import { describe, expect, it, vi } from "vitest";
import { KONFIG, boardLesen, fuerStage, lauf, moveAusfuehren } from "./board-status-job.mjs";

// WICHTIG: Attrappen, keine echten Stages. Die HTTP-Formen folgen magenta-os #1976 (Entwurf);
// sobald DEV die Endpunkte hat, muss ein Lauf gegen DEV diese Annahmen bestaetigen.

const LABEL = [{ name: "app:magenta-os", color: "00ff00" }];
function knoten(id, nr, status, { labels = LABEL, state = "OPEN", repo = "ss-cowork-engineer/magenta-os" } = {}) {
  return {
    id,
    content: { number: nr, title: `Karte ${nr}`, url: `https://github.com/${repo}/issues/${nr}`, state, repository: { nameWithOwner: repo }, updatedAt: `2026-10-0${(nr % 9) + 1}T00:00:00Z`, labels: { nodes: labels } },
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

// Alarm sofort (1) und ohne Wartezeit zwischen Leseversuchen: die Alarm-Verzoegerung wird in eigenen Tests geprueft.
const SCHNELL = { ...KONFIG, leseWartenMs: 0, alarmNachFehlern: 1 };

function umgebung(extra = {}) {
  const zustand = { daten: {}, lesen() { return this.daten; }, schreiben(z) { this.daten = z; } };
  return { alarmFn: vi.fn(), zustand, schluessel: (s) => `KEY-${s}`, log: vi.fn(), konfig: SCHNELL, ...extra };
}

describe("boardLesen / fuerStage", () => {
  it("nimmt nur Karten aus magenta-os mit app:magenta-os, nicht andere Repos", async () => {
    const { gql } = boardAttrappe([knoten("a", 1, "Todo"), knoten("x", 2, "Todo", { repo: "drivenbysun/agency-os" })]);
    expect((await boardLesen(gql)).items.map((i) => i.number)).toEqual([1]);
  });

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
    const mk = (n, status) => ({ itemId: `i${n}`, number: n, title: "t", url: `https://github.com/ss-cowork-engineer/magenta-os/issues/${n}`, status, labels: [], updatedAt: `2026-01-01T00:00:${String(n % 60).padStart(2, "0")}Z` });
    const items = [mk(1, "Done (PROD)"), mk(2, "Done (PROD)"), mk(3, "Todo"), mk(4, "Todo")];
    const r = fuerStage(items, { ...KONFIG, maxItems: 3 });
    expect(r.gekappt).toBe(1);
    expect(r.items.map((i) => i.number)).toContain(3);
    expect(r.items.map((i) => i.number)).toContain(4);
    expect(r.items.every((i) => !("itemId" in i))).toBe(true); // itemId entfaellt laut Spec
  });
});

describe("fuerStage: Form der App", () => {
  const gut = (n = 1) => ({ number: n, title: "t", url: `https://github.com/ss-cowork-engineer/magenta-os/issues/${n}`, status: "Todo", labels: [{ name: "app:magenta-os", color: "0e8a16" }], updatedAt: "" });

  it("laesst Items ohne gueltige URL, Farbe oder Status aus und schickt den Rest", () => {
    const items = [
      gut(1),
      { ...gut(2), url: "https://github.com/anderer/repo/issues/2" },
      { ...gut(3), url: "https://github.com/ss-cowork-engineer/magenta-os/issues/3/../../x" },
      { ...gut(4), labels: [{ name: "x", color: "f00" }] },
      { ...gut(5), status: null },
    ];
    const r = fuerStage(items);
    expect(r.items.map((i) => i.number)).toEqual([1]);
    expect(r.verworfen).toBe(4);
  });

  it("laesst Status ausserhalb der App-Liste aus, dedupliziert Nummern und kappt Labels auf 20", () => {
    const viele = Array.from({ length: 30 }, (_, i) => ({ name: `l${i}`, color: "ffffff" }));
    const r = fuerStage([gut(1), { ...gut(2), status: "Spalte X" }, gut(1), { ...gut(3), labels: viele }, { ...gut(4), title: "" }]);
    expect(r.items.map((i) => i.number)).toEqual([1, 3]);
    expect(r.items[1].labels).toHaveLength(20);
    expect(r.verworfen).toBe(3);
  });

  it("schickt body nur fuer Review (DEV)/(TEST), auf 4000 gekuerzt", () => {
    const r = fuerStage([
      { ...gut(1), status: "Review (DEV)", body: "b".repeat(9000) },
      { ...gut(2), status: "Review (TEST)", body: "kurz" },
      { ...gut(3), status: "Todo", body: "geheim" },
      { ...gut(4), status: "Done (PROD)", body: "alt" },
      { ...gut(5), status: "Review (DEV)", body: "" },
    ]).items;
    expect(r[0].body).toHaveLength(4000);
    expect(r[1].body).toBe("kurz");
    expect(r.slice(2).every((i) => !("body" in i))).toBe(true);
  });

  it("kuerzt title auf 300 und label.name auf 100 Zeichen", () => {
    const [i] = fuerStage([{ ...gut(1), title: "x".repeat(500), labels: [{ name: "y".repeat(200), color: "ffffff" }] }]).items;
    expect(i.title).toHaveLength(300);
    expect(i.labels[0].name).toHaveLength(100);
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

  it("dev: nur Review (DEV) -> Review (TEST); test: nur Review (TEST) -> Done (PROD)", async () => {
    const { gql, schreib } = boardAttrappe([]);
    const b = board();
    expect(await moveAusfuehren(gql, b, { id: "1", issueNumber: 10, toStatus: "Review (TEST)" }, "dev")).toEqual({ ok: true });
    expect(await moveAusfuehren(gql, b, { id: "2", issueNumber: 11, toStatus: "Done (PROD)" }, "test")).toEqual({ ok: true });
    expect(schreib).toEqual([{ item: "iA", option: "opt-Review (TEST)" }, { item: "iB", option: "opt-Done (PROD)" }]);
  });

  it("kreuzweise und prod: abgelehnt, nichts bewegt", async () => {
    const { gql, schreib } = boardAttrappe([]);
    const b = board();
    const faelle = [
      ["dev", { id: "1", issueNumber: 11, toStatus: "Done (PROD)" }],
      ["test", { id: "2", issueNumber: 10, toStatus: "Review (TEST)" }],
      ["prod", { id: "3", issueNumber: 11, toStatus: "Done (PROD)" }],
      ["prod", { id: "4", issueNumber: 10, toStatus: "Review (TEST)" }],
      ["staging", { id: "5", issueNumber: 10, toStatus: "Review (TEST)" }],
      ["dev", { id: "6", issueNumber: 10, toStatus: "__proto__" }],
      ["dev", { id: "7", issueNumber: "10; DROP", toStatus: "Review (TEST)" }],
    ];
    for (const [stage, move] of faelle) expect((await moveAusfuehren(gql, b, move, stage)).ok).toBe(false);
    expect(schreib).toEqual([]);
  });

  it("ist idempotent: steht die Karte schon im Ziel, ok ohne zweite Verschiebung", async () => {
    const { gql, schreib } = boardAttrappe([]);
    const b = board();
    await moveAusfuehren(gql, b, { id: "1", issueNumber: 10, toStatus: "Review (TEST)" }, "dev");
    const zweit = await moveAusfuehren(gql, b, { id: "1", issueNumber: 10, toStatus: "Review (TEST)" }, "dev");
    expect(zweit).toEqual({ ok: true, schonDa: true });
    expect(schreib.length).toBe(1);
  });

  it("verschiebt nicht, wenn die Karte nicht mehr im Ausgangsstatus steht", async () => {
    const { gql, schreib } = boardAttrappe([]);
    const r = await moveAusfuehren(gql, board(), { id: "1", issueNumber: 12, toStatus: "Review (TEST)" }, "dev");
    expect(r).toEqual({ ok: false, error: "status changed" });
    expect(schreib).toEqual([]);
  });

  it("ein fromStatus der App, das von der Erlaubnisliste abweicht, macht den Auftrag ungueltig", async () => {
    const { gql, schreib } = boardAttrappe([]);
    const r = await moveAusfuehren(gql, board(), { id: "1", issueNumber: 13, toStatus: "Done (PROD)", fromStatus: "Review (DEV)" }, "test");
    expect(schreib).toEqual([]);
    expect(r).toEqual({ ok: false, error: "status changed" });
  });

  it("unbekannte oder nicht erlaubte Spalte geht als Fehler zurueck, kein stilles Skip", async () => {
    const { gql, schreib } = boardAttrappe([]);
    for (const ziel of ["Gibt es nicht", "Todo", "Someday"]) {
      const r = await moveAusfuehren(gql, board(), { id: "1", issueNumber: 10, toStatus: ziel }, "dev");
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/nicht erlaubt/);
    }
    expect(schreib).toEqual([]);
  });

  it("Karte ausserhalb Board 1 / ohne Label -> Fehler", async () => {
    const { gql } = boardAttrappe([]);
    const r = await moveAusfuehren(gql, board(), { id: "1", issueNumber: 999, toStatus: "Review (TEST)" }, "dev");
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
    expect(results[1].body.error).toMatch(/nicht erlaubt/);
    // Ablehnung = fachliches Ergebnis, geht an die App zurueck, kein Jobfehler, kein Alarm
    expect(r.exit).toBe(0);
    expect(r.ergebnisse.dev.schreiben.abgelehnt.length).toBe(1);
    expect(env.alarmFn).not.toHaveBeenCalled();
  });

  it("Ergebnis 409 (App hat den Auftrag schon abgeschlossen) ist kein Jobfehler", async () => {
    const { gql } = boardAttrappe(items);
    const { fetchFn } = stageAttrappe({ moves: [{ id: "m1", issueNumber: 1, fromStatus: "Review (DEV)", toStatus: "Review (TEST)" }], resultStatus: 409 });
    const env = umgebung();
    const r = await lauf({ stages: ["dev"], nurSchreiben: true }, { ...env, gql, fetchFn });
    expect(r.exit).toBe(0);
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

  it("Weiterleitungen werden nie gefolgt und jede Stage hat ihren eigenen Host (Schluessel bleibt bei seiner Stage)", async () => {
    const { gql } = boardAttrappe(items);
    const optionen = [];
    const fetchFn = vi.fn(async (url, init) => {
      optionen.push(init.redirect);
      return { status: 200, json: async () => [] };
    });
    await lauf({ stages: ["dev", "test", "prod"] }, { ...umgebung(), gql, fetchFn });
    expect(optionen.length).toBeGreaterThan(0);
    expect(optionen.every((o) => o === "error")).toBe(true);
    const hosts = Object.values(KONFIG.stages).map((u) => new URL(u).host);
    expect(new Set(hosts).size).toBe(3);
    expect(Object.values(KONFIG.stages).every((u) => u.startsWith("https://"))).toBe(true);
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

  it("Board lesen: haengt eine Seite einmal, wiederholt der Job sie mit 20 s Limit und der Lauf gelingt", async () => {
    const echt = boardAttrappe(items);
    let erster = true;
    const gql = vi.fn(async (query, vars, opt) => {
      if (erster) {
        erster = false;
        throw new Error("gh: Zeitlimit 20s");
      }
      return echt.gql(query, vars, opt);
    });
    const { fetchFn } = stageAttrappe();
    const env = umgebung();
    const r = await lauf({ stages: ["dev"], nurLesen: true }, { ...env, gql, fetchFn });
    expect(r.exit).toBe(0);
    expect(env.alarmFn).not.toHaveBeenCalled();
    expect(gql.mock.calls.every((a) => a[2]?.aufrufSekunden === 20)).toBe(true);
  });

  it("Board lesen: nach dem dritten Fehlversuch ist es ein Fehler (genau drei Versuche je Seite)", async () => {
    const gql = vi.fn(async () => {
      throw new Error("gh: Zeitlimit 20s");
    });
    await expect(boardLesen(gql, SCHNELL)).rejects.toThrow(/Zeitlimit/);
    expect(gql).toHaveBeenCalledTimes(3);
  });

  it("Board lesen: ist die Gesamtfrist abgelaufen, gibt es keinen weiteren Versuch", async () => {
    const gql = vi.fn(async () => {
      throw new Error("gh: Zeitlimit 20s");
    });
    await expect(boardLesen(gql, { ...SCHNELL, leseGesamtSekunden: -1 })).rejects.toThrow(/Zeitlimit/);
    expect(gql).toHaveBeenCalledTimes(1);
  });

  it("Alarm erst nach 3 Fehllaeufen in Folge, ein Erfolg setzt den Zaehler zurueck, Entwarnung nur nach Alarm", async () => {
    const { gql } = boardAttrappe(items);
    const kaputt = stageAttrappe({ putStatus: 500 });
    const heil = stageAttrappe();
    const konfig = { ...SCHNELL, alarmNachFehlern: 3 };
    const env = umgebung({ konfig });
    const los = (f) => lauf({ stages: ["dev"], nurLesen: true }, { ...env, gql, fetchFn: f.fetchFn });
    await los(kaputt);
    await los(kaputt);
    expect(env.alarmFn).not.toHaveBeenCalled();
    await los(heil);
    expect(env.alarmFn).not.toHaveBeenCalled();
    expect(env.zustand.daten.folge.dev).toBe(0);
    await los(kaputt);
    await los(kaputt);
    expect(env.alarmFn).not.toHaveBeenCalled();
    await los(kaputt);
    expect(env.alarmFn).toHaveBeenCalledTimes(1);
    expect(env.alarmFn.mock.calls[0][0]).toBe("rot");
    expect(env.alarmFn.mock.calls[0][2]).toMatch(/3 Laeufe in Folge/);
    await los(kaputt);
    expect(env.alarmFn).toHaveBeenCalledTimes(1);
    await los(heil);
    expect(env.alarmFn).toHaveBeenCalledTimes(2);
    expect(env.alarmFn.mock.calls[1][0]).toBe("gruen");
  });

  it("Alarm-Zaehler laeuft je Stage getrennt", async () => {
    const { gql } = boardAttrappe(items);
    const env = umgebung({ konfig: { ...SCHNELL, alarmNachFehlern: 2 } });
    const fetchFn = vi.fn(async (url) => ({ status: url.includes("-dev.") ? 500 : 200, json: async () => ({ ok: !url.includes("-dev.") }) }));
    await lauf({ stages: ["dev", "test"], nurLesen: true }, { ...env, gql, fetchFn });
    await lauf({ stages: ["dev", "test"], nurLesen: true }, { ...env, gql, fetchFn });
    expect(env.alarmFn).toHaveBeenCalledTimes(1);
    expect(env.alarmFn.mock.calls[0][3]).toBe("board-status-job-dev");
  });

  it("label: null liest alle Issues des Repos, mit Label nur die markierten", async () => {
    const { gql } = boardAttrappe(items);
    const alle = await boardLesen(gql, { ...SCHNELL, label: null });
    const markiert = await boardLesen(gql, SCHNELL);
    expect(alle.items.length).toBeGreaterThanOrEqual(markiert.items.length);
    expect(alle.items.every((i) => typeof i.number === "number")).toBe(true);
  });

  it("unbekannte Stage wird abgelehnt", async () => {
    await expect(lauf({ stages: ["staging"] }, umgebung())).rejects.toThrow(/unbekannte Stage/);
  });
});
