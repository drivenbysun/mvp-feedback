"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  createFormatter,
  toggleFollow,
  toggleVote,
  type DraftAttachment,
  type FormatOptions,
  type Formatter,
  type NewRequestDraft,
  type Release,
  type RequestType,
  type TrackedRequest,
  type UserRef,
} from "../tracking";

export type TrackingRoute =
  | { page: "requests" }
  | { page: "request"; id: number }
  | { page: "releasePlan" }
  | { page: "whatsNew"; releaseId?: string };

export interface TrackingActions {
  /** `voted` = Zustand NACH dem Klick. Wirft/verwirft → die Anzeige springt zurück. */
  onVote?: (id: number, voted: boolean) => void | Promise<unknown>;
  onFollow?: (id: number, following: boolean) => void | Promise<unknown>;
  onComment?: (id: number, text: string, opts: { replyTo?: string }) => void | Promise<unknown>;
  onLinkDuplicate?: (id: number) => void;
  /** Muss die neue Nummer liefern (für „ist jetzt #1050"). */
  onSubmit: (draft: NewRequestDraft) => Promise<{ id: number }>;
  /** Eigene Dubletten-Suche (z. B. `GET /requests/similar`). Ohne: Stichwort-Abgleich auf `requests`. */
  findSimilar?: (query: string, type: RequestType) => Promise<TrackedRequest[]> | TrackedRequest[];
  /** „Diese Seite aufnehmen". Ohne Haken wird der Knopf nicht gezeigt. */
  onCaptureScreenshot?: () => Promise<DraftAttachment | null>;
}

interface Ctx {
  fmt: Formatter;
  me: UserRef;
  requests: TrackedRequest[];
  releases: Release[];
  actions: TrackingActions;
  vote: (id: number) => void;
  follow: (id: number) => void;
  navigate: (r: TrackingRoute) => void;
}

const TrackingContext = createContext<Ctx | null>(null);

export function useTracking(): Ctx {
  const c = useContext(TrackingContext);
  if (!c) throw new Error("mvp-feedback/tracking-react: Komponente muss innerhalb von <RequestTracking> stehen.");
  return c;
}

type Override = Pick<TrackedRequest, "votes" | "votedByMe" | "followers" | "followedByMe">;

export function TrackingProvider(props: {
  format: FormatOptions;
  me: UserRef;
  requests: TrackedRequest[];
  releases: Release[];
  actions: TrackingActions;
  navigate: (r: TrackingRoute) => void;
  children: ReactNode;
}) {
  const { format, me, requests, releases, actions, navigate, children } = props;
  const fmt = useMemo(
    () => createFormatter(format),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [format.locale, format.timeZone, format.now?.getTime(), format.texts, format.reviewSlaDays],
  );

  // Optimistische Umschalter, bis die App neue `requests` liefert.
  const [overrides, setOverrides] = useState<Map<number, Override>>(new Map());
  useEffect(() => setOverrides(new Map()), [requests]);
  const live = useMemo(
    () => requests.map((r) => (overrides.has(r.id) ? { ...r, ...overrides.get(r.id)! } : r)),
    [requests, overrides],
  );
  const liveRef = useRef(live);
  liveRef.current = live;

  const apply = useCallback(
    (id: number, change: (r: TrackedRequest) => TrackedRequest, call: (next: TrackedRequest) => void | Promise<unknown>) => {
      const cur = liveRef.current.find((r) => r.id === id);
      if (!cur) return;
      const next = change(cur);
      const pick = (r: TrackedRequest): Override => ({
        votes: r.votes,
        votedByMe: r.votedByMe,
        followers: r.followers,
        followedByMe: r.followedByMe,
      });
      setOverrides((m) => new Map(m).set(id, pick(next)));
      const revert = () => setOverrides((m) => new Map(m).set(id, pick(cur)));
      try {
        const res = call(next);
        if (res && typeof (res as Promise<unknown>).catch === "function") (res as Promise<unknown>).catch(revert);
      } catch {
        revert();
      }
    },
    [],
  );

  const vote = useCallback(
    (id: number) => apply(id, toggleVote, (n) => actions.onVote?.(id, n.votedByMe)),
    [apply, actions],
  );
  const follow = useCallback(
    (id: number) => apply(id, toggleFollow, (n) => actions.onFollow?.(id, n.followedByMe)),
    [apply, actions],
  );

  const value = useMemo<Ctx>(
    () => ({ fmt, me, requests: live, releases, actions, vote, follow, navigate }),
    [fmt, me, live, releases, actions, vote, follow, navigate],
  );
  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}
