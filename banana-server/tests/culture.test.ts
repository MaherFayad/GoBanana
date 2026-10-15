/** CULT-02: culture data on items, get_canvas, CULTURE.md, the Cultural brief and lens culture. */
import { describe, expect, it } from "vitest";
import { cleanCulture, cultureSchema, CULTURE_LIMITS, type Culture } from "@/lib/culture";
import { createAddToCanvasTool } from "@/lib/mcp/tools/add_to_canvas";
import { createGetCanvasTool } from "@/lib/mcp/tools/get_canvas";
import { createExportKitTool } from "@/lib/mcp/tools/export_kit";
import { bendBrief, formatDirections, LENSES } from "@/lib/bend";
import { exportKit, EXPORT_FORMATS } from "@/lib/export";
import { parseState } from "@/canvas/state";
import type { CanvasState } from "@/canvas/types";
import type { CanvasSnapshot } from "@/lib/canvas/types";
import { ALICE, makeDeps, seedCanvas, state, text } from "./tools-fixtures";

const SADU: Culture = {
  tradition: "Sadu weaving",
  region: "Arabian Peninsula",
  community: "Bedouin women weavers",
  tier: "care",
  meaning: "Flat woven bands in strict repeats, made by Bedouin women.",
  credit: "Sadu weavers of the Gulf, via UNESCO",
  sourceUrl: "https://ich.unesco.org/en/RL/al-sadu-traditional-weaving-skills-in-the-united-arab-emirates-00517",
};

describe("culture validation", () => {
  it("accepts a full object and one without the optional fields", () => {
    expect(cultureSchema.safeParse(SADU).success).toBe(true);
    const { community: _c, sourceUrl: _s, ...min } = SADU;
    expect(cultureSchema.safeParse(min).success).toBe(true);
  });

  it("refuses bad tiers, long text, markup, control characters and non web links", () => {
    const bad = (over: Record<string, unknown>) => cultureSchema.safeParse({ ...SADU, ...over }).success;
    expect(bad({ tier: "secret" })).toBe(false);
    expect(bad({ tradition: "" })).toBe(false);
    expect(bad({ meaning: "x".repeat(CULTURE_LIMITS.meaning + 1) })).toBe(false);
    expect(bad({ credit: "x".repeat(CULTURE_LIMITS.credit + 1) })).toBe(false);
    expect(bad({ meaning: "<b>bold</b>" })).toBe(false);
    expect(bad({ region: "Gulf\nNajd" })).toBe(false);
    expect(bad({ credit: "a\u0000b" })).toBe(false);
    expect(bad({ sourceUrl: "javascript:alert(1)" })).toBe(false);
    expect(bad({ sourceUrl: "not a url" })).toBe(false);
    expect(bad({ meaning: "Line one\nLine two" })).toBe(true);
  });

  it("turns em dashes into commas and keeps Arabic text", () => {
    const r = cultureSchema.parse({ ...SADU, tradition: "السدو", credit: "Weavers — UNESCO" });
    expect(r.tradition).toBe("السدو");
    expect(r.credit).toBe("Weavers, UNESCO");
  });

  it("cleanCulture drops what does not pass", () => {
    expect(cleanCulture(SADU)).toEqual(SADU);
    expect(cleanCulture({ ...SADU, tier: "x" })).toBeUndefined();
    expect(cleanCulture("nope")).toBeUndefined();
  });

  it("is kept by the canvas state parser on images and notes", () => {
    const raw = {
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        { id: "n1", type: "note", x: 0, y: 0, w: 200, h: 100, data: { text: "hi", culture: SADU } },
        { id: "n2", type: "note", x: 0, y: 0, w: 200, h: 100, data: { text: "hi", culture: { tier: "bad" } } },
      ],
      tray: [],
    };
    const s = parseState(raw);
    const [a, b] = s.nodes;
    expect(a?.type === "note" && a.data.culture).toEqual(SADU);
    expect(b?.type === "note" && b.data.culture).toBeUndefined();
  });
});

describe("add_to_canvas and get_canvas carry culture", () => {
  it("stores it on notes and rejects a bad object with its own message", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    const add = createAddToCanvasTool(deps);
    const ok = await add({ canvasId: c.id, items: [{ type: "note", text: "meaning: bands\ncredit: Sadu weavers", culture: SADU }] }, ALICE);
    expect(ok.isError).toBeFalsy();
    const saved = (await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState;
    const note = saved.nodes.find((n) => n.type === "note");
    expect(note?.type === "note" && note.data.culture).toEqual(SADU);

    const bad = await add({ canvasId: c.id, items: [{ type: "note", text: "x", culture: { ...SADU, tier: "holy" } }] }, ALICE);
    expect(bad.isError).toBe(true);
    expect(text(bad)).toContain("culture must be");

    const got = await createGetCanvasTool(deps)({ canvasId: c.id }, ALICE);
    const items = (got.structuredContent as { canvas: { items: { type: string; culture?: Culture }[] } }).canvas.items;
    expect(items.find((i) => i.type === "note")?.culture).toEqual(SADU);
    expect(text(got)).toContain("culture: Sadu weaving");
  });
});

function board(extra: Partial<CanvasSnapshot> = {}): CanvasSnapshot {
  return {
    id: "c1",
    title: "Banking onboarding",
    brief: "Banking onboarding for a Saudi bank",
    wildness: 3,
    lens: null,
    webUrl: "https://app.example.com/c/c1",
    directions: [{ id: "d1", move: "lens", title: "Onboarding as a woven band", searchQuery: "sadu onboarding" }],
    sections: [{ id: "s1", title: "Woven band", directionId: "d1", x: 0, y: 0, w: 600, h: 400 }],
    items: [
      {
        id: "r1", type: "image", sectionId: "s1", x: 10, y: 10, w: 200, h: 150,
        imageUrl: "https://example.com/a.jpg", sourceUrl: "https://example.com/a", sourceSite: "example.com", title: "Sadu band", culture: SADU,
      },
      { id: "n1", type: "note", sectionId: "s1", x: 10, y: 200, w: 200, h: 100, text: "steal: bands as dividers", culture: { ...SADU, tradition: "Talli", tier: "open", sourceUrl: undefined } },
    ],
    palettes: [],
    ...extra,
  };
}

describe("exports", () => {
  it("has the culture_md format and writes CULTURE.md in the exploration folder", () => {
    expect(EXPORT_FORMATS).toContain("culture_md");
    const [f] = exportKit(board(), ["culture_md"]);
    expect(f!.name).toBe("CULTURE.md");
    expect(f!.path).toMatch(/^design\/explorations\/.+\/CULTURE\.md$/);
    expect(f!.content).toContain("## Cultural brief");
    expect(f!.content).toContain("Sadu weaving");
    expect(f!.content).toContain("credit: Sadu weavers of the Gulf, via UNESCO");
    expect(f!.content).toContain("Is the meaning right?");
    expect(f!.content).not.toMatch(/—/);
  });

  it("starts DIRECTION.md with the Cultural brief when items carry culture", () => {
    const [f] = exportKit(board(), ["direction_md"]);
    const at = f!.content.indexOf("## Cultural brief");
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(f!.content.indexOf("## 1."));
    expect(f!.content).toContain("Suggested reviewer");
    expect(f!.content).toContain("Tier: Care");
  });

  it("starts DIRECTION.md with the Cultural brief for a lens alone, with its sources and mappings", () => {
    const b = board({ lens: "talli", items: [] });
    const [f] = exportKit(b, ["direction_md"]);
    expect(f!.content).toContain("## Cultural brief");
    expect(f!.content).toContain("Talli");
    expect(f!.content).toContain("ich.unesco.org");
  });

  it("leaves the block out when there is no culture and no lens", () => {
    const b = board({ items: board().items.map((i) => ({ ...i, culture: undefined })) as CanvasSnapshot["items"] });
    const [f] = exportKit(b, ["direction_md"]);
    expect(f!.content).not.toContain("Cultural brief");
  });

  it("works through export_kit for a free user", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state());
    await createAddToCanvasTool(deps)({ canvasId: c.id, items: [{ type: "note", text: "meaning: bands", culture: SADU }] }, ALICE);
    const res = await createExportKitTool(deps)({ canvasId: c.id, formats: ["culture_md"] }, ALICE);
    expect(res.isError).toBeFalsy();
    expect(text(res)).toContain("CULTURE.md");
    expect(text(res)).toContain("Sadu weaving");
  });
});

describe("lens culture data", () => {
  it("gives every lens a tier, meaning, UI mappings and a reviewer", () => {
    for (const l of LENSES) {
      expect(["open", "care", "sacred"], l.id).toContain(l.tier);
      expect(l.meaning.length, l.id).toBeGreaterThan(40);
      expect(l.uiMappings.length, l.id).toBeGreaterThanOrEqual(2);
      for (const r of l.uiMappings) expect(r.element && r.grammar && r.mechanic, l.id).toBeTruthy();
      expect(l.reviewerHint.length, l.id).toBeGreaterThan(10);
      expect(JSON.stringify(l), l.id).not.toMatch(/—/);
    }
  });

  it("only lists https source pages and never an empty title", () => {
    for (const l of LENSES) for (const s of l.sources) {
      expect(s.url, l.id).toMatch(/^https:\/\/(ich|whc)\.unesco\.org\//);
      expect(s.title.length, l.id).toBeGreaterThan(5);
    }
    const care = LENSES.filter((l) => ["sadu", "talli", "qatt-asiri"].includes(l.id));
    for (const l of care) {
      expect(l.tier).toBe("care");
      expect(l.sources.length).toBeGreaterThan(0);
    }
  });

  it("never offers sacred text as decoration: kufic forbids it", () => {
    const kufic = LENSES.find((l) => l.id === "kufic")!;
    expect(kufic.sacredOrProtected.join(" ")).toMatch(/Quran/);
  });

  it("returns the mappings and care lines with a lens bend, once per result for every direction", () => {
    const r = bendBrief({ brief: "banking onboarding app", wildness: 3, count: 4, lens: "sadu" });
    expect(r.lens?.culture.tier).toBe("care");
    expect(r.lens?.culture.uiMappings.length).toBeGreaterThan(1);
    expect(r.lens?.culture.care.join(" ")).toMatch(/Reviewer/);
    const t = formatDirections(r);
    expect(t).toContain("UI mappings");
    expect(t).toContain("Care: ");
    expect(bendBrief({ brief: "banking onboarding app", wildness: 3, count: 4 }).lens).toBeNull();
  });
});
