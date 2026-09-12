import { describe, it, expect, beforeEach } from "vitest";
import { pruefeRateLimit, _rateLimitZuruecksetzen } from "./rate-limit";

describe("pruefeRateLimit", () => {
  beforeEach(() => {
    _rateLimitZuruecksetzen();
  });

  it("laesst die ersten `max` Aufrufe im Fenster durch", () => {
    expect(pruefeRateLimit("k", 3, 1000, 0)).toBe(true);
    expect(pruefeRateLimit("k", 3, 1000, 0)).toBe(true);
    expect(pruefeRateLimit("k", 3, 1000, 0)).toBe(true);
  });

  it("blockiert den Aufruf ueber dem Limit im selben Fenster", () => {
    pruefeRateLimit("k", 2, 1000, 0);
    pruefeRateLimit("k", 2, 1000, 0);
    expect(pruefeRateLimit("k", 2, 1000, 0)).toBe(false);
  });

  it("setzt nach Fensterende zurueck", () => {
    pruefeRateLimit("k", 1, 1000, 0);
    expect(pruefeRateLimit("k", 1, 1000, 500)).toBe(false); // noch im Fenster
    expect(pruefeRateLimit("k", 1, 1000, 1001)).toBe(true); // Fenster vorbei
  });

  it("fuehrt getrennte Zaehler pro Schluessel", () => {
    pruefeRateLimit("a", 1, 1000, 0);
    expect(pruefeRateLimit("a", 1, 1000, 0)).toBe(false);
    expect(pruefeRateLimit("b", 1, 1000, 0)).toBe(true);
  });
});
