#!/usr/bin/env node
// Board-Status-Job fuer magenta-os (Schnittstelle: magenta-os #1976, Teil b).
// Laeuft auf dem Mac mini mit dem gh-Login des Servers; die Stages brauchen
// dadurch keinen GitHub-Token mehr, nur einen eigenen BOARD_STATUS_KEY je Stage.
//
//   node scripts/board-status-job.mjs --stages dev,test    (ohne --stages: nichts live)
//   --nur-lesen / --nur-schreiben                           einen Teil auslassen
//   --trocken                                               Board lesen, NICHTS senden/verschieben
//
// Lesen:     alle app:magenta-os-Issues von Board 1 -> PUT {stage}/api/board-status
// Schreiben: GET {stage}/api/board-moves -> Karte verschieben -> POST .../result
// Schluessel: ~/.fabrik/keys/board-status-key-<stage>.txt (600). Nie loggen, nie im Alarmtext.

import { readFileSync, mkdirSync, writeFileSync, statSync, truncateSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ghGraphql, alarm as alarmSenden } from "./board-einsortierer.mjs";

export const KONFIG = {
  eigentuemer: "ss-cowork-engineer",
  boardNummer: 1,
  label: "app:magenta-os",
  repo: "ss-cowork-engineer/magenta-os",
  stages: {
    dev: "https://magenta-os-dev.mhub.one",
    test: "https://magenta-os-test.mhub.one",
    prod: "https://magenta-os.mhub.one",
  },
  schluesselDatei: (stage) => join(homedir(), `.fabrik/keys/board-status-key-${stage}.txt`),
  maxItems: 2000,
  maxItemSeiten: 30,
  maxMovesProStage: 50,
  httpSekunden: 20,
  gesamtSekunden: 200,
  // Board lesen: eine Seite braucht ~2 s. Ein haengender gh-Aufruf kommt nicht mehr zurueck (gemessen: 60 s und 60 s
  // hintereinander, minutenlang haengende gh-Prozesse) -- kurzes Limit + mehrere frische Versuche statt langem Warten.
  leseAufrufSekunden: 20,
  leseVersuche: 3,
  leseWartenMs: 3000,
  leseGesamtSekunden: 150,
  // Alarm erst, wenn ein Stage so oft hintereinander fehlschlaegt (5-Minuten-Takt: ~15 Minuten).
  alarmNachFehlern: 3,
  // Je Stage genau ein Uebergang (Ziel -> erforderlicher Ausgangsstatus); prod: keiner.
  // Die Auftraege stammen aus der Datenbank der App und gelten fuer den Job als nicht vertrauenswuerdig.
  erlaubteSpruenge: {
    dev: { "Review (TEST)": "Review (DEV)" },
    test: { "Done (PROD)": "Review (TEST)" },
    prod: {},
  },
};

const Q_BOARD = `query($o:String!,$n:Int!,$c:String){ user(login:$o){ projectV2(number:$n){ id
  field(name:"Status"){ ... on ProjectV2SingleSelectField { id options{ id name } } }
  items(first:100, after:$c){ pageInfo{ hasNextPage endCursor } nodes{ id
    content{ ... on Issue{ number title body url state updatedAt repository{ nameWithOwner } labels(first:30){ nodes{ name color } } } }
    status: fieldValueByName(name:"Status"){ ... on ProjectV2ItemFieldSingleSelectValue{ name } } } } } } }`;
const M_SET = `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ projectV2Item{ id } } }`;

// ── Board lesen ──────────────────────────────────────────────────────────────
async function seiteLesen(gql, vars, konfig, frist) {
  let letzter;
  for (let v = 1; v <= konfig.leseVersuche; v++) {
    if (v > 1 && Date.now() > frist) break;
    try {
      return await gql(Q_BOARD, vars, { aufrufSekunden: konfig.leseAufrufSekunden });
    } catch (e) {
      letzter = e;
      if (v < konfig.leseVersuche && konfig.leseWartenMs) await new Promise((r) => setTimeout(r, konfig.leseWartenMs));
    }
  }
  throw letzter;
}

export async function boardLesen(gql, konfig = KONFIG) {
  let projekt = null;
  const knoten = [];
  let cursor = null;
  const frist = Date.now() + konfig.leseGesamtSekunden * 1000;
  for (let i = 0; i < konfig.maxItemSeiten; i++) {
    const d = await seiteLesen(gql, { o: konfig.eigentuemer, n: konfig.boardNummer, c: cursor }, konfig, frist);
    const p = d?.user?.projectV2;
    if (!p?.id) throw new Error(`Board ${konfig.boardNummer} nicht lesbar`);
    projekt ??= p;
    knoten.push(...(p.items?.nodes ?? []));
    if (!p.items?.pageInfo?.hasNextPage) {
      const items = [];
      for (const k of knoten) {
        const c = k.content;
        const labels = (c?.labels?.nodes ?? []).map((l) => ({ name: l.name, color: l.color }));
        if (!c?.number || c.repository?.nameWithOwner !== konfig.repo || (konfig.label && !labels.some((l) => l.name === konfig.label))) continue;
        items.push({
          itemId: k.id, number: c.number, title: c.title, body: c.body ?? "", url: c.url, status: k.status?.name ?? null,
          labels, updatedAt: c.updatedAt ?? "",
        });
      }
      return {
        projectId: projekt.id,
        statusFeldId: projekt.field?.id ?? null,
        optionen: Object.fromEntries((projekt.field?.options ?? []).map((o) => [o.name, o.id])),
        items,
      };
    }
    cursor = p.items.pageInfo.endCursor;
  }
  throw new Error(`Board hat mehr als ${konfig.maxItemSeiten} Seiten -- nichts geraten`);
}

// Form der App (400 sonst, ein schlechtes Item kippt den ganzen Push): Item bereinigen oder auslassen.
const STATUS_SPALTEN = ["User Request", "New", "Next", "Todo", "In Progress", "Review (DEV)", "Review (TEST)", "Done (PROD)", "Someday"];
const BODY_SPALTEN = ["Review (DEV)", "Review (TEST)"];
const ISSUE_URL = (repo) => new RegExp(`^https://github\\.com/${repo.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}/issues/\\d+$`);
export function itemFuerApp(it, konfig = KONFIG) {
  if (!Number.isInteger(it.number) || it.number <= 0) return null;
  if (!STATUS_SPALTEN.includes(it.status)) return null;
  if (typeof it.url !== "string" || it.url.length > 200 || !ISSUE_URL(konfig.repo).test(it.url)) return null;
  if (typeof it.title !== "string" || !it.title) return null;
  const labels = [];
  for (const l of (it.labels ?? []).slice(0, 20)) {
    if (typeof l.name !== "string" || !/^[0-9a-fA-F]{6}$/.test(l.color ?? "")) return null;
    labels.push({ name: l.name.slice(0, 100), color: l.color });
  }
  const out = { number: it.number, title: it.title.slice(0, 300), status: it.status, url: it.url, labels };
  // Abnahme-Ansicht zeigt den Volltext: nur fuer die Review-Spalten, auf 4000 gekuerzt (App weist mehr mit 400 ab).
  if (BODY_SPALTEN.includes(it.status) && typeof it.body === "string" && it.body) out.body = it.body.slice(0, 4000);
  return out;
}

// Obergrenze der App: 2000 Items. Erledigtes faellt zuerst raus, dann das Aelteste.
export function fuerStage(items, konfig = KONFIG) {
  const gueltig = [];
  const gesehen = new Set();
  let verworfen = 0;
  for (const it of items) {
    const k = itemFuerApp(it, konfig);
    if (k && !gesehen.has(k.number)) {
      gesehen.add(k.number);
      gueltig.push({ ...k, updatedAt: it.updatedAt ?? "" });
    } else verworfen++;
  }
  const ohneZeit = ({ updatedAt, ...rest }) => rest;
  if (gueltig.length <= konfig.maxItems) return { items: gueltig.map(ohneZeit), gekappt: 0, verworfen };
  const rang = (it) => (it.status === "Done (PROD)" ? 0 : 1);
  const sortiert = [...gueltig].sort((a, b) => rang(b) - rang(a) || b.updatedAt.localeCompare(a.updatedAt));
  const behalten = sortiert.slice(0, konfig.maxItems);
  return { items: behalten.map(ohneZeit), gekappt: gueltig.length - behalten.length, verworfen };
}

// ── HTTP gegen eine Stage ────────────────────────────────────────────────────
export async function stageAufruf(fetchFn, basis, pfad, methode, schluessel, body, konfig = KONFIG) {
  const res = await fetchFn(basis + pfad, {
    method: methode,
    headers: { Authorization: `Bearer ${schluessel}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(konfig.httpSekunden * 1000),
    // Nie Weiterleitungen folgen: der Bearer-Schluessel darf nur an die Basis-URL genau dieser Stage gehen.
    redirect: "error",
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* Antwort ohne JSON */
  }
  return { status: res.status, json };
}

// ── Lesen: Stand an eine Stage schieben ──────────────────────────────────────
export async function standSenden(fetchFn, stage, basis, schluessel, board, konfig = KONFIG) {
  const { items, gekappt, verworfen } = fuerStage(board.items, konfig);
  const r = await stageAufruf(fetchFn, basis, "/api/board-status", "PUT", schluessel, { generatedAt: new Date().toISOString(), items }, konfig);
  // 409: die Stage hat einen neueren Stand -- kein Fehler, nichts zurueckdrehen.
  if (r.status === 200 || r.status === 409) return { ok: true, status: r.status, anzahl: items.length, gekappt, verworfen };
  const hinweis = { 401: "Schluessel falsch", 503: "Schluessel auf der Stage nicht gesetzt", 404: "Endpunkt fehlt", 400: "Schema abgelehnt" }[r.status] ?? "unerwartet";
  return { ok: false, status: r.status, fehler: `${stage}: PUT /api/board-status -> ${r.status} (${hinweis})` };
}

// ── Schreiben: Auftraege abarbeiten ──────────────────────────────────────────
export async function moveAusfuehren(gql, board, move, stage, konfig = KONFIG) {
  const nummer = Number(move.issueNumber);
  const ziel = move.toStatus;
  const erlaubt = konfig.erlaubteSpruenge[stage] ?? {};
  if (!Number.isInteger(nummer) || nummer <= 0) return { ok: false, error: "ungueltige Issue-Nummer" };
  if (!Object.hasOwn(erlaubt, ziel) || !board.optionen[ziel]) return { ok: false, error: `Uebergang auf ${stage} nicht erlaubt: ${String(ziel).slice(0, 60)}` };
  // Ausgangsstatus kommt aus der Erlaubnisliste; ein abweichendes fromStatus der App macht den Auftrag ungueltig.
  const erlaubterStart = erlaubt[ziel];
  if (move.fromStatus !== undefined && move.fromStatus !== erlaubterStart) return { ok: false, error: "status changed" };
  const item = board.items.find((i) => i.number === nummer);
  if (!item) return { ok: false, error: `Karte #${nummer} nicht auf Board 1 in ${konfig.repo}${konfig.label ? ` mit ${konfig.label}` : ""}` };
  if (item.status === ziel) return { ok: true, schonDa: true }; // idempotent
  if (item.status !== erlaubterStart) return { ok: false, error: "status changed" };
  await gql(M_SET, { p: board.projectId, i: item.itemId, f: board.statusFeldId, o: board.optionen[ziel] });
  item.status = ziel;
  return { ok: true };
}

export async function schreibenFuerStage(fetchFn, gql, stage, basis, schluessel, board, konfig = KONFIG) {
  const g = await stageAufruf(fetchFn, basis, "/api/board-moves", "GET", schluessel, undefined, konfig);
  if (g.status !== 200) return { ok: false, fehler: `${stage}: GET /api/board-moves -> ${g.status}`, bearbeitet: 0 };
  const liste = Array.isArray(g.json) ? g.json : (g.json?.moves ?? g.json?.items ?? []);
  let bearbeitet = 0;
  const fehler = [];
  const abgelehnt = [];
  for (const move of liste.slice(0, konfig.maxMovesProStage)) {
    let ergebnis;
    try {
      ergebnis = await moveAusfuehren(gql, board, move, stage, konfig);
    } catch (e) {
      // GitHub-Fehler: Auftrag bleibt offen (pending) und wird im naechsten Lauf erneut versucht.
      fehler.push(`${stage}: Auftrag ${move.id} (#${move.issueNumber}): ${String(e.message ?? e).slice(0, 120)}`);
      continue;
    }
    // Eine Ablehnung ist ein fachliches Ergebnis (geht an die App zurueck), kein Jobfehler -> kein Alarm.
    if (!ergebnis.ok) abgelehnt.push(`${move.id} (#${move.issueNumber}): ${ergebnis.error}`);
    const body = ergebnis.ok ? { ok: true } : { ok: false, error: ergebnis.error };
    const p = await stageAufruf(fetchFn, basis, `/api/board-moves/${encodeURIComponent(move.id)}/result`, "POST", schluessel, body, konfig);
    // 409 = App hat den Auftrag schon abgeschlossen, 404 = unbekannt: beides kein Jobfehler.
    if (p.status !== 200 && p.status !== 409 && p.status !== 404) fehler.push(`${stage}: Ergebnis fuer ${move.id} nicht angenommen (${p.status})`);
    bearbeitet++;
  }
  return { ok: fehler.length === 0, fehler: fehler.join(" | "), bearbeitet, abgelehnt };
}

// ── Zustand + Alarm je Stage ─────────────────────────────────────────────────
const ZUSTAND = join(homedir(), ".fabrik/zustand/board-status-job.json");
export const zustandDatei = {
  lesen() {
    try {
      return JSON.parse(readFileSync(ZUSTAND, "utf8"));
    } catch {
      return {};
    }
  },
  schreiben(z) {
    mkdirSync(dirname(ZUSTAND), { recursive: true });
    writeFileSync(ZUSTAND, JSON.stringify(z));
  },
};

export function schluesselLesen(stage, konfig = KONFIG) {
  const datei = konfig.schluesselDatei(stage);
  const st = statSync(datei);
  if (st.mode & 0o077) throw new Error(`Schluesseldatei ${stage} ist fuer andere lesbar (Rechte muessen 600 sein)`);
  const wert = readFileSync(datei, "utf8").trim();
  if (!wert) throw new Error(`Schluesseldatei ${stage} ist leer`);
  return wert;
}

// ── Lauf ─────────────────────────────────────────────────────────────────────
export async function lauf(opt, deps = {}) {
  const {
    gql = ghGraphql, fetchFn = fetch, konfig = KONFIG, alarmFn = alarmSenden, zustand = zustandDatei,
    schluessel = (s) => schluesselLesen(s, konfig), log = console.log,
  } = deps;
  const stages = opt.stages ?? [];
  if (!stages.length) {
    log("Keine Stage gewaehlt (--stages dev,test,prod): nichts zu tun.");
    return { exit: 0, ergebnisse: {} };
  }
  const unbekannt = stages.filter((s) => !konfig.stages[s]);
  if (unbekannt.length) throw new Error(`unbekannte Stage: ${unbekannt.join(",")}`);

  const ergebnisse = {};
  let board = null;
  let boardFehler = null;
  try {
    board = await boardLesen(gql, konfig);
    log(`Board 1: ${board.items.length} Karten${konfig.label ? ` mit ${konfig.label}` : ""}`);
  } catch (e) {
    boardFehler = `Board lesen: ${String(e.message ?? e).slice(0, 200)}`;
  }

  const start = Date.now();
  for (const stage of stages) {
    let fehler = boardFehler;
    if (!fehler) {
      if (Date.now() - start > konfig.gesamtSekunden * 1000) fehler = `${stage}: Laufzeit-Obergrenze, Stage uebersprungen`;
      else if (opt.trocken) {
        log(`${stage}: Trockenlauf, ${fuerStage(board.items, konfig).items.length} Karten wuerden gesendet`);
        ergebnisse[stage] = { trocken: true };
        continue;
      } else {
        try {
          const key = schluessel(stage);
          const basis = konfig.stages[stage];
          const teile = [];
          if (!opt.nurSchreiben) {
            const r = await standSenden(fetchFn, stage, basis, key, board, konfig);
            ergebnisse[stage] = { ...ergebnisse[stage], lesen: r };
            if (!r.ok) teile.push(r.fehler);
            else log(`${stage}: ${r.anzahl} Karten gesendet (${r.status})${r.gekappt ? `, ${r.gekappt} wegen Obergrenze weggelassen` : ""}${r.verworfen ? `, ${r.verworfen} mit ungueltiger Form ausgelassen` : ""}`);
          }
          if (!opt.nurLesen) {
            const r = await schreibenFuerStage(fetchFn, gql, stage, basis, key, board, konfig);
            ergebnisse[stage] = { ...ergebnisse[stage], schreiben: r };
            if (!r.ok) teile.push(r.fehler);
            if (r.bearbeitet) log(`${stage}: ${r.bearbeitet} Verschiebe-Auftraege bearbeitet, ${r.abgelehnt.length} abgelehnt${r.abgelehnt.length ? `: ${r.abgelehnt.join(" | ")}` : ""}`);
          }
          fehler = teile.length ? teile.join(" | ") : null;
        } catch (e) {
          fehler = `${stage}: ${String(e.message ?? e).slice(0, 200)}`;
        }
      }
    }
    // Alarm je Stage: rot erst nach konfig.alarmNachFehlern Fehlschlaegen in Folge, gruen beim ersten Erfolg danach.
    const z = zustand.lesen();
    const vorher = z[stage] ?? "ok";
    const folge = { ...(z.folge ?? {}) };
    folge[stage] = fehler ? (folge[stage] ?? 0) + 1 : 0;
    const jetzt = fehler ? (folge[stage] >= konfig.alarmNachFehlern ? "rot" : vorher) : "ok";
    if (jetzt !== vorher) {
      if (jetzt === "rot") await alarmFn("rot", `Board-Status-Job ${stage}: Fehler`, `${folge[stage]} Laeufe in Folge: ${fehler}`, `board-status-job-${stage}`);
      else await alarmFn("gruen", `Board-Status-Job ${stage}: wieder ok`, "Letzter Lauf ohne Fehler.", `board-status-job-${stage}`);
    }
    if (jetzt !== vorher || JSON.stringify(folge) !== JSON.stringify(z.folge ?? {})) zustand.schreiben({ ...z, [stage]: jetzt, folge });
    if (fehler) {
      console.error(`FEHLER ${fehler}`);
      ergebnisse[stage] = { ...ergebnisse[stage], fehler };
    }
  }
  const exit = Object.values(ergebnisse).some((e) => e.fehler) ? 1 : 0;
  return { exit, ergebnisse };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--stages");
  const opt = {
    stages: i >= 0 ? (argv[i + 1] ?? "").split(",").filter(Boolean) : [],
    nurLesen: argv.includes("--nur-lesen"),
    nurSchreiben: argv.includes("--nur-schreiben"),
    trocken: argv.includes("--trocken"),
  };
  // launchd haengt nur an: Log ab 1 MB leeren (O_APPEND, der Deskriptor bleibt gueltig).
  try {
    const LOG = "/tmp/fabrik-board-status-job.log";
    if (statSync(LOG).size > 1_000_000) truncateSync(LOG, 0);
  } catch {
    /* kein Log, nichts zu tun */
  }
  const wachhund = setTimeout(() => {
    console.error("FEHLER: Laufzeit-Obergrenze, Prozess wird beendet");
    process.exit(2);
  }, (KONFIG.gesamtSekunden + 60) * 1000);
  lauf(opt)
    .then((r) => {
      clearTimeout(wachhund);
      process.exit(r.exit);
    })
    .catch((e) => {
      console.error(String(e.message ?? e));
      process.exit(1);
    });
}
