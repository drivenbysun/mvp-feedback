// Server-Einstieg: der Intake (nur aus Server-Actions/Route-Handlern importieren).
export { submitFeedback, createBoardIssue } from "./intake";
export { attachmentsFromFormData } from "./form-data";
// Dieselbe Funktion wie im Client-Einstieg (".") -- serverseitig auf JEDEN
// eingehenden Wert anwenden, bevor er gespeichert wird. Eine Bereinigung, die
// nur der Client macht, ist keine Bereinigung.
export { sanitizePagePath } from "./page-path";
export type {
  FeedbackConfig,
  IntakeInput,
  IntakeResult,
  IntakeKind,
  IntakeAttachment,
  IntakeTarget,
  FeedbackScope,
  CreateBoardIssueInput,
} from "./config";
