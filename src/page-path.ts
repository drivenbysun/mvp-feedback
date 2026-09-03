// Seiten-Pfad fuer eine Meldung, bereinigt -- OHNE Herkunft (Sören, 03.09.:
// "seitenpfad sollte reichen"), OHNE Erlaubnisliste fuer Parameter (Query und
// Hash werden komplett verworfen). Eine gepflegte Liste geht irgendwann
// auseinander, die leere Menge muss nie gepflegt werden.
//
// Grund: Wiederherstellungs-/Einladungslinks und OAuth-Callbacks tragen
// Einmal-Kennungen in Abfrageparametern und hinter "#" (z.B.
// "/auth/callback?code=…&next=…", gefunden bei StaffHub). Landet die volle
// URL ungefiltert in einer Meldung und von dort in einem GitHub-Issue, liegt
// ein Zugangsschluessel an einem Ort, fuer den er nie gedacht war -- Loeschen
// in der Datenbank holt ihn aus dem Issue nicht zurueck.
//
// Dieselbe Funktion fuer beide Seiten derselben Melde-Strecke:
// - Client: sanitizePagePath(window.location.href) beim Absenden.
// - Server: sanitizePagePath(eingehenderWert) vor dem Speichern -- eine
//   Bereinigung, die nur der Absender macht, ist keine Bereinigung. Ein
//   aelterer Client, ein zweites Widget oder ein von Hand abgesetzter Aufruf
//   koennen sonst eine vollstaendige Adresse durchreichen.
//
// Abschneiden statt ablehnen: eine Meldung darf nie an ihrer eigenen
// Seiten-Angabe scheitern. Bei Muell oder leerer Eingabe kommt ein leerer
// oder bestmoeglich gekuerzter String zurueck, nie ein Fehler.
//
// Vorlage: staffhubs bereinigeSeiteUrl (Commit fe51261, origin/main).
export function sanitizePagePath(value: string | null | undefined): string {
  const input = value ?? "";
  try {
    return new URL(input).pathname;
  } catch {
    // Keine vollstaendige URL (z.B. schon ein blosser Pfad, oder Muell) --
    // Query/Hash trotzdem kappen. Nie durchlassen, nie werfen.
    return input.split("?")[0].split("#")[0];
  }
}
