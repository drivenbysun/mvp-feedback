// Erfundene Beispieldaten (Stand „heute" = 27.10.2026). Für Tests, Storybook und Vorschau. Keine echten Tickets, Personen oder Portale.
import type { Release, TrackedRequest, TrackingNotification, UserRef } from "./model";

export const DEMO_NOW = new Date("2026-10-27T10:00:00+01:00");
export const DEMO_ME: UserRef = { id: "u-me", name: "Robin Muster" };
const SARAH: UserRef = { id: "u-sarah", name: "Kim Beispiel" };
const OTHER: UserRef = { id: "u-other", name: "Jo Test" };

type Seed = Partial<TrackedRequest> & Pick<TrackedRequest, "id" | "type" | "title" | "portal" | "createdAt" | "status" | "votes">;

function req(s: Seed): TrackedRequest {
  return {
    description: "",
    isPublic: true,
    createdBy: DEMO_ME,
    statusHistory: [{ status: "submitted", at: s.createdAt }],
    duplicates: [],
    votedByMe: false,
    followedByMe: false,
    followers: 0,
    comments: [],
    attachments: [],
    ...s,
  };
}

export const DEMO_REQUESTS: TrackedRequest[] = [
  req({ id: 1049, type: "bug", title: "Reminder e-mail shows wrong sender", portal: "Inbox", createdAt: "2026-10-26", status: "submitted", votes: 2, description: "Reminder e-mails show the system address instead of the team name.", severity: "annoying" }),
  req({
    id: 1046, type: "bug", title: "Calendar: week view ignores the team filter", portal: "Calendar", createdAt: "2026-10-22", status: "in_progress", votes: 9, followedByMe: true, followers: 3,
    description: "In Calendar › Week, choosing a team does not filter the entries. All entries are still shown.", severity: "blocks", targetReleaseId: "v2.13.3",
    statusHistory: [
      { status: "submitted", at: "2026-10-22" },
      { status: "accepted", at: "2026-10-23", by: SARAH },
      { status: "in_progress", at: "2026-10-26" },
    ],
    comments: [
      { id: "c1", author: SARAH, at: "2026-10-23T09:00:00Z", text: "Reproduced, thanks.", isTeam: true },
      { id: "c2", author: DEMO_ME, at: "2026-10-23T10:00:00Z", text: "Thanks!" },
    ],
  }),
  req({
    id: 1041, type: "feature", title: "Order office supplies", portal: "Shop", createdAt: "2026-10-14", status: "in_progress", votes: 31, votedByMe: true, followedByMe: true, followers: 12, targetReleaseId: "v2.14", duplicates: [1018], audience: "all",
    description: "As an employee I want to order pens, paper and other supplies directly in the app instead of writing an e-mail.",
    statusHistory: [
      { status: "submitted", at: "2026-10-14" },
      { status: "accepted", at: "2026-10-16", by: SARAH },
      { status: "in_progress", at: "2026-10-21" },
    ],
    comments: [
      { id: "c3", author: OTHER, at: "2026-10-15T08:00:00Z", text: "Would love this for notebooks too." },
      { id: "c4", author: SARAH, at: "2026-10-26T15:00:00Z", text: "Should orders go to your team lead for approval first, or straight to purchasing?", isTeam: true, isQuestion: true },
    ],
  }),
  req({ id: 1039, type: "feature", title: "Keep the draft when the dialog closes", portal: "Profile", createdAt: "2026-10-13", status: "in_progress", votes: 12, targetReleaseId: "v2.14", statusHistory: [{ status: "submitted", at: "2026-10-13" }, { status: "accepted", at: "2026-10-15", by: SARAH }, { status: "in_progress", at: "2026-10-22" }] }),
  req({ id: 1035, type: "feature", title: "Team lead: edit team member details", portal: "Directory", createdAt: "2026-10-09", status: "accepted", votes: 24, targetReleaseId: "v2.15", statusHistory: [{ status: "submitted", at: "2026-10-09" }, { status: "accepted", at: "2026-10-12", by: SARAH }] }),
  req({ id: 1033, type: "feature", title: "Workload view for team leads", portal: "Calendar", createdAt: "2026-10-08", status: "accepted", votes: 18, targetReleaseId: "v2.15", duplicates: [1030], statusHistory: [{ status: "submitted", at: "2026-10-08" }, { status: "accepted", at: "2026-10-10", by: SARAH }] }),
  req({ id: 1030, type: "feature", title: "Workload tab: show project names", portal: "Timesheet", createdAt: "2026-10-06", status: "declined", votes: 3, duplicateOfId: 1033, statusHistory: [{ status: "submitted", at: "2026-10-06" }, { status: "declined", at: "2026-10-07", by: SARAH }] }),
  req({ id: 1027, type: "bug", title: "Directory: CSV export ignores the column selection", portal: "Directory", createdAt: "2026-10-02", status: "live", votes: 14, targetReleaseId: "v2.13.2", severity: "blocks", statusHistory: [{ status: "submitted", at: "2026-10-02" }, { status: "accepted", at: "2026-10-05", by: SARAH }, { status: "in_progress", at: "2026-10-12" }, { status: "live", at: "2026-10-20" }] }),
  req({ id: 1044, type: "feature", title: "Dark mode for the calendar", portal: "Calendar", createdAt: "2026-10-19", status: "accepted", votes: 57, followedByMe: true, createdBy: OTHER, targetReleaseId: "v2.15", statusHistory: [{ status: "submitted", at: "2026-10-19" }, { status: "accepted", at: "2026-10-20", by: SARAH }] }),
  req({ id: 1040, type: "bug", title: "Receipts: photo upload fails on iOS", portal: "Receipts", createdAt: "2026-10-14", status: "in_progress", votes: 22, createdBy: OTHER, targetReleaseId: "v2.13.3", statusHistory: [{ status: "submitted", at: "2026-10-14" }, { status: "accepted", at: "2026-10-15" }, { status: "in_progress", at: "2026-10-20" }] }),
  req({ id: 1036, type: "feature", title: "Approve several leave requests at once", portal: "Leave", createdAt: "2026-10-10", status: "submitted", votes: 40, createdBy: OTHER }),
  req({ id: 1018, type: "feature", title: "Order a new notebook", portal: "Shop", createdAt: "2026-09-28", status: "declined", votes: 6, createdBy: OTHER, duplicateOfId: 1041, isPublic: false, statusHistory: [{ status: "submitted", at: "2026-09-28" }, { status: "declined", at: "2026-10-17" }] }),
];

export const DEMO_RELEASES: Release[] = [
  { id: "v2.13", kind: "release", plannedDate: "2026-10-08", state: "live", items: [], notes: [
    { title: "Team overview with filter", text: "Filter your team by role.", requestId: 1044 },
    { title: "Weather in the header", text: "Today's forecast next to the date.", requestId: 1036 },
    { title: "Faster inbox", text: "Loads about twice as fast.", tag: "Improvement" },
  ] },
  { id: "v2.13.2", kind: "hotfix", plannedDate: "2026-10-20", state: "live", items: [1027], notes: [
    { title: "CSV export respects the column selection", text: "Exports from the directory only contain the chosen columns.", requestId: 1027 },
    { title: "Fixed date picker in Receipts on Safari", text: "" },
    { title: "Inbox no longer shows read items as new", text: "" },
  ] },
  { id: "v2.13.3", kind: "hotfix", plannedDate: "2026-10-29", state: "scheduled", items: [1046, 1040], notes: [] },
  { id: "v2.14", kind: "release", plannedDate: "2026-11-12", state: "scheduled", items: [1041, 1039], notes: [] },
  { id: "v2.14.1", kind: "hotfix", plannedDate: "2026-11-19", state: "planning", isConditional: true, items: [], notes: [] },
  { id: "v2.15", kind: "release", plannedDate: "2026-12-10", state: "planning", items: [1035, 1033, 1044], notes: [] },
];

export const DEMO_NOTIFICATIONS: TrackingNotification[] = [
  { id: "n1", kind: "question", at: "2026-10-26T15:00:00Z", read: false, requestId: 1041, requestTitle: "Order office supplies", actor: SARAH },
  { id: "n2", kind: "status", at: "2026-10-26T09:00:00Z", read: false, requestId: 1046, requestTitle: "Week view ignores the team filter", from: "accepted", to: "in_progress", releaseId: "v2.13.3" },
  { id: "n3", kind: "dateMoved", at: "2026-10-24T09:00:00Z", read: true, releaseId: "v2.15", fromDate: "2026-12-03", toDate: "2026-12-10", affected: 2 },
  { id: "n4", kind: "duplicate", at: "2026-10-07T09:00:00Z", read: true, requestId: 1030, requestTitle: "Workload tab: show project…", duplicateOfId: 1033 },
];
