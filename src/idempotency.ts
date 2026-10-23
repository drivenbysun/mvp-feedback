// Doppel-Absenden abfangen: dieselbe Absendung (gleicher Schluessel) legt hoechstens
// ein Issue an. In-Memory und damit nur pro Prozess/Serverless-Instanz -- dieselbe
// bewusste Grenze wie beim Rate-Limit. Fehlgeschlagene Versuche werden NICHT gemerkt,
// damit ein Wiederholen nach einem Fehler moeglich bleibt.

const BEHALTEN_MS = 10 * 60_000;

interface Eintrag {
  ergebnis: Promise<{ ok: boolean }>;
  bisMs: number | null;
}

const eintraege = new Map<string, Eintrag>();

export async function einmalProSchluessel<T extends { ok: boolean }>(
  schluessel: string | undefined,
  lauf: () => Promise<T>,
  now: number = Date.now(),
): Promise<T> {
  if (!schluessel) return lauf();

  for (const [k, e] of eintraege) if (e.bisMs !== null && e.bisMs <= now) eintraege.delete(k);

  const vorhanden = eintraege.get(schluessel);
  if (vorhanden) return vorhanden.ergebnis as Promise<T>;

  const ergebnis = lauf();
  const eintrag: Eintrag = { ergebnis, bisMs: null };
  eintraege.set(schluessel, eintrag);
  try {
    const r = await ergebnis;
    if (r.ok) eintrag.bisMs = now + BEHALTEN_MS;
    else eintraege.delete(schluessel);
    return r;
  } catch (e) {
    eintraege.delete(schluessel);
    throw e;
  }
}

/** Nur fuer Tests. */
export function _idempotenzZuruecksetzen(): void {
  eintraege.clear();
}
