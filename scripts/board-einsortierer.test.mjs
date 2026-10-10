import { describe, expect, it, vi } from "vitest";
import { KONFIG, ausfuehren, boardSchluesselFuer, lauf, mitWiederholung, planen } from "./board-einsortierer.mjs";

// Attrappe der GitHub-GraphQL-Schnittstelle. Merkt sich jede Schreib-Mutation.
function attrappe({ spalteBoard1 = false, issues, failSet = false, failDelete = false, boardItems = {} } = {}) {
  const schreib = [];
  const board = (nr) => ({
    id: `B${nr}`,
    title: nr === 1 ? "Magenta OS" : nr === 2 ? "MVP Factory" : "Staffing",
    field: {
      id: `F${nr}`,
      options: [
        { id: `${nr}-todo`, name: "Todo" },
        ...(nr === 1 && !spalteBoard1 ? [] : [{ id: `${nr}-ur`, name: "User Request" }]),
      ],
    },
  });
  const standard = {
    "ss-cowork-engineer/staffhub": [
      { id: "I1", number: 1, title: "BUG: neu", url: "u1", projectItems: { nodes: [] } },
      { id: "I2", number: 2, title: "schon da", url: "u2", projectItems: { nodes: [{ project: { id: "B2" } }] } },
      { id: "I3", number: 3, title: "auf fremdem Board", url: "u3", projectItems: { nodes: [{ project: { id: "B1" } }] } },
    ],
    "drivenbysun/agency-os": [{ id: "I4", number: 4, title: "FR: neu", url: "u4", projectItems: { nodes: [] } }],
    "ss-cowork-engineer/magenta-os": [{ id: "I5", number: 5, title: "magenta neu", url: "u5", labels: { nodes: [{ name: "app:magenta-os" }] }, projectItems: { nodes: [] } }],
  };
  const tabelle = issues ?? standard;

  const gql = vi.fn(async (query, vars) => {
    if (query.includes("items(first")) {
      const ids = boardItems[vars.n] ?? [];
      return { user: { projectV2: { items: { pageInfo: { hasNextPage: false }, nodes: ids.map((id) => ({ content: { id } })) } } } };
    }
    if (query.includes("projectV2(number")) return { user: { projectV2: board(vars.n) } };
    if (query.includes("repositoryOwner")) {
      const eig = vars.o;
      const nodes = Object.keys(tabelle)
        .filter((r) => r.startsWith(`${eig}/`))
        .map((r) => ({
          nameWithOwner: r,
          // unscharfer Treffer von GitHub: area:mobile zaehlt NICHT
          labels: { nodes: [{ name: "app:x" }, { name: "area:mobile" }] },
        }));
      // Dublette wie in der echten Liste
      return { repositoryOwner: { repositories: { pageInfo: { hasNextPage: false }, nodes: [...nodes, ...nodes] } } };
    }
    if (query.includes("issues(first")) {
      const repo = `${vars.o}/${vars.r}`;
      return { repository: { issues: { pageInfo: { hasNextPage: false }, nodes: tabelle[repo] ?? [] } } };
    }
    if (query.includes("addProjectV2ItemById")) {
      schreib.push(["add", vars.p, vars.c]);
      return { addProjectV2ItemById: { item: { id: `item-${vars.c}` } } };
    }
    if (query.includes("updateProjectV2ItemFieldValue")) {
      if (failSet) throw new Error("GraphQL: set kaputt");
      schreib.push(["set", vars.p, vars.i, vars.o]);
      return {};
    }
    if (query.includes("deleteProjectV2Item")) {
      if (failDelete) throw new Error("GraphQL: del kaputt");
      schreib.push(["del", vars.p, vars.i]);
      return {};
    }
    throw new Error(`unerwartete Abfrage: ${query.slice(0, 40)}`);
  });
  return { gql, schreib };
}

describe("boardSchluesselFuer", () => {
  it("app:magenta-os -> Board 1, alles andere -> Board 2", () => {
    expect(boardSchluesselFuer(["app:magenta-os"])).toBe("magenta");
    expect(boardSchluesselFuer(["type:bug", "app:magenta-os"])).toBe("magenta");
    expect(boardSchluesselFuer(["app:agency-os"])).toBe("fabrik");
    expect(boardSchluesselFuer(["app:staffhub"])).toBe("fabrik");
  });
});

describe("planen (nur lesen)", () => {
  it("findet app:*-Issues, dedupliziert Repos, erkennt Items, die schon auf einem Board liegen", async () => {
    const { gql, schreib } = attrappe();
    const plan = await planen(gql);
    const aktion = Object.fromEntries(plan.eintraege.map((e) => [`${e.repo}#${e.nummer}`, e.aktion]));
    expect(aktion).toEqual({
      "drivenbysun/agency-os#4": "sortieren",
      "ss-cowork-engineer/magenta-os#5": "spalte_fehlt", // Board 1 hat keine Spalte
      "ss-cowork-engineer/staffhub#1": "sortieren",
      "ss-cowork-engineer/staffhub#2": "schon_auf_board",
      "ss-cowork-engineer/staffhub#3": "schon_auf_board", // liegt auf Board 1 -> nie anfassen
    });
    expect(schreib).toEqual([]);
  });

  it("erkennt Items, die nur vom Board aus sichtbar sind (projectItems am Issue leer)", async () => {
    const { gql } = attrappe({ boardItems: { 2: ["I4"] } });
    const plan = await planen(gql);
    expect(plan.eintraege.find((e) => e.nummer === 4).aktion).toBe("schon_auf_board");
    const erg = await ausfuehren(gql, plan);
    expect(erg.sortiert.map((e) => e.nummer)).not.toContain(4);
  });

  it("filtert das unscharfe Label-Query strikt auf app:", async () => {
    const gql = vi.fn(async (query, vars) => {
      if (query.includes("items(first")) return { user: { projectV2: { items: { pageInfo: { hasNextPage: false }, nodes: [] } } } };
      if (query.includes("projectV2(number")) return { user: { projectV2: { id: `B${vars.n}`, title: "t", field: { id: "F", options: [{ id: "o", name: "User Request" }] } } } };
      if (query.includes("repositoryOwner"))
        return { repositoryOwner: { repositories: { pageInfo: { hasNextPage: false }, nodes: [{ nameWithOwner: "x/y", labels: { nodes: [{ name: "area:mobile" }] } }] } } };
      throw new Error("Issues duerfen nicht abgefragt werden");
    });
    const plan = await planen(gql);
    expect(plan.eintraege).toEqual([]);
  });

  it("bricht bei mehr Seiten als erlaubt ab statt zu raten", async () => {
    const gql = vi.fn(async (query, vars) => {
      if (query.includes("items(first")) return { user: { projectV2: { items: { pageInfo: { hasNextPage: false }, nodes: [] } } } };
      if (query.includes("projectV2(number")) return { user: { projectV2: { id: `B${vars.n}`, title: "t", field: { id: "F", options: [] } } } };
      return { repositoryOwner: { repositories: { pageInfo: { hasNextPage: true, endCursor: "c" }, nodes: [] } } };
    });
    await expect(planen(gql, { ...KONFIG, maxSeiten: 2 })).rejects.toThrow(/Obergrenze/);
  });
});

describe("ausfuehren (schreiben)", () => {
  it("sortiert in die Spalte User Request und fasst Vorhandenes nicht an", async () => {
    const { gql, schreib } = attrappe({ spalteBoard1: true });
    const plan = await planen(gql);
    const erg = await ausfuehren(gql, plan);
    expect(erg.fehler).toEqual([]);
    expect(erg.sortiert.map((e) => `${e.repo}#${e.nummer}`).sort()).toEqual([
      "drivenbysun/agency-os#4",
      "ss-cowork-engineer/magenta-os#5",
      "ss-cowork-engineer/staffhub#1",
    ]);
    // staffhub#2 und #3 (schon auf Board) tauchen in keiner Schreib-Mutation auf
    const angelegt = schreib.filter((s) => s[0] === "add").map((s) => s[2]);
    expect(angelegt.sort()).toEqual(["I1", "I4", "I5"]);
    // Spalte stimmt je Board
    expect(schreib).toContainEqual(["set", "B2", "item-I1", "2-ur"]);
    expect(schreib).toContainEqual(["set", "B1", "item-I5", "1-ur"]);
  });

  it("legt nichts an, wenn die Zielspalte fehlt (sonst faellt das Item nach Todo)", async () => {
    const { gql, schreib } = attrappe({ spalteBoard1: false });
    const plan = await planen(gql);
    const erg = await ausfuehren(gql, plan);
    expect(erg.fehler.map((f) => f.nummer)).toEqual([5]);
    expect(erg.fehler[0].grund).toMatch(/keine Spalte/);
    expect(schreib.filter((s) => s[2] === "I5")).toEqual([]);
  });

  it("zweiter Lauf ist ein No-op (idempotent)", async () => {
    const { gql } = attrappe();
    const plan = await planen(gql);
    const erster = await ausfuehren(gql, plan);
    expect(erster.sortiert.length).toBe(2);
    // Zustand nach dem ersten Lauf: dieselben Issues liegen jetzt auf Boards
    const nachher = attrappe({
      issues: {
        "ss-cowork-engineer/staffhub": [{ id: "I1", number: 1, title: "x", url: "u", projectItems: { nodes: [{ project: { id: "B2" } }] } }],
        "drivenbysun/agency-os": [{ id: "I4", number: 4, title: "y", url: "u", projectItems: { nodes: [{ project: { id: "B2" } }] } }],
      },
    });
    const plan2 = await planen(nachher.gql);
    const zweiter = await ausfuehren(nachher.gql, plan2);
    expect(zweiter.sortiert).toEqual([]);
    expect(nachher.schreib).toEqual([]);
  });

  it("baut das Item wieder aus, wenn das Setzen der Spalte scheitert", async () => {
    const { gql, schreib } = attrappe({ failSet: true, spalteBoard1: true });
    const plan = await planen(gql);
    const erg = await ausfuehren(gql, plan);
    expect(erg.sortiert).toEqual([]);
    expect(erg.fehler.length).toBe(3);
    expect(erg.fehler[0].grund).toMatch(/wieder entfernt/);
    expect(schreib.filter((s) => s[0] === "del").length).toBe(3);
  });

  it("meldet laut, wenn auch der Rueckbau scheitert", async () => {
    const { gql } = attrappe({ failSet: true, failDelete: true, spalteBoard1: true });
    const plan = await planen(gql);
    const erg = await ausfuehren(gql, plan);
    expect(erg.fehler[0].grund).toMatch(/OHNE Spalte/);
  });

  it("haelt die Obergrenze je Lauf ein", async () => {
    const { gql, schreib } = attrappe();
    const plan = await planen(gql);
    const erg = await ausfuehren(gql, plan, { ...KONFIG, maxProLauf: 1 });
    expect(schreib.filter((s) => s[0] === "add").length).toBe(1);
    expect(erg.uebersprungen.length).toBe(1);
  });

  it("haelt die Laufzeit-Obergrenze ein", async () => {
    const { gql, schreib } = attrappe();
    const plan = await planen(gql);
    let t = 0;
    const erg = await ausfuehren(gql, plan, KONFIG, { jetzt: () => (t += 1_000_000), start: 0 });
    expect(schreib).toEqual([]);
    expect(erg.uebersprungen.every((u) => /Laufzeit/.test(u.grund))).toBe(true);
  });
});

describe("mitWiederholung", () => {
  const ohnePause = async () => {};

  it("wiederholt einen leeren Body (gh: unexpected end of JSON input) und liefert dann das Ergebnis", async () => {
    const roh = vi.fn().mockRejectedValueOnce(new Error("gh Exit 1: unexpected end of JSON input")).mockResolvedValueOnce({ ok: 1 });
    const pause = vi.fn(ohnePause);
    expect(await mitWiederholung(roh, KONFIG, pause)({ q: 1 })).toEqual({ ok: 1 });
    expect(roh).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledWith(3000);
  });

  it("wiederholt 502, 504 und Zeitlimit, gibt aber nach der Obergrenze je Lauf auf", async () => {
    const roh = vi.fn(async () => {
      throw new Error("gh Exit 1: HTTP 504");
    });
    const gql = mitWiederholung(roh, { ...KONFIG, wiederholungenProLauf: 2 }, ohnePause);
    await expect(gql()).rejects.toThrow("504");
    expect(roh).toHaveBeenCalledTimes(3);
    // Die Obergrenze gilt fuer den ganzen Lauf, nicht je Aufruf.
    await expect(gql()).rejects.toThrow("504");
    expect(roh).toHaveBeenCalledTimes(4);
  });

  it("wiederholt GraphQL-Fehlerobjekte nicht (kaputte Abfrage ist kein Netzproblem)", async () => {
    const roh = vi.fn(async () => {
      throw new Error("GraphQL: [{...}]");
    });
    await expect(mitWiederholung(roh, KONFIG, ohnePause)()).rejects.toThrow("GraphQL");
    expect(roh).toHaveBeenCalledTimes(1);
  });
});

describe("lauf (Alarm)", () => {
  const stumm = () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    return () => {
      log.mockRestore();
      err.mockRestore();
    };
  };
  const pause = async () => {};
  const zustandMit = (zustand = "ok", folge = 0) => ({ lesen: () => ({ zustand, folge }), schreiben: vi.fn() });
  const kaputt = (text = "gh Exit 1: unexpected end of JSON input") =>
    vi.fn(async () => {
      throw new Error(text);
    });

  it("Trockenlauf schreibt nichts und alarmiert nicht", async () => {
    const { gql, schreib } = attrappe({ spalteBoard1: true });
    const alarmFn = vi.fn();
    const z = zustandMit();
    const aus = stumm();
    const r = await lauf({ scharf: false, json: false }, { gql, alarmFn, zustand: z, pause });
    aus();
    expect(schreib).toEqual([]);
    expect(alarmFn).not.toHaveBeenCalled();
    expect(z.schreiben).not.toHaveBeenCalled();
    expect(r.exit).toBe(0);
  });

  it("einzelner Fehlschlag (leeres JSON) alarmiert NICHT, zaehlt aber mit", async () => {
    const alarmFn = vi.fn();
    const z = zustandMit("ok", 0);
    const aus = stumm();
    const r = await lauf({ scharf: true, json: false }, { gql: kaputt(), alarmFn, zustand: z, pause });
    aus();
    expect(r.exit).toBe(1);
    expect(alarmFn).not.toHaveBeenCalled();
    expect(z.schreiben).toHaveBeenCalledWith({ zustand: "ok", folge: 1 });
  });

  it("zweiter Fehlschlag in Folge alarmiert ebenfalls noch nicht", async () => {
    const alarmFn = vi.fn();
    const z = zustandMit("ok", 1);
    const aus = stumm();
    await lauf({ scharf: true, json: false }, { gql: kaputt(), alarmFn, zustand: z, pause });
    aus();
    expect(alarmFn).not.toHaveBeenCalled();
    expect(z.schreiben).toHaveBeenCalledWith({ zustand: "ok", folge: 2 });
  });

  it("dritter Fehlschlag in Folge alarmiert gelb, nicht rot", async () => {
    const alarmFn = vi.fn();
    const z = zustandMit("ok", 2);
    const aus = stumm();
    await lauf({ scharf: true, json: false }, { gql: kaputt(), alarmFn, zustand: z, pause });
    aus();
    expect(alarmFn).toHaveBeenCalledWith("gelb", expect.any(String), expect.stringContaining("unexpected end of JSON input"));
    expect(z.schreiben).toHaveBeenCalledWith({ zustand: "gelb", folge: 3 });
  });

  it("heilt es sich nicht, wird es nach sechs Laeufen in Folge rot", async () => {
    const alarmFn = vi.fn();
    const z = zustandMit("gelb", 5);
    const aus = stumm();
    await lauf({ scharf: true, json: false }, { gql: kaputt("gh Exit 4: auth"), alarmFn, zustand: z, pause });
    aus();
    expect(alarmFn).toHaveBeenCalledWith("rot", expect.any(String), expect.stringContaining("gh Exit 4"));
    expect(z.schreiben).toHaveBeenCalledWith({ zustand: "rot", folge: 6 });
  });

  it("ein einmaliger leerer Body mitten im Lauf wird wiederholt und ist gar kein Fehler", async () => {
    const { gql: echt } = attrappe({ spalteBoard1: true });
    let erster = true;
    const gql = vi.fn(async (...a) => {
      if (erster) {
        erster = false;
        throw new Error("gh Exit 1: unexpected end of JSON input");
      }
      return echt(...a);
    });
    const alarmFn = vi.fn();
    const z = zustandMit("ok", 2);
    const aus = stumm();
    const r = await lauf({ scharf: true, json: false }, { gql, alarmFn, zustand: z, pause });
    aus();
    expect(r.exit).toBe(0);
    expect(alarmFn).not.toHaveBeenCalled();
    expect(z.schreiben).toHaveBeenCalledWith({ zustand: "ok", folge: 0 });
  });

  it("Fehler beim Einsortieren eines Issues zaehlt wie jeder Fehlschlag (kein sofortiges Rot mehr)", async () => {
    const { gql } = attrappe({ failSet: true });
    const alarmFn = vi.fn();
    const z = zustandMit("ok", 2);
    const aus = stumm();
    const r = await lauf({ scharf: true, json: false }, { gql, alarmFn, zustand: z, pause });
    aus();
    expect(r.exit).toBe(1);
    expect(alarmFn).toHaveBeenCalledWith("gelb", expect.any(String), expect.stringContaining("staffhub#1"));
  });

  it("schliesst den Alarm mit gruen, wenn es nach gelb oder rot wieder laeuft", async () => {
    for (const stufe of ["gelb", "rot"]) {
      const { gql } = attrappe({ spalteBoard1: true });
      const alarmFn = vi.fn();
      const z = zustandMit(stufe, 7);
      const aus = stumm();
      const r = await lauf({ scharf: true, json: false }, { gql, alarmFn, zustand: z, pause });
      aus();
      expect(r.exit).toBe(0);
      expect(alarmFn).toHaveBeenCalledWith("gruen", expect.any(String), expect.any(String));
      expect(z.schreiben).toHaveBeenCalledWith({ zustand: "ok", folge: 0 });
    }
  });

  it("gruen ohne vorherigen Alarm gibt es nicht (nach 1-2 stillen Fehlschlaegen nur Zaehler zurueck)", async () => {
    const { gql } = attrappe({ spalteBoard1: true });
    const alarmFn = vi.fn();
    const z = zustandMit("ok", 2);
    const aus = stumm();
    await lauf({ scharf: true, json: false }, { gql, alarmFn, zustand: z, pause });
    aus();
    expect(alarmFn).not.toHaveBeenCalled();
    expect(z.schreiben).toHaveBeenCalledWith({ zustand: "ok", folge: 0 });
  });

  it("unauffaelliger Lauf schreibt keinen Zustand", async () => {
    const { gql } = attrappe({ spalteBoard1: true });
    const z = zustandMit("ok", 0);
    const aus = stumm();
    await lauf({ scharf: true, json: false }, { gql, alarmFn: vi.fn(), zustand: z, pause });
    aus();
    expect(z.schreiben).not.toHaveBeenCalled();
  });
});
