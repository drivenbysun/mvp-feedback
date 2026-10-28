import type { Audience, RequestStatus, RequestType, Severity } from "./model";

export type TrackingLocale = "en" | "de";

export interface TrackingTexts {
  eyebrow: string;
  tabs: { requests: string; releasePlan: string; whatsNew: string };
  view: { list: string; board: string };
  newRequest: string;
  scopes: { mine: string; public: string; following: string };
  filters: {
    status: string;
    type: string;
    sort: string;
    all: string;
    recent: string;
    votes: string;
  };
  columns: { votes: string; request: string; status: string; shipsWith: string };
  status: Record<RequestStatus, string>;
  type: Record<RequestType, string>;
  comments: (n: number) => string;
  hotfix: string;
  notScheduled: string;
  reviewWithin: (days: number) => string;
  awaitingDecision: string;
  duplicate: string;
  declined: string;
  mergedInto: (id: number) => string;
  liveSince: (date: string) => string;
  kw: (week: number) => string;
  inDays: (n: number) => string;
  today: string;
  tomorrow: string;
  declinedHidden: (n: number) => string;
  show: string;
  hide: string;
  empty: string;
  // Detail
  allRequests: string;
  submittedOn: (date: string) => string;
  following: string;
  follow: string;
  description: string;
  expected: string;
  activity: string;
  teamQuestion: string;
  replyTo: (name: string) => string;
  send: string;
  addComment: string;
  mergedEvent: (id: number, title: string | undefined, votes: number | undefined) => string;
  statusChangedTo: (status: string) => string;
  acceptedFor: (release: string) => string;
  acceptedEvent: string;
  declinedEvent: string;
  submittedByYou: (date: string) => string;
  submittedBy: (name: string, date: string) => string;
  stepBy: (name: string) => string;
  inDevelopment: string;
  plannedOn: (date: string) => string;
  plannedIn: (n: number) => string;
  shipsWithLabel: string;
  shippedWithLabel: string;
  daysToGo: (n: number) => string;
  mayShift: string;
  meta: { status: string; portal: string; comments: string; visibility: string };
  visibility: { public: string; private: string };
  linked: string;
  duplicateTag: string;
  linkDuplicate: string;
  you: string;
  // Release-Plan
  legend: { release: string; hotfix: string; yours: string };
  lanes: { releases: string; features: string; hotfixes: string; bugs: string };
  todayMarker: string;
  ifNeeded: string;
  liveLabel: string;
  releaseCard: (id: string) => string;
  hotfixCard: (id: string) => string;
  countFixes: (n: number) => string;
  countFeatures: (n: number) => string;
  scopeOpen: string;
  planning: string;
  inDaysChip: (n: number) => string;
  todayChip: string;
  tomorrowChip: string;
  yours: string;
  more: (n: number) => string;
  // Was ist neu
  releaseKind: { release: string; hotfix: string };
  youReported: string;
  youUpvoted: string;
  votesTag: (n: number) => string;
  openRequest: string;
  noReleases: string;
  // Dialog
  dialogType: { bug: string; feature: string };
  dialogTitle: { bug: string; feature: string };
  ctx: { portal: string; page: string; env: string; note: string };
  subject: string;
  alreadyReported: string;
  whatHappened: string;
  whatHappenedPlaceholder: string;
  whatExpected: string;
  whatExpectedPlaceholder: string;
  howMuch: string;
  severity: Record<Severity, string>;
  hotfixHint: string;
  problem: string;
  problemPlaceholder: string;
  whoBenefits: string;
  audience: Record<Audience, string>;
  publicToggle: string;
  publicHint: string;
  attachment: string;
  optional: string;
  capturePage: string;
  dropFile: string;
  namesBlurred: string;
  remove: string;
  attachmentsPrivate: string;
  notifyMe: string;
  cancel: string;
  submit: string;
  submitting: string;
  errors: {
    titleTooShort: string;
    descriptionMissing: string;
    fileType: string;
    fileSize: string;
    submitFailed: string;
  };
  // Erfolg
  successTitle: { bug: string; feature: string };
  successText: (title: string, id: number, days: number) => string;
  newReport: string;
  trackRequest: string;
  // Benachrichtigungen
  notifications: string;
  markAllRead: string;
  noNotifications: string;
  dismiss: string;
  seeWhatChanged: string;
  needsReply: string;
  nQuestion: (actor: string, title: string) => string;
  nStatus: (title: string, release?: string) => string;
  nDateMoved: (release: string, from: string, to: string, affected: number) => string;
  nDuplicate: (title: string, id: number) => string;
  nLiveTitle: { bug: string; feature: string };
  nLive: (title: string, kind: "release" | "hotfix", release: string) => string;
  bell: string;
}

export const TEXTS_EN: TrackingTexts = {
  eyebrow: "My work",
  tabs: { requests: "Requests", releasePlan: "Release plan", whatsNew: "What's new" },
  view: { list: "List", board: "Board" },
  newRequest: "+ New request",
  scopes: { mine: "Mine", public: "All public", following: "Following" },
  filters: { status: "Status", type: "Type", sort: "Sort", all: "All", recent: "Recent", votes: "Votes" },
  columns: { votes: "Votes", request: "Request", status: "Status", shipsWith: "Ships with" },
  status: {
    submitted: "Submitted",
    accepted: "Accepted",
    declined: "Declined",
    in_progress: "In progress",
    live: "Live",
  },
  type: { bug: "Bug", feature: "Feature" },
  comments: (n) => `${n} ${n === 1 ? "comment" : "comments"}`,
  hotfix: "Hotfix",
  notScheduled: "Not scheduled",
  reviewWithin: (d) => `Review within ${d} ${d === 1 ? "day" : "days"}`,
  awaitingDecision: "Awaiting decision",
  duplicate: "Duplicate",
  declined: "Declined",
  mergedInto: (id) => `Merged into #${id}`,
  liveSince: (date) => `Live since ${date}`,
  kw: (w) => `KW ${w}`,
  inDays: (n) => `in ${n} ${n === 1 ? "day" : "days"}`,
  today: "today",
  tomorrow: "tomorrow",
  declinedHidden: (n) => `${n} declined ${n === 1 ? "request" : "requests"} hidden`,
  show: "Show",
  hide: "Hide",
  empty: "Nothing here yet.",
  allRequests: "← All requests",
  submittedOn: (d) => `submitted ${d}`,
  following: "✓ Following",
  follow: "Follow",
  description: "Description",
  expected: "Expected",
  activity: "Activity",
  teamQuestion: "Team · Question",
  replyTo: (name) => `Reply to ${name} …`,
  send: "Send",
  addComment: "Add a comment …",
  mergedEvent: (id, title, votes) =>
    `#${id}${title ? ` “${title}”` : ""} was merged into this request${votes ? ` · ${votes} votes carried over` : ""}`,
  statusChangedTo: (s) => `Status changed to ${s}`,
  acceptedFor: (r) => `Accepted and planned for ${r}`,
  acceptedEvent: "Accepted",
  declinedEvent: "Declined",
  submittedByYou: (d) => `Submitted by you · ${d}`,
  submittedBy: (name, d) => `Submitted by ${name} · ${d}`,
  stepBy: (name) => `by ${name}`,
  inDevelopment: "in development",
  plannedOn: (d) => `planned ${d}`,
  plannedIn: (n) => (n <= 0 ? "planned today" : n === 1 ? "planned tomorrow" : `planned in ${n} days`),
  shipsWithLabel: "Ships with",
  shippedWithLabel: "Shipped with",
  daysToGo: (n) => (n === 1 ? "day to go" : "days to go"),
  mayShift: "Planned date, may shift. We notify you if it does.",
  meta: { status: "Status", portal: "Portal", comments: "Comments", visibility: "Visibility" },
  visibility: { public: "Public", private: "Private" },
  linked: "Linked",
  duplicateTag: "Duplicate",
  linkDuplicate: "+ Link a duplicate",
  you: "you",
  legend: { release: "Release (features)", hotfix: "Hotfix (bugs)", yours: "Contains yours" },
  lanes: { releases: "Releases", features: "Features", hotfixes: "Hotfixes", bugs: "Bugs" },
  todayMarker: "Today",
  ifNeeded: "if needed",
  liveLabel: "live",
  releaseCard: (id) => `Release ${id}`,
  hotfixCard: (id) => `Hotfix ${id}`,
  countFixes: (n) => `${n} ${n === 1 ? "fix" : "fixes"}`,
  countFeatures: (n) => `${n} ${n === 1 ? "feature" : "features"}`,
  scopeOpen: "scope open",
  planning: "Planning",
  inDaysChip: (n) => `In ${n} days`,
  todayChip: "Today",
  tomorrowChip: "Tomorrow",
  yours: "yours",
  more: (n) => `+ ${n} more`,
  releaseKind: { release: "Release", hotfix: "Hotfix" },
  youReported: "You reported this",
  youUpvoted: "You upvoted",
  votesTag: (n) => `${n} votes`,
  openRequest: "Open request →",
  noReleases: "No releases yet.",
  dialogType: { bug: "Bug", feature: "Feature request" },
  dialogTitle: { bug: "Report a bug", feature: "Suggest a feature" },
  ctx: { portal: "Portal", page: "Page", env: "Env", note: "added automatically, with your name and time" },
  subject: "Subject",
  alreadyReported: "Already reported? Upvote instead",
  whatHappened: "What happened?",
  whatHappenedPlaceholder: "The map shows all people, not only my group",
  whatExpected: "What did you expect?",
  whatExpectedPlaceholder: "Only people of the selected group",
  howMuch: "How much does it hurt?",
  severity: { blocks: "Blocks my work", annoying: "Annoying", cosmetic: "Cosmetic" },
  hotfixHint: "“Blocks my work” goes to the hotfix queue.",
  problem: "What problem would this solve?",
  problemPlaceholder: "Today I have to … which takes …",
  whoBenefits: "Who would benefit?",
  audience: { me: "Just me", team: "My team", all: "Everyone" },
  publicToggle: "Public — colleagues can upvote and follow",
  publicHint: "Requests with more votes get planned sooner.",
  attachment: "Attachment",
  optional: "(optional)",
  capturePage: "Capture this page",
  dropFile: "or drop a file · PNG, JPG, PDF, DOCX, XLSX, CSV · max. 10 MB",
  namesBlurred: "names blurred automatically",
  remove: "Remove",
  attachmentsPrivate: "Attachments are only visible to signed-in reviewers.",
  notifyMe: "Notify me on status changes",
  cancel: "Cancel",
  submit: "Submit",
  submitting: "Sending …",
  errors: {
    titleTooShort: "Please enter at least 3 characters.",
    descriptionMissing: "Please describe it briefly.",
    fileType: "This file type is not supported.",
    fileSize: "The file is larger than 10 MB.",
    submitFailed: "Could not be sent. Please try again.",
  },
  successTitle: { bug: "Bug reported", feature: "Feature request submitted" },
  successText: (title, id, days) =>
    `“${title}” is now #${id}. We review new requests within ${days} working ${days === 1 ? "day" : "days"}.`,
  newReport: "New report",
  trackRequest: "Track request",
  notifications: "Notifications",
  markAllRead: "Mark all read",
  noNotifications: "No notifications.",
  dismiss: "Dismiss",
  seeWhatChanged: "See what changed",
  needsReply: "needs your reply",
  nQuestion: (a, t) => `${a} asked a question on ${t}`,
  nStatus: (t, r) => (r ? `${t} is planned for ${r}` : `${t} has a new status`),
  nDateMoved: (r, f, t, n) => `Release date of ${r} moved from ${f} to ${t} · affects ${n} of your requests`,
  nDuplicate: (t, id) => `${t} was closed as duplicate of #${id}. Your vote moved there.`,
  nLiveTitle: { bug: "Your bug fix is live", feature: "Your feature is live" },
  nLive: (t, k, r) => `“${t}” shipped with ${k === "hotfix" ? "hotfix" : "release"} ${r}.`,
  bell: "Notifications",
};

export const TEXTS_DE: TrackingTexts = {
  eyebrow: "Meine Arbeit",
  tabs: { requests: "Meldungen", releasePlan: "Release-Plan", whatsNew: "Was ist neu" },
  view: { list: "Liste", board: "Board" },
  newRequest: "+ Neue Meldung",
  scopes: { mine: "Meine", public: "Alle öffentlichen", following: "Gefolgt" },
  filters: { status: "Status", type: "Art", sort: "Sortierung", all: "Alle", recent: "Neueste", votes: "Stimmen" },
  columns: { votes: "Stimmen", request: "Meldung", status: "Status", shipsWith: "Kommt mit" },
  status: {
    submitted: "Eingereicht",
    accepted: "Angenommen",
    declined: "Abgelehnt",
    in_progress: "In Arbeit",
    live: "Live",
  },
  type: { bug: "Fehler", feature: "Wunsch" },
  comments: (n) => `${n} ${n === 1 ? "Kommentar" : "Kommentare"}`,
  hotfix: "Hotfix",
  notScheduled: "Nicht geplant",
  reviewWithin: (d) => `Prüfung binnen ${d} ${d === 1 ? "Tag" : "Tagen"}`,
  awaitingDecision: "Entscheidung offen",
  duplicate: "Dublette",
  declined: "Abgelehnt",
  mergedInto: (id) => `Zusammengeführt in #${id}`,
  liveSince: (date) => `Live seit ${date}`,
  kw: (w) => `KW ${w}`,
  inDays: (n) => `in ${n} ${n === 1 ? "Tag" : "Tagen"}`,
  today: "heute",
  tomorrow: "morgen",
  declinedHidden: (n) => `${n} ${n === 1 ? "abgelehnte Meldung" : "abgelehnte Meldungen"} ausgeblendet`,
  show: "Anzeigen",
  hide: "Ausblenden",
  empty: "Noch nichts hier.",
  allRequests: "← Alle Meldungen",
  submittedOn: (d) => `eingereicht ${d}`,
  following: "✓ Gefolgt",
  follow: "Folgen",
  description: "Beschreibung",
  expected: "Erwartet",
  activity: "Verlauf",
  teamQuestion: "Team · Rückfrage",
  replyTo: (name) => `Antwort an ${name} …`,
  send: "Senden",
  addComment: "Kommentar schreiben …",
  mergedEvent: (id, title, votes) =>
    `#${id}${title ? ` „${title}“` : ""} wurde hier zusammengeführt${votes ? ` · ${votes} Stimmen übernommen` : ""}`,
  statusChangedTo: (s) => `Status geändert auf ${s}`,
  acceptedFor: (r) => `Angenommen und geplant für ${r}`,
  acceptedEvent: "Angenommen",
  declinedEvent: "Abgelehnt",
  submittedByYou: (d) => `Von dir eingereicht · ${d}`,
  submittedBy: (name, d) => `Eingereicht von ${name} · ${d}`,
  stepBy: (name) => `von ${name}`,
  inDevelopment: "in Entwicklung",
  plannedOn: (d) => `geplant ${d}`,
  plannedIn: (n) => (n <= 0 ? "geplant heute" : n === 1 ? "geplant morgen" : `geplant in ${n} Tagen`),
  shipsWithLabel: "Kommt mit",
  shippedWithLabel: "Kam mit",
  daysToGo: (n) => (n === 1 ? "Tag noch" : "Tage noch"),
  mayShift: "Geplantes Datum, kann sich verschieben. Wir sagen dir Bescheid.",
  meta: { status: "Status", portal: "Portal", comments: "Kommentare", visibility: "Sichtbarkeit" },
  visibility: { public: "Öffentlich", private: "Privat" },
  linked: "Verknüpft",
  duplicateTag: "Dublette",
  linkDuplicate: "+ Dublette verknüpfen",
  you: "dir",
  legend: { release: "Release (Wünsche)", hotfix: "Hotfix (Fehler)", yours: "Enthält deine" },
  lanes: { releases: "Releases", features: "Wünsche", hotfixes: "Hotfixes", bugs: "Fehler" },
  todayMarker: "Heute",
  ifNeeded: "falls nötig",
  liveLabel: "live",
  releaseCard: (id) => `Release ${id}`,
  hotfixCard: (id) => `Hotfix ${id}`,
  countFixes: (n) => `${n} ${n === 1 ? "Fehlerbehebung" : "Fehlerbehebungen"}`,
  countFeatures: (n) => `${n} ${n === 1 ? "Wunsch" : "Wünsche"}`,
  scopeOpen: "Umfang offen",
  planning: "In Planung",
  inDaysChip: (n) => `In ${n} Tagen`,
  todayChip: "Heute",
  tomorrowChip: "Morgen",
  yours: "deine",
  more: (n) => `+ ${n} weitere`,
  releaseKind: { release: "Release", hotfix: "Hotfix" },
  youReported: "Von dir gemeldet",
  youUpvoted: "Von dir unterstützt",
  votesTag: (n) => `${n} Stimmen`,
  openRequest: "Meldung öffnen →",
  noReleases: "Noch keine Releases.",
  dialogType: { bug: "Fehler", feature: "Wunsch" },
  dialogTitle: { bug: "Fehler melden", feature: "Wunsch einreichen" },
  ctx: { portal: "Portal", page: "Seite", env: "Umg.", note: "automatisch ergänzt, mit deinem Namen und der Uhrzeit" },
  subject: "Betreff",
  alreadyReported: "Schon gemeldet? Lieber unterstützen",
  whatHappened: "Was ist passiert?",
  whatHappenedPlaceholder: "Die Karte zeigt alle Personen, nicht nur meine Gruppe",
  whatExpected: "Was hast du erwartet?",
  whatExpectedPlaceholder: "Nur Personen der gewählten Gruppe",
  howMuch: "Wie sehr stört es?",
  severity: { blocks: "Blockiert meine Arbeit", annoying: "Lästig", cosmetic: "Kosmetisch" },
  hotfixHint: "„Blockiert meine Arbeit“ kommt in die Hotfix-Schlange.",
  problem: "Welches Problem löst das?",
  problemPlaceholder: "Heute muss ich … und das dauert …",
  whoBenefits: "Wem hilft es?",
  audience: { me: "Nur mir", team: "Meinem Team", all: "Allen" },
  publicToggle: "Öffentlich — Kollegen können unterstützen und folgen",
  publicHint: "Meldungen mit mehr Stimmen werden früher eingeplant.",
  attachment: "Anhang",
  optional: "(optional)",
  capturePage: "Diese Seite aufnehmen",
  dropFile: "oder Datei ablegen · PNG, JPG, PDF, DOCX, XLSX, CSV · max. 10 MB",
  namesBlurred: "Namen automatisch unkenntlich",
  remove: "Entfernen",
  attachmentsPrivate: "Anhänge sehen nur angemeldete Prüfer.",
  notifyMe: "Bei Statusänderungen benachrichtigen",
  cancel: "Abbrechen",
  submit: "Absenden",
  submitting: "Wird gesendet …",
  errors: {
    titleTooShort: "Bitte mindestens 3 Zeichen eingeben.",
    descriptionMissing: "Bitte kurz beschreiben.",
    fileType: "Dieses Dateiformat wird nicht unterstützt.",
    fileSize: "Die Datei ist größer als 10 MB.",
    submitFailed: "Konnte nicht gesendet werden. Bitte erneut versuchen.",
  },
  successTitle: { bug: "Fehler gemeldet", feature: "Wunsch eingereicht" },
  successText: (title, id, days) =>
    `„${title}“ ist jetzt #${id}. Wir prüfen neue Meldungen binnen ${days} ${days === 1 ? "Werktag" : "Werktagen"}.`,
  newReport: "Neue Meldung",
  trackRequest: "Meldung verfolgen",
  notifications: "Benachrichtigungen",
  markAllRead: "Alle gelesen",
  noNotifications: "Keine Benachrichtigungen.",
  dismiss: "Schließen",
  seeWhatChanged: "Was ist neu?",
  needsReply: "wartet auf deine Antwort",
  nQuestion: (a, t) => `${a} hat eine Rückfrage zu ${t}`,
  nStatus: (t, r) => (r ? `${t} ist geplant für ${r}` : `${t} hat einen neuen Status`),
  nDateMoved: (r, f, t, n) => `Termin von ${r} verschoben von ${f} auf ${t} · betrifft ${n} deiner Meldungen`,
  nDuplicate: (t, id) => `${t} wurde als Dublette von #${id} geschlossen. Deine Stimme zählt jetzt dort.`,
  nLiveTitle: { bug: "Deine Fehlerbehebung ist live", feature: "Dein Wunsch ist live" },
  nLive: (t, k, r) => `„${t}“ kam mit ${k === "hotfix" ? "Hotfix" : "Release"} ${r}.`,
  bell: "Benachrichtigungen",
};

export function textsFor(locale: TrackingLocale, overrides?: Partial<TrackingTexts>): TrackingTexts {
  return { ...(locale === "de" ? TEXTS_DE : TEXTS_EN), ...overrides };
}
