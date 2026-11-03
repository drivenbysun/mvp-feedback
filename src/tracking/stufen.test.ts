import { describe, expect, it } from "vitest";
import { applyBoardStage, createFormatter, currentStage, trackingStageFromBoard, type TrackedRequest } from "./index";
import { createBoardStatusHandler } from "../board-status";
import { DEMO_ME, DEMO_NOW, DEMO_REQUESTS } from "./fixtures";

const de = createFormatter({ locale: "de", now: DEMO_NOW, timeZone: "Europe/Berlin" });
const basis: TrackedRequest = { ...DEMO_REQUESTS[0], createdAt: "2026-11-02T23:24:00Z", targetReleaseId: undefined, comments: [] };
const mit = (hist: TrackedRequest["statusHistory"]): TrackedRequest => ({
  ...basis,
  status: hist[hist.length - 1].status,
  statusHistory: [{ status: "submitted", at: "2026-11-02T23:24:00Z" }, ...hist],
});

describe("Stufe aus dem Board (A512)", () => {
  it("Code fertig nur mit verknüpftem PR, Auf DEV nur aus der Spalte", () => {
    expect(trackingStageFromBoard({ status: "In Progress", state: "OPEN" })).toBe("in_progress");
    expect(trackingStageFromBoard({ status: "In Progress", state: "OPEN", linkedPullRequests: [381] })).toBe("code_ready");
    expect(trackingStageFromBoard({ status: "Review (DEV)", state: "OPEN" })).toBe("on_dev");
    expect(trackingStageFromBoard({ status: "Review (DEV)", state: "OPEN", linkedPullRequests: [381] })).toBe("on_dev");
    expect(trackingStageFromBoard({ status: "Next", state: "OPEN", linkedPullRequests: [381] })).toBe("accepted");
    expect(trackingStageFromBoard({ status: "Done (PROD)", state: "CLOSED", stateReason: "COMPLETED" })).toBe("live");
  });
  it("Verlauf bekommt auch bei reinem Stufenwechsel einen Eintrag, sonst nicht", () => {
    const r = mit([{ status: "in_progress", at: "2026-11-03T09:30:00Z" }]);
    const a = applyBoardStage(r, "code_ready", "2026-11-04T14:12:00Z", { pr: 381 })!;
    expect(a.status).toBe("in_progress");
    expect(a.statusHistory.at(-1)).toEqual({ status: "in_progress", stage: "code_ready", pr: 381, at: "2026-11-04T14:12:00Z" });
    expect(applyBoardStage({ ...r, ...a }, "code_ready", "2026-11-04T14:17:00Z")).toBeNull();
    expect(applyBoardStage(r, "in_progress", "x")).toBeNull();
    const live = applyBoardStage({ ...r, ...a }, "live", "2026-11-05T10:00:00Z")!;
    expect(live.statusHistory.at(-1)).toEqual({ status: "live", at: "2026-11-05T10:00:00Z" });
  });
  it("aktuelle Stufe passt immer zum Status", () => {
    expect(currentStage(mit([{ status: "in_progress", stage: "on_dev", at: "x" }]))).toBe("on_dev");
    expect(currentStage({ status: "accepted", statusHistory: [{ status: "in_progress", stage: "on_dev", at: "x" }] })).toBe("accepted");
  });
  it("Handler gibt Stufe und PR weiter", async () => {
    let got: { stage: string; pr?: number }[] = [];
    const h = createBoardStatusHandler({ key: "k", apply: async (u) => void (got = u) });
    const res = await h(new Request("https://x", { method: "PUT", headers: { Authorization: "Bearer k" }, body: JSON.stringify({
      generatedAt: "2026-11-04T14:12:00Z",
      items: [{ number: 1, status: "In Progress", state: "OPEN", linkedPullRequests: [381, "x", -2] }, { number: 2, status: "Review (DEV)", state: "OPEN" }],
    }) }));
    expect(res.status).toBe(200);
    expect(got.map((u) => [u.stage, u.pr ?? null])).toEqual([["code_ready", 381], ["on_dev", null]]);
  });
});

describe("Leiste zeigt nur belegte Schritte", () => {
  it("voller Weg: sechs Schritte mit Uhrzeit, aktuell Auf DEV", () => {
    const r = mit([
      { status: "accepted", at: "2026-11-03T08:05:00Z", by: { id: "s", name: "Sarah K." } },
      { status: "in_progress", at: "2026-11-03T09:30:00Z" },
      { status: "in_progress", stage: "code_ready", pr: 381, at: "2026-11-04T14:12:00Z" },
      { status: "in_progress", stage: "on_dev", at: "2026-11-04T15:40:00Z" },
    ]);
    const s = de.steps(r, []);
    expect(s.map((x) => x.label)).toEqual(["Eingereicht", "Angenommen", "In Arbeit", "Code fertig", "Auf DEV", "Live"]);
    expect(s.map((x) => x.state)).toEqual(["done", "done", "done", "done", "current", "future"]);
    expect(s.map((x) => x.sub)).toEqual([
      "3. Nov., 00:24",
      "3. Nov., 09:05 · von Sarah K.",
      "3. Nov., 10:30",
      "4. Nov., 15:12 · PR #381",
      "4. Nov., 16:40 · zum Testen",
      "",
    ]);
  });
  it("direkt von Eingereicht auf Live: genau zwei Schritte", () => {
    const s = de.steps(mit([{ status: "live", at: "2026-11-01T09:12:00Z" }]), []);
    expect(s.map((x) => [x.label, x.state, x.sub])).toEqual([
      ["Eingereicht", "done", "3. Nov., 00:24"],
      ["Live", "done", "1. Nov., 10:12"],
    ]);
  });
  it("angenommen: kommende Schritte nur In Arbeit und Live, grau, ohne Datum", () => {
    const s = de.steps(mit([{ status: "accepted", at: "2026-11-03T08:05:00Z" }]), []);
    expect(s.map((x) => [x.label, x.state, x.sub])).toEqual([
      ["Eingereicht", "done", "3. Nov., 00:24"],
      ["Angenommen", "current", "3. Nov., 09:05"],
      ["In Arbeit", "future", ""],
      ["Live", "future", ""],
    ]);
  });
  it("übersprungenes In Arbeit erscheint nicht (Todo → Review (DEV))", () => {
    const s = de.steps(mit([{ status: "accepted", at: "2026-11-03T08:05:00Z" }, { status: "in_progress", stage: "on_dev", at: "2026-11-03T12:00:00Z" }]), []);
    expect(s.map((x) => x.label)).toEqual(["Eingereicht", "Angenommen", "Auf DEV", "Live"]);
  });
  it("zurückgeschoben: früher erreichte spätere Stufen werden wieder grau, Code fertig/Auf DEV verschwinden", () => {
    const s = de.steps(
      mit([
        { status: "in_progress", stage: "on_dev", at: "2026-11-03T12:00:00Z" },
        { status: "accepted", at: "2026-11-03T13:00:00Z" },
      ]),
      [],
    );
    expect(s.map((x) => [x.label, x.state])).toEqual([
      ["Eingereicht", "done"],
      ["Angenommen", "current"],
      ["In Arbeit", "future"],
      ["Live", "future"],
    ]);
  });
  it("Verlauf nennt Code fertig mit PR und Auf DEV", () => {
    const r = mit([
      { status: "in_progress", at: "2026-11-03T09:30:00Z" },
      { status: "in_progress", stage: "code_ready", pr: 381, at: "2026-11-04T14:12:00Z" },
      { status: "in_progress", stage: "on_dev", at: "2026-11-04T15:40:00Z" },
    ]);
    expect(de.activity(r, [], [], DEMO_ME, { hideOpenQuestion: false }).map((e) => e.text).slice(0, 3)).toEqual([
      "Auf DEV · 4. Nov., 16:40",
      "Code fertig · PR #381 · 4. Nov., 15:12",
      "Status geändert auf In Arbeit · 3. Nov., 10:30",
    ]);
  });
});
