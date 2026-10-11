/**
 * Landing page visuals (DECISIONS.md, 2026-10-11, "Live references, linked" and the visual pass):
 * hero tiles that link to real work, the generative fallback when an image fails, the export file
 * tabs (WAI-ARIA tabs, arrow keys follow the reading direction), the example board dialog, and
 * Arabic alignment (labels sit at the inline start, the right side). Runs against `next dev`
 * with the E2E bypass, which checks the showcase against an empty takedown list.
 *
 * Image CDN requests are answered with synthetic gradients, never anyone's image.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

const CDN = /^https:\/\/(cdn\.dribbble\.com|mir-s3-cdn-cf\.behance\.net|i\.pinimg\.com)\//;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function mockCdn(page: Page, fail: RegExp | null = null) {
  await page.route(CDN, (route) => {
    if (fail?.test(route.request().url())) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(160, 120, [200, 210, 230], [90, 70, 140]) });
  });
}

/** Opens a page and waits for hydration (Reveal puts .reveal-on on <html> once React runs). */
async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator("html")).toHaveClass(/reveal-on/);
}

async function axe(page: Page, include: string, label: string) {
  const results = await new AxeBuilder({ page }).include(include).withTags(TAGS).analyze();
  expect(results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), label).toEqual([]);
}

test.describe("hero references", () => {
  test("each tile links to its source in a new tab, credits the creator, and loads with no referrer", async ({ page }) => {
    await mockCdn(page);
    await open(page, "/en");
    const links = page.locator(".hero-tile-link");
    await expect(links).toHaveCount(14);
    for (const i of [0, 2, 5]) {
      const link = links.nth(i);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(await link.getAttribute("href")).toMatch(/^https:\/\/(www\.|fr\.)?(dribbble\.com\/shots|behance\.net\/gallery|pinterest\.com\/pin)\//);
      await expect(link.locator("img")).toHaveAttribute("referrerpolicy", "no-referrer");
      expect(await link.locator("img").getAttribute("alt")).toBeTruthy();
    }
    await expect(links.nth(2)).toContainText("Aleksei Vasileika, Dribbble");
    await expect(links.nth(2)).toContainText("Material: iridescent film");
    await expect(page.locator(".hero-notice a")).toHaveAttribute("href", "/en/takedown");
  });

  test("an image that does not load falls back to the generative art", async ({ page }) => {
    await mockCdn(page, /dribbble/);
    await open(page, "/en");
    const tile = page.locator(".hero-tile").nth(2);
    await expect(tile.locator(".art")).toHaveCount(1);
    await expect(tile.locator("img")).toHaveCount(0);
    // Still a link to the work, still credited.
    await expect(tile.locator(".hero-tile-link")).toContainText("Dribbble");
  });

  test("the idea button opens the sample idea with an Open source link", async ({ page }) => {
    await mockCdn(page);
    await open(page, "/en");
    const idea = page.locator(".hero-idea").first();
    await idea.focus();
    await page.keyboard.press("Enter");
    const card = page.getByRole("dialog");
    await expect(card).toBeVisible();
    await expect(card.getByRole("link", { name: /Open source/ })).toHaveAttribute("target", "_blank");
    await axe(page, ".hero", "hero with an idea open");
    await page.keyboard.press("Escape");
    await expect(idea).toBeFocused();
  });
});

test.describe("export file tabs", () => {
  test("arrow keys move along the cards and switch the window", async ({ page }) => {
    await mockCdn(page);
    await open(page, "/en");
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(6);
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".export-window-file")).toHaveText("AGENTS.md");
    await page.keyboard.press("End");
    await expect(page.locator(".export-window-file")).toHaveText("BRIEF.md");
    await page.keyboard.press("Home");
    await expect(page.getByRole("tabpanel")).toContainText("version: alpha");
    await axe(page, ".export-tabs", "export tabs en");
  });

  test("Arabic: ArrowLeft moves forward, and every label sits at the right (inline start)", async ({ page }) => {
    await mockCdn(page);
    await open(page, "/ar");
    const tabs = page.getByRole("tab");
    await tabs.first().focus();
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    for (let i = 0; i < 6; i++) {
      const tab = tabs.nth(i);
      const card = (await tab.boundingBox())!;
      for (const sel of [".export-card-name", ".export-card-body"]) {
        const text = await tab.locator(sel).evaluate((el) => {
          const r = document.createRange();
          r.selectNodeContents(el);
          const b = r.getBoundingClientRect();
          return { right: b.right, left: b.left, align: getComputedStyle(el).textAlign, dir: getComputedStyle(el).direction };
        });
        expect(text.dir, `${i} ${sel}`).toBe("rtl");
        // The text's right edge is at the card's right padding, never pushed to the left.
        expect(card.x + card.width - text.right, `${i} ${sel} right gap`).toBeLessThan(28);
      }
    }
    await axe(page, ".export-tabs", "export tabs ar");
  });
});

test.describe("gallery boards", () => {
  test("Open example shows the board with every reference linked", async ({ page }) => {
    await mockCdn(page);
    await open(page, "/en");
    const card = page.locator(".gallery-card").first();
    await card.locator(".gallery-reveal .st-btn").focus();
    await expect(card.locator(".gallery-reveal")).toHaveCSS("opacity", "1");
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Souq checkout" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".board-dialog-credit")).toHaveCount(4);
    await expect(dialog.locator(".board-dialog-palette li")).toHaveCount(5);
    await axe(page, ".board-dialog", "board dialog");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the sources disclosure lists four links", async ({ page }) => {
    await mockCdn(page);
    await open(page, "/en");
    const sources = page.locator(".gallery-sources").first();
    await sources.locator("summary").click();
    await expect(sources.getByRole("link")).toHaveCount(4);
  });
});

test("the server address copies with a Copied toast", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockCdn(page);
  await open(page, "/en");
  await page.getByRole("button", { name: "Copy address" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copied" })).toHaveCount(1);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/api\/mcp$/);
});

test("Arabic copy keeps punctuation outside Latin terms", async ({ page }) => {
  await mockCdn(page);
  await open(page, "/ar");
  const body = page.getByRole("tab").nth(2).locator(".export-card-body");
  await expect(body.locator("bdi")).toHaveText("JSON");
  await expect(body).toHaveText("الألوان والخطوط بصيغة JSON.");
});
