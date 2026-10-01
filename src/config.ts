// Konfiguration je Projekt — genau das, was bei Magenta hartkodiert war, wird
// hier reingereicht. So kann jedes MVP das gleiche Paket mit eigenen Werten nutzen.
export type IntakeKind = "bug" | "feature";

// Ein Intake-Ziel (Repo + Label + optional Board). Wird sowohl für die App als
// auch für das „Plattform"-Ziel (das Paket-Repo selbst) benutzt.
export interface IntakeTarget {
  /** Repo, in dem die Issues angelegt werden, "owner/repo". */
  repo: string;
  /** Projekt-Label, das jede Meldung bekommt, z. B. "app:agency-os". */
  appLabel: string;
  /** Optional: ProjectV2-Board-Node-ID. */
  boardProjectId?: string;
  /** Optional: Single-Select-Status-Feld-ID des Boards. */
  statusFieldId?: string;
  /** Optional: Ziel-Spaltenname (zur Laufzeit per Name aufgelöst). */
  columnName?: string;
  /**
   * Nur mit `githubReleaseAttachments: true` relevant: Tag/Name des GitHub-
   * Releases, an das Anhänge als Assets gehängt werden (Default:
   * "feedback-attachments").
   */
  attachmentReleaseTag?: string;
}

/**
 * Speicher-Haken: die App legt den Anhang in IHREM eigenen, login-geschützten
 * Speicher ab und gibt die URL zurück (https). Ins Issue kommt nur dieser Link,
 * die Datei selbst verlässt die App nie Richtung GitHub. `null`/Fehler =
 * dieser Anhang wird verworfen (Feedback scheitert nie am Anhang).
 */
export type StoreAttachment = (attachment: IntakeAttachment) => Promise<string | null>;

/** Ein einzelner Anhang, transport-agnostisch (Base64, damit Server-Actions ihn tragen). */
export interface IntakeAttachment {
  filename: string;
  contentType?: string;
  /** Base64-kodierter Inhalt (ohne "data:"-Präfix). */
  dataBase64: string;
}

export interface FeedbackConfig extends IntakeTarget {
  /**
   * Optional: Ziel für „betrifft die Plattform/das Feedback-Tool selbst".
   * So fließen FRs ÜBER die Komponente automatisch ins Paket-Repo statt in die
   * App — kein Project-Lead-Briefing nötig, das Tool routet selbst (Dogfooding).
   */
  platform?: IntakeTarget;
  /**
   * Speicher-Haken für Anhänge (siehe StoreAttachment). OHNE Haken sind Anhänge
   * AUS: der Server verwirft sie und lädt nie etwas zu GitHub hoch --
   * Screenshots können Personendaten zeigen und gehören nicht in ein GitHub-Repo.
   */
  storeAttachment?: StoreAttachment;
  /**
   * Ausdrückliches Opt-in für die alte Strecke: Anhänge als GitHub-Release-Assets
   * im Ziel-Repo. Nur für Apps ohne Personendaten sinnvoll; nur wirksam, wenn
   * KEIN `storeAttachment` gesetzt ist. Default false.
   */
  githubReleaseAttachments?: boolean;
  /** Env-Variable mit dem GitHub-Token (Default: GH_PROJECT_TOKEN). */
  tokenEnv?: string;
  /**
   * Direkter Token — hat Vorrang vor tokenEnv/Default. Für Consumer mit eigener
   * Token-Auflösung (z. B. Magenta OS: GH_PAT_SERVER→GH_PROJECT_TOKEN→GH_TOKEN).
   */
  token?: string;
  /**
   * Mindestlänge des Freitexts in Zeichen, serverseitig erzwungen (Default: 10).
   * Ein `required`-Feld im Client reicht nicht — ein Leerzeichen erfüllt das
   * schon (Lücke, die agency-os' eigene Einbindung hatte, andere Consumer
   * hatten das nur clientseitig oder gar nicht durchgesetzt).
   */
  minLength?: number;
  /**
   * Rate-Limit pro Absender (In-Memory, siehe rate-limit.ts). Ohne Angabe:
   * kein Limit. In-Memory gilt NUR pro Serverless-Instanz/Prozess — kein
   * verteilter Zähler. Das ist eine bewusste Grenze, keine Nachlässigkeit:
   * dieselbe Grenze hatte Magenta OS' eigene Umsetzung schon, und ein
   * einfacher Spam-Schutz braucht keine Redis-Abhängigkeit im Paket.
   */
  rateLimit?: { max: number; windowMs: number };
}

/** Eingaben für die Low-Level-Primitive createBoardIssue (Issue + Board + Spalte). */
export interface CreateBoardIssueInput {
  token: string;
  repo: string;
  title: string;
  body: string;
  labels?: string[];
  boardProjectId?: string;
  statusFieldId?: string;
  columnName?: string;
}

export type FeedbackScope = "app" | "platform";

export interface IntakeInput {
  kind: IntakeKind;
  /** Freitext der Meldung. */
  text: string;
  /** Optionaler Titel; sonst aus dem Text abgeleitet. */
  title?: string;
  /** Wer meldet (für Transparenz im Issue-Body). */
  submitter?: { name?: string | null; email?: string | null } | null;
  /**
   * Schlüssel fürs Rate-Limit (siehe FeedbackConfig.rateLimit), z. B. die IP
   * des Anfragenden. Ohne Angabe fällt submitFeedback auf `submitter.email`
   * zurück; ist auch das leer, greift KEIN Limit (lieber kein Schutz als ein
   * gemeinsamer Topf für alle anonymen Absender, der sich gegenseitig sperrt).
   */
  rateLimitKey?: string;
  /** Optionale Datei-Anhänge; werden nur über config.storeAttachment (oder Opt-in) verlinkt. */
  attachments?: IntakeAttachment[];
  /**
   * "app" (Default) = betrifft die App → App-Ziel. "platform" = betrifft das
   * Feedback-Tool selbst → wird ins Paket-Repo (config.platform) geroutet.
   * Fällt auf das App-Ziel zurück, wenn kein platform-Ziel konfiguriert ist.
   */
  scope?: FeedbackScope;
}

export interface IntakeResult {
  ok: boolean;
  issueNumber?: number;
  issueUrl?: string;
  error?: string;
}
