"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFormatter, type FormatOptions, type Formatter, type TrackingNotification } from "../tracking";
import { StatusPill, TrackingStyles } from "./primitives";

function useFmt(o: FormatOptions): Formatter {
  return useMemo(
    () => createFormatter(o),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [o.locale, o.timeZone, o.now?.getTime(), o.texts],
  );
}

/** Platzhalter {0}, {1} … im übersetzten Satz durch fett gesetzte Teile ersetzen. */
function emphasize(sentence: string, parts: string[]): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = sentence;
  parts.forEach((p, i) => {
    const at = p ? rest.indexOf(p) : -1;
    if (at < 0) return;
    out.push(rest.slice(0, at), <b key={i}>{p}</b>);
    rest = rest.slice(at + p.length);
  });
  out.push(rest);
  return out;
}

export function notificationContent(n: TrackingNotification, fmt: Formatter): { text: ReactNode; extra?: ReactNode } {
  const t = fmt.texts;
  const title = n.requestTitle ?? (n.requestId !== undefined ? `#${n.requestId}` : "");
  switch (n.kind) {
    case "question":
      return { text: emphasize(t.nQuestion(n.actor.name, title), [n.actor.name, title]), extra: t.needsReply };
    case "status":
      return {
        text: emphasize(t.nStatus(title, n.releaseId), [title, n.releaseId ?? ""]),
        extra: (
          <>
            <StatusPill status={n.from} fmt={fmt} small />
            <span style={{ color: "var(--rt-faint)" }}>→</span>
            <StatusPill status={n.to} fmt={fmt} small />
          </>
        ),
      };
    case "dateMoved": {
      const to = fmt.shortDate(n.toDate);
      return { text: emphasize(t.nDateMoved(n.releaseId, fmt.shortDate(n.fromDate), to, n.affected), [n.releaseId, to]) };
    }
    case "duplicate":
      return { text: emphasize(t.nDuplicate(title, n.duplicateOfId), [title]) };
    case "live":
      return { text: emphasize(t.nLive(title, n.releaseKind, n.releaseId), [title, n.releaseId]) };
  }
}

export interface NotificationBellProps extends FormatOptions {
  notifications: TrackingNotification[];
  onOpen?: (n: TrackingNotification) => void;
  onMarkAllRead?: () => void;
  withStyles?: boolean;
}

export function NotificationBell(props: NotificationBellProps) {
  const { notifications, onOpen, onMarkAllRead, withStyles = true } = props;
  const fmt = useFmt(props);
  const t = fmt.texts;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="mvpf-rt-scope rt-bell" ref={ref}>
      {withStyles && <TrackingStyles />}
      <button type="button" className="rt-bell-btn" aria-label={t.bell} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="rt-bell-badge">{unread}</span>}
      </button>
      {open && (
        <div className="rt-bell-panel" role="dialog" aria-label={t.notifications}>
          <div className="rt-bell-head">
            <b>{t.notifications}</b>
            {onMarkAllRead && unread > 0 && (
              <button type="button" onClick={onMarkAllRead}>
                {t.markAllRead}
              </button>
            )}
          </div>
          <div className="rt-bell-list">
            {notifications.length === 0 && <div className="rt-empty">{t.noNotifications}</div>}
            {notifications.map((n) => {
              const c = notificationContent(n, fmt);
              return (
                <button
                  key={n.id}
                  type="button"
                  className="rt-nrow"
                  data-unread={!n.read}
                  onClick={() => {
                    onOpen?.(n);
                    setOpen(false);
                  }}
                >
                  <span className="rt-ndot" aria-hidden="true" />
                  <span>
                    <div className="rt-ntext">{c.text}</div>
                    <div className="rt-nwhen">
                      {n.kind === "status" ? c.extra : null}
                      <span>{fmt.relativeDay(n.at)}</span>
                      {n.kind === "question" && <span>· {c.extra}</span>}
                    </div>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export interface NotificationToastProps extends FormatOptions {
  title: string;
  text: string;
  onAction?: () => void;
  actionLabel?: string;
  onDismiss: () => void;
  withStyles?: boolean;
}

/** Dunkler Hinweis, z. B. „Deine Fehlerbehebung ist live". Position bestimmt die App. */
export function NotificationToast(props: NotificationToastProps) {
  const fmt = useFmt(props);
  const t = fmt.texts;
  return (
    <div className="mvpf-rt-scope rt-toast" role="status">
      {props.withStyles !== false && <TrackingStyles />}
      <span className="rt-toast-icon" aria-hidden="true">✓</span>
      <div style={{ flex: 1 }}>
        <b>{props.title}</b>
        <p>{props.text}</p>
        <div className="rt-toast-actions">
          {props.onAction && (
            <button type="button" onClick={props.onAction}>
              {props.actionLabel ?? t.seeWhatChanged}
            </button>
          )}
          <button type="button" onClick={props.onDismiss}>
            {t.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
