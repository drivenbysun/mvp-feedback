# mvp-feedback

Wiederverwendbares Feedback-Widget (Bug/Feature) für die **drivenbysun MVP-Factory**.
Eine In-App-Meldung wird als **GitHub-Issue** angelegt (Labels `type:bug`/`type:feature`
+ ein Projekt-Label wie `app:agency-os`) und best-effort aufs gemeinsame **MVP-Board**
gelegt. Alles Projektspezifische kommt als **Config** rein — kein hartkodierter Wert.

## Nutzung (jedes MVP)

`package.json` (via git-Dependency, keine Registry nötig):
```json
"dependencies": { "mvp-feedback": "github:drivenbysun/mvp-feedback" }
```
`next.config.ts`:
```ts
const nextConfig = { transpilePackages: ["mvp-feedback"] };
```

**Server-Action** (bindet Config + „wer meldet" ein):
```ts
"use server";
import { submitFeedback } from "mvp-feedback/server";
export async function sendFeedback(fd: FormData) {
  const session = await getSession();
  await submitFeedback(
    {
      repo: "drivenbysun/agency-os",
      appLabel: "app:agency-os",
      boardProjectId: "PVT_...",        // gemeinsames MVP-Board (optional)
      statusFieldId: "PVTSSF_...",       // optional
      columnName: "User Request",        // optional, Default "User Request" (per Name aufgelöst)
    },
    {
      kind: fd.get("kind") === "bug" ? "bug" : "feature",
      text: String(fd.get("text") ?? ""),
      attachments: await attachmentsFromFormData(fd),   // optional, s. u.
      submitter: session ? { name: session.name, email: session.email } : null,
    },
  );
}
```

**Widget** (Client, im Layout):
```tsx
import { FeedbackWidget } from "mvp-feedback";
import { sendFeedback } from "./feedback-action";
<FeedbackWidget action={sendFeedback} brandColor="#e20074" />
```

Standardmäßig eine Pille mit Text-Label unten rechts. Mit `compact` stattdessen
ein kleiner runder Knopf (🐞) — das Formular dahinter ist identisch, nur der
Aufmacher ist unauffälliger (Sören/agency-os, 31.08.2026):
```tsx
<FeedbackWidget action={sendFeedback} brandColor="#e20074" compact />
```

## Datei-Anhänge (Screenshots etc.)
**Standard: AUS.** Screenshots können Personendaten zeigen (Lebensläufe, Kundendaten) und
gehören nicht in ein GitHub-Repo. Ohne Speicher-Haken verwirft der Server Anhänge, ruft nie
`uploads.github.com` auf, und das Widget blendet Datei-Feld und Screenshot-Knopf aus.

Anhänge einschalten = die App liefert einen **Speicher-Haken** (eigener, login-geschützter
Speicher); ins Issue kommt nur der Link:
```ts
submitFeedback({
  ...config,
  storeAttachment: async (att) => {
    const url = await meinSpeicher.ablegen(att.filename, att.contentType, att.dataBase64);
    return url; // https-URL, oder null = Anhang verwerfen
  },
}, input);
// Widget: <FeedbackWidget allowAttachments allowScreenshot ... />
```
Nur `http(s)`-URLs ohne Leerzeichen/Klammern werden verlinkt; ein Fehler im Haken verwirft nur
diesen Anhang, das Feedback geht trotzdem raus.

Alte Strecke (GitHub-Release-Assets, Tag via `attachmentReleaseTag`) gibt es nur noch als
ausdrückliches Opt-in `githubReleaseAttachments: true` — für Apps ohne Personendaten, wirkt
nur ohne `storeAttachment`.

Consumer-Seite: `attachmentsFromFormData(fd)` zieht die Dateien aus dem FormData (Base64,
Grenzen 5×10 MB). **Wichtig:** Next.js begrenzt Server-Action-Bodies auf 1 MB — im
Consumer hochsetzen:
```ts
const nextConfig = {
  transpilePackages: ["mvp-feedback"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};
```

## Seiten-Pfad erfassen (`sanitizePagePath`)
Damit eine Meldung nachvollziehbar bleibt (welche Seite betraf es?), ohne dabei
versehentlich Zugangsdaten mitzuschicken: `sanitizePagePath(wert)` kappt IMMER
Abfrageparameter und alles hinter `#`, egal wie sie heißen (keine Erlaubnis-
oder Verbotsliste — Wiederherstellungs-/Einladungslinks und OAuth-Callbacks
tragen Einmal-Kennungen dort, z. B. `/auth/callback?code=…`). Liefert **nur den
Pfad**, keine Herkunft. Wirft nie — bei Müll oder leerer Eingabe kommt ein
leerer oder bestmöglich gekürzter String zurück, eine Meldung darf nie an ihrer
eigenen Seiten-Angabe scheitern.

Dieselbe Funktion für beide Seiten, damit sie nicht auseinanderlaufen können:
```ts
// Client, beim Absenden:
import { sanitizePagePath } from "mvp-feedback";
const seite = sanitizePagePath(window.location.href);

// Server, vor dem Speichern — IMMER anwenden, auch wenn der Client es
// schon getan hat. Eine Bereinigung, die nur der Absender macht, ist
// keine Bereinigung.
import { sanitizePagePath } from "mvp-feedback/server";
const seite = sanitizePagePath(eingehenderWert);
```

## Mindestlänge & Rate-Limit (serverseitig)
Aus dem Vergleich der drei ursprünglichen Implementierungen (agency-os, magenta-os,
StaffHub) übernommen, statt dass jede App das für sich neu baut:

```ts
await submitFeedback(
  {
    repo: "drivenbysun/agency-os",
    appLabel: "app:agency-os",
    minLength: 15,                              // Default: 10 Zeichen
    rateLimit: { max: 3, windowMs: 60_000 },     // Default: kein Limit
  },
  { kind: "bug", text, rateLimitKey: ip },       // ohne rateLimitKey: fällt auf submitter.email zurück
);
```

Beides ist **serverseitig erzwungen** — ein `required`-Textfeld im Client reicht nicht
(ein Leerzeichen erfüllt das schon). Rate-Limit ist **In-Memory**, gilt also pro
Serverless-Prozess, kein verteilter Zähler — bewusste Grenze für einen einfachen
Spam-Schutz, keine Redis-Abhängigkeit im Paket. Ohne `rateLimitKey` **und** ohne
`submitter.email` greift kein Limit (kein gemeinsamer Topf für alle anonymen
Absender, der sich sonst gegenseitig sperren würde).

Damit ein abgelehnter Versuch nicht trotzdem als „Danke, eingegangen" erscheint,
darf die Server-Action jetzt optional das `IntakeResult` zurückgeben — das Widget
zeigt bei `ok: false` einen Fehlertext statt der Erfolgsmeldung:
```ts
"use server";
export async function sendFeedback(fd: FormData) {
  return submitFeedback(config, input); // Rückgabe jetzt durchreichen, statt zu verwerfen
}
```
Rein `void` zurückgebende Actions (bestehende Einbindungen) funktionieren unverändert
weiter — sie zeigen bei einer Ablehnung nur weiterhin unverändert "Danke" (wie bisher).

## Screenshot + Markierung (`allowScreenshot`)
Aus StaffHubs eigenem Feedback-Modul übernommen (dort das einzige der drei mit dieser
Funktion). Erfasst die Seite per `html2canvas` und erlaubt eine Freihand-Markierung
(ein Stift, keine Formen/Text — Zweck ist "worum es geht zeigen", kein Bildeditor)
direkt im Widget, bevor sie als Anhang mitgeschickt wird:
```tsx
<FeedbackWidget action={sendFeedback} allowScreenshot />
```
`html2canvas` wird nur bei tatsächlicher Nutzung per `import()` nachgeladen — Apps,
die das Feature nicht einschalten, bekommen kein zusätzliches Bundle-Gewicht.

## Runtime-Voraussetzung
`GH_PROJECT_TOKEN` (oder `config.tokenEnv`) = GitHub-Token mit `repo` (+ `project` fürs Board;
`contents`/Releases-Schreibrecht für Anhänge) als Server-Env (z. B. Vercel). Ohne Token:
still no-op (best-effort).

## Rückkanal / Request-Status (`mvp-feedback/return-channel`)
Framework-agnostische Domänenlogik für den Einreicher-Rückkanal (aus Magenta OS
#1431 extrahiert): Board-Spalte → nutzerfreundliche Status-Stufe, plus Overlay für
offene Team-Rückfragen (`awaitingReply` = Einreicher ist am Zug). Keine DB, kein
React, kein GitHub — der Consumer liefert die Daten, das Paket leitet den Zustand ab.

```ts
import { resolveRequestState } from "mvp-feedback/return-channel";

const state = resolveRequestState({
  columnName: "In Progress",          // Board-Spalte des Issues
  issueClosed: false,
  clarifications: [                    // Rückfrage-Thread (aus eigener Persistenz)
    { direction: "to_user", createdAt: new Date() },
  ],
  // columnMap: { Backlog: "planned" } // optional: eigene Spaltennamen
});
// → { status: "awaitingReply", boardStatus: "inProgress", awaitingReply: true, order }
```

Bausteine einzeln: `mapRequestStatus`, `overlayStatus`, `hasOpenClarification`,
`openClarificationKeys` (Batch-Overlay über viele Requests), `REQUEST_STATUS_ORDER`,
`DEFAULT_COLUMN_TO_STATUS`. Alles auch aus `mvp-feedback` re-exportiert.

## Wiederverwendbarkeit
- Kein hartkodiertes Repo/Board — alles Config.
- Getrennte Entry-Points: `mvp-feedback` (Client-Widget) · `mvp-feedback/server` (Intake)
  · `mvp-feedback/return-channel` (Status-/Rückfrage-Logik, framework-agnostisch).
- Später als GitHub-Packages-npm-Paket veröffentlichbar (`publishConfig` gesetzt).
