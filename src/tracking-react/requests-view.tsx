"use client";

import { useState, type KeyboardEvent } from "react";
import { boardColumns, type TrackedRequest } from "../tracking";
import { useTracking } from "./context";
import { StatusBar, StatusPill, TypeDot, VoteButton } from "./primitives";

function openOnKey(open: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
}

export function RequestList({ requests }: { requests: TrackedRequest[] }) {
  const { fmt, releases, vote, navigate } = useTracking();
  const t = fmt.texts;
  return (
    <div className="rt-card rt-table" role="table" aria-label={t.tabs.requests}>
      <div className="rt-table-row rt-th" role="row">
        <span className="rt-label" role="columnheader">{t.columns.votes}</span>
        <span className="rt-label" role="columnheader">{t.columns.request}</span>
        <span className="rt-label" role="columnheader">{t.columns.status}</span>
        <span className="rt-label" role="columnheader">{t.columns.shipsWith}</span>
      </div>
      {requests.length === 0 && <div className="rt-empty">{t.empty}</div>}
      {requests.map((r) => {
        const ship = fmt.shipsWith(r, releases);
        const open = () => navigate({ page: "request", id: r.id });
        return (
          <div
            key={r.id}
            className="rt-table-row rt-row"
            role="row"
            tabIndex={0}
            onClick={open}
            onKeyDown={openOnKey(open)}
            data-request-id={r.id}
          >
            <span role="cell">
              <VoteButton request={r} onVote={vote} fmt={fmt} />
            </span>
            <span role="cell" style={{ minWidth: 0 }}>
              <div className="rt-title">{r.title}</div>
              <div className="rt-meta">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <TypeDot type={r.type} />
                  {t.type[r.type]}
                </span>
                <span className="rt-sep" />
                <span className="rt-mono" style={{ fontSize: 12 }}>#{r.id}</span>
                <span className="rt-sep" />
                <span>{r.portal}</span>
                <span className="rt-sep" />
                <span>{fmt.shortDate(r.createdAt)}</span>
                {r.comments.length > 0 && (
                  <>
                    <span className="rt-sep" />
                    <span>{t.comments(r.comments.length)}</span>
                  </>
                )}
              </div>
            </span>
            <span role="cell">
              <StatusPill status={r.status} fmt={fmt} />
              <StatusBar status={r.status} />
            </span>
            <span role="cell">
              <div className="rt-ship">
                {ship.hotfix && <span className="rt-hotfix">{t.hotfix}</span>}
                {ship.label}
              </div>
              {ship.sub && <div className="rt-ship-sub">{ship.sub}</div>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function RequestBoard({ requests }: { requests: TrackedRequest[] }) {
  const { fmt, releases, vote, navigate } = useTracking();
  const t = fmt.texts;
  const [showDeclined, setShowDeclined] = useState(false);
  const { columns, declined } = boardColumns(requests);
  const cols = showDeclined ? [...columns, { status: "declined" as const, items: declined }] : columns;
  return (
    <>
      <div className="rt-board" data-cols={cols.length}>
        {cols.map((col) => (
          <section key={col.status} className="rt-col" data-status={col.status} aria-label={t.status[col.status]}>
            <div className="rt-col-head">
              <span>
                <span className="rt-sdot" />
                {t.status[col.status]}
              </span>
              <span className="rt-count">{col.items.length}</span>
            </div>
            {col.items.map((r) => {
              const ship = fmt.shipsWith(r, releases);
              const open = () => navigate({ page: "request", id: r.id });
              return (
                <div
                  key={r.id}
                  className="rt-bcard"
                  data-status={r.status}
                  role="button"
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={openOnKey(open)}
                  data-request-id={r.id}
                >
                  <div className="rt-bcard-top">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <TypeDot type={r.type} />
                      {t.type[r.type]} · {r.portal}
                    </span>
                    <span className="rt-mono">#{r.id}</span>
                  </div>
                  <div className="rt-bcard-title">{r.title}</div>
                  <StatusBar status={r.status} />
                  <div className="rt-bcard-foot">
                    <span className="rt-target" style={ship.release ? undefined : { color: "var(--rt-ink)" }}>
                      {ship.hotfix && <span className="rt-hotfix">{t.hotfix}</span>}
                      {ship.label}
                    </span>
                    <VoteButton request={r} onVote={vote} variant="chip" fmt={fmt} />
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
      {declined.length > 0 && (
        <p className="rt-hidden-note">
          {showDeclined ? null : <>{t.declinedHidden(declined.length)} · </>}
          <button type="button" className="rt-link" onClick={() => setShowDeclined((v) => !v)}>
            {showDeclined ? t.hide : t.show}
          </button>
        </p>
      )}
    </>
  );
}
