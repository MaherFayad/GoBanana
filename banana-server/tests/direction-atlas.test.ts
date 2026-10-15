/**
 * W1: a direction keeps its Atlas ids in one place, `detail.atlas` ({ cardIds, mechanicId,
 * recipeIds, pageId, domainId, productNoun }). Rows saved before that kept flat `cardIds`,
 * `mechanicId` and `recipeIds`; every reader (exports, learning, search plan v2) reads them through
 * the same field.
 */
import { describe, expect, it } from "vitest";
import { parseDirectionAtlas, parseDirectionDetail } from "@/lib/db/detail";
import { buildKitModel, cleanDetail } from "@/lib/export/model";
import { directionDetail } from "@/lib/mcp/tools/bend_brief";
import { createRateDirectionsTool } from "@/lib/mcp/tools/rate_directions";
import type { BendResult } from "@/lib/bend";
import type { CanvasSnapshot } from "@/lib/canvas/types";
import type { LeadCard } from "@/lib/export/card";
import { ALICE, makeDeps, seedCanvas } from "./tools-fixtures";

const NEW_ROW = {
  platform: "mobile",
  atlas: { cardIds: ["kraft-paper", "neon-sign"], mechanicId: "total-stamp", recipeIds: ["rc-abc"], pageId: "checkout", domainId: "coffee", productNoun: "beans" },
};
const OLD_ROW = { platform: "mobile", cardIds: ["kraft-paper"], mechanicId: "total-stamp", recipeIds: ["rc-old"] };

describe("one set of Atlas ids on a direction", () => {
  it("keeps detail.atlas and has no flat id fields", () => {
    const d = parseDirectionDetail(NEW_ROW)!;
    expect(d.atlas).toEqual(NEW_ROW.atlas);
    expect(d).not.toHaveProperty("cardIds");
    expect(d).not.toHaveProperty("mechanicId");
    expect(d).not.toHaveProperty("recipeIds");
  });

  it("reads the flat fields of old rows into detail.atlas", () => {
    const d = parseDirectionDetail(OLD_ROW)!;
    expect(d.atlas).toEqual({ cardIds: ["kraft-paper"], mechanicId: "total-stamp", recipeIds: ["rc-old"] });
    expect(d).not.toHaveProperty("cardIds");
  });

  it("prefers detail.atlas when a row has both", () => {
    expect(parseDirectionAtlas({ ...OLD_ROW, ...NEW_ROW })?.cardIds).toEqual(["kraft-paper", "neon-sign"]);
    // An atlas object with no card falls back to the flat fields.
    expect(parseDirectionAtlas({ ...OLD_ROW, atlas: { cardIds: [] } })?.recipeIds).toEqual(["rc-old"]);
    expect(parseDirectionAtlas({ platform: "mobile" })).toBeUndefined();
  });

  it("caps ids", () => {
    const d = parseDirectionAtlas({ atlas: { cardIds: ["a", "b", "c", "d", "e"], recipeIds: Array.from({ length: 20 }, (_, i) => `rc-${i}`) } })!;
    expect(d.cardIds).toHaveLength(4);
    expect(d.recipeIds).toHaveLength(12);
  });

  it("bend_brief saves detail.atlas, and it parses back the same", () => {
    const direction = {
      id: "bd-1",
      platform: "mobile",
      pages: [],
      spec: undefined,
      artQueries: [],
      twist: "",
      prompt: "",
      mechanic: { element: "total", how: "stamp" },
      cardIds: ["kraft-paper"],
      mechanicId: "total-stamp",
      recipeIds: ["rc-1"],
    } as unknown as BendResult["directions"][number];
    const saved = directionDetail(direction, 3, "coffee checkout", { pageId: "checkout", domainId: "coffee", productNoun: "beans" });
    expect(saved).not.toHaveProperty("cardIds");
    expect(parseDirectionDetail(saved)?.atlas).toEqual({ cardIds: ["kraft-paper"], mechanicId: "total-stamp", recipeIds: ["rc-1"], pageId: "checkout", domainId: "coffee", productNoun: "beans" });
  });

  it("exports read the lead card from detail.atlas and from old rows", () => {
    const card: LeadCard = {
      id: "kraft-paper",
      name: "Kraft paper",
      palette: [
        { hex: "#f6efe3", role: "surface", name: "Paper" },
        { hex: "#1d1a16", role: "ink", name: "Ink" },
      ],
      shipPairs: [["#1d1a16", "#f6efe3"]],
      type: { voice: "serif-editorial", latin: { display: "Fraunces", body: "Work Sans" }, arabic: { display: "El Messiri", body: "Noto Naskh Arabic" } },
      motion: { verb: "unfold", ms: 240, reduced: "fade in place" },
      radius: "round",
    };
    expect(cleanDetail(OLD_ROW)?.atlas?.cardIds).toEqual(["kraft-paper"]);
    for (const detail of [NEW_ROW, OLD_ROW]) {
      const snapshot = {
        id: "cnv",
        title: "t",
        brief: "coffee checkout",
        wildness: 3,
        lens: null,
        webUrl: null,
        directions: [{ id: "d1", move: "material", title: "Kraft", searchQuery: "q", detail: { ...detail, verdict: "keep" } }],
        sections: [],
        items: [],
        palettes: [],
      } as unknown as CanvasSnapshot;
      const m = buildKitModel(snapshot, { cards: new Map([["kraft-paper", card]]), directionId: "d1" });
      expect(m.card?.id).toBe("kraft-paper");
      expect(m.fonts.latinDisplay.family).toBe("Fraunces");
    }
  });

  it("rate_directions credits the ids saved in detail.atlas", async () => {
    const { deps, repos } = makeDeps();
    const canvas = await seedCanvas(repos, ALICE);
    await repos.directions.upsertMany(canvas.id, [{ bendId: "bd-new", move: "material", title: "Kraft", searchQuery: "kraft", detail: NEW_ROW as never }]);
    const res = await createRateDirectionsTool(deps)({ canvasId: canvas.id, ratings: [{ directionId: "bd-new", verdict: "keep" }] }, ALICE);
    expect(res.isError).toBeFalsy();
    expect(repos.data.feedback.filter((f) => f.lane === "atlas").map((f) => [f.termKey, f.verdict])).toEqual([
      ["card|kraft-paper", "great"],
      ["card|neon-sign", "great"],
      ["mechanic|total-stamp", "great"],
      ["recipe|rc-abc", "great"],
    ]);
  });
});
