/**
 * Field report, 2026-10-12: all 24 parts of a flight checkout board were guessed crops, most of
 * them the same band (40% to 70% down), and the pay button and fare summary cut from one shot came
 * out identical. Guesses now depend on the role and the image shape, and never repeat on one image.
 */
import { describe, expect, it } from "vitest";
import { createCutPartsTool } from "@/lib/mcp/tools/cut_parts";
import { defaultCrop, distinctCrop, imageLayout, ROLE_BANDS } from "@/lib/stitch/crop";
import { PART_ROLES, type Crop } from "@/lib/stitch/types";
import { ALICE, APP, imageNode, makeDeps, state, text } from "./tools-fixtures";

const key = (c: Crop) => [c.x, c.y, c.w, c.h].map((n) => n.toFixed(3)).join(",");
const SHAPES = {
  "phone screen": { imageWidth: 390, imageHeight: 844, platform: "mobile" as const },
  "phone presentation": { imageWidth: 3200, imageHeight: 2400, platform: "mobile" as const },
  "dribbble, no size": { platform: "mobile" as const },
  "desktop page": { imageWidth: 1440, imageHeight: 900 },
  "full page": { imageWidth: 1440, imageHeight: 6000 },
};

describe("guessed crops by role and image shape", () => {
  it("gives every role its own crop on every image shape", () => {
    for (const [name, ctx] of Object.entries(SHAPES)) {
      const crops = PART_ROLES.map((r) => key(defaultCrop(r, ctx)));
      expect(new Set(crops).size, name).toBe(PART_ROLES.length);
    }
  });

  it("puts the pay button low and narrow, the summary in the middle, the nav on top", () => {
    const screen = SHAPES["phone screen"];
    const cta = defaultCrop("cta", screen);
    const detail = defaultCrop("detail", screen);
    const nav = defaultCrop("nav", screen);
    expect(cta.y).toBeGreaterThanOrEqual(0.75);
    expect(cta.w).toBeLessThan(1);
    expect(detail.y).toBeLessThan(cta.y);
    expect(nav.y).toBe(0);
    expect(defaultCrop("footer", screen).y + defaultCrop("footer", screen).h).toBeCloseTo(1, 5);
  });

  it("cuts a landscape phone presentation from its middle phone, and a desktop page across", () => {
    expect(imageLayout(SHAPES["phone presentation"])).toBe("phones");
    expect(imageLayout(SHAPES["dribbble, no size"])).toBe("phones");
    expect(imageLayout(SHAPES["phone screen"])).toBe("screen");
    expect(imageLayout(SHAPES["desktop page"])).toBe("screen");
    expect(imageLayout(SHAPES["full page"])).toBe("page");
    const hero = defaultCrop("hero", SHAPES["phone presentation"]);
    expect(hero.x).toBeGreaterThan(0.3);
    expect(hero.x + hero.w).toBeLessThan(0.7);
    expect(defaultCrop("hero", SHAPES["desktop page"])).toEqual(ROLE_BANDS.hero);
  });

  it("moves a guess that repeats a crop already cut from the same image", () => {
    const cards = defaultCrop("cards", SHAPES["phone screen"]);
    const second = distinctCrop(cards, [cards]);
    expect(key(second)).not.toBe(key(cards));
    const third = distinctCrop(cards, [cards, second]);
    expect(new Set([key(cards), key(second), key(third)]).size).toBe(3);
    expect(distinctCrop(cards, [])).toBe(cards);
  });
});

describe("cut_parts guesses", () => {
  it("never gives two parts of one image the same guessed crop, and stays honest about it", async () => {
    const { repos } = makeDeps();
    const c = await repos.canvases.create({
      userId: ALICE,
      title: "Flight checkout",
      brief: "Mobile flight checkout for a GCC travel OTA",
      // The fixture image is 400 by 300: a 4:3 shot.
      state: state([imageNode("img_1", 1)]),
    });
    const tool = createCutPartsTool({ repos, appUrl: () => APP });
    const res = await tool(
      {
        canvasId: c.id,
        cuts: [
          { itemId: "img_1", role: "detail" },
          { itemId: "img_1", role: "cta" },
          { itemId: "img_1", role: "cards" },
          { itemId: "img_1", role: "cards" },
        ],
      },
      ALICE,
    );
    const parts = (res.structuredContent as { parts: { crop: Crop; guessedCrop: boolean }[] }).parts;
    expect(parts.every((p) => p.guessedCrop)).toBe(true);
    expect(new Set(parts.map((p) => key(p.crop))).size).toBe(4);
    // The board is mobile and the shot is a 4:3 presentation: cut from the middle phone.
    expect(parts.every((p) => p.crop.x >= 0.3 && p.crop.x + p.crop.w <= 0.7)).toBe(true);
    expect(text(res)).toContain("nobody looked at the image");
    expect(text(res)).toContain("canvas crop editor");
  });
});
