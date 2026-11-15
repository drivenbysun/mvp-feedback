import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hatPlatzhalter, lokaleKonfigLesen, mitLokal } from "./lokale-konfig.mjs";
import { ZIELE } from "./board-status-job.mjs";
import { KONFIG as EINSORTIERER } from "./board-einsortierer.mjs";

describe("lokale Konfiguration (Sicherheits-Sweep 15.11.)", () => {
  it("im Repo stehen nur Platzhalter, ein scharfer Lauf ohne lokale Datei wird verweigert", () => {
    for (const z of Object.values(ZIELE)) expect(hatPlatzhalter(z)).toBe(true);
    expect(hatPlatzhalter(EINSORTIERER)).toBe(true);
  });

  it("uebernimmt nur Daten-Schluessel, keine Zeitlimits oder Spruenge", () => {
    const k = mitLokal(ZIELE.magenta, {
      repo: "o/r",
      eigentuemer: "o",
      stages: { dev: "https://dev.intern.test" },
      gesamtSekunden: 99999,
      erlaubteSpruenge: { dev: { "Done (PROD)": "Todo" } },
    });
    expect(k.repo).toBe("o/r");
    expect(k.stages).toEqual({ dev: "https://dev.intern.test" });
    expect(k.gesamtSekunden).toBe(ZIELE.magenta.gesamtSekunden);
    expect(k.erlaubteSpruenge).toBe(ZIELE.magenta.erlaubteSpruenge);
    expect(hatPlatzhalter(k)).toBe(false);
  });

  it("fehlende Datei = null, kaputte Datei = Fehler (nicht still mit Platzhaltern weiter)", () => {
    const d = mkdtempSync(join(tmpdir(), "lk-"));
    expect(lokaleKonfigLesen(join(d, "fehlt.json"))).toBeNull();
    writeFileSync(join(d, "kaputt.json"), "{kaputt");
    expect(() => lokaleKonfigLesen(join(d, "kaputt.json"))).toThrow();
    writeFileSync(join(d, "gut.json"), JSON.stringify({ ziele: { magenta: { repo: "o/r" } } }));
    expect(lokaleKonfigLesen(join(d, "gut.json")).ziele.magenta.repo).toBe("o/r");
  });

  it("ein einzelner verbliebener Platzhalter reicht fuer die Sperre", () => {
    expect(hatPlatzhalter(mitLokal(ZIELE.agency, { repo: "o/r", eigentuemer: "o" }))).toBe(true); // stages noch example.com
  });
});
