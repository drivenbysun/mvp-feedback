// A681: Zusatzspalte, Marke, Nur-Lese-Modus. Server-Rendern reicht, die Teile sind reine Darstellung.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RequestTracking, type RequestTrackingProps } from "./index";
import { DEMO_ME, DEMO_NOW, DEMO_RELEASES, DEMO_REQUESTS } from "../tracking/fixtures";

const basis: RequestTrackingProps = {
  requests: DEMO_REQUESTS,
  releases: DEMO_RELEASES,
  currentUser: DEMO_ME,
  context: { portal: "Test", pagePath: "/" },
  now: DEMO_NOW,
  timeZone: "Europe/Berlin",
  defaultScope: "public",
  onSubmit: async () => ({ id: 1 }),
  onVote: () => {},
  onFollow: () => {},
  onComment: () => {},
};
const html = (p: Partial<RequestTrackingProps> = {}) => renderToStaticMarkup(<RequestTracking {...basis} {...p} />);
const zaehle = (s: string, nadel: string) => s.split(nadel).length - 1;
const detail = (id: number) => ({ route: { page: "request" as const, id } });
const kommentiert = DEMO_REQUESTS.find((r) => r.createdBy.id === DEMO_ME.id)!;

describe("ohne neue Props unverändert", () => {
  it("Liste: keine Zusatzspalte, keine Marke, Abstimm-Knöpfe da", () => {
    const h = html();
    expect(h).not.toContain('data-extra=""');
    expect(h).not.toContain('class="rt-badge"');
    expect(h).not.toContain('data-readonly=""');
    expect(zaehle(h, 'class="rt-vote"')).toBeGreaterThan(0);
    expect(zaehle(h, 'role="columnheader"')).toBe(4);
  });
  it("Detail: Folgen und Kommentarfeld da", () => {
    const h = html(detail(kommentiert.id));
    expect(h).toContain("rt-upvote");
    expect(h).toMatch(/<button[^>]*aria-pressed="(true|false)"[^>]*>(✓ )?(Follow|Following|Folgen|Folge ich)/);
    expect(h).toContain('class="rt-inline-form"');
  });
});

describe("Zusatzspalte", () => {
  const extraColumn = { header: "Agentur · von", render: (r: { id: number }) => <b data-agentur={r.id}>Agentur {r.id}</b>, width: "200px" };
  it("Kopf und eine Zelle je Meldung, Breite als Variable", () => {
    const h = html({ extraColumn });
    expect(zaehle(h, 'role="columnheader"')).toBe(5);
    expect(h).toContain("Agentur · von");
    expect(h).toContain("--rt-extra-w:200px");
    expect(zaehle(h, "data-agentur=")).toBe(zaehle(h, 'class="rt-extra-cell"'));
    expect(zaehle(h, "data-agentur=")).toBeGreaterThan(0);
  });
  it("Board bleibt ohne Spalte", () => {
    expect(html({ extraColumn, defaultView: "board" })).not.toContain('class="rt-extra-cell"');
  });
});

describe("Marke", () => {
  const requestBadge = (r: { isPublic: boolean; id: number }) => (r.id % 2 ? "nicht öffentlich" : null);
  it("nur dort, wo die Funktion Text liefert, in Liste, Board und Detail", () => {
    const ungerade = DEMO_REQUESTS.filter((r) => r.id % 2).length;
    expect(zaehle(html({ requestBadge }), 'class="rt-badge"')).toBe(ungerade);
    expect(zaehle(html({ requestBadge, defaultView: "board" }), 'class="rt-badge"')).toBeGreaterThan(0);
    const mit = DEMO_REQUESTS.find((r) => r.id % 2)!;
    const ohne = DEMO_REQUESTS.find((r) => !(r.id % 2))!;
    expect(html({ requestBadge, ...detail(mit.id) })).toContain('<span class="rt-badge">nicht öffentlich</span>');
    expect(html({ requestBadge, ...detail(ohne.id) })).not.toContain('class="rt-badge"');
  });
});

describe("Nur lesen", () => {
  it("Liste und Board: Zahl ohne Knopf", () => {
    for (const view of ["list", "board"] as const) {
      const h = html({ readOnly: true, defaultView: view });
      expect(h).toContain('data-readonly=""');
      expect(h).not.toMatch(/<button[^>]*class="rt-(vote|chipvote)"/);
    }
  });
  it("Detail: kein Abstimmen, kein Folgen, kein Kommentarfeld, Zahl bleibt", () => {
    const h = html({ readOnly: true, ...detail(kommentiert.id) });
    expect(h).not.toMatch(/<button[^>]*rt-upvote/);
    expect(h).toMatch(/<span[^>]*rt-upvote[^>]*data-readonly/);
    expect(h).not.toMatch(/>(✓ )?(Follow|Following|Folgen|Folge ich)</);
    expect(h).not.toContain('class="rt-inline-form"');
  });
});
