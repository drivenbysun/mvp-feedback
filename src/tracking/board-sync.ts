// Rückweg Board → App: Spalte + Issue-Zustand → Tracking-Status. Rein, ohne GitHub-Zugriff.
import type { RequestStatus, StatusChange } from "./model";

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
