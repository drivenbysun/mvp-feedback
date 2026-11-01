// Empfänger für den Board-Status-Job: `PUT /api/board-status` in einer App.
// Prüft Schlüssel und Form, weist ältere Stände ab und reicht nur Einträge mit
// ableitbarem Status an die App weiter. Die App schreibt in ihre eigene DB.
import { timingSafeEqual } from "node:crypto";
import { trackingStatusFromBoard, type BoardStatusItem } from "./tracking/board-sync";
import type { RequestStatus } from "./tracking/model";

export interface BoardStatusPayload {
  generatedAt: string;
  items: BoardStatusItem[];
}

export interface BoardStatusUpdate {
  issueNumber: number;
  status: RequestStatus;
  item: BoardStatusItem;
}

export interface BoardStatusHandlerOptions {
  /** Erwarteter Bearer-Schlüssel (z. B. process.env.BOARD_STATUS_KEY). Fehlt er: 503. */
  key: string | undefined | (() => string | undefined);
  /** Schreibt die Änderungen. `generatedAt` als Zeitpunkt für den Verlauf verwenden. */
  apply: (updates: BoardStatusUpdate[], payload: BoardStatusPayload) => Promise<number | void>;
  /** Zuletzt angenommener Stand; ein älterer Push bekommt 409 und ändert nichts. */
  lastGeneratedAt?: () => Promise<string | null | undefined>;
  columnMap?: Record<string, RequestStatus>;
}

const MAX_ITEMS = 2000;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const STATES = new Set(["OPEN", "CLOSED"]);
const REASONS = new Set(["COMPLETED", "NOT_PLANNED", "DUPLICATE", "REOPENED"]);

type Parsed = { ok: true; payload: BoardStatusPayload } | { ok: false; error: string };

/** Unbekannte Felder (body, labels …) werden ignoriert, damit ein Job für mehrere Apps dieselbe Form senden kann. */
export function parseBoardStatusPayload(json: unknown): Parsed {
  if (typeof json !== "object" || json === null) return { ok: false, error: "kein Objekt" };
  const { generatedAt, items } = json as Record<string, unknown>;
  if (typeof generatedAt !== "string" || !ISO_UTC.test(generatedAt) || Number.isNaN(Date.parse(generatedAt))) {
    return { ok: false, error: "generatedAt fehlt oder ist kein ISO-Zeitpunkt (UTC)" };
  }
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return { ok: false, error: `items fehlt oder mehr als ${MAX_ITEMS}` };
  const out: BoardStatusItem[] = [];
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) return { ok: false, error: "Item ist kein Objekt" };
    const r = raw as Record<string, unknown>;
    if (!Number.isInteger(r.number) || (r.number as number) <= 0) return { ok: false, error: "Item ohne gültige number" };
    if (r.status !== null && (typeof r.status !== "string" || r.status.length > 60)) return { ok: false, error: `#${r.number}: status ungültig` };
    if (r.state !== undefined && !STATES.has(r.state as string)) return { ok: false, error: `#${r.number}: state ungültig` };
    if (r.stateReason !== undefined && r.stateReason !== null && !REASONS.has(r.stateReason as string)) {
      return { ok: false, error: `#${r.number}: stateReason ungültig` };
    }
    out.push({
      number: r.number as number,
      status: (r.status as string | null) ?? null,
      title: typeof r.title === "string" ? r.title.slice(0, 300) : undefined,
      url: typeof r.url === "string" ? r.url.slice(0, 200) : undefined,
      state: r.state as BoardStatusItem["state"],
      stateReason: (r.stateReason as BoardStatusItem["stateReason"]) ?? null,
      closedAt: typeof r.closedAt === "string" && ISO_UTC.test(r.closedAt) ? r.closedAt : undefined,
    });
  }
  return { ok: true, payload: { generatedAt, items: out } };
}

function keyMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** Route-Handler (Web-Request → Response), z. B. `export const PUT = createBoardStatusHandler({...})`. */
export function createBoardStatusHandler(opts: BoardStatusHandlerOptions): (req: Request) => Promise<Response> {
  return async (req) => {
    const expected = (typeof opts.key === "function" ? opts.key() : opts.key)?.trim();
    if (!expected) return json(503, { error: "board status key not configured" });
    const auth = req.headers.get("authorization") ?? "";
    const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!given || !keyMatches(given, expected)) return json(401, { error: "unauthorized" });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid json" });
    }
    const parsed = parseBoardStatusPayload(body);
    if (!parsed.ok) return json(400, { error: parsed.error });
    const { payload } = parsed;

    const last = await opts.lastGeneratedAt?.();
    if (last && Date.parse(last) >= Date.parse(payload.generatedAt)) return json(409, { error: "stale", lastGeneratedAt: last });

    const updates: BoardStatusUpdate[] = [];
    for (const item of payload.items) {
      const status = trackingStatusFromBoard(item, opts.columnMap);
      if (status) updates.push({ issueNumber: item.number, status, item });
    }
    const changed = await opts.apply(updates, payload);
    return json(200, { ok: true, received: payload.items.length, mapped: updates.length, changed: typeof changed === "number" ? changed : undefined });
  };
}
