// Echte Betriebsdaten (Hosts, Repos, Board-Eigentuemer, Labels) stehen NICHT im oeffentlichen Repo, sondern in einer
// lokalen Datei auf dem Rechner, der die Jobs faehrt (Sicherheits-Sweep 15.11.). Im Repo bleiben nur Platzhalter.
//
//   ~/.fabrik/config/board-ziele.json  (oder Pfad in FABRIK_BOARD_KONFIG), Rechte 600
//   { "ziele": { "<ziel>": { "repo": "…", "stages": { "dev": "https://…" }, … } },
//     "einsortierer": { "eigentuemer": ["…"], "boardEigentuemer": "…", "magentaLabels": ["…"] } }
//
// Nur reine Daten-Schluessel werden uebernommen; alles andere (Zeitlimits, Spruenge, Funktionen) bleibt im Code.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const LOKALE_KONFIG_PFAD = () => process.env.FABRIK_BOARD_KONFIG || join(homedir(), ".fabrik/config/board-ziele.json");

const DATEN_SCHLUESSEL = new Set(["eigentuemer", "boardEigentuemer", "boardNummer", "boards", "weitereBoards", "repo", "label", "magentaLabels", "stages"]);

export function lokaleKonfigLesen(pfad = LOKALE_KONFIG_PFAD()) {
  let roh;
  try {
    roh = readFileSync(pfad, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
  return JSON.parse(roh);
}

/** Basis-Konfiguration mit den Daten-Schluesseln aus der lokalen Datei ueberschreiben (flach, stages als Ganzes). */
export function mitLokal(basis, lokal) {
  if (!lokal || typeof lokal !== "object") return basis;
  const out = { ...basis };
  for (const [k, v] of Object.entries(lokal)) if (DATEN_SCHLUESSEL.has(k)) out[k] = v;
  return out;
}

/** true, solange noch ein Platzhalter aus dem Repo drinsteht: dann darf kein scharfer Lauf starten. */
export function hatPlatzhalter(konfig) {
  const werte = [konfig.repo, konfig.eigentuemer, konfig.boardEigentuemer, ...Object.values(konfig.stages ?? {})].flat().filter(Boolean);
  return werte.some((w) => /beispiel-|example\.(com|org)/i.test(String(w)));
}
