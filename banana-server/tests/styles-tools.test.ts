/**
 * The style round end to end over in-memory repos (real adapter, mocked Serper): bend_brief names
 * one style per direction, search uses an asked style's words and tags what that request found,
 * rate_references saves the agent's style tags on the canvas, add_to_canvas keeps them, and
 * get_canvas summary checks the style mix.
 */
import { describe, expect, it, vi } from "vitest";
import { createAddToCanvasTool } from "@/lib/mcp/tools/add_to_canvas";
import { createBendBriefTool } from "@/lib/mcp/tools/bend_brief";
import { createGetCanvasTool } from "@/lib/mcp/tools/get_canvas";
import { createRateReferencesTool } from "@/lib/mcp/tools/rate_references";
import { createDbDeps, createSearchReferencesTool, styleLine } from "@/lib/mcp/tools/search_references";
import { DEFAULT_IMAGE_HOSTS, createWebSearchAdapter, parseAllowlist, type FetchLike } from "@/lib/sources";
import type { CanvasState } from "@/canvas/types";
import { ALICE, APP, makeDeps, NOW, seedCanvas, text } from "./tools-fixtures";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);
const bodyOf = (init?: RequestInit) => JSON.parse(String(init?.body)) as { q: string; page?: number };

function serperPage(q: string, page = 1) {
  const site = /site:(\S+)/.exec(q)![1]!;
  const slug = `${q.split(" site:")[0]}-p${page}`.replace(/\W+/g, "-");
  const h = [...slug].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 1_000_000, 7);
  return {
    images: Array.from({ length: 10 }, (_, i) => {
      const id = `${h}${i}`;
      const title = `Wallet app shot ${i} by Maker ${i % 3} on Dribbble`;
      if (site.startsWith("dribbble")) return { title, link: `https://dribbble.com/shots/${id}-${slug}`, imageUrl: `https://cdn.dribbble.com/u/${slug}-${i}.png` };
      if (site.startsWith("behance")) return { title: `App project ${i}`, link: `https://www.behance.net/gallery/${id}/${slug}`, imageUrl: `https://mir-s3-cdn-cf.behance.net/p/${slug}-${i}.jpg` };
      return { title, link: `https://www.pinterest.com/pin/${id}/`, imageUrl: `https://i.pinimg.com/736x/${slug}-${i}.jpg` };
    }),
  };
}

function setup() {
  const { deps, repos } = makeDeps();
  const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
    const { q, page } = bodyOf(init);
    return new Response(JSON.stringify(serperPage(q, page ?? 1)), { status: 200 });
  });
  const searchDeps = { ...createDbDeps(repos, () => APP), adapter: createWebSearchAdapter({ apiKey: "k", fetch: fetchMock, allowlist }), now: () => NOW };
  return {
    repos,
    fetchMock,
    bend: createBendBriefTool(() => ({ repos })),
    search: createSearchReferencesTool(searchDeps),
    rate: createRateReferencesTool(deps),
    add: createAddToCanvasTool(deps),
    get: createGetCanvasTool(deps),
  };
}

type Ref = { id: string; lane?: string; sourceUrl: string; zone?: string; styles?: string[] };
type SearchOut = { references: Ref[]; queries: string[]; styles?: { asked: string[]; searched?: { id: string; words: string }; direction?: string } };

describe("styles end to end", () => {
  it("names one style per direction, searches an asked style, saves the agent's tags and checks the mix", async () => {
    const s = setup();
    const c = await seedCanvas(s.repos, ALICE);
    const bent = await s.bend({ brief: "crypto wallet home screen", platform: "mobile", wildness: 3, count: 3, canvasId: c.id, taste: ["glassmorphism"] }, ALICE);
    const dirs = (bent.structuredContent as { directions: { id: string; styleId: string }[] }).directions;
    expect(dirs.map((d) => d.styleId)).toEqual(["glass-frosted", "soft-3d-objects", expect.any(String)]);
    expect(new Set(dirs.map((d) => d.styleId)).size).toBe(3);
    expect(text(bent)).toContain("Styles (one per direction, never shared");
    expect(text(bent)).toContain("The brief asks for glass-frosted");
    const saved = await s.repos.directions.listForCanvas(c.id);
    expect(saved.map((d) => d.detail?.styleId)).toEqual(dirs.map((d) => d.styleId));

    const res = await s.search({ directionId: dirs[0]!.id, canvasId: c.id }, ALICE);
    const out = res.structuredContent as SearchOut;
    expect(out.styles).toMatchObject({ asked: ["glass-frosted"], direction: "glass-frosted", searched: { id: "glass-frosted" } });
    // The taste lane already names glassmorphism (the user's taste), so it keeps its measured wording.
    expect(out.styles!.searched!.words).toContain("glassmorphism");
    expect(out.queries.some((q) => q.includes(out.styles!.searched!.words))).toBe(true);
    const tagged = out.references.filter((r) => r.styles?.length);
    expect(tagged.length).toBeGreaterThan(0);
    expect(tagged.every((r) => r.styles![0] === "glass-frosted" && r.zone !== "art")).toBe(true);
    // At most 3 of one main style in the first 8 UI results (diversity rule 1).
    const firstUi = out.references.filter((r) => r.zone !== "art").slice(0, 8);
    expect(firstUi.filter((r) => r.styles?.[0] === "glass-frosted").length).toBeLessThanOrEqual(3);
    expect(text(res)).toContain("Style: The brief or taste asks for glass-frosted");
    expect(text(res)).toContain("style glass-frosted");

    // The agent reads two thumbnails and tags them.
    // Direction results only (the fidelity lane is the canvas baseline, placed in "Shipped today").
    const ui = out.references.filter((r) => r.zone !== "art" && r.lane !== "fidelity");
    const [a, b] = ui.filter((r) => r.id !== tagged[0]!.id) as [Ref, Ref];
    const rated = await s.rate(
      {
        canvasId: c.id,
        ratings: [
          { referenceId: a.id, verdict: "great", styles: ["hero-numeral", "minimal-mono-light"] },
          { referenceId: b.id, verdict: "great", styles: ["dark-luminous"] },
        ],
      },
      ALICE,
    );
    expect((rated.structuredContent as { styled?: number }).styled).toBe(2);
    expect(text(rated)).toContain("Style tags saved on 2 references");
    const tray = ((await s.repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState).tray;
    expect(tray.find((t) => t.id === a.id)!.styles).toEqual(["hero-numeral", "minimal-mono-light"]);

    // A bad style id is a plain message.
    const badStyle = await s.rate({ canvasId: c.id, ratings: [{ referenceId: a.id, verdict: "great", styles: ["neon-goth"] }] }, ALICE);
    expect(text(badStyle)).toContain("Styles: 1 or 2 of");

    // Placed, the tags stay on the reference; the summary checks the mix.
    const placed = await s.add({ canvasId: c.id, items: [a, b, tagged[0]!].map((r) => ({ type: "reference", referenceId: r.id })) }, ALICE);
    expect(placed.isError).toBeFalsy();
    const summary = await s.get({ canvasId: c.id, summary: true }, ALICE);
    const sc = (summary.structuredContent as { styleCheck?: { asked: string[]; directions: { id: string; styleId?: string; check: { tagged: number } }[]; problems: string[] } }).styleCheck!;
    expect(sc.asked).toEqual(["glass-frosted"]);
    expect(sc.directions.find((d) => d.id === dirs[0]!.id)).toMatchObject({ styleId: "glass-frosted", check: { tagged: 3 } });
    expect(sc.problems).toEqual([]);
    expect(text(summary)).toContain("Style mix of direction");
    expect(text(summary)).toContain("Only 1 of 3 tagged references are glass-frosted or soft-3d-objects");
    expect(text(summary)).toMatch(/\[hero-numeral \+ minimal-mono-light\]/);
  });

  it("says nothing about styles when none is in play", () => {
    expect(styleLine({ references: [] })).toBe("");
    expect(styleLine({ styles: { asked: [] }, references: [] })).toBe("");
  });
});
