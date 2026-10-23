import type { IntakeAttachment } from "./config";

// Bequemer Helfer für Consumer: zieht Datei-Anhänge aus dem FormData einer
// Server-Action und wandelt sie in transport-agnostische IntakeAttachments
// (Base64). So bleibt die Consumer-Action dünn — einmal aufrufen, durchreichen.
//
// Grenzen (Default): max. 5 Dateien, je max. 10 MB. Größere/überzählige werden
// still übersprungen (Feedback soll nie am Anhang scheitern). Achtung: Next.js
// begrenzt Server-Action-Bodies per Default auf 1 MB — für echte Uploads im
// Consumer `serverActions.bodySizeLimit` (z. B. "10mb") in next.config setzen.
export async function attachmentsFromFormData(
  formData: FormData,
  field = "files",
  opts: { maxFiles?: number; maxBytes?: number } = {},
): Promise<IntakeAttachment[]> {
  const maxFiles = opts.maxFiles ?? 5;
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;
  const out: IntakeAttachment[] = [];
  for (const entry of formData.getAll(field)) {
    if (out.length >= maxFiles) break;
    // File ist im Server-Runtime verfügbar; Strings/leere Felder ignorieren.
    if (typeof entry === "string") continue;
    const file = entry as File;
    if (!file || file.size === 0 || file.size > maxBytes) continue;
    const buf = Buffer.from(await file.arrayBuffer());
    out.push({
      filename: file.name || "datei",
      contentType: file.type || "application/octet-stream",
      dataBase64: buf.toString("base64"),
    });
  }
  return out;
}

// Liest den Absende-Schluessel, den das Widget als Formularfeld mitschickt.
// Ergebnis direkt als `idempotencyKey` in submitFeedback reichen.
export function idempotencyKeyFromFormData(formData: FormData, field = "idempotencyKey"): string | undefined {
  const v = formData.get(field);
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : undefined;
}
