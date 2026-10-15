/**
 * P1-I5: exports read fonts, radius, motion and palette from the direction's lead Atlas card. The
 * board palette refines the card palette and never swaps in a pair that fails WCAG 2.2 SC 1.4.3
 * (4.5:1 text) or SC 1.4.11 (3:1 UI). No two directions in a bend export the same font pair.
 * The cards are a small hand-written fixture shard (the Atlas data does not exist yet).
 */
import { describe, expect, it } from "vitest";
import type { IngredientCard } from "@/lib/atlas/types";
import type { CanvasSnapshot } from "@/lib/canvas/types";
import type { DirectionDetail } from "@/lib/direction-detail";
import { exportKitByDirection } from "@/lib/export";
import { cardColors, pairMin, type LeadCard } from "@/lib/export/card";
import { buildKitModel } from "@/lib/export/model";
import { contrastRatio } from "@/lib/export/util";

const card = (id: string, over: Partial<IngredientCard>): IngredientCard => ({
  id,
  kind: "material",
  name: id,
  family: "craft",
  idea: "One plain sentence.",
  surprise: "Unexpected in UI.",
  palette: [
    { hex: "#f6efe3", role: "surface", name: "Paper" },
    { hex: "#1d1a16", role: "ink", name: "Ink" },
    { hex: "#b5471b", role: "accent", name: "Rust" },
  ],
  shipPairs: [
    ["#1d1a16", "#f6efe3"],
    ["#b5471b", "#f6efe3"],
  ],
  type: { voice: "serif-editorial", latin: { display: "Fraunces", body: "Work Sans" }, arabic: { display: "El Messiri", body: "Noto Naskh Arabic" } },
  texture: "paper grain",
  imagery: "flat cut paper",
  motion: { verb: "unfold", ms: 240, reduced: "fade in place" },
  radius: "none",
  density: "airy",
  avoid: [],
  artQueries: ["cut paper"],
  ...over,
});

const SHARD: IngredientCard[] = [
  card("kraft-paper", {}),
  card("neon-sign", {
    palette: [
      { hex: "#0d0d12", role: "surface", name: "Night" },
      { hex: "#f4f4f8", role: "ink", name: "White" },
      { hex: "#ff3fa4", role: "accent", name: "Pink" },
    ],
    shipPairs: [
      ["#f4f4f8", "#0d0d12"],
      ["#ff3fa4", "#0d0d12"],
    ],
    type: { voice: "condensed", latin: { display: "Anton", body: "Work Sans" }, arabic: { display: "Lalezar", body: "Vazirmatn" } },
    motion: { verb: "flicker on", ms: 120, reduced: "no flicker, show at once" },
    radius: "round",
  }),
  // Same Latin pair as kraft-paper on purpose: the second direction must still get its own.
  card("ledger", { radius: "small", type: { voice: "serif-editorial", latin: { display: "Fraunces", body: "Work Sans" }, arabic: { display: "Amiri", body: "Scheherazade New" } } }),
];
const CARDS = new Map<string, LeadCard>(SHARD.map((c) => [c.id, c]));

function canvas(details: Record<string, DirectionDetail>): CanvasSnapshot {
  const ids = Object.keys(details);
  return {
    id: "cnv_cards",
    title: "Card exports",
    brief: "Mobile checkout for a coffee subscription",
    wildness: 3,
    lens: null,
    webUrl: null,
    directions: ids.map((id) => ({ id, move: "material", title: `Direction ${id}`, searchQuery: "q", detail: details[id] })) as CanvasSnapshot["directions"],
    sections: ids.map((id, i) => ({ id: `s-${id}`, title: id, directionId: id, x: i * 700, y: 0, w: 600, h: 400 })),
    items: [],
    palettes: [],
  } as CanvasSnapshot;
}

const keep = (cardIds: string[], extra: DirectionDetail = {}): DirectionDetail => ({ verdict: "keep", platform: "mobile", cardIds, ...extra });

describe("exports from the lead card", () => {
  it("reads fonts, radius, motion and palette from the lead card", () => {
    const m = buildKitModel(canvas({ d1: keep(["neon-sign", "kraft-paper"]) }), { cards: CARDS, directionId: "d1" });
    expect(m.card).toEqual({ id: "neon-sign", name: "neon-sign" });
    expect(m.pairingFrom).toBe("card");
    expect(m.fonts.latinDisplay.family).toBe("Anton");
    expect(m.fonts.latinBody.family).toBe("Work Sans");
    expect(m.fonts.arabicDisplay.family).toBe("Lalezar");
    expect(m.typography.find((t) => t.name === "display")?.fontFamily).toBe("Anton");
    expect(Object.fromEntries(m.rounded.map(([k, d]) => [k, d.value]))).toMatchObject({ sm: 8, md: 16, lg: 24 });
    expect(m.motion).toEqual({ verb: "flicker on", ms: 120, reduced: "no flicker, show at once" });
    expect(m.colorsFrom).toBe("card");
    expect(m.ship.map((c) => [c.name, c.hex])).toEqual([
      ["surface", "#0d0d12"],
      ["ink", "#f4f4f8"],
      ["primary", "#ff3fa4"],
    ]);
  });

  it("keeps today's behaviour without a card", () => {
    const m = buildKitModel(canvas({ d1: { verdict: "keep", spec: undefined } }), { cards: CARDS });
    expect(m.card).toBeNull();
    expect(m.motion).toBeNull();
    expect(Object.fromEntries(m.rounded.map(([k, d]) => [k, d.value]))).toMatchObject({ sm: 4, md: 8, lg: 16 });
  });

  it("no two directions in a bend export the same font pair", () => {
    const snap = canvas({ d1: keep(["kraft-paper"]), d2: keep(["neon-sign"]), d3: keep(["ledger"]), d4: { verdict: "keep" }, d5: { verdict: "keep" } });
    const sets = exportKitByDirection(snap, ["design_md"], ["d1", "d2", "d3", "d4", "d5"], { cards: CARDS });
    expect(sets).toHaveLength(5);
    const pairs = ["d1", "d2", "d3", "d4", "d5"].map((id) => {
      const m = buildKitModel(snap, { cards: CARDS, directionId: id });
      return `${m.fonts.latinDisplay.family} + ${m.fonts.latinBody.family}`;
    });
    expect(new Set(pairs).size).toBe(pairs.length);
    // The first direction keeps its card's pair; the clash goes to the later one.
    expect(pairs[0]).toBe("Fraunces + Work Sans");
    const d3 = buildKitModel(snap, { cards: CARDS, directionId: "d3" });
    expect(d3.pairingFrom).toBe("distinct");
    expect(d3.fonts.arabicDisplay.family).toBe("Amiri");
  });

  it("every ship pair passes its WCAG minimum", () => {
    for (const c of SHARD) {
      const m = buildKitModel(canvas({ d1: keep([c.id]) }), { cards: CARDS });
      const ship = m.contrast.filter((p) => p.tag === "ship");
      expect(ship.length).toBeGreaterThan(0);
      for (const p of ship) expect(p.passesUi && (p.passesText || !m.ship.some((t) => t.name === "ink" && (t.hex === p.fg || t.hex === p.bg)))).toBe(true);
    }
  });
});

describe("the board refines the card palette", () => {
  const kraft = SHARD[0]!;

  it("takes a board color that keeps every pair passing", () => {
    const out = cardColors(kraft, [
      { hex: "#fbf6ec", role: "surface" },
      { hex: "#a8401a", role: "primary" },
    ]);
    expect(out.ship.map((c) => c.hex)).toEqual(["#fbf6ec", "#1d1a16", "#a8401a"]);
    expect(out.ship[0]!.from).toBe("board");
    expect(out.refined).toHaveLength(2);
    for (const p of out.contrast) expect(p.tag).toBe("ship");
  });

  it("never swaps in a color that fails 4.5:1 text or 3:1 UI", () => {
    // A mid gray surface: ink on it drops under 4.5:1. A pale accent: under 3:1 on the paper.
    const out = cardColors(kraft, [
      { hex: "#6b6b6b", role: "surface" },
      { hex: "#f0c9b8", role: "accent" },
    ]);
    expect(contrastRatio("#1d1a16", "#6b6b6b")).toBeLessThan(4.5);
    expect(contrastRatio("#f0c9b8", "#f6efe3")).toBeLessThan(3);
    expect(out.ship.map((c) => c.hex)).toEqual(["#f6efe3", "#1d1a16", "#b5471b"]);
    expect(out.refined).toEqual([]);
    expect(out.unused.sort()).toEqual(["#6b6b6b", "#f0c9b8"]);
    for (const p of out.contrast) {
      expect(p.tag).toBe("ship");
      expect(contrastRatio(p.fg, p.bg)).toBeGreaterThanOrEqual(3);
    }
  });

  it("never marks a failing card pair as ship", () => {
    const weak = { ...kraft, shipPairs: [["#b5471b", "#1d1a16"]] as Array<[string, string]> };
    expect(contrastRatio("#b5471b", "#1d1a16")).toBeLessThan(pairMin("accent", "ink"));
    const out = cardColors(weak);
    expect(out.contrast).toHaveLength(1);
    expect(out.contrast[0]!.tag).toBe("explore");
  });

  it("refines through buildKitModel with the lead's reconciled palette", () => {
    const reconciled = { at: "2026-10-15T00:00:00Z", itemsKey: "k", palette: [{ hex: "#fbf6ec", oklch: "", role: "surface" }, { hex: "#777777", oklch: "", role: "on-surface" }], contrast: [], mood: "warm paper", images: 6, great: 1 };
    const m = buildKitModel(canvas({ d1: keep(["kraft-paper"], { reconciled }) }), { cards: CARDS });
    expect(m.colorsFrom).toBe("card");
    expect(m.ship.find((c) => c.name === "surface")?.hex).toBe("#fbf6ec");
    // #777777 as ink fails 4.5:1 on the paper: the card ink stays.
    expect(m.ship.find((c) => c.name === "ink")?.hex).toBe("#1d1a16");
    expect(m.explore.map((c) => c.hex)).toEqual(["#777777"]);
  });
});
