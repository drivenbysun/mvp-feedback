"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  createFormatter,
  findSimilar as localSimilar,
  MIN_TITLE_LENGTH,
  validateAttachment,
  validateDraft,
  type Audience,
  type AutoContext,
  type DraftAttachment,
  type FormatOptions,
  type NewRequestDraft,
  type Release,
  type RequestType,
  type Severity,
  type TrackedRequest,
} from "../tracking";
import { StatusPill, TrackingStyles, VoteButton } from "./primitives";

export interface NewRequestDialogProps extends FormatOptions {
  open: boolean;
  onClose: () => void;
  context: AutoContext;
  onSubmit: (draft: NewRequestDraft) => Promise<{ id: number }>;
  initialType?: RequestType;
  /** Für Dubletten-Vorschläge ohne eigene Suche und zur Anzeige der Ziel-Version. */
  requests?: TrackedRequest[];
  releases?: Release[];
  findSimilar?: (query: string, type: RequestType) => Promise<TrackedRequest[]> | TrackedRequest[];
  onVote?: (id: number) => void;
  onOpenRequest?: (id: number) => void;
  /** „Meldung verfolgen" im Erfolgsfall. */
  onTrack?: (id: number) => void;
  onCaptureScreenshot?: () => Promise<DraftAttachment | null>;
  /** Datei-Anhänge zulassen. Standard aus (Personendaten, wie im Widget seit 0.7.0). */
  allowAttachments?: boolean;
  /** Stylesheet mitliefern; false, wenn schon eine <RequestTracking>-Seite es einbindet. */
  withStyles?: boolean;
}

function readFile(file: File): Promise<DraftAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const url = String(reader.result);
      resolve({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        dataBase64: url.slice(url.indexOf(",") + 1),
        previewUrl: file.type.startsWith("image/") ? url : undefined,
      });
    };
    reader.readAsDataURL(file);
  });
}

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function NewRequestDialog(props: NewRequestDialogProps) {
  const { open, onClose, context, onSubmit, requests = [], releases = [], withStyles = true } = props;
  const fmt = useMemo(
    () => createFormatter(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.locale, props.timeZone, props.now?.getTime(), props.texts, props.reviewSlaDays],
  );
  const t = fmt.texts;

  const [type, setType] = useState<RequestType>(props.initialType ?? "bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");
  const [severity, setSeverity] = useState<Severity>("annoying");
  const [audience, setAudience] = useState<Audience>("team");
  const [isPublic, setIsPublic] = useState(true);
  const [notify, setNotify] = useState(true);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<TrackedRequest[]>([]);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [done, setDone] = useState<{ id: number; title: string; type: RequestType } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sending = useRef(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setExpected("");
    setSeverity("annoying");
    setAudience("team");
    setIsPublic(true);
    setNotify(true);
    setAttachments([]);
    setAttachError(null);
    setSimilar([]);
    setTouched(false);
    setSubmitError(false);
    setDone(null);
  };

  useEffect(() => {
    if (!open) return;
    if (props.initialType) setType(props.initialType);
    const id = window.setTimeout(() => titleRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, props.initialType]);

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  // Dubletten beim Tippen, ~300 ms entprellt.
  const { findSimilar } = props;
  useEffect(() => {
    const q = title.trim();
    if (q.length < MIN_TITLE_LENGTH) {
      setSimilar([]);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const res = findSimilar ? await findSimilar(q, type) : localSimilar(q, requests);
        if (!cancelled) setSimilar(res.slice(0, 2));
      } catch {
        if (!cancelled) setSimilar([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [title, type, findSimilar, requests]);

  if (!open) return null;

  const errors = validateDraft({ title, description });
  const canSubmit = title.trim().length >= MIN_TITLE_LENGTH && !busy;

  const addFiles = async (files: FileList | File[] | null) => {
    const file = files?.[0];
    if (!file) return;
    const err = validateAttachment({ filename: file.name, sizeBytes: file.size });
    if (err) {
      setAttachError(t.errors[err]);
      return;
    }
    setAttachError(null);
    setAttachments([await readFile(file)]);
  };

  const capture = async () => {
    const shot = await props.onCaptureScreenshot?.();
    if (shot) {
      setAttachError(null);
      setAttachments([shot]);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (errors.length > 0 || sending.current) return;
    sending.current = true;
    setBusy(true);
    setSubmitError(false);
    const draft: NewRequestDraft = {
      type,
      title: title.trim(),
      description: description.trim(),
      expected: type === "bug" && expected.trim() ? expected.trim() : undefined,
      severity: type === "bug" ? severity : undefined,
      audience: type === "feature" ? audience : undefined,
      isPublic: type === "feature" ? isPublic : false,
      notify,
      attachments,
      context: type === "bug" ? context : { portal: context.portal, pagePath: context.pagePath },
    };
    try {
      const res = await onSubmit(draft);
      setDone({ id: res.id, title: draft.title, type });
    } catch {
      setSubmitError(true);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void addFiles(e.dataTransfer.files);
  };

  const shipLine = (r: TrackedRequest) => fmt.shipsWith(r, releases).label;

  return (
    <div
      className="mvpf-rt-scope rt-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {withStyles && <TrackingStyles />}
      <div className="rt-dialog" role="dialog" aria-modal="true" aria-labelledby="rt-dialog-title" data-type={done ? done.type : type}>
        {done ? (
          <div className="rt-success">
            <div className="rt-success-icon" aria-hidden="true">✓</div>
            <h2 id="rt-dialog-title">{t.successTitle[done.type]}</h2>
            <p>{t.successText(done.title, done.id, fmt.reviewSlaDays)}</p>
            <div className="rt-success-steps" aria-hidden="true">
              <div>{t.status.submitted}</div>
              <div>{t.status.accepted}</div>
              <div>{t.status.in_progress}</div>
              <div>{t.status.live}</div>
            </div>
            <div className="rt-foot-btns">
              <button type="button" className="rt-secondary" onClick={reset}>
                {t.newReport}
              </button>
              <button
                type="button"
                className="rt-primary"
                style={{ background: "var(--rt-brand)" }}
                onClick={() => {
                  props.onTrack?.(done.id);
                  onClose();
                }}
              >
                {t.trackRequest}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="rt-dialog-body">
              <div className="rt-type-seg" role="group">
                {(["bug", "feature"] as const).map((k) => (
                  <button key={k} type="button" data-type={k} aria-pressed={type === k} onClick={() => setType(k)}>
                    {t.dialogType[k]}
                  </button>
                ))}
              </div>
              <h2 id="rt-dialog-title">{t.dialogTitle[type]}</h2>
              <div className="rt-ctx">
                <span>
                  <i>{t.ctx.portal}</i>
                  {context.portal}
                </span>
                <span>
                  <i>{t.ctx.page}</i>
                  {context.pagePath}
                </span>
                {type === "bug" && context.environment && (
                  <span>
                    <i>{t.ctx.env}</i>
                    {context.environment}
                  </span>
                )}
              </div>
              <div className="rt-ctx-note">{t.ctx.note}</div>

              <div className="rt-field">
                <label htmlFor="rt-subject">{t.subject} *</label>
                <input
                  id="rt-subject"
                  ref={titleRef}
                  className="rt-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={touched && errors.includes("titleTooShort")}
                  autoComplete="off"
                  maxLength={200}
                />
                {touched && errors.includes("titleTooShort") && <div className="rt-err">{t.errors.titleTooShort}</div>}
                {similar.length > 0 && (
                  <div className="rt-similar">
                    <div className="rt-label" style={{ color: "var(--rt-muted)" }}>{t.alreadyReported}</div>
                    {similar.map((r) => (
                      <div key={r.id} className="rt-similar-row">
                        <div style={{ minWidth: 0 }}>
                          <b onClick={() => props.onOpenRequest?.(r.id)}>{r.title}</b>
                          <small>
                            <StatusPill status={r.status} fmt={fmt} small />
                            <span className="rt-mono">#{r.id}</span> · {shipLine(r)}
                          </small>
                        </div>
                        {props.onVote ? (
                          <VoteButton request={r} onVote={props.onVote} variant="chip" fmt={fmt} />
                        ) : (
                          <span className="rt-chipvote">
                            <span className="rt-tri">▲</span>
                            {r.votes}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {type === "bug" ? (
                <>
                  <div className="rt-field rt-field-2">
                    <div>
                      <label className="rt-flabel" htmlFor="rt-happened">{t.whatHappened} *</label>
                      <textarea
                        id="rt-happened"
                        className="rt-textarea"
                        value={description}
                        placeholder={t.whatHappenedPlaceholder}
                        onChange={(e) => setDescription(e.target.value)}
                        aria-invalid={touched && errors.includes("descriptionMissing")}
                      />
                      {touched && errors.includes("descriptionMissing") && <div className="rt-err">{t.errors.descriptionMissing}</div>}
                    </div>
                    <div>
                      <label className="rt-flabel" htmlFor="rt-expected">{t.whatExpected}</label>
                      <textarea id="rt-expected" className="rt-textarea" value={expected} placeholder={t.whatExpectedPlaceholder} onChange={(e) => setExpected(e.target.value)} />
                    </div>
                  </div>
                  <div className="rt-field">
                    <span className="rt-flabel">{t.howMuch}</span>
                    <div className="rt-chips" role="group" aria-label={t.howMuch}>
                      {(["blocks", "annoying", "cosmetic"] as const).map((k) => (
                        <button key={k} type="button" className="rt-chip" aria-pressed={severity === k} onClick={() => setSeverity(k)}>
                          {t.severity[k]}
                        </button>
                      ))}
                    </div>
                    <div className="rt-hint">{t.hotfixHint}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="rt-field">
                    <label htmlFor="rt-problem">{t.problem} *</label>
                    <textarea
                      id="rt-problem"
                      className="rt-textarea"
                      value={description}
                      placeholder={t.problemPlaceholder}
                      onChange={(e) => setDescription(e.target.value)}
                      aria-invalid={touched && errors.includes("descriptionMissing")}
                    />
                    {touched && errors.includes("descriptionMissing") && <div className="rt-err">{t.errors.descriptionMissing}</div>}
                  </div>
                  <div className="rt-field">
                    <span className="rt-flabel">{t.whoBenefits}</span>
                    <div className="rt-chips" role="group" aria-label={t.whoBenefits}>
                      {(["me", "team", "all"] as const).map((k) => (
                        <button key={k} type="button" className="rt-chip" aria-pressed={audience === k} onClick={() => setAudience(k)}>
                          {t.audience[k]}
                        </button>
                      ))}
                    </div>
                    <button type="button" className="rt-toggle" role="switch" aria-checked={isPublic} onClick={() => setIsPublic((v) => !v)}>
                      <span className="rt-switch" aria-hidden="true" />
                      <span>
                        <b>{t.publicToggle}</b>
                        <small>{t.publicHint}</small>
                      </span>
                    </button>
                  </div>
                </>
              )}

              {props.allowAttachments && (
                <div className="rt-field">
                  <span className="rt-flabel">
                    {t.attachment} <span style={{ fontWeight: 400, color: "var(--rt-muted)" }}>{t.optional}</span>
                  </span>
                  {attachments.length === 0 ? (
                    <div
                      className="rt-drop"
                      data-over={dragOver}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={onDrop}
                    >
                      {props.onCaptureScreenshot && (
                        <button type="button" className="rt-secondary" style={{ fontSize: 14, padding: "8px 14px" }} onClick={capture}>
                          {t.capturePage}
                        </button>
                      )}
                      <button type="button" onClick={() => fileRef.current?.click()} style={{ color: "var(--rt-muted)" }}>
                        {t.dropFile}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        hidden
                        accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.xlsx,.csv"
                        onChange={(e) => {
                          void addFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  ) : (
                    attachments.map((a) => (
                      <div key={a.filename} className="rt-file">
                        <span className="rt-thumb" style={a.previewUrl ? { backgroundImage: `url("${a.previewUrl}")` } : undefined} />
                        <span style={{ minWidth: 0 }}>
                          <b>{a.filename}</b>
                          <small>
                            {sizeLabel(a.sizeBytes)}
                            {a.blurred ? ` · ${t.namesBlurred}` : ""}
                          </small>
                        </span>
                        <button type="button" onClick={() => setAttachments([])}>
                          {t.remove}
                        </button>
                      </div>
                    ))
                  )}
                  {attachError && <div className="rt-err">{attachError}</div>}
                  <div className="rt-hint">{t.attachmentsPrivate}</div>
                </div>
              )}
              {submitError && <div className="rt-err" role="alert" style={{ marginTop: 16 }}>{t.errors.submitFailed}</div>}
            </div>
            <div className="rt-dialog-foot">
              <label className="rt-check">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                {t.notifyMe}
              </label>
              <div className="rt-foot-btns">
                <button type="button" className="rt-secondary" onClick={onClose}>
                  {t.cancel}
                </button>
                <button type="submit" className="rt-primary" disabled={!canSubmit} aria-busy={busy}>
                  {busy ? t.submitting : t.submit}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
