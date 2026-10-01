#!/usr/bin/env node
// Zentraler Board-Einsortierer (laeuft auf dem Mac mini, nicht in den Apps).
//
// Apps legen ihre Meldungen als Issue mit Label app:<name> an (Fine-grained Token,
// nur Issues-Recht). DIESES Skript legt offene app:*-Issues, die noch auf KEINEM
// Board liegen, mit dem gh-Login des Servers in die Spalte "User Request".
// Der breite Token bleibt so auf dem Server und kommt nie auf PROD.
//
//   node scripts/board-einsortierer.mjs            Trockenlauf (Standard): nur Liste
//   node scripts/board-einsortierer.mjs --scharf   einsortieren
//   --json                                         Liste maschinenlesbar
//
// Regeln: idempotent (was schon auf einem Board liegt, wird nie angefasst, auch
// nicht in einer anderen Spalte), keine Warteschleife, harte Laufzeit-Obergrenze,
// Fehler laufen ueber fabrik-alarm. Ohne "User Request"-Spalte wird NICHTS gesetzt
// (ein Item ohne Status faellt nach Todo und wuerde von den Devs sofort gezogen).

import { execFile, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const KONFIG = {
  eigentuemer: ["ss-cowork-engineer", "drivenbysun"],
  boardEigentuemer: "ss-cowork-engineer",
  // Board-Nummern der User-Projekte von ss-cowork-engineer.
  boards: { magenta: 1, fabrik: 2 },
  // Weitere Boards, die als "liegt schon auf einem Board" zaehlen (nie anfassen).
  weitereBoards: [3],
  // Repo-Name (ohne Owner) -> Board. Alles andere -> fabrik.
  magentaRepos: ["magenta-os"],
  spalte: "User Request",
  labelPraefix: "app:",
  maxProLauf: 25,
  maxSeiten: 5,
  gesamtSekunden: 240,
  aufrufSekunden: 30,
};

const AUSLASTUNGS_SCHUTZ = "board-einsortierer";

// ── gh-Aufruf (GraphQL ueber stdin, kein Shell) ──────────────────────────────
export function ghGraphql(query, variables = {}, { aufrufSekunden = KONFIG.aufrufSekunden } = {}) {
  return new Promise((resolve, reject) => {
    const kind = spawn("gh", ["api", "graphql", "--input", "-"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      kind.kill("SIGKILL");
      reject(new Error(`gh: Zeitlimit ${aufrufSekunden}s`));
    }, aufrufSekunden * 1000);
    kind.stdout.on("data", (d) => (out += d));
    kind.stderr.on("data", (d) => (err += d));
    kind.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    kind.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`gh Exit ${code}: ${(err || out).slice(0, 300)}`));
      try {
        const j = JSON.parse(out);
        if (j.errors) return reject(new Error(`GraphQL: ${JSON.stringify(j.errors).slice(0, 300)}`));
        resolve(j.data);
      } catch (e) {
        reject(new Error(`gh: Antwort unlesbar: ${String(e).slice(0, 100)}`));
      }
    });
    kind.stdin.end(JSON.stringify({ query, variables }));
  });
}

// ── Abfragen ─────────────────────────────────────────────────────────────────
const Q_BOARD = `query($o:String!,$n:Int!){ user(login:$o){ projectV2(number:$n){ id title
  field(name:"Status"){ ... on ProjectV2SingleSelectField { id options{ id name } } } } } }`;

const Q_REPOS = `query($o:String!,$c:String){ repositoryOwner(login:$o){ repositories(first:100, after:$c, isArchived:false){
  pageInfo{ hasNextPage endCursor }
  nodes{ nameWithOwner labels(first:30, query:"app:"){ nodes{ name } } } } } }`;

const Q_ISSUES = `query($o:String!,$r:String!,$l:[String!],$c:String){ repository(owner:$o,name:$r){
  issues(first:100, after:$c, states:OPEN, labels:$l){
    pageInfo{ hasNextPage endCursor }
    nodes{ id number title url projectItems(first:20){ nodes{ project{ id } } } } } } }`;

const M_ADD = `mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item{ id } } }`;
const M_SET = `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ projectV2Item{ id } } }`;
const M_DEL = `mutation($p:ID!,$i:ID!){ deleteProjectV2Item(input:{projectId:$p,itemId:$i}){ deletedItemId } }`;

// ── Planen (nur lesen) ───────────────────────────────────────────────────────
export function boardSchluesselFuer(repoNameWithOwner, konfig = KONFIG) {
  const name = repoNameWithOwner.split("/")[1];
  return konfig.magentaRepos.includes(name) ? "magenta" : "fabrik";
}

async function ladeBoard(gql, konfig, nummer) {
  const d = await gql(Q_BOARD, { o: konfig.boardEigentuemer, n: nummer });
  const p = d?.user?.projectV2;
  if (!p?.id) throw new Error(`Board ${nummer} nicht lesbar`);
  const optionen = p.field?.options ?? [];
  return {
    nummer,
    id: p.id,
    titel: p.title,
    statusFeldId: p.field?.id ?? null,
    spaltenId: optionen.find((o) => o.name === konfig.spalte)?.id ?? null,
    spalten: optionen.map((o) => o.name),
  };
}

async function seitenweise(gql, query, vars, holen, konfig) {
  const alle = [];
  let cursor = null;
  for (let i = 0; i < konfig.maxSeiten; i++) {
    const d = await gql(query, { ...vars, c: cursor });
    const seite = holen(d);
    alle.push(...(seite?.nodes ?? []));
    if (!seite?.pageInfo?.hasNextPage) return alle;
    cursor = seite.pageInfo.endCursor;
  }
  throw new Error(`mehr als ${konfig.maxSeiten} Seiten -- Obergrenze erreicht, nichts geraten`);
}

export async function planen(gql, konfig = KONFIG) {
  const boards = {};
  for (const [schluessel, nr] of Object.entries(konfig.boards)) boards[schluessel] = await ladeBoard(gql, konfig, nr);
  const bekannteBoardIds = new Set(Object.values(boards).map((b) => b.id));
  for (const nr of konfig.weitereBoards) bekannteBoardIds.add((await ladeBoard(gql, konfig, nr)).id);

  const repos = new Map();
  for (const eig of konfig.eigentuemer) {
    const knoten = await seitenweise(gql, Q_REPOS, { o: eig }, (d) => d?.repositoryOwner?.repositories, konfig);
    for (const r of knoten) {
      // Das GitHub-Label-Query ist unscharf ("area:mobile" trifft "app:") -> strikt nachfiltern.
      const labels = (r.labels?.nodes ?? []).map((l) => l.name).filter((n) => n.startsWith(konfig.labelPraefix));
      if (labels.length) repos.set(r.nameWithOwner, labels);
    }
  }

  const eintraege = [];
  for (const [repo, labels] of repos) {
    const [eig, name] = repo.split("/");
    const issues = await seitenweise(gql, Q_ISSUES, { o: eig, r: name, l: labels }, (d) => d?.repository?.issues, konfig);
    const schluessel = boardSchluesselFuer(repo, konfig);
    const board = boards[schluessel];
    for (const is of issues) {
      const aufBoard = (is.projectItems?.nodes ?? []).some((n) => bekannteBoardIds.has(n.project?.id));
      let aktion = "sortieren";
      if (aufBoard) aktion = "schon_auf_board";
      else if (!board.spaltenId || !board.statusFeldId) aktion = "spalte_fehlt";
      eintraege.push({
        repo, nummer: is.number, titel: is.title, url: is.url, contentId: is.id,
        board: board.nummer, boardTitel: board.titel, aktion,
      });
    }
  }
  eintraege.sort((a, b) => a.repo.localeCompare(b.repo) || a.nummer - b.nummer);
  return { boards, eintraege };
}

// ── Ausfuehren (schreiben) ───────────────────────────────────────────────────
// Reihenfolge schuetzt vor Items ohne Status: Spalten-ID steht VOR dem Anlegen fest;
// scheitert das Status-Setzen nach dem Anlegen, wird das Item wieder entfernt.
export async function ausfuehren(gql, plan, konfig = KONFIG, { jetzt = Date.now, start = jetzt() } = {}) {
  const ergebnis = { sortiert: [], fehler: [], uebersprungen: [] };
  let versuche = 0;
  for (const e of plan.eintraege) {
    if (e.aktion === "spalte_fehlt") {
      ergebnis.fehler.push({ ...e, grund: `Board ${e.board} (${e.boardTitel}) hat keine Spalte "${konfig.spalte}"` });
      continue;
    }
    if (e.aktion !== "sortieren") continue;
    if (versuche >= konfig.maxProLauf) {
      ergebnis.uebersprungen.push({ ...e, grund: `Obergrenze ${konfig.maxProLauf} je Lauf` });
      continue;
    }
    if (jetzt() - start > konfig.gesamtSekunden * 1000) {
      ergebnis.uebersprungen.push({ ...e, grund: "Laufzeit-Obergrenze" });
      continue;
    }
    versuche++;
    const board = Object.values(plan.boards).find((b) => b.nummer === e.board);
    let itemId = null;
    try {
      const a = await gql(M_ADD, { p: board.id, c: e.contentId });
      itemId = a?.addProjectV2ItemById?.item?.id;
      if (!itemId) throw new Error("addProjectV2ItemById ohne Item");
      await gql(M_SET, { p: board.id, i: itemId, f: board.statusFeldId, o: board.spaltenId });
      ergebnis.sortiert.push(e);
    } catch (err) {
      let rueckbau = "";
      if (itemId) {
        try {
          await gql(M_DEL, { p: board.id, i: itemId });
          rueckbau = " (Item wieder entfernt)";
        } catch (err2) {
          rueckbau = ` (ACHTUNG: Item ${itemId} liegt OHNE Spalte auf dem Board, Rueckbau scheiterte: ${String(err2).slice(0, 100)})`;
        }
      }
      ergebnis.fehler.push({ ...e, grund: String(err.message ?? err).slice(0, 200) + rueckbau });
    }
  }
  return ergebnis;
}

// ── Alarm + Zustand ──────────────────────────────────────────────────────────
export function alarm(schwere, titel, text) {
  return new Promise((resolve) => {
    execFile(
      join(homedir(), ".fabrik/bin/fabrik-alarm"),
      ["board-einsortierer", schwere, AUSLASTUNGS_SCHUTZ, titel, text.slice(0, 500)],
      { timeout: 30000 },
      (err) => resolve(err ? err.code ?? 1 : 0),
    );
  });
}

const ZUSTAND = join(homedir(), ".fabrik/zustand/board-einsortierer.json");
function zustandLesen() {
  try {
    return JSON.parse(readFileSync(ZUSTAND, "utf8")).zustand;
  } catch {
    return "ok";
  }
}
function zustandSchreiben(z) {
  mkdirSync(dirname(ZUSTAND), { recursive: true });
  writeFileSync(ZUSTAND, JSON.stringify({ zustand: z, zeit: new Date().toISOString() }));
}

// ── Lauf ─────────────────────────────────────────────────────────────────────
export function bericht(plan, ergebnis) {
  const z = [];
  for (const e of plan.eintraege) {
    const marke = { sortieren: "SORTIERT EIN ", schon_auf_board: "schon auf Board", spalte_fehlt: "SPALTE FEHLT " }[e.aktion];
    z.push(`${marke.padEnd(15)} ${e.repo}#${e.nummer} -> Board ${e.board} (${e.boardTitel})  ${e.titel}`);
  }
  if (!plan.eintraege.length) z.push("Keine offenen app:*-Issues gefunden.");
  if (ergebnis) {
    z.push(`Ergebnis: ${ergebnis.sortiert.length} einsortiert, ${ergebnis.fehler.length} Fehler, ${ergebnis.uebersprungen.length} uebersprungen`);
    for (const f of ergebnis.fehler) z.push(`  FEHLER ${f.repo}#${f.nummer}: ${f.grund}`);
    for (const f of ergebnis.uebersprungen) z.push(`  uebersprungen ${f.repo}#${f.nummer}: ${f.grund}`);
  }
  return z.join("\n");
}

export async function lauf({ scharf, json }, { gql = ghGraphql, konfig = KONFIG, alarmFn = alarm, zustand = { lesen: zustandLesen, schreiben: zustandSchreiben } } = {}) {
  let plan = null;
  let ergebnis = null;
  let fehlerText = null;
  try {
    plan = await planen(gql, konfig);
    if (scharf) {
      ergebnis = await ausfuehren(gql, plan, konfig);
      if (ergebnis.fehler.length) fehlerText = ergebnis.fehler.map((f) => `${f.repo}#${f.nummer}: ${f.grund}`).join(" | ");
    } else {
      const fehlt = plan.eintraege.filter((e) => e.aktion === "spalte_fehlt");
      if (fehlt.length) fehlerText = `Trockenlauf: ${fehlt.length} Issue(s) ohne Zielspalte "${konfig.spalte}"`;
    }
  } catch (err) {
    fehlerText = String(err.message ?? err);
  }

  if (json) console.log(JSON.stringify({ scharf, plan, ergebnis, fehler: fehlerText }, null, 2));
  else {
    if (plan) console.log(bericht(plan, ergebnis));
    if (fehlerText) console.error(`FEHLER: ${fehlerText}`);
  }

  // Nur der scharfe Lauf alarmiert und fuehrt den Zustand; der Trockenlauf meldet nur.
  if (scharf) {
    if (fehlerText) {
      await alarmFn("rot", "Board-Einsortierer: Fehler", fehlerText);
      zustand.schreiben("rot");
    } else if (zustand.lesen() === "rot") {
      await alarmFn("gruen", "Board-Einsortierer: wieder ok", "Letzter Lauf ohne Fehler.");
      zustand.schreiben("ok");
    }
  }
  return { plan, ergebnis, fehler: fehlerText, exit: fehlerText ? 1 : 0 };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  // Harte Obergrenze fuer den ganzen Prozess, unabhaengig von einzelnen Aufrufen.
  const wachhund = setTimeout(async () => {
    console.error("FEHLER: Laufzeit-Obergrenze, Prozess wird beendet");
    if (argv.includes("--scharf")) await alarm("rot", "Board-Einsortierer: haengt", "Laufzeit-Obergrenze erreicht, Lauf abgebrochen.");
    process.exit(2);
  }, (KONFIG.gesamtSekunden + 40) * 1000);
  lauf({ scharf: argv.includes("--scharf"), json: argv.includes("--json") })
    .then((r) => {
      clearTimeout(wachhund);
      process.exit(r.exit);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
