"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calendarDay,
  containsMine,
  daysUntil,
  isoWeek,
  myRequestIds,
  parseDate,
  timelinePosition,
  timelineRange,
  whatsNewEntries,
  type Release,
} from "../tracking";
import { useTracking } from "./context";

const MAX_CARD_ITEMS = 3;

export function ReleasePlan() {
  const { fmt, me, requests, releases, navigate } = useTracking();
  const t = fmt.texts;
  const mine = useMemo(() => myRequestIds(requests, me), [requests, me]);
  const byId = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  const sorted = useMemo(() => [...releases].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)), [releases]);
  if (sorted.length === 0) return <p className="rt-empty">{t.noReleases}</p>;

  const today = calendarDay(fmt.now, fmt.timeZone);
  const range = timelineRange(sorted, fmt.now, fmt.timeZone);
  const monthFmt = new Intl.DateTimeFormat(fmt.locale === "de" ? "de-DE" : "en-US", { month: "short", timeZone: "UTC" });
  const isPast = (r: Release) => r.state === "live" || r.plannedDate < today;

  const upcoming = sorted.filter((r) => !isPast(r));
  const nextHotfix = upcoming.find((r) => r.kind === "hotfix" && !r.isConditional) ?? upcoming.find((r) => r.kind === "hotfix");
  const upcomingReleases = upcoming.filter((r) => r.kind === "release");
  const cards = [nextHotfix, upcomingReleases[0], upcomingReleases[1]].filter((x): x is Release => !!x);

  const lane = (kind: Release["kind"]) => (
    <div className="rt-lane-track">
      {sorted
        .filter((r) => r.kind === kind)
        .map((r) => (
          <div
            key={r.id}
            className="rt-tl-item"
            data-kind={kind}
            data-state={r.state}
            data-past={isPast(r)}
            data-conditional={!!r.isConditional}
            style={{ left: `${timelinePosition(r.plannedDate, range) * 100}%` }}
          >
            <span className="rt-tl-shape">
              {containsMine(r, mine) && !isPast(r) && <span className="rt-tl-mine" title={t.legend.yours} />}
            </span>
            <span>
              <div className="rt-tl-name">{r.id}</div>
              <div className="rt-tl-sub">
                {kind === "release" && !isPast(r) ? `${t.kw(isoWeek(r.plannedDate, fmt.timeZone))} · ` : ""}
                {fmt.shortDate(r.plannedDate)}
                {isPast(r) ? ` · ${t.liveLabel}` : r.isConditional ? ` · ${t.ifNeeded}` : ""}
              </div>
            </span>
          </div>
        ))}
    </div>
  );

  return (
    <>
      <div className="rt-legend">
        <span>
          <i className="rt-sq" /> {t.legend.release}
        </span>
        <span>
          <i className="rt-dia" /> {t.legend.hotfix}
        </span>
        <span>
          <i className="rt-circ" /> {t.legend.yours}
        </span>
      </div>

      <div className="rt-card rt-tlcard">
        <div className="rt-tl-grid">
          <div className="rt-tl-months">
            {range.months.map((m) => (
              <span key={m.day} style={{ left: `${m.position * 100}%` }}>
                {monthFmt.format(parseDate(m.day))}
              </span>
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <div className="rt-lane" style={{ height: 96 }}>
              <div className="rt-lane-label">
                {t.lanes.releases}
                <small>{t.lanes.features}</small>
              </div>
              {lane("release")}
            </div>
            <div className="rt-lane" style={{ height: 80 }}>
              <div className="rt-lane-label">
                {t.lanes.hotfixes}
                <small>{t.lanes.bugs}</small>
              </div>
              {lane("hotfix")}
            </div>
            <div style={{ position: "absolute", top: -28, bottom: 0, left: 110, right: 0, pointerEvents: "none" }}>
              <div className="rt-today" style={{ left: `${timelinePosition(today, range) * 100}%` }}>
                <span>{t.todayMarker}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rt-rcards">
        {cards.map((r) => {
          const days = daysUntil(r.plannedDate, fmt.now, fmt.timeZone);
          const chip = r.state === "planning" && r.kind === "release" ? t.planning : days <= 0 ? t.todayChip : days === 1 ? t.tomorrowChip : t.inDaysChip(days);
          const items = [...r.items].sort((a, b) => Number(mine.has(b)) - Number(mine.has(a)));
          const shown = items.slice(0, MAX_CARD_ITEMS);
          const count = r.kind === "hotfix" ? t.countFixes(r.items.length) : r.state === "planning" ? t.scopeOpen : t.countFeatures(r.items.length);
          return (
            <section key={r.id} className="rt-card rt-rcard" data-state={r.state}>
              <div className="rt-rcard-head">
                <div className="rt-rcard-title">
                  {r.kind === "hotfix" ? <i className="rt-dia" /> : <i className="rt-sq" />}
                  {r.kind === "hotfix" ? t.hotfixCard(r.id) : t.releaseCard(r.id)}
                </div>
                <span className="rt-chip-when" data-soon={days <= 1 && r.state !== "planning"}>
                  {chip}
                </span>
              </div>
              <div className="rt-rcard-sub">
                {r.kind === "release" ? `${t.kw(isoWeek(r.plannedDate, fmt.timeZone))} · ` : ""}
                {fmt.weekdayDate(r.plannedDate)} · {count}
              </div>
              <ul>
                {shown.map((id) => {
                  const req = byId.get(id);
                  const isMine = mine.has(id);
                  return (
                    <li key={id} data-mine={isMine}>
                      <span>
                        {req ? (
                          <button type="button" onClick={() => navigate({ page: "request", id })} style={{ textAlign: "left" }}>
                            {req.title}
                          </button>
                        ) : (
                          `#${id}`
                        )}
                        {isMine && <span className="rt-yours"> · {t.yours}</span>}
                      </span>
                    </li>
                  );
                })}
                {items.length > shown.length && <li className="rt-more" style={{ listStyle: "none" }}>{t.more(items.length - shown.length)}</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

export function WhatsNew({ releaseId }: { releaseId?: string }) {
  const { fmt, me, requests, releases, navigate } = useTracking();
  const t = fmt.texts;
  const today = calendarDay(fmt.now, fmt.timeZone);
  const shipped = useMemo(
    () => releases.filter((r) => r.state === "live" || r.plannedDate <= today).sort((a, b) => b.plannedDate.localeCompare(a.plannedDate)),
    [releases, today],
  );
  const [active, setActive] = useState(releaseId ?? shipped[0]?.id);
  const refs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (releaseId) {
      setActive(releaseId);
      refs.current.get(releaseId)?.scrollIntoView({ block: "start" });
    }
  }, [releaseId]);

  if (shipped.length === 0) return <p className="rt-empty">{t.noReleases}</p>;

  const jump = (id: string) => {
    setActive(id);
    refs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="rt-wn">
      <nav className="rt-wn-nav">
        {shipped.map((r) => (
          <button key={r.id} type="button" aria-current={active === r.id} onClick={() => jump(r.id)}>
            {r.id} · {fmt.shortDate(r.plannedDate)}
          </button>
        ))}
      </nav>
      <div className="rt-stack">
        {shipped.map((r) => {
          const entries = whatsNewEntries(r, requests, me);
          const reported = entries.filter((e) => e.relation === "reported");
          const rest = entries.filter((e) => e.relation !== "reported");
          return (
            <section
              key={r.id}
              className="rt-card rt-wn-card"
              ref={(el) => {
                if (el) refs.current.set(r.id, el);
                else refs.current.delete(r.id);
              }}
            >
              <div className="rt-wn-head">
                {r.kind === "hotfix" ? <i className="rt-dia" /> : <i className="rt-sq" />}
                <h3>{r.id}</h3>
                <span>
                  {t.releaseKind[r.kind]} · {fmt.weekdayDate(r.plannedDate)}
                </span>
              </div>
              {reported.map((e) => (
                <div key={e.note.title} className="rt-wn-mine">
                  <div>
                    <div className="rt-label">{t.youReported}</div>
                    <h4>{e.note.title}</h4>
                    <p>
                      {e.note.text}
                      {e.request ? ` #${e.request.id}` : ""}
                    </p>
                  </div>
                  {e.request && (
                    <button type="button" className="rt-link" style={{ fontSize: 13, fontWeight: 600, alignSelf: "flex-start", whiteSpace: "nowrap" }} onClick={() => navigate({ page: "request", id: e.request!.id })}>
                      {t.openRequest}
                    </button>
                  )}
                </div>
              ))}
              {r.kind === "hotfix" ? (
                rest.length > 0 && (
                  <ul className="rt-wn-list">
                    {rest.map((e) => (
                      <li key={e.note.title}>{e.note.title}</li>
                    ))}
                  </ul>
                )
              ) : (
                rest.length > 0 && (
                  <div className="rt-wn-grid">
                    {rest.map((e) => (
                      <div key={e.note.title} className="rt-wn-item">
                        {e.relation === "upvoted" ? (
                          <span className="rt-tag rt-tag-grey">{t.youUpvoted}</span>
                        ) : e.request ? (
                          <span className="rt-label" style={{ fontSize: 10 }}>{t.votesTag(e.request.votes)}</span>
                        ) : e.note.tag ? (
                          <span className="rt-label" style={{ fontSize: 10 }}>{e.note.tag}</span>
                        ) : null}
                        <h4>{e.note.title}</h4>
                        {e.note.text && <p>{e.note.text}</p>}
                      </div>
                    ))}
                  </div>
                )
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
