import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitFeedback } from "./intake";
import { _rateLimitZuruecksetzen } from "./rate-limit";
import type { FeedbackConfig } from "./config";

const BASIS_CONFIG: FeedbackConfig = {
  repo: "drivenbysun/test-repo",
  appLabel: "app:test",
  token: "fake-token",
};

describe("submitFeedback -- Validierung vor jedem Netzwerkaufruf", () => {
  beforeEach(() => {
    _rateLimitZuruecksetzen();
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("fetch haette nicht aufgerufen werden duerfen"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lehnt Text unter der Mindestlaenge ab, ohne GitHub zu kontaktieren", async () => {
    const ergebnis = await submitFeedback(BASIS_CONFIG, { kind: "bug", text: "zu kurz" });
    expect(ergebnis).toEqual({ ok: false, error: "text too short (min 10 chars)" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("respektiert eine eigene minLength-Konfiguration", async () => {
    const ergebnis = await submitFeedback(
      { ...BASIS_CONFIG, minLength: 3 },
      { kind: "bug", text: "abc" },
    );
    // 3 Zeichen erfuellen minLength:3 -> kommt an der Validierung vorbei,
    // scheitert danach am (bewusst fehlschlagenden) fetch-Mock.
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.error).not.toContain("too short");
  });

  it("blockiert den zweiten Aufruf ueber dem Rate-Limit, ohne GitHub zu kontaktieren", async () => {
    const config: FeedbackConfig = { ...BASIS_CONFIG, rateLimit: { max: 1, windowMs: 60_000 } };
    const input = { kind: "bug" as const, text: "genug Zeichen fuer die Pruefung", rateLimitKey: "user-1" };

    // Erster Aufruf: kommt an der Rate-Limit-Pruefung vorbei, scheitert danach
    // am (bewusst fehlschlagenden) fetch-Mock -- ghRest faengt den Fehler
    // intern ab (wirft nie), submitFeedback ruft dabei MEHRERE fetch-Aufrufe
    // aus (Label sicherstellen, Issue anlegen, ...), daher kein exakter Zaehler.
    await submitFeedback(config, input);
    const aufrufeNachErstem = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(aufrufeNachErstem).toBeGreaterThan(0);

    // Zweiter Aufruf: Limit erreicht, fetch darf UEBERHAUPT NICHT mehr aufgerufen werden.
    const zweites = await submitFeedback(config, input);
    expect(zweites).toEqual({ ok: false, error: "rate limited" });
    expect(fetch).toHaveBeenCalledTimes(aufrufeNachErstem);
  });

  it("laesst ohne rateLimitKey/submitter.email unlimitiert durch (kein gemeinsamer Anonym-Topf)", async () => {
    const config: FeedbackConfig = { ...BASIS_CONFIG, rateLimit: { max: 1, windowMs: 60_000 } };
    const input = { kind: "bug" as const, text: "genug Zeichen fuer die Pruefung" };

    await submitFeedback(config, input);
    const aufrufeNachErstem = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await submitFeedback(config, input);
    // Zweiter Aufruf erreicht fetch GENAUSO wie der erste -- kein Schluessel, kein Limit.
    expect(fetch).toHaveBeenCalledTimes(aufrufeNachErstem * 2);
  });
});
