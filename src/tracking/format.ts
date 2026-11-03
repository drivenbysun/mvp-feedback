import {
  daysUntil,
  isDateOnly,
  isoWeek,
  openQuestion,
  parseDate,
  releaseOf,
  statusEntry,
  type Release,
  type RequestComment,
  type RequestStatus,
  type TrackedRequest,
  type UserRef,
} from "./model";
import { textsFor, type TrackingLocale, type TrackingTexts } from "./texts";

export interface FormatOptions {
  locale?: TrackingLocale;
  timeZone?: string;
  now?: Date;
  texts?: Partial<TrackingTexts>;
  /** Zusage „Prüfung binnen n Tagen". */
  reviewSlaDays?: number;
}

export interface ShipsWith {
  /** Hauptzeile: Version, „Nicht geplant", „Dublette" … */
  label: string;
  sub: string;
  hotfix: boolean;
  release?: Release;
}

export type StepState = "done" | "current" | "future" | "declined";

export interface Step {
  status: RequestStatus;
  label: string;
  sub: string;
  state: StepState;
}

export type ActivityTone = RequestStatus | "comment" | "merged";

export interface ActivityEvent {
  key: string;
  at: string;
  tone: ActivityTone;
  text: string;
  comment?: RequestComment;
}

export interface Formatter {
  texts: TrackingTexts;
  locale: TrackingLocale;
  timeZone: string;
  now: Date;
  reviewSlaDays: number;
  shortDate(d: string | Date): string;
  weekdayDate(d: string | Date): string;
  relativeDay(d: string | Date): string;
  /** Zeitpunkt mit Uhrzeit in der Zeitzone („3. Nov., 00:24“); reines Datum bleibt ohne Uhrzeit. */
  dateTime(d: string | Date): string;
  /** Wie relativeDay, bei Zeitpunkten mit Uhrzeit („Gestern, 14:02“). */
  relativeDayTime(d: string | Date): string;
  releaseWhen(release: Release): string;
  shipsWith(r: TrackedRequest, releases: Release[]): ShipsWith;
  steps(r: TrackedRequest, releases: Release[]): Step[];
  activity(r: TrackedRequest, all: TrackedRequest[], releases: Release[], me: UserRef, opts?: { hideOpenQuestion?: boolean }): ActivityEvent[];
}

export function createFormatter(opts: FormatOptions = {}): Formatter {
  const locale = opts.locale ?? "en";
  const timeZone = opts.timeZone ?? "Europe/Berlin";
  const now = opts.now ?? new Date();
  const texts = textsFor(locale, opts.texts);
  const reviewSlaDays = opts.reviewSlaDays ?? 2;
  const tag = locale === "de" ? "de-DE" : "en-US";

  const fmt = (o: Intl.DateTimeFormatOptions) => ({
    zoned: new Intl.DateTimeFormat(tag, { ...o, timeZone }),
    day: new Intl.DateTimeFormat(tag, { ...o, timeZone: "UTC" }),
  });
  const short = fmt({ month: "short", day: "numeric" });
  const weekday = fmt({ weekday: "short", month: "short", day: "numeric" });
  const rel = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  // Ein kaputter Zeitstempel aus App-Daten darf nie die ganze Seite reissen: leer statt RangeError.
  const valid = (d: string | Date) => !Number.isNaN(parseDate(d).getTime());
  const format = (f: ReturnType<typeof fmt>, d: string | Date) => (valid(d) ? (isDateOnly(d) ? f.day : f.zoned).format(parseDate(d)) : "");

  const shortDate = (d: string | Date) => format(short, d);
  const time = new Intl.DateTimeFormat(tag, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const dateTime = (d: string | Date) => (!valid(d) ? "" : isDateOnly(d) ? shortDate(d) : `${shortDate(d)}, ${time.format(parseDate(d))}`);
  const weekdayDate = (d: string | Date) => format(weekday, d);
  const relativeDay = (d: string | Date) => {
    if (!valid(d)) return "";
    const diff = daysUntil(d, now, timeZone);
    if (diff <= 0 && diff >= -6) {
      const s = rel.format(diff, "day");
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    return shortDate(d);
  };
  const relativeDayTime = (d: string | Date) =>
    !valid(d) ? "" : isDateOnly(d) ? relativeDay(d) : `${relativeDay(d)}, ${time.format(parseDate(d))}`;
  const inDays = (n: number) => (n === 0 ? texts.today : n === 1 ? texts.tomorrow : texts.inDays(n));

  const releaseWhen = (release: Release) =>
    release.kind === "hotfix"
      ? `${weekdayDate(release.plannedDate)} · ${inDays(Math.max(0, daysUntil(release.plannedDate, now, timeZone)))}`
      : `${texts.kw(isoWeek(release.plannedDate, timeZone))} · ${shortDate(release.plannedDate)}`;

  const shipsWith = (r: TrackedRequest, releases: Release[]): ShipsWith => {
    const release = releaseOf(r, releases);
    const hotfix = release?.kind === "hotfix";
    if (r.status === "declined") {
      return r.duplicateOfId !== undefined
        ? { label: texts.duplicate, sub: texts.mergedInto(r.duplicateOfId), hotfix: false }
        : { label: texts.notScheduled, sub: "", hotfix: false };
    }
    if (r.status === "live") {
      const at = statusEntry(r, "live")?.at ?? release?.plannedDate;
      return { label: release?.id ?? texts.status.live, sub: at ? texts.liveSince(shortDate(at)) : "", hotfix, release };
    }
    if (release) return { label: release.id, sub: releaseWhen(release), hotfix, release };
    // Frisch eingereicht ist keine Absage: „Nicht geplant“ steht nur bei Abgelehnt.
    if (r.status === "submitted") return { label: texts.inReview[r.type], sub: texts.reviewWithin(reviewSlaDays), hotfix: false };
    return { label: texts.noDate, sub: "", hotfix: false };
  };

  const steps = (r: TrackedRequest, releases: Release[]): Step[] => {
    const release = releaseOf(r, releases);
    const current = r.status === "declined" ? 1 : { submitted: 0, accepted: 1, in_progress: 2, live: 3 }[r.status];
    const accepted = statusEntry(r, r.status === "declined" ? "declined" : "accepted");
    const liveAt = statusEntry(r, "live")?.at;
    const subs = [
      dateTime(r.createdAt),
      accepted ? [dateTime(accepted.at), accepted.by ? texts.stepBy(accepted.by.name) : ""].filter(Boolean).join(" · ") : "",
      r.status === "in_progress"
        ? [statusEntry(r, "in_progress") ? dateTime(statusEntry(r, "in_progress")!.at) : "", texts.inDevelopment].filter(Boolean).join(" · ")
        : current > 2 && statusEntry(r, "in_progress")
          ? dateTime(statusEntry(r, "in_progress")!.at)
          : "",
      liveAt
        ? dateTime(liveAt)
        : release && r.status !== "declined"
          ? release.kind === "hotfix"
            ? texts.plannedIn(daysUntil(release.plannedDate, now, timeZone))
            : texts.plannedOn(shortDate(release.plannedDate))
          : "",
    ];
    const order: RequestStatus[] =
      r.status === "declined" ? ["submitted", "declined"] : ["submitted", "accepted", "in_progress", "live"];
    // Ein Datum steht nur an erreichten Stufen; die noch offene Live-Stufe darf den geplanten Termin zeigen.
    const reached = (i: number) => i <= current;
    return order.map((status, i) => ({
      status,
      label: texts.status[status],
      sub: reached(i) || (i === 3 && !liveAt) ? subs[i] : "",
      state:
        r.status === "declined" && i === 1
          ? "declined"
          : i < current || (i === current && r.status === "live")
            ? "done"
            : i === current
              ? "current"
              : "future",
    }));
  };

  const activity = (
    r: TrackedRequest,
    all: TrackedRequest[],
    releases: Release[],
    me: UserRef,
    opts: { hideOpenQuestion?: boolean } = {},
  ): ActivityEvent[] => {
    const release = releaseOf(r, releases);
    const question = (opts.hideOpenQuestion ?? true) ? openQuestion(r) : undefined;
    const events: ActivityEvent[] = [];
    for (const h of r.statusHistory) {
      let text: string;
      if (h.status === "submitted") {
        text = r.createdBy.id === me.id ? texts.submittedByYou(dateTime(h.at)) : texts.submittedBy(r.createdBy.name, dateTime(h.at));
      } else if (h.status === "accepted") {
        text = `${release ? texts.acceptedFor(release.id) : texts.acceptedEvent} · ${dateTime(h.at)}`;
      } else if (h.status === "declined") {
        text = `${texts.declinedEvent} · ${r.duplicateOfId !== undefined ? `${texts.mergedInto(r.duplicateOfId)} · ` : ""}${dateTime(h.at)}`;
      } else {
        text = `${texts.statusChangedTo(texts.status[h.status])} · ${dateTime(h.at)}`;
      }
      events.push({ key: `s-${h.status}-${h.at}`, at: h.at, tone: h.status, text });
    }
    if (!r.statusHistory.some((h) => h.status === "submitted")) {
      events.push({
        key: "s-created",
        at: r.createdAt,
        tone: "submitted",
        text: r.createdBy.id === me.id ? texts.submittedByYou(dateTime(r.createdAt)) : texts.submittedBy(r.createdBy.name, dateTime(r.createdAt)),
      });
    }
    for (const id of r.duplicates) {
      const d = all.find((x) => x.id === id);
      const at = d ? (statusEntry(d, "declined")?.at ?? d.createdAt) : r.createdAt;
      events.push({ key: `m-${id}`, at, tone: "merged", text: texts.mergedEvent(id, d?.title, d?.votes) });
    }
    for (const c of r.comments) {
      if (c === question) continue;
      events.push({ key: `c-${c.id}`, at: c.at, tone: "comment", text: c.text, comment: c });
    }
    return events.sort((a, b) => parseDate(b.at).getTime() - parseDate(a.at).getTime());
  };

  return {
    texts,
    locale,
    timeZone,
    now,
    reviewSlaDays,
    shortDate,
    weekdayDate,
    relativeDay,
    dateTime,
    relativeDayTime,
    releaseWhen,
    shipsWith,
    steps,
    activity,
  };
}
