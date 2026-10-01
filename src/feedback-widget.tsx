"use client";

import { useRef, useState, type ReactNode } from "react";
import { ScreenshotAnnotator } from "./screenshot-annotator";

type ActionErgebnis = { ok: boolean; error?: string };

function istFehlgeschlagenesErgebnis(wert: unknown): wert is { ok: false; error?: string } {
  return typeof wert === "object" && wert !== null && "ok" in wert && (wert as { ok: unknown }).ok === false;
}

// Technische Fehlercodes aus submitFeedback in verstaendliche Saetze uebersetzen
// -- niemand soll "text too short (min 10 chars)" im UI lesen.
function fehlertext(code: string | undefined): string {
  if (code?.startsWith("text too short")) return "Bitte etwas ausführlicher beschreiben.";
  if (code === "rate limited") return "Kurz warten, bevor du erneut sendest.";
  return "Konnte nicht gesendet werden. Bitte später erneut versuchen.";
}

// Self-styled (Inline-Styles) → keine CSS-Abhängigkeit, läuft in jedem Projekt.
// Der Consumer reicht die Server-Action rein (bekommt FormData: kind, text).
export interface FeedbackWidgetProps {
  /**
   * Darf zusätzlich zu void ein `{ ok, error? }` zurückgeben (z. B. das
   * `IntakeResult` von `submitFeedback`) -- dann zeigt das Widget bei
   * `ok: false` einen Fehler statt "Danke" (sonst würde z. B. ein
   * Rate-Limit oder eine zu kurze Meldung so aussehen wie ein Erfolg).
   * Reine `void`-Actions (bestehende Einbindungen) verhalten sich unverändert.
   */
  action: (formData: FormData) => void | Promise<void> | ActionErgebnis | Promise<ActionErgebnis>;
  brandColor?: string;
  label?: string;
  /**
   * Wenn gesetzt, zeigt das Widget eine Checkbox mit diesem Text. Ist sie
   * angehakt, wird die Meldung als scope="platform" gesendet → landet im
   * Paket-Repo statt in der App. So fließen FRs übers Feedback-Tool selbst
   * automatisch upstream, ohne dass jemand Project-Leads briefen muss.
   */
  platformOptionLabel?: string;
  /**
   * Kleiner runder Käfer-Knopf statt der Pille mit Text-Label. Opt-in, damit
   * bestehende Einbindungen unverändert bleiben (Sören, 31.08.2026: die
   * grosse Pille lenkte zu sehr ab). Das Formular dahinter ist identisch.
   */
  compact?: boolean;
  /**
   * Wo der schwebende Knopf sitzt. Default unverändert unten rechts, damit
   * bestehende Einbindungen gleich bleiben (Sören, agency-os, 01.09.2026:
   * "bug button rechts weg und links unter versions nummer").
   */
  position?: "bottom-right" | "bottom-left";
  /**
   * `"emoji"` (Default, unverändert) zeigt 🐞 in `brandColor`. `"mono"`
   * zeigt stattdessen ein einfarbiges SVG-Käfer-Symbol in `iconColor` — für
   * Sidebars/Ecken, in denen ein bunter Emoji-Kreis nicht zum Rest passt.
   */
  compactIcon?: "emoji" | "mono";
  /** Nur bei `compactIcon="mono"` relevant. */
  iconColor?: string;
  /**
   * Hintergrundfarbe des runden Knopfs bei `compactIcon="mono"`. Default
   * "transparent" (unverändert). Sören, agency-os, 02.09.2026: "wie bei
   * staffhub" — dort ein schwarzer Kreis hinter dem weissen Käfer-Icon.
   */
  bgColor?: string;
  /**
   * Durchmesser des runden Knopfs in px, nur bei `compact`. Default 40
   * (unverändert). Icon und Emoji skalieren proportional mit (Sören,
   * agency-os, 02.09.2026: "käfer 30% grösser" → `size={52}`).
   */
  size?: number;
  /**
   * Eigenes Icon statt emoji/mono, z.B. ein Icon aus der eigenen
   * Icon-Bibliothek des Consumers (Tabler, Lucide, ...). Übernimmt NICHT
   * automatisch `iconColor`/Größe — der Consumer bringt sein Icon fertig
   * dimensioniert und eingefärbt mit, das Widget setzt es nur in den
   * runden Knopf. Grund: jede weitere feste Icon-Variante (nach emoji,
   * mono) hätte dieselbe Anfrage nur verschoben, statt sie zu lösen
   * (agency-os, 06.09.2026: "wie bei StaffHub" — deren Knopf nutzt
   * `@tabler/icons-react`, eine Bibliothek, die dieses Paket nicht
   * kennen soll).
   */
  customIcon?: ReactNode;
  /**
   * Mindestlänge fürs `minlength`-HTML-Attribut des Textfelds (Default: 10,
   * passend zum Server-Default in `submitFeedback`). Rein clientseitiger
   * Komfort -- die eigentliche Durchsetzung bleibt serverseitig. Wer die
   * Server-`minLength` in der Config ändert, sollte diesen Wert mitziehen,
   * sonst weichen Hinweistext und tatsächliche Regel voneinander ab.
   */
  minLength?: number;
  /**
   * Zeigt einen "Screenshot"-Knopf, der die Seite per html2canvas erfasst
   * und eine Freihand-Markierung darüber erlaubt (aus StaffHubs Feedback-
   * Modul übernommen). Default false/nicht geladen -- `html2canvas` wird
   * nur bei tatsächlicher Nutzung per `import()` nachgeladen, damit Apps
   * ohne dieses Feature kein zusätzliches Gewicht bekommen.
   */
  allowScreenshot?: boolean;
  /**
   * Zeigt das Datei-Feld (und den Screenshot-Knopf). Default false: ohne
   * Anhang-Speicher in der Server-Config (`storeAttachment`) verwirft der
   * Server Anhaenge ohnehin -- das Feld waere eine Luege. Nur auf true setzen,
   * wenn die App einen eigenen Speicher-Haken uebergibt.
   */
  allowAttachments?: boolean;
}

export function FeedbackWidget({
  action,
  brandColor = "#e20074",
  label = "Feedback",
  platformOptionLabel,
  compact = false,
  position = "bottom-right",
  compactIcon = "emoji",
  iconColor = "#fff",
  bgColor = "transparent",
  size = 40,
  customIcon,
  minLength = 10,
  allowScreenshot = false,
  allowAttachments = false,
}: FeedbackWidgetProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"bug" | "feature">("feature");
  const [platform, setPlatform] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotCanvas, setScreenshotCanvas] = useState<HTMLCanvasElement | null>(null);
  const [capturing, setCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function screenshotErfassen() {
    setCapturing(true);
    setOpen(false);
    // Kurz warten, bis das Modal wirklich aus dem gerenderten Baum ist --
    // sonst faengt html2canvas das eigene Overlay mit ein.
    await new Promise((r) => setTimeout(r, 60));
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(document.body, { logging: false, useCORS: true });
      setScreenshotCanvas(canvas);
    } finally {
      setCapturing(false);
      setOpen(true);
    }
  }

  function screenshotUebernehmen(blob: Blob) {
    const datei = new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" });
    const dt = new DataTransfer();
    for (const f of Array.from(fileInputRef.current?.files ?? [])) dt.items.add(f);
    dt.items.add(datei);
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
    setFileNames(Array.from(dt.files).map((f) => f.name));
    setScreenshotCanvas(null);
  }

  function schliessen() {
    setOpen(false);
    setError(null);
    setScreenshotCanvas(null);
  }

  const cornerStyle: React.CSSProperties =
    position === "bottom-left" ? { left: 20, right: "auto" } : { right: 20, left: "auto" };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "8px 12px",
    fontSize: 13,
    borderRadius: 8,
    border: "1px solid " + (active ? brandColor : "rgba(128,128,128,0.35)"),
    background: active ? brandColor : "transparent",
    color: active ? "#fff" : "inherit",
    cursor: "pointer",
    fontWeight: 500,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setSent(false); setError(null); setScreenshotCanvas(null); }}
        title={compact ? label : undefined}
        aria-label={compact ? label : undefined}
        style={compact ? {
          position: "fixed", bottom: 20, zIndex: 50, ...cornerStyle,
          width: size, height: size, borderRadius: "50%", border: "none",
          background: customIcon || compactIcon === "mono" ? bgColor : brandColor,
          fontSize: Math.round(size * 0.45), lineHeight: `${size}px`, textAlign: "center",
          cursor: "pointer",
          boxShadow: (customIcon || compactIcon === "mono") && bgColor === "transparent" ? "none" : "0 4px 14px rgba(0,0,0,0.25)",
          padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        } : {
          position: "fixed", bottom: 20, zIndex: 50, ...cornerStyle,
          padding: "10px 16px", borderRadius: 999, border: "none",
          background: brandColor, color: "#fff", fontWeight: 600, fontSize: 14,
          cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        }}
      >
        {compact ? (
          customIcon ? customIcon : compactIcon === "mono" ? (
            <svg width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
              <path d="M8 2v2M16 2v2M12 20v-9M12 20a5 5 0 0 0 5-5V9a5 5 0 0 0-10 0v6a5 5 0 0 0 5 5Z" />
              <path d="M6 12H3M21 12h-3M6 8l-2-2M20 8l-2-2M6 16l-2 2M20 16l2 2" />
            </svg>
          ) : "🐞"
        ) : label}
      </button>

      {open && (
        <div
          onClick={schliessen}
          style={{
            position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 420, borderRadius: 16, padding: 20,
              background: "#1a1d24", color: "#e8eaed", border: "1px solid #2e333d",
            }}
          >
            {sent ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Danke! 🙌</div>
                <div style={{ fontSize: 13, color: "#9aa0aa", marginTop: 4 }}>
                  Deine Meldung ist eingegangen.
                </div>
                <button
                  onClick={schliessen}
                  style={{ marginTop: 14, padding: "8px 16px", borderRadius: 8, border: "1px solid #2e333d", background: "transparent", color: "inherit", cursor: "pointer" }}
                >
                  Schließen
                </button>
              </div>
            ) : screenshotCanvas ? (
              <ScreenshotAnnotator
                quelle={screenshotCanvas}
                brandColor={brandColor}
                onUebernehmen={screenshotUebernehmen}
                onAbbrechen={() => setScreenshotCanvas(null)}
              />
            ) : (
              <form
                action={async (fd) => {
                  setError(null);
                  const ergebnis = await action(fd);
                  if (istFehlgeschlagenesErgebnis(ergebnis)) {
                    setError(fehlertext(ergebnis.error));
                    return;
                  }
                  setFileNames([]);
                  setSent(true);
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Feedback geben</div>
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="scope" value={platform ? "platform" : "app"} />
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button type="button" onClick={() => setKind("feature")} style={tabStyle(kind === "feature")}>
                    💡 Idee / Feature
                  </button>
                  <button type="button" onClick={() => setKind("bug")} style={tabStyle(kind === "bug")}>
                    🐞 Bug
                  </button>
                </div>
                <textarea
                  name="text"
                  required
                  minLength={minLength}
                  rows={5}
                  placeholder={kind === "bug" ? "Was ist passiert? Was hast du erwartet?" : "Was würde dir helfen?"}
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8,
                    border: "1px solid #2e333d", background: "#232730", color: "inherit",
                    fontSize: 14, resize: "vertical", outline: "none",
                  }}
                />
                {allowAttachments && (
                <label style={{ display: "block", marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: "#9aa0aa" }}>Anhänge (optional, z. B. Screenshot)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    name="files"
                    multiple
                    accept="image/*,application/pdf,.log,.txt"
                    onChange={(e) => setFileNames(Array.from(e.target.files ?? []).map((f) => f.name))}
                    style={{ display: "block", marginTop: 4, fontSize: 12, color: "#c7ccd4", width: "100%" }}
                  />
                  {fileNames.length > 0 && (
                    <span style={{ display: "block", marginTop: 4, fontSize: 12, color: brandColor }}>
                      {fileNames.length} Datei{fileNames.length > 1 ? "en" : ""}: {fileNames.join(", ")}
                    </span>
                  )}
                </label>
                )}
                {allowAttachments && allowScreenshot && (
                  <button
                    type="button"
                    disabled={capturing}
                    onClick={screenshotErfassen}
                    style={{
                      display: "block", marginTop: 8, padding: "6px 12px", borderRadius: 8,
                      border: "1px solid #2e333d", background: "transparent", color: "#9aa0aa",
                      cursor: capturing ? "wait" : "pointer", fontSize: 12,
                    }}
                  >
                    {capturing ? "Erfasse Bildschirm …" : "📷 Screenshot hinzufügen"}
                  </button>
                )}
                {error && (
                  <div style={{ fontSize: 12, color: "#e06a5e", marginTop: 10 }}>{error}</div>
                )}
                {platformOptionLabel && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "#9aa0aa", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={platform}
                      onChange={(e) => setPlatform(e.target.checked)}
                      style={{ accentColor: brandColor }}
                    />
                    {platformOptionLabel}
                  </label>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                  <button type="button" onClick={schliessen} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #2e333d", background: "transparent", color: "#9aa0aa", cursor: "pointer" }}>
                    Abbrechen
                  </button>
                  <button type="submit" style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: brandColor, color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                    Absenden
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
