// Rückweg Board → App: Spalte + Issue-Zustand → Tracking-Status. Rein, ohne GitHub-Zugriff.
import { currentStage, statusOfStage, type RequestStage, type RequestStatus, type StatusChange } from "./model";

export type IssueState = "OPEN" | "CLOSED";
export type IssueStateReason = "COMPLETED" | "NOT_PLANNED" | "DUPLICATE" | "REOPENED";

/** Ein Eintrag, wie der Board-Status-Job ihn an `PUT /api/board-status` schickt. */
export interface BoardStatusItem {
  number: number;
  title?: string;
  url?: string;
  /** Spaltenname auf dem Board; null, wenn die Karte keine Spalte hat. */
  status: string | null;
  state?: IssueState;
  stateReason?: IssueStateReason | null;
  closedAt?: string;
  /** Verknüpfte Pull Requests (offen oder gemergt), Beleg für „Code fertig“. */
  linkedPullRequests?: number[];
}

/** Soeren E469 (31.10.): Someday = „Angenommen, ohne Termin". */
export const BOARD_COLUMN_TO_TRACKING: Record<string, RequestStatus> = {
  "User Request": "submitted",
  New: "submitted",
  Request: "submitted",
  Next: "accepted",
  Todo: "accepted",
  Someday: "accepted",
  "In Progress": "in_progress",
  "Review (DEV)": "in_progress",
  "Review (TEST)": "in_progress",
  "Done (PROD)": "live",
  Done: "live",
};

/**
 * Geschlossen „nicht geplant" oder „Dublette" → abgelehnt, sonst geschlossen → live.
 * Offen: nach Spalte. Unbekannte oder fehlende Spalte → null (Status nicht anfassen).
 */
export function trackingStatusFromBoard(
  item: Pick<BoardStatusItem, "status" | "state" | "stateReason">,
  columnMap: Record<string, RequestStatus> = BOARD_COLUMN_TO_TRACKING,
): RequestStatus | null {
  if (item.state === "CLOSED") {
    return item.stateReason === "NOT_PLANNED" || item.stateReason === "DUPLICATE" ? "declined" : "live";
  }
  return (item.status && Object.hasOwn(columnMap, item.status) ? columnMap[item.status] : null) ?? null;
}

/** Neuer Stand mit Verlaufseintrag, oder null, wenn sich nichts ändert. */
export function applyBoardStatus(
  current: { status: RequestStatus; statusHistory: StatusChange[] },
  next: RequestStatus,
  at: string,
): { status: RequestStatus; statusHistory: StatusChange[] } | null {
  if (current.status === next) return null;
  return { status: next, statusHistory: [...current.statusHistory, { status: next, at }] };
}

/** Spalten, die „Auf DEV“ belegen (Review (TEST) liegt schon dahinter). */
const ON_DEV_COLUMNS = new Set(["Review (DEV)", "Review (TEST)"]);

/**
 * Feine Stufe aus Board + Issue (A512). „Code fertig“ nur bei verknüpftem PR, „Auf DEV“ nur aus der Spalte.
 * Unbekannt → null (nichts ändern).
 */
export function trackingStageFromBoard(
  item: Pick<BoardStatusItem, "status" | "state" | "stateReason" | "linkedPullRequests">,
  columnMap: Record<string, RequestStatus> = BOARD_COLUMN_TO_TRACKING,
): RequestStage | null {
  const status = trackingStatusFromBoard(item, columnMap);
  if (status !== "in_progress") return status;
  if (item.status && ON_DEV_COLUMNS.has(item.status)) return "on_dev";
  if (item.linkedPullRequests && item.linkedPullRequests.length > 0) return "code_ready";
  return "in_progress";
}

/**
 * Wie applyBoardStatus, aber mit feinen Stufen: ein neuer Verlaufseintrag auch dann, wenn sich nur die Stufe
 * ändert (In Arbeit → Code fertig → Auf DEV). Ältere Einträge ohne stage zählen mit ihrem Status.
 */
export function applyBoardStage(
  current: { status: RequestStatus; statusHistory: StatusChange[] },
  next: RequestStage,
  at: string,
  opts: { pr?: number } = {},
): { status: RequestStatus; statusHistory: StatusChange[] } | null {
  if (currentStage(current) === next && current.status === statusOfStage(next)) return null;
  const status = statusOfStage(next);
  const entry: StatusChange = { status, at, ...(next !== status ? { stage: next } : {}), ...(next === "code_ready" && opts.pr ? { pr: opts.pr } : {}) };
  return { status, statusHistory: [...current.statusHistory, entry] };
}
