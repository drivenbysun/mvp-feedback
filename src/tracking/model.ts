// Request-Tracking: Datenmodell und reine Ableitungen. Kein React, kein fetch,
// keine Persistenz — die App liefert Daten und nimmt Aktionen entgegen.

export type RequestType = "bug" | "feature";
export type RequestStatus = "submitted" | "accepted" | "declined" | "in_progress" | "live";
export type Severity = "blocks" | "annoying" | "cosmetic";
export type Audience = "me" | "team" | "all";

export interface UserRef {
  id: string;
  name: string;
}

export interface StatusChange {
  status: RequestStatus;
  /** ISO-Zeitpunkt oder Datum (YYYY-MM-DD). */
  at: string;
  by?: UserRef;
}

export interface RequestComment {
  id: string;
  author: UserRef;
  at: string;
  text: string;
  isTeam?: boolean;
  /** Team-Rückfrage, die auf Antwort des Einreichers wartet. */
  isQuestion?: boolean;
  /** Antwort auf eine Rückfrage (id der Frage). */
  replyTo?: string;
}

export interface RequestAttachment {
  id: string;
  filename: string;
  url?: string;
  sizeBytes?: number;
}

export interface TrackedRequest {
  /** Angezeigt als #1041. */
  id: number;
  type: RequestType;
  title: string;
  description: string;
  expected?: string;
  severity?: Severity;
  audience?: Audience;
  isPublic: boolean;
  portal: string;
  pagePath?: string;
  environment?: string;
  createdAt: string;
  createdBy: UserRef;
  status: RequestStatus;
  statusHistory: StatusChange[];
  targetReleaseId?: string;
  duplicateOfId?: number;
  /** In diesen Request zusammengeführte Dubletten. */
  duplicates: number[];
  votes: number;
  votedByMe: boolean;
  followedByMe: boolean;
  followers: number;
  comments: RequestComment[];
  attachments: RequestAttachment[];
}

export type ReleaseKind = "release" | "hotfix";
export type ReleaseState = "planning" | "scheduled" | "live";

export interface ReleaseNote {
  title: string;
  text: string;
  requestId?: number;
  /** Optionales Etikett für Einträge ohne Request, z. B. "improvement". */
  tag?: string;
}

export interface Release {
  /** z. B. "v2.14", "v2.13.3". */
  id: string;
  kind: ReleaseKind;
  /** Datum YYYY-MM-DD. */
  plannedDate: string;
  state: ReleaseState;
  /** Hotfix „nur falls nötig". */
  isConditional?: boolean;
  items: number[];
  notes: ReleaseNote[];
}

export type Scope = "mine" | "public" | "following";
export type ViewMode = "list" | "board";
export type SortKey = "recent" | "votes";

export const STATUS_STEP: Record<RequestStatus, number> = {
  submitted: 0,
  accepted: 1,
  declined: 1,
  in_progress: 2,
  live: 3,
};

export const BOARD_COLUMNS: RequestStatus[] = ["submitted", "accepted", "in_progress", "live"];

// ------------------------------------------------------------
// Datum: reine Kalenderrechnung in einer festen Zeitzone
// ------------------------------------------------------------

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Reines Datum (YYYY-MM-DD) ist ein Kalendertag, kein Zeitpunkt — es wird nie in eine Zeitzone umgerechnet. */
export function isDateOnly(value: string | Date): value is string {
  return typeof value === "string" && DATE_ONLY.test(value);
}

export function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return new Date(isDateOnly(value) ? `${value}T12:00:00Z` : value);
}

/** Kalendertag als YYYY-MM-DD in der Zeitzone. */
export function calendarDay(value: string | Date, timeZone: string): string {
  if (isDateOnly(value)) return value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parseDate(value));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Ganze Kalendertage von `now` bis `date` (negativ = vorbei). */
export function daysUntil(date: string | Date, now: Date, timeZone: string): number {
  return dayNumber(calendarDay(date, timeZone)) - dayNumber(calendarDay(now, timeZone));
}

/** ISO-8601-Kalenderwoche (KW). */
export function isoWeek(date: string | Date, timeZone: string): number {
  const [y, m, d] = calendarDay(date, timeZone).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const weekday = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

// ------------------------------------------------------------
// Status
// ------------------------------------------------------------

export function statusStep(status: RequestStatus): number {
  return STATUS_STEP[status];
}

/** Letzter Eintrag der Historie mit diesem Status. */
export function statusEntry(r: TrackedRequest, status: RequestStatus): StatusChange | undefined {
  for (let i = r.statusHistory.length - 1; i >= 0; i--) {
    if (r.statusHistory[i].status === status) return r.statusHistory[i];
  }
  return undefined;
}

export function releaseOf(r: TrackedRequest, releases: Release[]): Release | undefined {
  if (r.targetReleaseId) return releases.find((x) => x.id === r.targetReleaseId);
  return releases.find((x) => x.items.includes(r.id));
}

/** Offene Team-Rückfrage: letzte Team-Frage ohne spätere Antwort des Einreichers. */
export function openQuestion(r: TrackedRequest): RequestComment | undefined {
  const sorted = [...r.comments].sort((a, b) => parseDate(a.at).getTime() - parseDate(b.at).getTime());
  let open: RequestComment | undefined;
  for (const c of sorted) {
    if (c.isTeam && c.isQuestion) open = c;
    else if (open && !c.isTeam) open = undefined;
  }
  return open;
}

// ------------------------------------------------------------
// Countdown bis Auslieferung
// ------------------------------------------------------------

export interface Countdown {
  daysLeft: number;
  /** 0..1, verstrichener Anteil zwischen Annahme und geplantem Datum. */
  progress: number;
}

export function countdown(r: TrackedRequest, release: Release, now: Date, timeZone: string): Countdown {
  const daysLeft = daysUntil(release.plannedDate, now, timeZone);
  const start = statusEntry(r, "accepted")?.at ?? r.createdAt;
  const total = daysUntil(release.plannedDate, parseDate(start), timeZone);
  const progress = total <= 0 ? 1 : Math.min(1, Math.max(0, 1 - daysLeft / total));
  return { daysLeft, progress };
}

// ------------------------------------------------------------
// Filtern, Sortieren, Zählen
// ------------------------------------------------------------

export function inScope(r: TrackedRequest, scope: Scope, me: UserRef): boolean {
  if (scope === "mine") return r.createdBy.id === me.id;
  if (scope === "following") return r.followedByMe;
  return r.isPublic;
}

export function scopeCounts(requests: TrackedRequest[], me: UserRef): Record<Scope, number> {
  return {
    mine: requests.filter((r) => inScope(r, "mine", me)).length,
    public: requests.filter((r) => inScope(r, "public", me)).length,
    following: requests.filter((r) => inScope(r, "following", me)).length,
  };
}

export interface RequestQuery {
  scope: Scope;
  status?: RequestStatus | "all";
  type?: RequestType | "all";
  sort?: SortKey;
}

export function queryRequests(requests: TrackedRequest[], q: RequestQuery, me: UserRef): TrackedRequest[] {
  const out = requests.filter(
    (r) =>
      inScope(r, q.scope, me) &&
      (!q.status || q.status === "all" || r.status === q.status) &&
      (!q.type || q.type === "all" || r.type === q.type),
  );
  if (q.sort === "votes") return out.sort((a, b) => b.votes - a.votes || b.id - a.id);
  return out.sort((a, b) => parseDate(b.createdAt).getTime() - parseDate(a.createdAt).getTime() || b.id - a.id);
}

export function boardColumns(requests: TrackedRequest[]): {
  columns: { status: RequestStatus; items: TrackedRequest[] }[];
  declined: TrackedRequest[];
} {
  return {
    columns: BOARD_COLUMNS.map((status) => ({ status, items: requests.filter((r) => r.status === status) })),
    declined: requests.filter((r) => r.status === "declined"),
  };
}

// ------------------------------------------------------------
// Optimistische Umschalter (Vote / Follow)
// ------------------------------------------------------------

export function toggleVote(r: TrackedRequest): TrackedRequest {
  return { ...r, votedByMe: !r.votedByMe, votes: Math.max(0, r.votes + (r.votedByMe ? -1 : 1)) };
}

export function toggleFollow(r: TrackedRequest): TrackedRequest {
  return { ...r, followedByMe: !r.followedByMe, followers: Math.max(0, r.followers + (r.followedByMe ? -1 : 1)) };
}

// ------------------------------------------------------------
// Dubletten-Vorschläge (Stichwort-Abgleich auf dem Titel)
// ------------------------------------------------------------

function words(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9äöüß]+/)
    .filter((w) => w.length >= 3);
}

const STOP = new Set(["the", "and", "for", "not", "with", "der", "die", "das", "und", "ist", "nicht", "mit", "von", "ein", "eine"]);

/** Bis zu `max` Requests, deren Titel Wörter der Eingabe teilen (Präfix-Abgleich ab 4 Zeichen). */
export function findSimilar(query: string, requests: TrackedRequest[], max = 2): TrackedRequest[] {
  const q = words(query).filter((w) => !STOP.has(w));
  if (q.length === 0) return [];
  const scored: { r: TrackedRequest; score: number }[] = [];
  for (const r of requests) {
    const t = words(r.title);
    let score = 0;
    for (const w of q) {
      if (t.includes(w)) score += 2;
      else if (w.length >= 4 && t.some((x) => x.length >= 4 && (x.startsWith(w.slice(0, 4)) || w.startsWith(x.slice(0, 4))))) score += 1;
    }
    if (score > 0) scored.push({ r, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.r.votes - a.r.votes)
    .slice(0, max)
    .map((x) => x.r);
}

// ------------------------------------------------------------
// Neuer Request: Entwurf, Prüfung, Übergabe an den bestehenden Intake
// ------------------------------------------------------------

export interface AutoContext {
  portal: string;
  pagePath: string;
  /** Browser + App-Version, nur bei Bugs angezeigt. */
  environment?: string;
}

export interface DraftAttachment {
  filename: string;
  contentType: string;
  sizeBytes: number;
  /** Base64 ohne "data:"-Präfix — passt zu IntakeAttachment. */
  dataBase64: string;
  /** Vorschaubild (data:-URL), optional. */
  previewUrl?: string;
  /** Nur true, wenn die App beim Erfassen wirklich Namen unkenntlich gemacht hat. */
  blurred?: boolean;
}

export interface NewRequestDraft {
  type: RequestType;
  title: string;
  description: string;
  expected?: string;
  severity?: Severity;
  audience?: Audience;
  isPublic: boolean;
  notify: boolean;
  attachments: DraftAttachment[];
  context: AutoContext;
}

export const MIN_TITLE_LENGTH = 3;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_EXTENSIONS = ["png", "jpg", "jpeg", "pdf", "doc", "docx", "xlsx", "csv"];

export type DraftError = "titleTooShort" | "descriptionMissing";
export type AttachmentError = "fileType" | "fileSize";

export function validateDraft(d: Pick<NewRequestDraft, "title" | "description">): DraftError[] {
  const errors: DraftError[] = [];
  if (d.title.trim().length < MIN_TITLE_LENGTH) errors.push("titleTooShort");
  if (d.description.trim().length === 0) errors.push("descriptionMissing");
  return errors;
}

export function validateAttachment(a: { filename: string; sizeBytes: number }): AttachmentError | null {
  const ext = a.filename.toLowerCase().split(".").pop() ?? "";
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) return "fileType";
  if (a.sizeBytes > MAX_ATTACHMENT_BYTES) return "fileSize";
  return null;
}

/** Schwere „blockiert" → Hotfix-Schlange. */
export function goesToHotfixQueue(d: Pick<NewRequestDraft, "type" | "severity">): boolean {
  return d.type === "bug" && d.severity === "blocks";
}

/**
 * Entwurf als Klartext für den bestehenden Intake (`submitFeedback`, Feld `text`).
 * So kann eine App den neuen Dialog nutzen, ohne ihre Server-Strecke umzubauen.
 */
export function draftToFeedbackText(d: NewRequestDraft): string {
  const lines = [d.title.trim(), "", d.description.trim()];
  if (d.type === "bug" && d.expected?.trim()) lines.push("", `Expected: ${d.expected.trim()}`);
  const meta: string[] = [];
  if (d.type === "bug" && d.severity) meta.push(`Severity: ${d.severity}`);
  if (d.type === "feature" && d.audience) meta.push(`Audience: ${d.audience}`);
  if (d.type === "feature") meta.push(`Public: ${d.isPublic ? "yes" : "no"}`);
  meta.push(`Notify: ${d.notify ? "yes" : "no"}`);
  meta.push(`Portal: ${d.context.portal}`, `Page: ${d.context.pagePath}`);
  if (d.type === "bug" && d.context.environment) meta.push(`Env: ${d.context.environment}`);
  return [...lines, "", ...meta].join("\n");
}

// ------------------------------------------------------------
// Release-Plan und „Was ist neu"
// ------------------------------------------------------------

export function myRequestIds(requests: TrackedRequest[], me: UserRef): Set<number> {
  return new Set(requests.filter((r) => r.createdBy.id === me.id).map((r) => r.id));
}

export function containsMine(release: Release, mine: Set<number>): boolean {
  return release.items.some((id) => mine.has(id));
}

export interface WhatsNewEntry {
  note: ReleaseNote;
  request?: TrackedRequest;
  relation: "reported" | "upvoted" | "other";
}

/** Je Release: eigene Meldungen zuerst, dann hochgevotete, dann der Rest. */
export function whatsNewEntries(release: Release, requests: TrackedRequest[], me: UserRef): WhatsNewEntry[] {
  const byId = new Map(requests.map((r) => [r.id, r]));
  const rank = { reported: 0, upvoted: 1, other: 2 } as const;
  return release.notes
    .map((note, i) => {
      const request = note.requestId !== undefined ? byId.get(note.requestId) : undefined;
      const relation: WhatsNewEntry["relation"] = request
        ? request.createdBy.id === me.id
          ? "reported"
          : request.votedByMe
            ? "upvoted"
            : "other"
        : "other";
      return { note, request, relation, i };
    })
    .sort((a, b) => rank[a.relation] - rank[b.relation] || a.i - b.i)
    .map(({ note, request, relation }) => ({ note, request, relation }));
}

// ------------------------------------------------------------
// Benachrichtigungen (Toast + Glocke)
// ------------------------------------------------------------

export type TrackingNotification = {
  id: string;
  at: string;
  read: boolean;
  requestId?: number;
  requestTitle?: string;
} & (
  | { kind: "question"; actor: UserRef }
  | { kind: "status"; from: RequestStatus; to: RequestStatus; releaseId?: string }
  | { kind: "dateMoved"; releaseId: string; fromDate: string; toDate: string; affected: number }
  | { kind: "duplicate"; duplicateOfId: number }
  | { kind: "live"; releaseId: string; releaseKind: ReleaseKind }
);

export interface TimelineRange {
  from: string;
  to: string;
  months: { day: string; position: number }[];
}

/** Monatsweiser Zeitstrahl über alle Releases und heute. */
export function timelineRange(releases: Release[], now: Date, timeZone: string): TimelineRange {
  const days = [...releases.map((r) => calendarDay(r.plannedDate, timeZone)), calendarDay(now, timeZone)].sort();
  const [fy, fm] = days[0].split("-").map(Number);
  const [ly, lm] = days[days.length - 1].split("-").map(Number);
  const from = `${fy}-${String(fm).padStart(2, "0")}-01`;
  const endMonth = new Date(Date.UTC(ly, lm, 0));
  const to = endMonth.toISOString().slice(0, 10);
  const months: { day: string; position: number }[] = [];
  let y = fy;
  let m = fm;
  while (y < ly || (y === ly && m <= lm)) {
    const day = `${y}-${String(m).padStart(2, "0")}-01`;
    months.push({ day, position: timelinePosition(day, { from, to }) });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return { from, to, months };
}

export function timelinePosition(day: string, range: { from: string; to: string }): number {
  const a = dayNumber(range.from);
  const b = dayNumber(range.to) + 1;
  return Math.min(1, Math.max(0, (dayNumber(day) - a) / (b - a)));
}
