// Client-Einstieg: das Widget.
export { FeedbackWidget } from "./feedback-widget";
export type { FeedbackWidgetProps } from "./feedback-widget";
export type { FeedbackConfig, IntakeInput, IntakeResult, IntakeKind } from "./config";

// Seiten-Pfad bereinigen -- dieselbe Funktion wie im Server-Einstieg
// (mvp-feedback/server), damit Client und Server nie auseinanderlaufen
// koennen. Client-Aufruf: sanitizePagePath(window.location.href).
export { sanitizePagePath } from "./page-path";

// Rückkanal-Domänenlogik (framework-agnostisch, aus Magenta #1431 extrahiert).
// Auch als eigener Subpath `mvp-feedback/return-channel` verfügbar.
export {
  mapRequestStatus,
  overlayStatus,
  hasOpenClarification,
  openClarificationKeys,
  resolveRequestState,
  REQUEST_STATUS_ORDER,
  DEFAULT_COLUMN_TO_STATUS,
} from "./return-channel";
export type {
  RequestStatusKey,
  RequestState,
  ClarificationDirection,
  ClarificationMessage,
} from "./return-channel";
