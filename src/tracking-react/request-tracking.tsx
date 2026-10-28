"use client";

import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  queryRequests,
  scopeCounts,
  type AutoContext,
  type FormatOptions,
  type Release,
  type RequestStatus,
  type RequestType,
  type Scope,
  type SortKey,
  type TrackedRequest,
  type UserRef,
  type ViewMode,
} from "../tracking";
import { TrackingProvider, useTracking, type TrackingActions, type TrackingRoute } from "./context";
import { RequestDetail } from "./detail";
import { NewRequestDialog } from "./new-request-dialog";
import { TrackingStyles } from "./primitives";
import { ReleasePlan, WhatsNew } from "./releases-view";
import { RequestBoard, RequestList } from "./requests-view";

export interface RequestTrackingProps extends FormatOptions, TrackingActions {
  requests: TrackedRequest[];
  releases: Release[];
  currentUser: UserRef;
  /** Wird im Melde-Dialog automatisch mitgeschickt (Portal, Seite, Browser/Version). */
  context: AutoContext;
  /** Gesteuerte Navigation (z. B. an die URL gekoppelt). Ohne: interner Zustand. */
  route?: TrackingRoute;
  onRouteChange?: (route: TrackingRoute) => void;
  defaultView?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  defaultScope?: Scope;
  /** Punkt am Reiter „Was ist neu". */
  hasUnseenWhatsNew?: boolean;
  onWhatsNewSeen?: () => void;
  allowAttachments?: boolean;
  /** Platz rechts neben den Reitern, z. B. für <NotificationBell>. */
  headerExtra?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function Filter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const current = options.find((o) => o.value === value)?.label;
  return (
    <span className="rt-filter">
      {label}: {current}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

function RequestsPage(props: {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  scope: Scope;
  setScope: (s: Scope) => void;
  onNew: () => void;
  headerExtra?: ReactNode;
  tabs: ReactNode;
}) {
  const { fmt, me, requests } = useTracking();
  const t = fmt.texts;
  const [status, setStatus] = useState<RequestStatus | "all">("all");
  const [type, setType] = useState<RequestType | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const counts = useMemo(() => scopeCounts(requests, me), [requests, me]);
  const list = useMemo(
    () => queryRequests(requests, { scope: props.scope, status: props.view === "board" ? "all" : status, type, sort }, me),
    [requests, props.scope, props.view, status, type, sort, me],
  );
  return (
    <>
      <div className="rt-head">
        {props.tabs}
        <div className="rt-actions">
          {props.headerExtra}
          <div className="rt-seg" role="group">
            {(["list", "board"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={props.view === v} onClick={() => props.setView(v)}>
                {t.view[v]}
              </button>
            ))}
          </div>
          <button type="button" className="rt-primary" onClick={props.onNew}>
            {t.newRequest}
          </button>
        </div>
      </div>
      <div className="rt-bar">
        <div className="rt-scopes" role="group">
          {(["mine", "public", "following"] as const).map((s) => (
            <button key={s} type="button" className="rt-scope" aria-pressed={props.scope === s} onClick={() => props.setScope(s)}>
              {t.scopes[s]} ({counts[s]})
            </button>
          ))}
        </div>
        <div className="rt-filters">
          {props.view === "list" && (
            <Filter
              label={t.filters.status}
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: t.filters.all },
                ...(["submitted", "accepted", "in_progress", "live", "declined"] as const).map((s) => ({ value: s, label: t.status[s] })),
              ]}
            />
          )}
          <Filter
            label={t.filters.type}
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: t.filters.all },
              { value: "bug", label: t.type.bug },
              { value: "feature", label: t.type.feature },
            ]}
          />
          <Filter
            label={t.filters.sort}
            value={sort}
            onChange={setSort}
            options={[
              { value: "recent", label: t.filters.recent },
              { value: "votes", label: t.filters.votes },
            ]}
          />
        </div>
      </div>
      {props.view === "list" ? <RequestList requests={list} /> : <RequestBoard requests={list} />}
    </>
  );
}

function Shell(
  props: RequestTrackingProps & {
    route: TrackingRoute;
    navigate: (r: TrackingRoute) => void;
  },
) {
  const { fmt, requests, releases, actions, vote } = useTracking();
  const t = fmt.texts;
  const { route, navigate } = props;
  const [view, setViewState] = useState<ViewMode>(props.defaultView ?? "list");
  const [scope, setScope] = useState<Scope>(props.defaultScope ?? "mine");
  const [dialogOpen, setDialogOpen] = useState(false);
  const setView = (v: ViewMode) => {
    setViewState(v);
    props.onViewChange?.(v);
  };

  const page = route.page === "request" ? "requests" : route.page;
  const tab = (key: "requests" | "releasePlan" | "whatsNew") => (
    <button
      key={key}
      type="button"
      role="tab"
      className="rt-tab"
      aria-selected={page === key}
      onClick={() => {
        if (key === "whatsNew") props.onWhatsNewSeen?.();
        navigate({ page: key });
      }}
    >
      {t.tabs[key]}
      {key === "whatsNew" && props.hasUnseenWhatsNew && <span className="rt-dot-new" aria-hidden="true" />}
    </button>
  );
  const tabs = (
    <div>
      <div className="rt-eyebrow">{t.eyebrow}</div>
      <div className="rt-tabs" role="tablist">
        {tab("requests")}
        {tab("releasePlan")}
        {tab("whatsNew")}
      </div>
    </div>
  );
  const plainHead = (
    <div className="rt-head">
      {tabs}
      {props.headerExtra && <div className="rt-actions">{props.headerExtra}</div>}
    </div>
  );
  const selected = route.page === "request" ? requests.find((r) => r.id === route.id) : undefined;

  return (
    <div className="rt-inner">
      {route.page === "requests" && (
        <RequestsPage view={view} setView={setView} scope={scope} setScope={setScope} onNew={() => setDialogOpen(true)} headerExtra={props.headerExtra} tabs={tabs} />
      )}
      {route.page === "request" && (
        <>
          {plainHead}
          {selected ? (
            <RequestDetail request={selected} />
          ) : (
            <nav className="rt-crumb" aria-label="Breadcrumb">
              <button type="button" className="rt-link" onClick={() => navigate({ page: "requests" })}>
                {t.allRequests}
              </button>
              <span>/</span>
              <span className="rt-mono">#{route.id}</span>
            </nav>
          )}
        </>
      )}
      {route.page === "releasePlan" && (
        <>
          {plainHead}
          <ReleasePlan />
        </>
      )}
      {route.page === "whatsNew" && (
        <>
          {plainHead}
          <WhatsNew releaseId={route.releaseId} />
        </>
      )}
      <NewRequestDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        withStyles={false}
        locale={fmt.locale}
        timeZone={fmt.timeZone}
        now={props.now}
        texts={props.texts}
        reviewSlaDays={fmt.reviewSlaDays}
        context={props.context}
        requests={requests}
        releases={releases}
        onSubmit={actions.onSubmit}
        findSimilar={actions.findSimilar}
        onCaptureScreenshot={actions.onCaptureScreenshot}
        allowAttachments={props.allowAttachments}
        onVote={vote}
        onOpenRequest={(id) => {
          setDialogOpen(false);
          navigate({ page: "request", id });
        }}
        onTrack={(id) => navigate({ page: "request", id })}
      />
    </div>
  );
}

/** Ganze Seite „Meine Arbeit": Meldungen (Liste/Board/Detail), Release-Plan, Was ist neu, Melde-Dialog. */
export function RequestTracking(props: RequestTrackingProps) {
  const [internal, setInternal] = useState<TrackingRoute>({ page: "requests" });
  const route = props.route ?? internal;
  const { onRouteChange } = props;
  const navigate = useCallback(
    (r: TrackingRoute) => {
      setInternal(r);
      onRouteChange?.(r);
    },
    [onRouteChange],
  );
  const actions: TrackingActions = useMemo(
    () => ({
      onVote: props.onVote,
      onFollow: props.onFollow,
      onComment: props.onComment,
      onLinkDuplicate: props.onLinkDuplicate,
      onSubmit: props.onSubmit,
      findSimilar: props.findSimilar,
      onCaptureScreenshot: props.onCaptureScreenshot,
    }),
    [props.onVote, props.onFollow, props.onComment, props.onLinkDuplicate, props.onSubmit, props.findSimilar, props.onCaptureScreenshot],
  );
  return (
    <div className={`mvpf-rt${props.className ? ` ${props.className}` : ""}`} style={props.style}>
      <TrackingStyles />
      <TrackingProvider
        format={props}
        me={props.currentUser}
        requests={props.requests}
        releases={props.releases}
        actions={actions}
        navigate={navigate}
      >
        <Shell {...props} route={route} navigate={navigate} />
      </TrackingProvider>
    </div>
  );
}
