"use client";

import type { MouseEvent } from "react";
import { statusStep, type Formatter, type RequestStatus, type TrackedRequest } from "../tracking";
import { TRACKING_CSS } from "./styles";

export function TrackingStyles() {
  return <style data-mvpf-rt="">{TRACKING_CSS}</style>;
}

export function StatusPill({ status, fmt, small }: { status: RequestStatus; fmt: Formatter; small?: boolean }) {
  return (
    <span className={small ? "rt-pill rt-pill-sm" : "rt-pill"} data-status={status}>
      {fmt.texts.status[status]}
    </span>
  );
}

export function StatusBar({ status }: { status: RequestStatus }) {
  const step = statusStep(status);
  return (
    <div className="rt-sbar" data-status={status} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} data-on={i <= step} />
      ))}
    </div>
  );
}

export function TypeDot({ type }: { type: TrackedRequest["type"] }) {
  return <span className="rt-type-dot" data-type={type} aria-hidden="true" />;
}

export function VoteButton({
  request,
  onVote,
  variant = "box",
  fmt,
}: {
  request: Pick<TrackedRequest, "id" | "votes" | "votedByMe">;
  onVote: (id: number) => void;
  variant?: "box" | "chip";
  fmt: Formatter;
}) {
  const click = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onVote(request.id);
  };
  return (
    <button
      type="button"
      className={variant === "box" ? "rt-vote" : "rt-chipvote"}
      aria-pressed={request.votedByMe}
      aria-label={`${fmt.texts.columns.votes}: ${request.votes}`}
      onClick={click}
    >
      <span className="rt-tri" aria-hidden="true">
        ▲
      </span>
      <span>{request.votes}</span>
    </button>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
