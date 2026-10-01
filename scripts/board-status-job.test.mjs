import { describe, expect, it, vi } from "vitest";
import { KONFIG, boardLesen, fuerStage, lauf, moveAusfuehren } from "./board-status-job.mjs";

// WICHTIG: Attrappen, keine echten Stages. Die HTTP-Formen folgen magenta-os #1976 (Entwurf);
// sobald DEV die Endpunkte hat, muss ein Lauf gegen DEV diese Annahmen bestaetigen.

const LABEL = [{ name: "app:magenta-os", color: "00ff00" }];
function knoten(id, nr, status, { labels = LABEL, state = "OPEN" } = {}) {
  return {
    id,
    content: { number: nr, title: `Karte ${nr}`, url: `https://github.com/x/y/issues/${nr}`, state, updatedAt: `2026-10-0${(nr % 9) + 1}T00:00:00Z`, labels: { nodes: labels } },
    status: status ? { name: status } : null,
  };
}
const OPTIONEN = ["Someday", "New", "Todo", "In Progress", "Review (DEV)", "Review (TEST)", "Done (PROD)"].map((n) => ({ id: `opt-${n}`, name: n }));

function boardAttrappe(items, { seiten = 1 } = {}) {
  const schreib = [];
  const gql = vi.fn(async (query, vars) => {
    if (query.includes("updateProjectV2ItemFieldValue")) {
      schreib.push({ item: vars.i, option: vars.o });
      return {};
    }
    const alle = items;
    const pro = Math.ceil(alle.length / seiten) || 1;
    const start = vars.c ? Number(vars.c) : 0;
    const nodes = alle.slice(start, start + pro);
    const weiter = start + pro < alle.length;
    return { user: { projectV2: { id: "B1", field: { id: "F1", options: OPTIONEN }, items: { pageInfo: { hasNextPage: weiter, endCursor: String(start + pro) }, nodes } } } };
  });
  return { gql, schreib };
}

function stageAttrappe({ putStatus = 200, getStatus = 200, moves = [], resultStatus = 200 } = {}) {
  const aufrufe = [];
  const fetchFn = vi.fn(async (url, init) => {
    aufrufe.push({ url, methode: init.method, auth: init.headers.Authorization, body: init.body ? JSON.parse(init.body) : undefined });
    const pfad = new URL(url).pathname;
    const antwort = (status, json) => ({ status, json: async () => json });
    if (pfad === "/api/board-status") return antwort(putStatus, { ok: putStatus === 200 });
    if (pfad === "/api/board-moves" && init.method === "GET") return antwort(getStatus, moves);
    if (pfad.endsWith("/result")) return antwort(resultStatus, { ok: true });
    return antwort(404, {});
  });
  return { fetchFn, aufrufe };
}

function umgebung(extra = {}) {
  const zustand = { daten: {}, lesen() { return this.daten; }, schreiben(z) { this.daten = z; } };
  return { alarmFn: vi.fn(), zustand, schluessel: (s) => `KEY-${s}`, log: vi.fn(), ...extra };
}

describe("boardLesen / fuerStage", () => {
  it("nimmt nur Karten mit app:magenta-os und liest ueber mehrere Seiten", async () => {
    const items = [
      knoten("a", 1, "Todo"),
      knoten("b", 2, "Review (DEV)", { labels: [{ name: "type:bug", color: "f00" }] }),
      knoten("c", 3, "Done (PROD)", { state: "CLOSED" }),
      { id: "d", content: {}, status: null }, // Draft/PR ohne Issue-Inhalt
    ];
    const { gql } = boardAttrappe(items, { seiten: 2 });
    const b = await boardLesen(gql);
    expect(b.items.map((i) => i.number)).toEqual([1, 3]);
    expect(b.items[1].status).toBe("Done (PROD)");
    expect(b.optionen["Review (TEST)"]).toBe("opt-Review (TEST)");
  });

  it("bricht bei zu vielen Seiten ab statt zu raten", async () => {
    const gql = vi.fn(async () => ({ user: { projectV2: { id: "B1", field: { id: "F", options: [] }, items: { pageInfo: { hasNextPage: true, endCursor: "x" }, nodes: [] } } } }));
    await expect(boardLesen(gql, { ...KONFIG, maxItemSeiten: 3 })).rejects.toThrow(/mehr als 3 Seiten/);
  });

  it("kappt auf 2000: Erledigtes zuerst, Rest nach Aktualitaet", () => {
    const mk = (n, status) => ({ itemId: `i${n}`, number: n, title: "t", url: "u", status, labels: [], updatedAt: `2026-01-01T00:00:${String(n % 60).padStart(2, "0")}Z` });
    const items = [mk(1, "Done (PROD)"), mk(2, "Done (PROD)"), mk(3, "Todo"), mk(4, "Todo")];
    const r = fuerStage(items, { ...KONFIG, maxItems: 3 });
    expect(r.gekappt).toBe(1);
    expect(r.items.map((i) => i.number)).toContain(3);
    expect(r.items.map((i) => i.number)).toContain(4);
    expect(r.items.every((i) => !("itemId" in i))).toBe(true); // itemId entfaellt laut Spec
  });
});

describe("moveAusfuehren", () => {
  const board = () => ({
    projectId: "B1", statusFeldId: "F1", optionen: Object.fromEntries(OPTIONEN.map((o) => [o.name, o.id])),
    items: [
      { itemId: "iA", number: 10, status: "Review (DEV)" },
      { itemId: "iB", number: 11, status: "Review (TEST)" },
      { itemId: "iC", number: 12, status: "Todo" },
      { itemId: "iD", number: 13, status: "Review (TEST)" },
    ],
  });

  it("DEV -> Review (TEST) und TEST -> Done (PROD)", async () => {
    const { gql, schreib } = boardAttrappe([]);
    const b = board();
    expect(await moveAusfuehren(gql, b, { id: "1", issueNumber: 10, toStatus: "Review (TEST)" })).toEqual({ ok: true });
    expect(await moveAusfuehren(gql, b, { id: "2", issueNumber: 11, toStatus: "Done (PROD)" })).toEqual({ ok: true });
    expect(schreib).toEqual([{ item: "iA", option: "opt-Review (TEST)" }, { item: "iB", option: "opt-Done (PROD)" }]);
  });

  it("ist idempotent: steht die Karte schon im Ziel, ok ohne zweite Verschiebung", async () => {
    const { gql, schreib } = boardAttrappe([]);
    const b = board();
    await moveAusfuehren(gql, b, { id: "1", issueNumber: 10, toStatus: "Review (TEST)" });
    const zweit = await moveAusfuehren(gql, b, { id: "1", issueNumber: 10, toStatus: "Review (TEST)" });
    expect(zweit).toEqual({ ok: true, schonDa: true });
    expect(schreib.length).toBe(1);
  });

  it("verschiebt nicht, wenn die Karte nicht mehr im Ausgangsstatus steht", async () => {
    const { gql, schreib } = boardAttrappe([]);
    const r = await moveAusfuehren(gql, board(), { id: "1", issueNumber: 12, toStatus: "Review (TEST)" });
    expect(r).toEqual({ ok: false, error: "status changed" });
    expect(schreib).toEqual([]);
  });

  it("nutzt fromStatus aus dem Auftrag, falls MAGENTA es mitliefert", async () => {
    const { gql } = boardAttrappe([]);
    const r = await moveAusfuehren(gql, board(), { id: "1", issueNumber: 13, toStatus: "Done (PROD)", fromStatus: "Review (DEV)" });
    expect(r).toEqual({ ok: false, error: "status changed" });
  });

  it("unbekannte oder nicht erlaubte Spalte geht als Fehler zurueck, kein stilles Skip", async () => {
    const { gql, schreib } = boardAttrappe([]);
    for (const ziel of ["Gibt es nicht", "Todo", "Someday"]) {
      const r = await moveAusfuehren(gql, board(), { id: "1", issueNumber: 10, toStatus: ziel });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/unbekannte Spalte/);
    }
    expect(schreib).toEqual([]);
  });

  it("Karte ausserhalb Board 1 / ohne Label -> Fehler", async () => {
    const { gql } = boardAttrappe([]);
    const r = await moveAusfuehren(gql, board(), { id: "1", issueNumber: 999, toStatus: "Review (TEST)" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/nicht auf Board 1/);
  });
});

describe("lauf", () => {
  const items = [knoten("a", 1, "Review (DEV)"), knoten("b", 2, "Todo")];

  it("ohne --stages passiert nichts (nichts live)", async () => {
    const { gql } = boardAttrappe(items);
    const { fetchFn } = stageAttrappe();
    const r = await lauf({ stages: [] }, { ...umgebung(), gql, fetchFn });
    expect(r.exit).toBe(0);
    expect(gql).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("Trockenlauf liest nur das Board, sendet nichts", async () => {
    const { gql, schreib } = boardAttrappe(items);
    const { fetchFn } = stageAttrappe();
    const r = await lauf({ stages: ["dev"], trocken: true }, { ...umgebung(), gql, fetchFn });
    expect(r.exit).toBe(0);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(schreib).toEqual([]);
  });

  it("sendet je Stage den Stand mit dem Schluessel DIESER Stage, Schluessel nie im Body", async () => {
    const { gql } = boardAttrappe(items);
    const { fetchFn, aufrufe } = stageAttrappe();
    await lauf({ stages: ["dev", "test"], nurLesen: true }, { ...umgebung(), gql, fetchFn });
    const puts = aufrufe.filter((a) => a.methode === "PUT");
    expect(puts.map((p) => [new URL(p.url).host, p.auth])).toEqual([
      ["magenta-os-dev.mhub.one", "Bearer KEY-dev"],
      ["magenta-os-test.mhub.one", "Bearer KEY-test"],
    ]);
    expect(puts[0].body.items.map((i) => i.number)).toEqual([1, 2]);
    expect(JSON.stringify(puts[0].body)).not.toContain("KEY-");
    expect(typeof puts[0].body.generatedAt).toBe("string");
  });

  it("bearbeitet Auftraege und meldet das Ergebnis zurueck (Erfolg und Ablehnung)", async () => {
    const { gql, schreib } = boardAttrappe(items);
    const moves = [
      { id: "m1", issueNumber: 1, toStatus: "Review (TEST)", requestedAt: "x" },
      { id: "m2", issueNumber: 2, toStatus: "Spalte X", requestedAt: "x" },
    ];
    const { fetchFn, aufrufe } = stageAttrappe({ moves });
    const env = umgebung();
    const r = await lauf({ stages: ["dev"], nurSchreiben: true }, { ...env, gql, fetchFn });
    expect(schreib.length).toBe(1);
    const results = aufrufe.filter((a) => a.url.endsWith("/result"));
    expect(results.map((x) => [x.url.split("/").slice(-2)[0], x.body.ok])).toEqual([["m1", true], ["m2", false]]);
    expect(results[1].body.error).toMatch(/unbekannte Spalte/);
    // Ablehnung = fachliches Ergebnis, geht an die App zurueck, kein Jobfehler, kein Alarm
    expect(r.exit).toBe(0);
    expect(r.ergebnisse.dev.schreiben.abgelehnt.length).toBe(1);
    expect(env.alarmFn).not.toHaveBeenCalled();
  });

  it("GitHub-Fehler beim Verschieben: Auftrag bleibt offen (kein result), Alarm", async () => {
    const gql = vi.fn(async (query, vars) => {
      if (query.includes("updateProjectV2ItemFieldValue")) throw new Error("GraphQL: kaputt");
      return boardAttrappe(items).gql(query, vars);
    });
    const { fetchFn, aufrufe } = stageAttrappe({ moves: [{ id: "m1", issueNumber: 1, toStatus: "Review (TEST)" }] });
    const env = umgebung();
    const r = await lauf({ stages: ["dev"], nurSchreiben: true }, { ...env, gql, fetchFn });
    expect(aufrufe.filter((a) => a.url.endsWith("/result"))).toEqual([]);
    expect(r.exit).toBe(1);
    expect(env.alarmFn).toHaveBeenCalledWith("rot", expect.stringContaining("dev"), expect.stringContaining("m1"), "board-status-job-dev");
  });

  it("Endpunkt fehlt / Schluessel falsch: Fehler, Alarm genau einmal beim Wechsel, gruen beim Genesen", async () => {
    const { gql } = boardAttrappe(items);
    const env = umgebung();
    const kaputt = stageAttrappe({ putStatus: 401 });
    await lauf({ stages: ["dev"], nurLesen: true }, { ...env, gql, fetchFn: kaputt.fetchFn });
    await lauf({ stages: ["dev"], nurLesen: true }, { ...env, gql, fetchFn: kaputt.fetchFn });
    expect(env.alarmFn).toHaveBeenCalledTimes(1);
    expect(env.alarmFn.mock.calls[0][2]).toMatch(/Schluessel falsch/);
    const heil = stageAttrappe();
    const r = await lauf({ stages: ["dev"], nurLesen: true }, { ...env, gql, fetchFn: heil.fetchFn });
    expect(r.exit).toBe(0);
    expect(env.alarmFn).toHaveBeenCalledTimes(2);
    expect(env.alarmFn.mock.calls[1][0]).toBe("gruen");
  });

  it("409 (Stage hat neueren Stand) ist kein Fehler", async () => {
    const { gql } = boardAttrappe(items);
    const { fetchFn } = stageAttrappe({ putStatus: 409 });
    const env = umgebung();
    const r = await lauf({ stages: ["dev"], nurLesen: true }, { ...env, gql, fetchFn });
    expect(r.exit).toBe(0);
    expect(env.alarmFn).not.toHaveBeenCalled();
  });

  it("fehlende Schluesseldatei einer Stage trifft nur diese Stage", async () => {
    const { gql } = boardAttrappe(items);
    const { fetchFn, aufrufe } = stageAttrappe();
    const env = umgebung({
      schluessel: (s) => {
        if (s === "test") throw new Error("ENOENT");
        return `KEY-${s}`;
      },
    });
    const r = await lauf({ stages: ["dev", "test"], nurLesen: true }, { ...env, gql, fetchFn });
    expect(aufrufe.filter((a) => a.methode === "PUT").length).toBe(1);
    expect(r.ergebnisse.test.fehler).toMatch(/test: ENOENT/);
    expect(r.ergebnisse.dev.fehler).toBeUndefined();
  });

  it("Board nicht lesbar: alle gewaehlten Stages melden Fehler, nichts wird gesendet", async () => {
    const gql = vi.fn(async () => {
      throw new Error("gh Exit 4");
    });
    const { fetchFn } = stageAttrappe();
    const env = umgebung();
    const r = await lauf({ stages: ["dev", "test"] }, { ...env, gql, fetchFn });
    expect(r.exit).toBe(1);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(env.alarmFn).toHaveBeenCalledTimes(2);
  });

  it("unbekannte Stage wird abgelehnt", async () => {
    await expect(lauf({ stages: ["staging"] }, umgebung())).rejects.toThrow(/unbekannte Stage/);
  });
});
