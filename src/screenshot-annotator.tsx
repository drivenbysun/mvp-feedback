"use client";

import { useEffect, useRef } from "react";

// Freihand-Markierung ueber einem bereits erfassten Screenshot (html2canvas-
// Ergebnis kommt als HTMLCanvasElement rein). Bewusst NUR ein Stift, keine
// Formen/Pfeile/Text -- der Zweck ist "worum es geht zeigen", kein Editor.
// Aus StaffHubs eigenem Feedback-Modul uebernommen (dort das einzige der drei
// Module mit Screenshot+Annotation), hier einmal statt pro App neu gebaut.

const MAX_BREITE = 720; // Darstellungs- UND Canvas-Aufloesung zugleich --
// keine getrennte Koordinaten-Umrechnung zwischen CSS- und Canvas-Pixeln noetig.

export interface ScreenshotAnnotatorProps {
  quelle: HTMLCanvasElement;
  brandColor: string;
  onUebernehmen: (blob: Blob) => void;
  onAbbrechen: () => void;
}

export function ScreenshotAnnotator({ quelle, brandColor, onUebernehmen, onAbbrechen }: ScreenshotAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zeichnetRef = useRef(false);

  const skala = Math.min(1, MAX_BREITE / quelle.width);
  const breite = Math.max(1, Math.round(quelle.width * skala));
  const hoehe = Math.max(1, Math.round(quelle.height * skala));

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.drawImage(quelle, 0, 0, breite, hoehe);
  }, [quelle, breite, hoehe]);

  function position(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    zeichnetRef.current = true;
    const { x, y } = position(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function zeichne(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnetRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = position(e);
    ctx.strokeStyle = "#ff3b30";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function loeschen() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(quelle, 0, 0, breite, hoehe);
  }

  function uebernehmen() {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onUebernehmen(blob);
    }, "image/png");
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: "#9aa0aa", marginBottom: 8 }}>
        Auf dem Bild zeichnen, um zu markieren, worum es geht.
      </div>
      <canvas
        ref={canvasRef}
        width={breite}
        height={hoehe}
        onPointerDown={start}
        onPointerMove={zeichne}
        onPointerUp={() => { zeichnetRef.current = false; }}
        onPointerLeave={() => { zeichnetRef.current = false; }}
        style={{
          width: "100%", height: "auto", borderRadius: 8,
          border: "1px solid #2e333d", touchAction: "none", cursor: "crosshair",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={loeschen}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #2e333d", background: "transparent", color: "#9aa0aa", cursor: "pointer", fontSize: 13 }}
        >
          Zeichnung löschen
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onAbbrechen}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #2e333d", background: "transparent", color: "#9aa0aa", cursor: "pointer", fontSize: 13 }}
          >
            Verwerfen
          </button>
          <button
            type="button"
            onClick={uebernehmen}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: brandColor, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
          >
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}
