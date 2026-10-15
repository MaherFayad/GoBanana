/**
 * Culture chip (CULT-02): shows on an image tile and a note, opens the meaning and credit from the
 * keyboard, works in English and Arabic, and is axe clean. The API and image host are mocked.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

const CANVAS_ID = "e2e-culture";

const CULTURE = {
  tradition: "Sadu weaving",
  region: "Arabian Peninsula",
  community: "Bedouin women weavers",
  tier: "care",
  meaning: "Flat woven bands in strict repeats, made by Bedouin women.",
  credit: "Sadu weavers of the Gulf, via UNESCO",
  sourceUrl: "https://ich.unesco.org/en/RL/al-sadu-traditional-weaving-skills-in-the-united-arab-emirates-00517",
};

const state = {
  version: 1,
  viewport: { x: 40, y: 60, zoom: 1 },
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
        sourceUrl: "https://www.pinterest.com/pin/1/",
        sourceSite: "pinterest.com",
        title: "Sadu band",
        width: 1200,
        height: 900,
        culture: CULTURE,
      },
    },
    { id: "note1", type: "note", x: 340, y: 0, w: 260, h: 140, data: { text: "meaning: bands\ncredit: Sadu weavers", color: "yellow", culture: CULTURE } },
  ],
  tray: [],
};

async function open(page: Page, lang?: string) {
  await page.route(`**/api/canvas/${CANVAS_ID}`, async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state, updatedAt: "2026-10-15T10:00:00.000Z" }) });
  });
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(64, 48, [186, 222, 255], [74, 108, 170]) }),
  );
  await page.goto(`/c/${CANVAS_ID}`);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  if (lang) await page.evaluate((l) => document.documentElement.setAttribute("lang", l), lang);
}

test.describe("culture chip", () => {
  test("shows on the image and the note and opens the meaning and credit with the keyboard", async ({ page }) => {
    await open(page);
    const chips = page.getByTestId("culture-chip");
    await expect(chips).toHaveCount(2);
    const chip = page.locator('.react-flow__node[data-id="img1"]').getByTestId("culture-chip");
    await chip.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Cultural context" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Flat woven bands in strict repeats");
    await expect(dialog).toContainText("Sadu weavers of the Gulf, via UNESCO");
    await expect(dialog).toContainText("Care");
    await expect(dialog.getByRole("link", { name: /ich\.unesco\.org/ })).toBeVisible();
    // Opening it did not open the image preview.
    await expect(page.getByRole("dialog")).toHaveCount(1);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(chip).toBeFocused();
  });

  test("reads in Arabic when the page is Arabic", async ({ page }) => {
    await open(page, "ar");
    const chip = page.locator('.react-flow__node[data-id="note1"]').getByTestId("culture-chip");
    await expect(chip).toHaveText("الثقافة");
    await chip.focus();
    await page.keyboard.press("Space");
    const dialog = page.getByRole("dialog", { name: "السياق الثقافي" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("culture-details")).toHaveAttribute("dir", "rtl");
    await expect(dialog).toContainText("مستوى العناية");
    await expect(dialog).toContainText("Sadu weavers of the Gulf, via UNESCO");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
  });

  test("the board is axe clean with the chips closed @a11y", async ({ page }) => {
    await open(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
});
