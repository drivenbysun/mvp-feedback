import { describe, expect, it } from "vitest";
import {
  boardColumns,
  calendarDay,
  countdown,
  createFormatter,
  daysUntil,
  draftToFeedbackText,
  findSimilar,
  goesToHotfixQueue,
  isoWeek,
  openQuestion,
  queryRequests,
  scopeCounts,
  timelineRange,
  toggleVote,
  validateAttachment,
  validateDraft,
  whatsNewEntries,
  type NewRequestDraft,
} from "./index";
import { DEMO_ME, DEMO_NOW, DEMO_RELEASES, DEMO_REQUESTS } from "./fixtures";

const TZ = "Europe/Berlin";
const byId = (id: number) => DEMO_REQUESTS.find((r) => r.id === id)!;
const en = createFormatter({ locale: "en", now: DEMO_NOW, timeZone: TZ });
const de = createFormatter({ locale: "de", now: DEMO_NOW, timeZone: TZ });

describe("Kalender", () => {
  it("reines Datum kippt in keiner Zeitzone auf den Vortag", () => {
    expect(calendarDay("2026-11-12", "Pacific/Honolulu")).toBe("2026-11-12");
    expect(calendarDay("2026-11-12", "Pacific/Kiritimati")).toBe("2026-11-12");
  });
  it("KW nach ISO 8601, auch am Jahreswechsel", () => {
    expect(isoWeek("2026-11-12", TZ)).toBe(46);
    expect(isoWeek("2026-12-10", TZ)).toBe(50);
    expect(isoWeek("2027-01-01", TZ)).toBe(53);
    expect(isoWeek("2025-12-29", TZ)).toBe(1);
  });
  it("Tage bis zum Termin zählen Kalendertage, nicht 24-h-Blöcke", () => {
    expect(daysUntil("2026-10-29", DEMO_NOW, TZ)).toBe(2);
    expect(daysUntil("2026-11-12", DEMO_NOW, TZ)).toBe(16);
    expect(daysUntil("2026-10-27", new Date("2026-10-27T23:30:00+01:00"), TZ)).toBe(0);
  });
});

describe("Ships with", () => {
  it("Release zeigt KW und Datum", () => {
    expect(en.shipsWith(byId(1041), DEMO_RELEASES)).toMatchObject({ label: "v2.14", sub: "KW 46 · Nov 12", hotfix: false });
    expect(de.shipsWith(byId(1041), DEMO_RELEASES).sub).toBe("KW 46 · 12. Nov.");
  });
  it("Hotfix zeigt Wochentag und Countdown", () => {
    expect(en.shipsWith(byId(1046), DEMO_RELEASES)).toMatchObject({ label: "v2.13.3", sub: "Thu, Oct 29 · in 2 days", hotfix: true });
  });
  it("nicht geplant, Dublette, live", () => {
    expect(en.shipsWith(byId(1049), DEMO_RELEASES)).toMatchObject({ label: "Not scheduled", sub: "Review within 2 days" });
    expect(en.shipsWith(byId(1030), DEMO_RELEASES)).toMatchObject({ label: "Duplicate", sub: "Merged into #1033" });
    expect(en.shipsWith(byId(1027), DEMO_RELEASES)).toMatchObject({ label: "v2.13.2", sub: "Live since Oct 20", hotfix: true });
  });
});

describe("Stepper", () => {
  it("in Arbeit: zwei erledigt, einer aktuell, einer offen", () => {
    const s = en.steps(byId(1041), DEMO_RELEASES);
    expect(s.map((x) => x.state)).toEqual(["done", "done", "current", "future"]);
    expect(s[1].sub).toBe("by Sarah K.");
    expect(s[3].sub).toBe("planned Nov 12");
  });
  it("abgelehnt ersetzt Angenommen", () => {
    const s = en.steps(byId(1030), DEMO_RELEASES);
    expect(s.map((x) => x.status)).toEqual(["submitted", "declined", "in_progress", "live"]);
    expect(s.map((x) => x.state)).toEqual(["done", "declined", "future", "future"]);
  });
  it("live: alles erledigt", () => {
    expect(en.steps(byId(1027), DEMO_RELEASES).every((x) => x.state === "done")).toBe(true);
  });
});

describe("Countdown", () => {
  it("Fortschritt ist der verstrichene Anteil seit Annahme", () => {
    const c = countdown(byId(1041), DEMO_RELEASES.find((r) => r.id === "v2.14")!, DEMO_NOW, TZ);
    expect(c.daysLeft).toBe(16);
    expect(c.progress).toBeCloseTo(11 / 27, 5);
  });
});

describe("Filtern und Zählen", () => {
  it("Zahlen der Unterreiter wie im Entwurf", () => {
    expect(scopeCounts(DEMO_REQUESTS, DEMO_ME)).toEqual({ mine: 8, public: 11, following: 3 });
  });
  it("Sortierung nach Stimmen und Typfilter", () => {
    const r = queryRequests(DEMO_REQUESTS, { scope: "public", type: "feature", sort: "votes" }, DEMO_ME);
    expect(r[0].id).toBe(1044);
    expect(r.every((x) => x.type === "feature")).toBe(true);
  });
  it("Board blendet Abgelehnte aus und zählt sie", () => {
    const b = boardColumns(queryRequests(DEMO_REQUESTS, { scope: "mine" }, DEMO_ME));
    expect(b.columns.map((c) => c.items.length)).toEqual([1, 2, 3, 1]);
    expect(b.declined).toHaveLength(1);
  });
  it("Stimme umschalten ist symmetrisch", () => {
    const r = byId(1041);
    expect(toggleVote(r)).toMatchObject({ votes: 30, votedByMe: false });
    expect(toggleVote(toggleVote(r))).toMatchObject({ votes: 31, votedByMe: true });
  });
});

describe("Rückfrage", () => {
  it("offen, bis der Einreicher antwortet", () => {
    expect(openQuestion(byId(1041))?.id).toBe("c4");
    const answered = { ...byId(1041), comments: [...byId(1041).comments, { id: "c5", author: DEMO_ME, at: "2026-10-27T08:00:00Z", text: "Chapter lead first." }] };
    expect(openQuestion(answered)).toBeUndefined();
  });
  it("Verlauf: Dublette mit übernommenen Stimmen, Rückfrage nicht doppelt", () => {
    const a = en.activity(byId(1041), DEMO_REQUESTS, DEMO_RELEASES, DEMO_ME);
    expect(a.some((e) => e.text === "#1018 “Order a new monitor” was merged into this request · 6 votes carried over")).toBe(true);
    expect(a.some((e) => e.comment?.id === "c4")).toBe(false);
    expect(a[a.length - 1].text).toBe("Submitted by you · Oct 14");
  });
});

describe("Dubletten-Vorschläge", () => {
  it("findet Treffer über Wortstamm, höchstens zwei", () => {
    expect(findSimilar("Map filter by group", DEMO_REQUESTS).map((r) => r.id)[0]).toBe(1046);
    expect(findSimilar("excel export", DEMO_REQUESTS).map((r) => r.id)).toEqual([1027]);
    expect(findSimilar("a b", DEMO_REQUESTS)).toEqual([]);
    expect(findSimilar("the and", DEMO_REQUESTS)).toEqual([]);
  });
});

describe("Neuer Request", () => {
  const draft: NewRequestDraft = {
    type: "bug",
    title: "Excel export shows names",
    description: "Names visible",
    expected: "Masked",
    severity: "blocks",
    isPublic: true,
    notify: true,
    attachments: [],
    context: { portal: "People", pagePath: "/team/people/map", environment: "Chrome 130" },
  };
  it("Pflichtfelder", () => {
    expect(validateDraft({ title: "ab", description: "" })).toEqual(["titleTooShort", "descriptionMissing"]);
    expect(validateDraft({ title: "abc", description: "x" })).toEqual([]);
  });
  it("Anhänge: Format und Größe", () => {
    expect(validateAttachment({ filename: "a.PNG", sizeBytes: 1 })).toBeNull();
    expect(validateAttachment({ filename: "a.exe", sizeBytes: 1 })).toBe("fileType");
    expect(validateAttachment({ filename: "a.pdf", sizeBytes: 10 * 1024 * 1024 + 1 })).toBe("fileSize");
  });
  it("blockierender Fehler geht in die Hotfix-Schlange", () => {
    expect(goesToHotfixQueue(draft)).toBe(true);
    expect(goesToHotfixQueue({ type: "feature", severity: "blocks" })).toBe(false);
  });
  it("Klartext für den bestehenden Intake", () => {
    const t = draftToFeedbackText(draft);
    expect(t.split("\n")[0]).toBe("Excel export shows names");
    expect(t).toContain("Expected: Masked");
    expect(t).toContain("Severity: blocks");
    expect(t).toContain("Page: /team/people/map");
    expect(t).not.toContain("Public:");
  });
});

describe("Release-Plan und Was ist neu", () => {
  it("Zeitstrahl umfasst alle Monate von Oktober bis Dezember", () => {
    const r = timelineRange(DEMO_RELEASES, DEMO_NOW, TZ);
    expect(r.from).toBe("2026-10-01");
    expect(r.to).toBe("2026-12-31");
    expect(r.months.map((m) => m.day)).toEqual(["2026-10-01", "2026-11-01", "2026-12-01"]);
    expect(r.months[0].position).toBe(0);
  });
  it("eigene Meldungen zuerst, dann hochgevotete", () => {
    const e = whatsNewEntries(DEMO_RELEASES[0], DEMO_REQUESTS, DEMO_ME);
    expect(e.map((x) => x.relation)).toEqual(["other", "other", "other"]);
    const voted = DEMO_REQUESTS.map((r) => (r.id === 1036 ? { ...r, votedByMe: true } : r));
    expect(whatsNewEntries(DEMO_RELEASES[0], voted, DEMO_ME)[0].note.requestId).toBe(1036);
    expect(whatsNewEntries(DEMO_RELEASES[1], DEMO_REQUESTS, DEMO_ME)[0].relation).toBe("reported");
  });
});
