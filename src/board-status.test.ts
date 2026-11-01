import { describe, expect, it, vi } from "vitest";
import { createBoardStatusHandler, parseBoardStatusPayload } from "./board-status";
import { applyBoardStatus, createFormatter, trackingStatusFromBoard } from "./tracking";
import { DEMO_NOW, DEMO_REQUESTS } from "./tracking/fixtures";

describe("Spalte + Zustand → Status (E469)", () => {
  it.each([
    ["User Request", "submitted"],
    ["Next", "accepted"],
    ["Someday", "accepted"],
    ["In Progress", "in_progress"],
    ["Review (DEV)", "in_progress"],
    ["Review (TEST)", "in_progress"],
    ["Done (PROD)", "live"],
  ] as const)("offen in %s → %s", (status, erwartet) => {
    expect(trackingStatusFromBoard({ status, state: "OPEN" })).toBe(erwartet);
  });
  it("geschlossen: erledigt → live, nicht geplant/Dublette → abgelehnt", () => {
    expect(trackingStatusFromBoard({ status: "In Progress", state: "CLOSED", stateReason: "COMPLETED" })).toBe("live");
    expect(trackingStatusFromBoard({ status: null, state: "CLOSED", stateReason: null })).toBe("live");
    expect(trackingStatusFromBoard({ status: "Next", state: "CLOSED", stateReason: "NOT_PLANNED" })).toBe("declined");
    expect(trackingStatusFromBoard({ status: "User Request", state: "CLOSED", stateReason: "DUPLICATE" })).toBe("declined");
  });
  it("unbekannte oder fehlende Spalte ändert nichts", () => {
    expect(trackingStatusFromBoard({ status: "Backlog", state: "OPEN" })).toBeNull();
    expect(trackingStatusFromBoard({ status: null })).toBeNull();
    expect(trackingStatusFromBoard({ status: "constructor" })).toBeNull();
  });
  it("Verlauf nur bei echter Änderung", () => {
    const r = { status: "submitted" as const, statusHistory: [{ status: "submitted" as const, at: "2026-10-31" }] };
    expect(applyBoardStatus(r, "submitted", "2026-11-01T10:00:00Z")).toBeNull();
    expect(applyBoardStatus(r, "accepted", "2026-11-01T10:00:00Z")).toEqual({
      status: "accepted",
      statusHistory: [...r.statusHistory, { status: "accepted", at: "2026-11-01T10:00:00Z" }],
    });
  });
  it("Angenommen ohne Release zeigt „Ohne Termin“", () => {
    const de = createFormatter({ locale: "de", now: DEMO_NOW });
    const r = { ...DEMO_REQUESTS[0], status: "accepted" as const, targetReleaseId: undefined };
    expect(de.shipsWith(r, [])).toMatchObject({ label: "Ohne Termin", sub: "" });
  });
});

describe("Payload prüfen", () => {
  const gut = { generatedAt: "2026-11-01T10:00:00.000Z", items: [{ number: 355, status: "Next", state: "OPEN", title: "x", labels: [], body: "y" }] };
  it("nimmt den Job-Stand an, ignoriert Zusatzfelder", () => {
    const p = parseBoardStatusPayload(gut);
    expect(p.ok && p.payload.items[0]).toMatchObject({ number: 355, status: "Next", state: "OPEN", stateReason: null });
  });
  it.each([
    [{ ...gut, generatedAt: "gestern" }],
    [{ ...gut, items: [{ number: -1, status: "Next" }] }],
    [{ ...gut, items: [{ number: 1, status: "Next", state: "WEG" }] }],
    [{ ...gut, items: [{ number: 1, status: "Next", stateReason: "LAUNE" }] }],
    [{ ...gut, items: "x" }],
    [null],
  ])("weist kaputte Form ab", (j) => {
    expect(parseBoardStatusPayload(j).ok).toBe(false);
  });
});

describe("Handler", () => {
  const put = (body: unknown, key = "geheim") =>
    new Request("https://x/api/board-status", { method: "PUT", headers: { Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
  const payload = {
    generatedAt: "2026-11-01T10:00:00Z",
    items: [
      { number: 1, status: "Next", state: "OPEN" },
      { number: 2, status: "Backlog", state: "OPEN" },
      { number: 3, status: "Next", state: "CLOSED", stateReason: "NOT_PLANNED" },
    ],
  };
  it("ohne Schlüssel 503, falscher 401, nichts geschrieben", async () => {
    const apply = vi.fn();
    expect((await createBoardStatusHandler({ key: undefined, apply })(put(payload))).status).toBe(503);
    expect((await createBoardStatusHandler({ key: "geheim", apply })(put(payload, "falsch"))).status).toBe(401);
    expect((await createBoardStatusHandler({ key: "geheim", apply })(put(payload, "geheimX"))).status).toBe(401);
    expect(apply).not.toHaveBeenCalled();
  });
  it("älterer Stand 409", async () => {
    const apply = vi.fn();
    const h = createBoardStatusHandler({ key: "geheim", apply, lastGeneratedAt: async () => "2026-11-01T10:00:00Z" });
    expect((await h(put(payload))).status).toBe(409);
    expect(apply).not.toHaveBeenCalled();
  });
  it("reicht nur ableitbare Einträge weiter", async () => {
    const apply = vi.fn(async (_u: { issueNumber: number; status: string }[]) => 2);
    const res = await createBoardStatusHandler({ key: () => "geheim", apply })(put(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, received: 3, mapped: 2, changed: 2 });
    expect(apply.mock.calls[0]![0].map((u) => [u.issueNumber, u.status])).toEqual([
      [1, "accepted"],
      [3, "declined"],
    ]);
  });
  it("kaputtes JSON 400", async () => {
    const req = new Request("https://x", { method: "PUT", headers: { Authorization: "Bearer geheim" }, body: "{" });
    expect((await createBoardStatusHandler({ key: "geheim", apply: vi.fn() })(req)).status).toBe(400);
  });
});
