import { describe, it, expect } from "vitest";
import { sanitizePagePath } from "./page-path";

describe("sanitizePagePath", () => {
  it("kappt Abfrageparameter aus einer vollstaendigen URL", () => {
    expect(sanitizePagePath("https://app.example/dashboard?filter=offen")).toBe("/dashboard");
  });

  it("kappt einen Hash aus einer vollstaendigen URL", () => {
    expect(sanitizePagePath("https://app.example/dashboard#abschnitt")).toBe("/dashboard");
  });

  it("kappt Query UND Hash gemeinsam", () => {
    expect(sanitizePagePath("https://app.example/dashboard?filter=offen#abschnitt")).toBe("/dashboard");
  });

  it("der reale Fall: OAuth-Callback mit code-Parameter (StaffHub, 02.09.)", () => {
    expect(sanitizePagePath("https://app.example/auth/callback?code=EINMAL-GEHEIMNIS&next=/dashboard")).toBe("/auth/callback");
  });

  it("laesst KEINEN Parameter durch, egal wie er heisst (keine Erlaubnisliste noetig)", () => {
    const ergebnis = sanitizePagePath("https://app.example/seite?irgendein_unbekannter_name=wert");
    expect(ergebnis).not.toContain("irgendein_unbekannter_name");
    expect(ergebnis).not.toContain("wert");
    expect(ergebnis).toBe("/seite");
  });

  it("laesst nichts hinter dem Hash durch, auch wenn es wie ein Zugangstoken aussieht", () => {
    const ergebnis = sanitizePagePath("https://app.example/seite#access_token=geheim");
    expect(ergebnis).not.toContain("geheim");
  });

  it("funktioniert mit einem blossen Pfad ohne Herkunft (new URL() wirft, catch-Zweig greift)", () => {
    expect(sanitizePagePath("/dashboard?filter=offen#abschnitt")).toBe("/dashboard");
  });

  it("laesst einen bereits sauberen Pfad unveraendert", () => {
    expect(sanitizePagePath("/dashboard")).toBe("/dashboard");
  });

  it("liefert bei leerer Eingabe einen leeren String, wirft nicht", () => {
    expect(sanitizePagePath("")).toBe("");
  });

  it("liefert bei fehlender Eingabe (null/undefined) einen leeren String, wirft nicht", () => {
    expect(sanitizePagePath(null)).toBe("");
    expect(sanitizePagePath(undefined)).toBe("");
  });

  it("wirft nicht bei voelligem Unsinn und blockiert damit nie das Absenden", () => {
    expect(() => sanitizePagePath("###???nicht-mal-ansatzweise-eine-url###")).not.toThrow();
  });

  it("baut aus window.location.href (Client-Fall) denselben Pfad wie aus einem Server-String", () => {
    const vonClient = sanitizePagePath("https://app.example/portal/rechnungen?seite=3#tabelle");
    const vonServer = sanitizePagePath("https://app.example/portal/rechnungen?seite=3#tabelle");
    expect(vonClient).toBe(vonServer);
    expect(vonClient).toBe("/portal/rechnungen");
  });

  it("traegt keine Herkunft mehr (Soerens Entscheidung: nur der Pfad reicht)", () => {
    const ergebnis = sanitizePagePath("https://app.example/dashboard");
    expect(ergebnis).not.toContain("app.example");
    expect(ergebnis).not.toMatch(/^https?:/);
  });
});
