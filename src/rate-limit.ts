// In-Memory-Rate-Limit, aus Magenta OS' eigener Umsetzung extrahiert (dort
// bug/feature dupliziert, hier einmal, parametrisiert). Bewusst kein
// verteilter Zähler (Redis o.ä.) -- ein Serverless-Prozess reicht als
// Spam-Bremse, mehr Infrastruktur wäre für diesen Zweck Overengineering.
//
// `now` ist injizierbar, damit Tests nicht von echter Zeit abhängen.

interface Eintrag {
  anzahl: number;
  fensterEndeMs: number;
}

const zaehler = new Map<string, Eintrag>();

/** true = darf durch, false = Limit erreicht. Zaehlt bei jedem Aufruf mit. */
export function pruefeRateLimit(
  schluessel: string,
  max: number,
  fensterMs: number,
  now: number = Date.now(),
): boolean {
  const eintrag = zaehler.get(schluessel);
  if (!eintrag || eintrag.fensterEndeMs <= now) {
    zaehler.set(schluessel, { anzahl: 1, fensterEndeMs: now + fensterMs });
    return true;
  }
  if (eintrag.anzahl >= max) return false;
  eintrag.anzahl += 1;
  return true;
}

/** Nur fuer Tests -- verhindert, dass ein Testlauf den Zustand des naechsten verfaelscht. */
export function _rateLimitZuruecksetzen(): void {
  zaehler.clear();
}
