import type { CreateBoardIssueInput, FeedbackConfig, StoreAttachment, IntakeAttachment, IntakeInput, IntakeResult, IntakeTarget } from "./config";
import { pruefeRateLimit } from "./rate-limit";

const DEFAULT_ATTACHMENT_TAG = "feedback-attachments";
export const DEFAULT_COLUMN_NAME = "User Request";

// ============================================================
// Generischer GitHub-Intake (aus dem Magenta-OS-Muster extrahiert, aber
// vollständig CONFIG-getrieben — keine hartkodierten Repo-/Board-IDs).
// Best-effort: wirft nie; ohne Token oder bei Teil-Fehlern still degradieren.
// Nur serverseitig aufrufen (nutzt den Token aus process.env).
// ============================================================

type GhJson = Record<string, unknown>;

async function ghRest(
  token: string,
  method: "GET" | "POST",
  path: string,
  body?: GhJson,
): Promise<GhJson | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as GhJson;
  } catch {
    return null;
  }
}

async function ghGraphql(token: string, query: string, variables: GhJson): Promise<GhJson | null> {
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: GhJson; errors?: unknown };
    return json.errors ? null : (json.data ?? null);
  } catch {
    return null;
  }
}

// Release, an das Anhänge gehängt werden, sicherstellen (idempotent). Assets an
// einem Release liegen auf GitHub (nicht im Git-Baum) → kein Commit/Deploy, und
// Board-Mitglieder öffnen sie ohne separaten App-Login. Best-effort → null.
async function ensureAttachmentReleaseId(
  token: string,
  repo: string,
  tag: string,
): Promise<number | null> {
  const existing = await ghRest(token, "GET", `/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`);
  if (existing?.id) return existing.id as number;
  const created = await ghRest(token, "POST", `/repos/${repo}/releases`, {
    tag_name: tag,
    name: "Feedback-Anhänge",
    body: "Automatisch angelegter Container für In-App-Feedback-Anhänge.",
    prerelease: true,
    make_latest: "false",
  });
  return (created?.id as number | undefined) ?? null;
}

// Sanitisiert einen Dateinamen für die Asset-API (keine Slashes/Spaces/Sonderz.).
function sanitizeAssetName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "datei";
  return base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100) || "datei";
}

// Einen Anhang als Release-Asset hochladen. Liefert die öffentliche Download-URL
// oder null (best-effort). Eindeutiger Name via nonce → keine Kollisionen.
async function uploadAttachmentAsset(
  token: string,
  repo: string,
  releaseId: number,
  nonce: string,
  att: IntakeAttachment,
): Promise<{ filename: string; url: string; isImage: boolean } | null> {
  try {
    const bytes = Buffer.from(att.dataBase64, "base64");
    if (bytes.length === 0) return null;
    const safe = sanitizeAssetName(att.filename);
    const assetName = `${nonce}-${safe}`;
    const res = await fetch(
      `https://uploads.github.com/repos/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": att.contentType || "application/octet-stream",
        },
        body: bytes,
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { browser_download_url?: string };
    if (!json.browser_download_url) return null;
    const isImage = (att.contentType ?? "").startsWith("image/");
    return { filename: safe, url: json.browser_download_url, isImage };
  } catch {
    return null;
  }
}

// Rendert den Anhang-Block fürs Issue. Reihenfolge: App-Haken (nur Link ins
// Issue) > ausdrückliches GitHub-Opt-in > Anhänge verworfen. Ohne Haken und ohne
// Opt-in wird NICHTS hochgeladen und uploads.github.com nie aufgerufen.
async function buildAttachmentSection(
  token: string,
  target: IntakeTarget,
  attachments: IntakeAttachment[] | undefined,
  store: StoreAttachment | undefined,
  githubOptIn: boolean,
): Promise<string> {
  if (!attachments?.length) return "";
  if (store) return buildHookSection(attachments, store);
  if (!githubOptIn) {
    return `\n\n_${attachments.length} Anhang/Anhänge verworfen: kein Anhang-Speicher konfiguriert._`;
  }
  return buildGithubReleaseSection(token, target, attachments);
}

async function buildHookSection(attachments: IntakeAttachment[], store: StoreAttachment): Promise<string> {
  const lines: string[] = [];
  let dropped = 0;
  for (const att of attachments) {
    let url: string | null = null;
    try {
      url = await store(att);
    } catch {
      url = null;
    }
    if (!url || !/^https?:\/\//i.test(url) || /[\s()<>]/.test(url)) {
      dropped++;
      continue;
    }
    const name = sanitizeAssetName(att.filename);
    lines.push(`📎 [${name}](${url})`);
  }
  let out = lines.length ? `\n\n**Anhänge:**\n\n${lines.join("\n\n")}` : "";
  if (dropped) out += `\n\n_${dropped} Anhang/Anhänge nicht gespeichert._`;
  return out;
}

async function buildGithubReleaseSection(
  token: string,
  target: IntakeTarget,
  attachments: IntakeAttachment[],
): Promise<string> {
  const tag = target.attachmentReleaseTag ?? DEFAULT_ATTACHMENT_TAG;
  const releaseId = await ensureAttachmentReleaseId(token, target.repo, tag);
  if (!releaseId) return "";
  const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const uploaded = [];
  for (const att of attachments) {
    const u = await uploadAttachmentAsset(token, target.repo, releaseId, nonce, att);
    if (u) uploaded.push(u);
  }
  if (!uploaded.length) return "";
  // Inline-Bilder rendert GitHub nur bei ÖFFENTLICHEN Repos (der camo-Proxy
  // kommt nicht an Assets privater Repos). Bei privaten → klickbarer Link,
  // der für eingeloggte Board-Mitglieder funktioniert.
  const repoMeta = await ghRest(token, "GET", `/repos/${target.repo}`);
  const isPublic = repoMeta?.private === false;
  const lines = uploaded.map((u) =>
    u.isImage && isPublic ? `[![${u.filename}](${u.url})](${u.url})` : `📎 [${u.filename}](${u.url})`,
  );
  return `\n\n**Anhänge:**\n\n${lines.join("\n\n")}`;
}

// Label anlegen, falls es nicht existiert (idempotent, best-effort).
async function ensureLabel(token: string, repo: string, name: string, color: string) {
  const exists = await ghRest(token, "GET", `/repos/${repo}/labels/${encodeURIComponent(name)}`);
  if (exists) return;
  await ghRest(token, "POST", `/repos/${repo}/labels`, { name, color });
}

async function resolveColumnOptionId(
  token: string,
  statusFieldId: string,
  columnName: string,
): Promise<string | null> {
  const data = await ghGraphql(
    token,
    `query($id: ID!){ node(id:$id){ ... on ProjectV2SingleSelectField { options { id name } } } }`,
    { id: statusFieldId },
  );
  const options =
    ((data?.node as GhJson | undefined)?.options as { id: string; name: string }[] | undefined) ?? [];
  return options.find((o) => o.name === columnName)?.id ?? null;
}

// Titel: "BUG: ..." bzw. "FR: ..." -- zentral, damit alle Apps gleich titeln.
// Ein schon vorhandenes Praefix im Titel wird nicht verdoppelt.
function deriveTitle(input: IntakeInput): string {
  const prefix = input.kind === "bug" ? "BUG" : "FR";
  const raw = input.title?.trim() || input.text.trim().split("\n")[0].slice(0, 80);
  const rest = raw.replace(/^(\[(bug|feature|fr)\]|(bug|fr)\s*:)\s*/i, "").trim() || "Meldung";
  return `${prefix}: ${rest}`.slice(0, 120);
}

function buildBody(input: IntakeInput): string {
  const s = input.submitter;
  const who = s?.name ? `${s.name}${s.email ? ` (${s.email})` : ""}` : (s?.email ?? "anonym");
  return `${input.text}\n\n---\n_In-App-Meldung von ${who}._`;
}

// ── Low-Level-Primitive ─────────────────────────────────────────────────────
// createBoardIssue: legt ein Issue an (Labels sichergestellt), hängt es best-
// effort aufs Board und setzt die Ziel-Spalte. Token wird DIREKT übergeben —
// so kann jeder Consumer seine eigene Token-Auflösung nutzen (Magenta-Chain).
// Wirft nie; teilbare GitHub-Plumbing für submitFeedback UND fremde Adapter.
export async function createBoardIssue(input: CreateBoardIssueInput): Promise<IntakeResult> {
  const { token, repo } = input;
  if (!token) return { ok: false, error: "no token" };

  // Labels sicherstellen (idempotent; existierende Farben bleiben unangetastet).
  for (const label of input.labels ?? []) {
    await ensureLabel(token, repo, label, "ededed");
  }

  // 1) Issue anlegen.
  const issue = await ghRest(token, "POST", `/repos/${repo}/issues`, {
    title: input.title,
    body: input.body,
    labels: input.labels ?? [],
  });
  const contentId = issue?.node_id as string | undefined;
  const number = issue?.number as number | undefined;
  const htmlUrl = issue?.html_url as string | undefined;
  if (!contentId || !number || !htmlUrl) return { ok: false, error: "issue creation failed" };
  const result: IntakeResult = { ok: true, issueNumber: number, issueUrl: htmlUrl };

  // 2) Aufs Board (optional, best-effort).
  if (!input.boardProjectId) return result;
  const added = await ghGraphql(
    token,
    `mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item { id } } }`,
    { p: input.boardProjectId, c: contentId },
  );
  const itemId = ((added?.addProjectV2ItemById as GhJson | undefined)?.item as GhJson | undefined)?.id as
    | string
    | undefined;
  if (!itemId || !input.statusFieldId || !input.columnName) return result;

  // 3) Ziel-Spalte setzen (per Name aufgelöst; fehlt sie → ohne Status).
  const optionId = await resolveColumnOptionId(token, input.statusFieldId, input.columnName);
  if (!optionId) return result;
  await ghGraphql(
    token,
    `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ projectV2Item { id } } }`,
    { p: input.boardProjectId, i: itemId, f: input.statusFieldId, o: optionId },
  );
  return result;
}

export async function submitFeedback(config: FeedbackConfig, input: IntakeInput): Promise<IntakeResult> {
  const token = config.token ?? process.env[config.tokenEnv ?? "GH_PROJECT_TOKEN"];
  if (!token) return { ok: false, error: "no token configured" };

  // Serverseitig erzwungen -- ein `required`-Feld im Client allein reicht
  // nicht, ein Leerzeichen erfuellt das schon (agency-os' Luecke).
  const minLength = config.minLength ?? 10;
  const text = input.text?.trim() ?? "";
  if (text.length < minLength) {
    return { ok: false, error: `text too short (min ${minLength} chars)` };
  }

  // Rate-Limit VOR jedem GitHub-Aufruf, nicht danach -- sonst schuetzt es nur
  // das Issue-Anlegen, nicht die teureren Anhang-Uploads davor.
  if (config.rateLimit) {
    const schluessel = input.rateLimitKey ?? input.submitter?.email ?? null;
    if (schluessel) {
      const ok = pruefeRateLimit(
        `${config.repo}:${schluessel}`,
        config.rateLimit.max,
        config.rateLimit.windowMs,
      );
      if (!ok) return { ok: false, error: "rate limited" };
    }
  }

  // Ziel nach Scope wählen: "platform" → Paket-Repo (falls konfiguriert),
  // sonst die App. So landen FRs übers Feedback-Tool automatisch upstream.
  const target: IntakeTarget =
    input.scope === "platform" && config.platform ? config.platform : config;

  const typeLabel = input.kind === "bug" ? "type:bug" : "type:feature";
  // Labels mit Marken-Farben sicherstellen (bug=rot, feature=grün, app=magenta).
  await ensureLabel(token, target.repo, typeLabel, input.kind === "bug" ? "d73a4a" : "0e8a16");
  await ensureLabel(token, target.repo, target.appLabel, "e20074");

  // Anhänge zuerst hochladen → Links wandern direkt in den Issue-Body, damit
  // sie mit aufs Board reisen (best-effort; Fehler = Body ohne Anhänge).
  const attachmentSection = await buildAttachmentSection(
    token,
    target,
    input.attachments,
    config.storeAttachment,
    config.githubReleaseAttachments === true,
  );

  return createBoardIssue({
    token,
    repo: target.repo,
    title: deriveTitle(input),
    body: buildBody(input) + attachmentSection,
    labels: [typeLabel, target.appLabel],
    boardProjectId: target.boardProjectId,
    statusFieldId: target.statusFieldId,
    columnName: target.columnName ?? DEFAULT_COLUMN_NAME,
  });
}
