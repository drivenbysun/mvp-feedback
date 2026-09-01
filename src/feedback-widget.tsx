"use client";

import { useState } from "react";

// Self-styled (Inline-Styles) → keine CSS-Abhängigkeit, läuft in jedem Projekt.
// Der Consumer reicht die Server-Action rein (bekommt FormData: kind, text).
export interface FeedbackWidgetProps {
  action: (formData: FormData) => void | Promise<void>;
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
}: FeedbackWidgetProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"bug" | "feature">("feature");
  const [platform, setPlatform] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

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
        onClick={() => { setOpen(true); setSent(false); }}
        title={compact ? label : undefined}
        aria-label={compact ? label : undefined}
        style={compact ? {
          position: "fixed", bottom: 20, zIndex: 50, ...cornerStyle,
          width: 40, height: 40, borderRadius: "50%", border: "none",
          background: compactIcon === "mono" ? "transparent" : brandColor,
          fontSize: 18, lineHeight: "40px", textAlign: "center",
          cursor: "pointer",
          boxShadow: compactIcon === "mono" ? "none" : "0 4px 14px rgba(0,0,0,0.25)",
          padding: 0,
        } : {
          position: "fixed", bottom: 20, zIndex: 50, ...cornerStyle,
          padding: "10px 16px", borderRadius: 999, border: "none",
          background: brandColor, color: "#fff", fontWeight: 600, fontSize: 14,
          cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        }}
      >
        {compact ? (
          compactIcon === "mono" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "10px auto" }}>
              <path d="M8 2v2M16 2v2M12 20v-9M12 20a5 5 0 0 0 5-5V9a5 5 0 0 0-10 0v6a5 5 0 0 0 5 5Z" />
              <path d="M6 12H3M21 12h-3M6 8l-2-2M20 8l-2-2M6 16l-2 2M20 16l2 2" />
            </svg>
          ) : "🐞"
        ) : label}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
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
                  onClick={() => setOpen(false)}
                  style={{ marginTop: 14, padding: "8px 16px", borderRadius: 8, border: "1px solid #2e333d", background: "transparent", color: "inherit", cursor: "pointer" }}
                >
                  Schließen
                </button>
              </div>
            ) : (
              <form
                action={async (fd) => { await action(fd); setFileNames([]); setSent(true); }}
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
                  rows={5}
                  placeholder={kind === "bug" ? "Was ist passiert? Was hast du erwartet?" : "Was würde dir helfen?"}
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8,
                    border: "1px solid #2e333d", background: "#232730", color: "inherit",
                    fontSize: 14, resize: "vertical", outline: "none",
                  }}
                />
                <label style={{ display: "block", marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: "#9aa0aa" }}>Anhänge (optional, z. B. Screenshot)</span>
                  <input
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
                  <button type="button" onClick={() => setOpen(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #2e333d", background: "transparent", color: "#9aa0aa", cursor: "pointer" }}>
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
