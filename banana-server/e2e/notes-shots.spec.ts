/**
 * Visual QA for sticky notes, image chrome under zoom and the image preview (DECISIONS.md,
 * 2026-10-11). Not a gate: skipped unless VISUAL_QA=1.
 *
 *   VISUAL_QA=1 SHOT_TAG=after npx playwright test e2e/notes-shots.spec.ts --project=chromium
 *
 * Writes PNGs to ../docs/screenshots/notes/ named <tag>-<scene>-<theme>.png. The API and the
 * image host are mocked with page.route; tile images are synthetic gradients drawn here.
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

test.skip(!process.env.VISUAL_QA, "visual QA screenshots run only with VISUAL_QA=1");

const OUT = fileURLToPath(new URL("../../docs/screenshots/notes/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const TAG = process.env.SHOT_TAG ?? "after";
const THEMES = ["light", "dark"] as const;

const LONG =
  "WILD: The whole checkout is one tall seed packet. The order summary is printed on the back like planting instructions, and the pay button is the tear strip at the top.\n" +
  "SALVAGE: A flippable 'ticket card'. Front shows the total, back shows the line items, flip with one tap.";
const MID = "Keep the dark paper texture subtle. It should read as soil, not noise, and the type stays crisp on top of it.";

const NOTES_STATE = {
  version: 1,
  viewport: { x: 60, y: 60, zoom: 1 },
  nodes: [
    { id: "sec1", type: "section", x: 0, y: 0, w: 920, h: 420, data: { title: "B. Obsidian Seed Packet" } },
    // As placed by add_to_canvas and arranged: 280 x 178, too short for its text.
    { id: "note-long", type: "note", x: 16, y: 48, w: 280, h: 178, parentId: "sec1", data: { text: LONG, color: "yellow" } },
    { id: "note-short", type: "note", x: 312, y: 48, w: 220, h: 140, parentId: "sec1", data: { text: "Make it feel cold", color: "blue" } },
    {
      id: "note-compact",
      type: "note",
      x: 548,
      y: 48,
      w: 220,
      h: 96,
      parentId: "sec1",
      data: { text: MID, color: "pink", manualHeight: true },
    },
    { id: "note-green", type: "note", x: 548, y: 180, w: 220, h: 120, parentId: "sec1", data: { text: "NOTE: green paper\nSecond line here.", color: "green" } },
    { id: "note-gray", type: "note", x: 312, y: 220, w: 220, h: 120, parentId: "sec1", data: { text: "Gray paper, plain text, two short lines of it.", color: "gray" } },
  ],
  tray: [],
};

const IMAGE_STATE = (zoom: number) => ({
  version: 1,
  // Center the 280 x 210 tile in the 1440 x 900 window (minus the 42px rail and 36px bar).
  viewport: { x: 700 - 140 * zoom, y: 430 - 105 * zoom, zoom },
  nodes: [
    {
      id: "img1",
      type: "image",
      x: 0,
      y: 0,
      w: 280,
      h: 210,
      data: {
        imageUrl: "https://i.pinimg.com/736x/r1.jpg",
        thumbUrl: "https://i.pinimg.com/236x/r1.jpg",
        sourceUrl: "https://dribbble.com/shots/1-glass",
        sourceSite: "dribbble.com",
        title: "Glass checkout",
        width: 1200,
        height: 900,
      },
    },
    {
      id: "img2",
      type: "image",
      x: 296,
      y: 0,
      w: 280,
      h: 210,
      data: {
        imageUrl: "https://i.pinimg.com/736x/r2.jpg",
        thumbUrl: "https://i.pinimg.com/236x/r2.jpg",
        sourceUrl: "https://www.pinterest.com/pin/2/",
        sourceSite: "pinterest.com",
        title: "Frosted sleeve",
        width: 1200,
        height: 900,
      },
    },
  ],
  tray: [],
});

async function mock(page: Page, state: unknown) {
  await page.route("**/api/canvas/shots", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }) })
      : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state, updatedAt: new Date().toISOString() }) }),
  );
  // The thumbnail is tiny on purpose, so a blurry upscale is easy to see; the full image is large.
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) => {
    const url = route.request().url();
    const full = url.includes("/736x/");
    const two = url.includes("r2");
    const from: [number, number, number] = two ? [255, 214, 170] : [186, 222, 255];
    const to: [number, number, number] = two ? [196, 72, 92] : [74, 108, 170];
    return route.fulfill({ status: 200, contentType: "image/png", body: full ? gradientPng(1200, 900, from, to) : gradientPng(24, 18, from, to) });
  });
}

async function open(page: Page, state: unknown) {
  await mock(page, state);
  await page.goto("/c/shots");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

for (const theme of THEMES) {
  test.describe(`notes ${theme}`, () => {
    test.use({ colorScheme: theme, viewport: { width: 1440, height: 900 } });

    test(`notes board ${theme}`, async ({ page }) => {
      await open(page, NOTES_STATE);
      await page.mouse.move(5, 890);
      const box = await page.locator('.react-flow__node[data-id="sec1"]').boundingBox();
      if (!box) throw new Error("no section");
      await page.screenshot({
        path: `${OUT}${TAG}-notes-board-${theme}.png`,
        clip: { x: box.x - 24, y: box.y - 24, width: box.width + 48, height: Math.min(860 - box.y, box.height + 48) },
      });
    });

    test(`compact note focused ${theme}`, async ({ page }) => {
      await open(page, NOTES_STATE);
      await page.locator('.react-flow__node[data-id="note-compact"]').focus();
      await page.waitForTimeout(300);
      const box = await page.locator('.react-flow__node[data-id="note-compact"]').boundingBox();
      if (!box) throw new Error("no note");
      await page.screenshot({ path: `${OUT}${TAG}-compact-focus-${theme}.png`, clip: { x: box.x - 80, y: box.y - 80, width: 480, height: 420 } });
    });

    for (const zoom of [1, 3]) {
      test(`image chrome at ${zoom * 100}% ${theme}`, async ({ page }) => {
        await open(page, IMAGE_STATE(zoom));
        const tile = page.locator('.react-flow__node[data-id="img1"]');
        await tile.focus();
        await page.keyboard.press("Enter");
        await page.mouse.move(5, 890);
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${OUT}${TAG}-image-zoom-${zoom * 100}-${theme}.png` });
      });
    }
  });
}

for (const [name, viewport, theme] of [
  ["light", { width: 1440, height: 900 }, "light"],
  ["dark", { width: 1440, height: 900 }, "dark"],
  ["mobile", { width: 390, height: 844 }, "light"],
] as const) {
  test.describe(`preview ${name}`, () => {
    test.use({ colorScheme: theme, viewport, hasTouch: name === "mobile" });

    test(`image preview ${name}`, async ({ page }) => {
      test.skip(TAG === "before", "the preview is new");
      await open(page, IMAGE_STATE(1));
      await page.locator('.react-flow__node[data-id="img1"]').focus();
      await page.keyboard.press(" ");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${fileURLToPath(new URL("../../docs/screenshots/preview/", import.meta.url))}preview-${name}.png` });
    });
  });
}
