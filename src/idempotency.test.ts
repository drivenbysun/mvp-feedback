import { describe, it, expect, beforeEach, vi } from "vitest";
import { einmalProSchluessel, _idempotenzZuruecksetzen } from "./idempotency";
import { submitFeedback } from "./intake";
import { idempotencyKeyFromFormData } from "./form-data";
import { _rateLimitZuruecksetzen } from "./rate-limit";

beforeEach(() => {
  _idempotenzZuruecksetzen();
  _rateLimitZuruecksetzen();
  vi.restoreAllMocks();
});

describe("einmalProSchluessel", () => {
  it("fuehrt bei gleichzeitigen Aufrufen mit gleichem Schluessel nur einmal aus", async () => {
    const lauf = vi.fn(async () => ({ ok: true, n: 1 }));
    const [a, b] = await Promise.all([einmalProSchluessel("k1", lauf), einmalProSchluessel("k1", lauf)]);
    expect(lauf).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it("gibt nach Erfolg das erste Ergebnis zurueck", async () => {
    const lauf = vi.fn(async () => ({ ok: true }));
    await einmalProSchluessel("k1", lauf);
    await einmalProSchluessel("k1", lauf);
    expect(lauf).toHaveBeenCalledTimes(1);
  });

  it("erlaubt Wiederholen nach einem Fehler", async () => {
    const lauf = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
    expect((await einmalProSchluessel("k1", lauf)).ok).toBe(false);
    expect((await einmalProSchluessel("k1", lauf)).ok).toBe(true);
    expect(lauf).toHaveBeenCalledTimes(2);
  });

  it("erlaubt Wiederholen, wenn der Lauf wirft", async () => {
    const lauf = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce({ ok: true });
    await expect(einmalProSchluessel("k1", lauf)).rejects.toThrow("x");
    expect((await einmalProSchluessel("k1", lauf)).ok).toBe(true);
  });

  it("trennt verschiedene Schluessel und laesst ohne Schluessel alles durch", async () => {
    const lauf = vi.fn(async () => ({ ok: true }));
    await einmalProSchluessel("a", lauf);
    await einmalProSchluessel("b", lauf);
    await einmalProSchluessel(undefined, lauf);
    await einmalProSchluessel(undefined, lauf);
    expect(lauf).toHaveBeenCalledTimes(4);
  });

  it("vergisst erfolgreiche Schluessel nach der Haltezeit", async () => {
    const lauf = vi.fn(async () => ({ ok: true }));
    await einmalProSchluessel("k1", lauf, 0);
    await einmalProSchluessel("k1", lauf, 11 * 60_000);
    expect(lauf).toHaveBeenCalledTimes(2);
  });
});

describe("submitFeedback mit idempotencyKey", () => {
  it("legt bei doppeltem Absenden nur einmal an (nur ein Satz GitHub-Aufrufe)", async () => {
    const config = { repo: "o/r", appLabel: "app:t", token: "t" };
    const input = { kind: "bug" as const, text: "genug Zeichen fuer die Pruefung", idempotencyKey: "abc" };
    vi.spyOn(global, "fetch").mockImplementation(async () => new Response(JSON.stringify({ number: 1, html_url: "u", node_id: "n" }), { status: 201 }));
    const [a, b] = await Promise.all([submitFeedback(config, input), submitFeedback(config, input)]);
    const nachZweien = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await submitFeedback(config, input);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(nachZweien);
    expect(a.ok).toBe(true);
    expect(b).toEqual(a);
  });
});

describe("idempotencyKeyFromFormData", () => {
  it("liest und kuerzt den Schluessel, leer = undefined", () => {
    const fd = new FormData();
    expect(idempotencyKeyFromFormData(fd)).toBeUndefined();
    fd.set("idempotencyKey", "  abc ");
    expect(idempotencyKeyFromFormData(fd)).toBe("abc");
    fd.set("idempotencyKey", "x".repeat(300));
    expect(idempotencyKeyFromFormData(fd)?.length).toBe(100);
  });
});
