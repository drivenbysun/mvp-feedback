// Beispieldaten aus dem Design-Handoff (Stand „heute" = 27.10.2026). Für Tests, Storybook und Vorschau.
import type { Release, TrackedRequest, TrackingNotification, UserRef } from "./model";

export const DEMO_NOW = new Date("2026-10-27T10:00:00+01:00");
export const DEMO_ME: UserRef = { id: "u-me", name: "Alex M." };
const SARAH: UserRef = { id: "u-sarah", name: "Sarah K." };
const OTHER: UserRef = { id: "u-other", name: "Jonas B." };

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
  req({ id: 1049, type: "bug", title: "Names in Alerts unmasked", portal: "Alerts", createdAt: "2026-10-26", status: "submitted", votes: 2, description: "Alert e-mails show full names although the privacy setting is on.", severity: "annoying" }),
  req({
    id: 1046, type: "bug", title: "Team - People : Map is not filtering for Group", portal: "Team", createdAt: "2026-10-22", status: "in_progress", votes: 9, followedByMe: true, followers: 3,
    description: "On Team › People › Map, selecting a group does not filter the map. All people are still shown.", severity: "blocks", targetReleaseId: "v2.13.3",
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
    id: 1041, type: "feature", title: "View and request assets", portal: "Equipment", createdAt: "2026-10-14", status: "in_progress", votes: 31, votedByMe: true, followedByMe: true, followers: 12, targetReleaseId: "v2.14", duplicates: [1018], audience: "all",
    description: "As an employee I want to see which equipment is assigned to me (laptop, phone, monitor) and request new or replacement items directly from the portal instead of writing to IT.",
    statusHistory: [
      { status: "submitted", at: "2026-10-14" },
      { status: "accepted", at: "2026-10-16", by: SARAH },
      { status: "in_progress", at: "2026-10-21" },
    ],
    comments: [
      { id: "c3", author: OTHER, at: "2026-10-15T08:00:00Z", text: "Would love this for monitors too." },
      { id: "c4", author: SARAH, at: "2026-10-26T15:00:00Z", text: "Should requests go to your chapter lead for approval first, or straight to IT?", isTeam: true, isQuestion: true },
    ],
  }),
  req({ id: 1039, type: "feature", title: "Feature Request window persistence", portal: "MySpace", createdAt: "2026-10-13", status: "in_progress", votes: 12, targetReleaseId: "v2.14", statusHistory: [{ status: "submitted", at: "2026-10-13" }, { status: "accepted", at: "2026-10-15", by: SARAH }, { status: "in_progress", at: "2026-10-22" }] }),
  req({ id: 1035, type: "feature", title: "Chapter Lead: Edit data of people", portal: "People", createdAt: "2026-10-09", status: "accepted", votes: 24, targetReleaseId: "v2.15", statusHistory: [{ status: "submitted", at: "2026-10-09" }, { status: "accepted", at: "2026-10-12", by: SARAH }] }),
  req({ id: 1033, type: "feature", title: "Team - Utilization View for the chapter lead", portal: "Team", createdAt: "2026-10-08", status: "accepted", votes: 18, targetReleaseId: "v2.15", duplicates: [1030], statusHistory: [{ status: "submitted", at: "2026-10-08" }, { status: "accepted", at: "2026-10-10", by: SARAH }] }),
  req({ id: 1030, type: "feature", title: "Utilization Tab show names of assigned projects", portal: "Time tracking", createdAt: "2026-10-06", status: "declined", votes: 3, duplicateOfId: 1033, statusHistory: [{ status: "submitted", at: "2026-10-06" }, { status: "declined", at: "2026-10-07", by: SARAH }] }),
  req({ id: 1027, type: "bug", title: "People: Export Excel exports real names", portal: "People", createdAt: "2026-10-02", status: "live", votes: 14, targetReleaseId: "v2.13.2", severity: "blocks", statusHistory: [{ status: "submitted", at: "2026-10-02" }, { status: "accepted", at: "2026-10-05", by: SARAH }, { status: "in_progress", at: "2026-10-12" }, { status: "live", at: "2026-10-20" }] }),
  req({ id: 1044, type: "feature", title: "Dark mode for calendar view", portal: "Calendar", createdAt: "2026-10-19", status: "accepted", votes: 57, followedByMe: true, createdBy: OTHER, targetReleaseId: "v2.15", statusHistory: [{ status: "submitted", at: "2026-10-19" }, { status: "accepted", at: "2026-10-20", by: SARAH }] }),
  req({ id: 1040, type: "bug", title: "Expenses: receipt upload fails on iOS", portal: "Expenses", createdAt: "2026-10-14", status: "in_progress", votes: 22, createdBy: OTHER, targetReleaseId: "v2.13.3", statusHistory: [{ status: "submitted", at: "2026-10-14" }, { status: "accepted", at: "2026-10-15" }, { status: "in_progress", at: "2026-10-20" }] }),
  req({ id: 1036, type: "feature", title: "Bulk approve vacation requests", portal: "Vacation", createdAt: "2026-10-10", status: "submitted", votes: 40, createdBy: OTHER }),
  req({ id: 1018, type: "feature", title: "Order a new monitor", portal: "Equipment", createdAt: "2026-09-28", status: "declined", votes: 6, createdBy: OTHER, duplicateOfId: 1041, isPublic: false, statusHistory: [{ status: "submitted", at: "2026-09-28" }, { status: "declined", at: "2026-10-17" }] }),
];

export const DEMO_RELEASES: Release[] = [
  { id: "v2.13", kind: "release", plannedDate: "2026-10-08", state: "live", items: [], notes: [
    { title: "Team overview with skills filter", text: "Filter your team by skill and seniority.", requestId: 1044 },
    { title: "Weather in the header", text: "Today's forecast next to the date.", requestId: 1036 },
    { title: "Faster inbox", text: "Loads about twice as fast.", tag: "Improvement" },
  ] },
  { id: "v2.13.2", kind: "hotfix", plannedDate: "2026-10-20", state: "live", items: [1027], notes: [
    { title: "Excel export now masks names", text: "Exports from People respect your privacy setting.", requestId: 1027 },
    { title: "Fixed date picker in Expenses on Safari", text: "" },
    { title: "Inbox no longer shows read items as new", text: "" },
  ] },
  { id: "v2.13.3", kind: "hotfix", plannedDate: "2026-10-29", state: "scheduled", items: [1046, 1040], notes: [] },
  { id: "v2.14", kind: "release", plannedDate: "2026-11-12", state: "scheduled", items: [1041, 1039], notes: [] },
  { id: "v2.14.1", kind: "hotfix", plannedDate: "2026-11-19", state: "planning", isConditional: true, items: [], notes: [] },
  { id: "v2.15", kind: "release", plannedDate: "2026-12-10", state: "planning", items: [1035, 1033, 1044], notes: [] },
];

export const DEMO_NOTIFICATIONS: TrackingNotification[] = [
  { id: "n1", kind: "question", at: "2026-10-26T15:00:00Z", read: false, requestId: 1041, requestTitle: "View and request assets", actor: SARAH },
  { id: "n2", kind: "status", at: "2026-10-26T09:00:00Z", read: false, requestId: 1046, requestTitle: "Map is not filtering for Group", from: "accepted", to: "in_progress", releaseId: "v2.13.3" },
  { id: "n3", kind: "dateMoved", at: "2026-10-24T09:00:00Z", read: true, releaseId: "v2.15", fromDate: "2026-12-03", toDate: "2026-12-10", affected: 2 },
  { id: "n4", kind: "duplicate", at: "2026-10-07T09:00:00Z", read: true, requestId: 1030, requestTitle: "Utilization Tab show names…", duplicateOfId: 1033 },
];
