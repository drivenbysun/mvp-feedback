import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitFeedback } from "./intake";
import { _rateLimitZuruecksetzen } from "./rate-limit";
import type { FeedbackConfig } from "./config";

const BASIS_CONFIG: FeedbackConfig = {
  repo: "drivenbysun/test-repo",
  appLabel: "app:test",
  token: "fake-token",
};

describe("submitFeedback -- Validierung vor jedem Netzwerkaufruf", () => {
  beforeEach(() => {
    _rateLimitZuruecksetzen();
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("fetch haette nicht aufgerufen werden duerfen"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lehnt Text unter der Mindestlaenge ab, ohne GitHub zu kontaktieren", async () => {
    const ergebnis = await submitFeedback(BASIS_CONFIG, { kind: "bug", text: "zu kurz" });
    expect(ergebnis).toEqual({ ok: false, error: "text too short (min 10 chars)" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("respektiert eine eigene minLength-Konfiguration", async () => {
    const ergebnis = await submitFeedback(
      { ...BASIS_CONFIG, minLength: 3 },
      { kind: "bug", text: "abc" },
    );
    // 3 Zeichen erfuellen minLength:3 -> kommt an der Validierung vorbei,
    // scheitert danach am (bewusst fehlschlagenden) fetch-Mock.
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.error).not.toContain("too short");
  });

  it("blockiert den zweiten Aufruf ueber dem Rate-Limit, ohne GitHub zu kontaktieren", async () => {
    const config: FeedbackConfig = { ...BASIS_CONFIG, rateLimit: { max: 1, windowMs: 60_000 } };
    const input = { kind: "bug" as const, text: "genug Zeichen fuer die Pruefung", rateLimitKey: "user-1" };

    // Erster Aufruf: kommt an der Rate-Limit-Pruefung vorbei, scheitert danach
    // am (bewusst fehlschlagenden) fetch-Mock -- ghRest faengt den Fehler
    // intern ab (wirft nie), submitFeedback ruft dabei MEHRERE fetch-Aufrufe
    // aus (Label sicherstellen, Issue anlegen, ...), daher kein exakter Zaehler.
    await submitFeedback(config, input);
    const aufrufeNachErstem = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(aufrufeNachErstem).toBeGreaterThan(0);

    // Zweiter Aufruf: Limit erreicht, fetch darf UEBERHAUPT NICHT mehr aufgerufen werden.
    const zweites = await submitFeedback(config, input);
    expect(zweites).toEqual({ ok: false, error: "rate limited" });
    expect(fetch).toHaveBeenCalledTimes(aufrufeNachErstem);
  });

  it("laesst ohne rateLimitKey/submitter.email unlimitiert durch (kein gemeinsamer Anonym-Topf)", async () => {
    const config: FeedbackConfig = { ...BASIS_CONFIG, rateLimit: { max: 1, windowMs: 60_000 } };
    const input = { kind: "bug" as const, text: "genug Zeichen fuer die Pruefung" };

    await submitFeedback(config, input);
    const aufrufeNachErstem = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await submitFeedback(config, input);
    // Zweiter Aufruf erreicht fetch GENAUSO wie der erste -- kein Schluessel, kein Limit.
    expect(fetch).toHaveBeenCalledTimes(aufrufeNachErstem * 2);
  });
});

// ── Titel, Spalte, Anhaenge ─────────────────────────────────────────────────
type Aufruf = { url: string; method: string; body: unknown };

function githubAttrappe() {
  const aufrufe: Aufruf[] = [];
  vi.spyOn(global, "fetch").mockImplementation(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    let body: unknown = init?.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { /* roh lassen */ }
    }
    aufrufe.push({ url: u, method, body });
    const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
    if (u.startsWith("https://uploads.github.com/")) return json({ browser_download_url: "https://github.com/x/y/releases/download/t/a.png" });
    if (u.endsWith("/graphql")) {
      const q = (body as { query?: string })?.query ?? "";
      if (q.includes("addProjectV2ItemById")) return json({ data: { addProjectV2ItemById: { item: { id: "ITEM" } } } });
      if (q.includes("ProjectV2SingleSelectField")) return json({ data: { node: { options: [{ id: "OPT", name: "User Request" }] } } });
      return json({ data: {} });
    }
    if (u.includes("/issues") && method === "POST") return json({ node_id: "N", number: 7, html_url: "https://github.com/o/r/issues/7" });
    if (u.includes("/releases/tags/")) return json({ id: 1 });
    return json({ id: 1, private: true });
  });
  return aufrufe;
}

const BOARD_CONFIG: FeedbackConfig = {
  ...BASIS_CONFIG,
  boardProjectId: "PVT",
  statusFieldId: "FIELD",
};
const PNG = { filename: "cv screenshot.png", contentType: "image/png", dataBase64: "aGFsbG8=" };
const issueBody = (a: Aufruf[]) =>
  (a.find((x) => x.method === "POST" && x.url.endsWith("/issues"))?.body as { title: string; body: string });

describe("submitFeedback -- Titel und Spalte", () => {
  beforeEach(() => _rateLimitZuruecksetzen());
  afterEach(() => vi.restoreAllMocks());

  it("Bug beginnt mit 'BUG: ', Feature mit 'FR: '", async () => {
    const a = githubAttrappe();
    await submitFeedback(BASIS_CONFIG, { kind: "bug", text: "Der Knopf tut nichts mehr" });
    expect(issueBody(a).title).toBe("BUG: Der Knopf tut nichts mehr");
    a.length = 0;
    await submitFeedback(BASIS_CONFIG, { kind: "feature", text: "Bitte Export als CSV" });
    expect(issueBody(a).title).toBe("FR: Bitte Export als CSV");
  });

  it("doppelt das Praefix nicht und ersetzt das alte '[Bug]'", async () => {
    const a = githubAttrappe();
    await submitFeedback(BASIS_CONFIG, { kind: "bug", text: "irgendein langer Text", title: "BUG: schon da" });
    expect(issueBody(a).title).toBe("BUG: schon da");
    a.length = 0;
    await submitFeedback(BASIS_CONFIG, { kind: "feature", text: "irgendein langer Text", title: "[Feature] alt" });
    expect(issueBody(a).title).toBe("FR: alt");
  });

  it("setzt ohne columnName die Spalte 'User Request'", async () => {
    const a = githubAttrappe();
    await submitFeedback(BOARD_CONFIG, { kind: "bug", text: "genug Zeichen fuer die Pruefung" });
    const setzen = a.find((x) => String((x.body as { query?: string })?.query).includes("updateProjectV2ItemFieldValue"));
    expect(setzen).toBeDefined();
    expect((setzen!.body as { variables: { o: string } }).variables.o).toBe("OPT");
  });
});

describe("submitFeedback -- Anhaenge", () => {
  beforeEach(() => _rateLimitZuruecksetzen());
  afterEach(() => vi.restoreAllMocks());

  const hochgeladen = (a: Aufruf[]) => a.filter((x) => x.url.includes("uploads.github.com"));

  it("OHNE Haken: ruft uploads.github.com nie auf und verwirft die Anhaenge", async () => {
    const a = githubAttrappe();
    const r = await submitFeedback(BASIS_CONFIG, {
      kind: "bug", text: "genug Zeichen fuer die Pruefung", attachments: [PNG],
    });
    expect(r.ok).toBe(true);
    expect(hochgeladen(a)).toHaveLength(0);
    expect(a.some((x) => x.url.includes("/releases"))).toBe(false);
    expect(issueBody(a).body).not.toContain("releases/download");
    expect(issueBody(a).body).toContain("verworfen");
  });

  it("MIT Haken: nur der Link kommt ins Issue, nichts geht zu GitHub", async () => {
    const a = githubAttrappe();
    const store = vi.fn(async () => "https://app.example.com/files/abc123");
    const r = await submitFeedback({ ...BASIS_CONFIG, storeAttachment: store }, {
      kind: "bug", text: "genug Zeichen fuer die Pruefung", attachments: [PNG],
    });
    expect(r.ok).toBe(true);
    expect(store).toHaveBeenCalledWith(PNG);
    expect(hochgeladen(a)).toHaveLength(0);
    expect(issueBody(a).body).toContain("[cv_screenshot.png](https://app.example.com/files/abc123)");
    expect(JSON.stringify(a)).not.toContain(PNG.dataBase64);
  });

  it("MIT Haken: Fehler, null und unsichere URLs verwerfen nur den Anhang", async () => {
    const a = githubAttrappe();
    const antworten: Array<string | null | Error> = [null, "javascript:alert(1)", "https://ok.example.com/a b", new Error("kaputt")];
    let i = 0;
    const store = vi.fn(async () => {
      const x = antworten[i++];
      if (x instanceof Error) throw x;
      return x;
    });
    const r = await submitFeedback({ ...BASIS_CONFIG, storeAttachment: store }, {
      kind: "bug", text: "genug Zeichen fuer die Pruefung", attachments: [PNG, PNG, PNG, PNG],
    });
    expect(r.ok).toBe(true);
    expect(hochgeladen(a)).toHaveLength(0);
    expect(issueBody(a).body).not.toContain("javascript:");
    expect(issueBody(a).body).toContain("4 Anhang/Anhänge nicht gespeichert");
  });

  it("Opt-in githubReleaseAttachments laedt weiterhin zu GitHub hoch", async () => {
    const a = githubAttrappe();
    await submitFeedback({ ...BASIS_CONFIG, githubReleaseAttachments: true }, {
      kind: "bug", text: "genug Zeichen fuer die Pruefung", attachments: [PNG],
    });
    expect(hochgeladen(a)).toHaveLength(1);
  });

  it("Haken hat Vorrang vor dem Opt-in", async () => {
    const a = githubAttrappe();
    await submitFeedback(
      { ...BASIS_CONFIG, githubReleaseAttachments: true, storeAttachment: async () => "https://app.example.com/f/1" },
      { kind: "bug", text: "genug Zeichen fuer die Pruefung", attachments: [PNG] },
    );
    expect(hochgeladen(a)).toHaveLength(0);
  });
});
