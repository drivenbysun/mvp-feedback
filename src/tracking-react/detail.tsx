"use client";

import { useState, type FormEvent } from "react";
import { countdown, openQuestion, releaseOf, type TrackedRequest } from "../tracking";
import { useTracking } from "./context";
import { initials, StatusPill, TypeDot } from "./primitives";

function CommentForm({
  placeholder,
  onSend,
  compact,
  sendLabel,
}: {
  placeholder: string;
  onSend: (text: string) => void | Promise<unknown>;
  compact?: boolean;
  sendLabel: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      await onSend(v);
      setText("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="rt-inline-form" onSubmit={submit}>
      <input
        className="rt-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={busy}
      />
      {(compact || text.trim()) && (
        <button type="submit" className="rt-send" disabled={!text.trim() || busy}>
          {sendLabel}
        </button>
      )}
    </form>
  );
}

export function RequestDetail({ request }: { request: TrackedRequest }) {
  const { fmt, me, requests, releases, actions, vote, follow, navigate } = useTracking();
  const t = fmt.texts;
  const r = request;
  const release = releaseOf(r, releases);
  const ship = fmt.shipsWith(r, releases);
  const steps = fmt.steps(r, releases);
  const question = r.createdBy.id === me.id ? openQuestion(r) : undefined;
  const events = fmt.activity(r, requests, releases, me).filter((e) => e.comment !== question);
  const cd = release && r.status !== "live" && r.status !== "declined" ? countdown(r, release, fmt.now, fmt.timeZone) : null;
  const linked = [...r.duplicates, ...(r.duplicateOfId !== undefined ? [r.duplicateOfId] : [])];
  const send = (text: string, replyTo?: string) => actions.onComment?.(r.id, text, { replyTo });

  return (
    <>
      <nav className="rt-crumb" aria-label="Breadcrumb">
        <button type="button" className="rt-link" onClick={() => navigate({ page: "requests" })}>
          {t.allRequests}
        </button>
        <span>/</span>
        <span className="rt-mono">#{r.id}</span>
      </nav>

      <div className="rt-detail-head">
        <div style={{ minWidth: 0 }}>
          <div className="rt-meta" style={{ marginTop: 0 }}>
            <TypeDot type={r.type} />
            <span>
              {t.type[r.type]} · {r.portal} · {t.submittedOn(fmt.shortDate(r.createdAt))}
            </span>
          </div>
          <h1 className="rt-detail-title">{r.title}</h1>
        </div>
        <div className="rt-detail-actions">
          <button
            type="button"
            className="rt-btn-outline rt-upvote"
            aria-pressed={r.votedByMe}
            aria-label={`${t.columns.votes}: ${r.votes}`}
            onClick={() => vote(r.id)}
          >
            <span style={{ fontSize: 10 }} aria-hidden="true">
              ▲
            </span>
            {r.votes}
          </button>
          <button type="button" className="rt-btn-outline" aria-pressed={r.followedByMe} onClick={() => follow(r.id)}>
            {r.followedByMe ? t.following : t.follow}
          </button>
        </div>
      </div>

      <ol className="rt-card rt-stepper" data-status={r.status} style={{ listStyle: "none", margin: "20px 0 0" }}>
        {steps.map((s, i) => (
          <li key={s.status} className="rt-step" data-state={s.state}>
            {i < steps.length - 1 && <span className="rt-step-line" />}
            <span className="rt-step-dot" aria-hidden="true">
              {s.state === "done" ? "✓" : s.state === "declined" ? "×" : ""}
            </span>
            <div className="rt-step-label">{s.label}</div>
            {s.sub && <div className="rt-step-sub">{s.sub}</div>}
          </li>
        ))}
      </ol>

      <div className="rt-cols">
        <div className="rt-stack">
          <section className="rt-card rt-pad">
            <div className="rt-label">{t.description}</div>
            <p className="rt-body">{r.description}</p>
            {r.expected && (
              <>
                <div className="rt-label" style={{ marginTop: 18 }}>{t.expected}</div>
                <p className="rt-body">{r.expected}</p>
              </>
            )}
          </section>

          <section className="rt-card rt-pad">
            <div className="rt-label">{t.activity}</div>
            {question && (
              <div className="rt-q">
                <span className="rt-avatar" aria-hidden="true">{initials(question.author.name)}</span>
                <div className="rt-q-box">
                  <div className="rt-q-head">
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <b>{question.author.name}</b>
                      <span className="rt-tag rt-tag-brand">{t.teamQuestion}</span>
                    </span>
                    <span style={{ color: "var(--rt-muted)" }}>{fmt.relativeDay(question.at)}</span>
                  </div>
                  <p className="rt-q-text">{question.text}</p>
                  <CommentForm
                    compact
                    placeholder={t.replyTo(question.author.name.split(" ")[0]!)}
                    sendLabel={t.send}
                    onSend={(text) => send(text, question.id)}
                  />
                </div>
              </div>
            )}
            <ul className="rt-timeline">
              {events.map((e) => (
                <li key={e.key} data-tone={e.tone}>
                  <span className="rt-tl-dot" aria-hidden="true" />
                  <span>
                    {e.comment ? (
                      <>
                        <span className="rt-tl-who">{e.comment.author.id === me.id ? t.you : e.comment.author.name}</span>
                        {e.comment.isTeam && <span className="rt-tag rt-tag-grey" style={{ marginLeft: 8 }}>Team</span>}
                        <span className="rt-tl-when"> · {fmt.relativeDay(e.at)}</span>
                        <br />
                        {e.text}
                      </>
                    ) : (
                      e.text
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {actions.onComment && <CommentForm placeholder={t.addComment} sendLabel={t.send} onSend={(text) => send(text)} />}
          </section>
        </div>

        <aside className="rt-stack">
          <section className="rt-shipcard" data-status={r.status}>
            <div className="rt-label">{r.status === "live" ? t.shippedWithLabel : t.shipsWithLabel}</div>
            <div className="rt-ship-ver">
              {ship.hotfix && <span className="rt-hotfix">{t.hotfix}</span>}
              {ship.label}
            </div>
            {ship.sub && <div className="rt-ship-date">{ship.sub}</div>}
            {cd && (
              <>
                <div className="rt-cd">
                  <b>{Math.max(0, cd.daysLeft)}</b> {t.daysToGo(Math.max(0, cd.daysLeft))}
                </div>
                <div className="rt-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(cd.progress * 100)}>
                  <span style={{ width: `${cd.progress * 100}%` }} />
                </div>
                <div className="rt-note">{t.mayShift}</div>
              </>
            )}
          </section>

          <section className="rt-card rt-pad" style={{ padding: "16px 22px" }}>
            <div className="rt-kv">
              <span>{t.meta.status}</span>
              <StatusPill status={r.status} fmt={fmt} small />
            </div>
            <div className="rt-kv">
              <span>{t.meta.portal}</span>
              <b>{r.portal}</b>
            </div>
            <div className="rt-kv">
              <span>{t.meta.comments}</span>
              <b>{r.comments.length}</b>
            </div>
            <div className="rt-kv">
              <span>{t.meta.visibility}</span>
              <b>{r.isPublic ? t.visibility.public : t.visibility.private}</b>
            </div>
          </section>

          {(linked.length > 0 || actions.onLinkDuplicate) && (
            <section className="rt-card rt-pad">
              <div className="rt-label">{t.linked}</div>
              {linked.map((id) => {
                const d = requests.find((x) => x.id === id);
                return (
                  <div key={id} className="rt-linked">
                    <span className="rt-tag rt-tag-grey">{t.duplicateTag}</span>
                    {d ? (
                      <button type="button" onClick={() => navigate({ page: "request", id })} style={{ textAlign: "left" }}>
                        #{id} {d.title}
                      </button>
                    ) : (
                      <span>#{id}</span>
                    )}
                  </div>
                );
              })}
              {actions.onLinkDuplicate && (
                <button type="button" className="rt-add-link" onClick={() => actions.onLinkDuplicate!(r.id)}>
                  {t.linkDuplicate}
                </button>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
