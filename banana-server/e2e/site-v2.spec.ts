/**
 * The site after the pryzm.design restructure (DECISIONS.md, 2026-10-11): the hero field
 * (drag, keyboard, sample cards), scroll reveals that never hide content without JS or under
 * reduced motion, the 404 page, the canvases dashboard (E2E sign-in bypass, demo cards) and the
 * share page chrome. axe runs on the new pages in light and dark.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const DEMO_SHARE = "/s/e2e-share-demo-token-0000000000";

async function axe(page: Page, include: string, label: string) {
  const results = await new AxeBuilder({ page }).include(include).withTags(TAGS).analyze();
  expect(results.violations, `${label}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), null, 2)}`).toEqual([]);
}

async function mockThumbs(page: Page) {
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(240, 180, [200, 210, 240], [70, 100, 170]) }),
  );
}

const planeShift = (page: Page) =>
  page.locator(".hero-plane").evaluate((el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: Math.round(m.m41), y: Math.round(m.m42) };
  });

test.describe("hero field", () => {
  test("arrow keys pan, Home recenters, and nothing moves on its own", async ({ page }) => {
    await page.goto("/en");
    const field = page.getByRole("region", { name: "Moves field" });
    await expect(field).toHaveAttribute("aria-describedby", /.+/);
    await field.focus();
    const start = await planeShift(page);
    await page.waitForTimeout(600);
    expect(await planeShift(page)).toEqual(start);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    const moved = await planeShift(page);
    expect(moved.x).toBeLessThan(start.x);
    expect(moved.y).toBeLessThan(start.y);
    await page.keyboard.press("Home");
    expect(await planeShift(page)).toEqual(start);
  });

  test("a drag pans the field and does not open a tile", async ({ page }) => {
    await page.goto("/en");
    const field = page.locator(".hero-field");
    const box = (await field.boundingBox())!;
    const start = await planeShift(page);
    await page.mouse.move(box.x + box.width / 2, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + 160, { steps: 8 });
    await page.mouse.up();
    const after = await planeShift(page);
    expect(after.x).toBeLessThan(start.x - 100);
    await expect(page.locator(".hero-card")).toHaveCount(0);
  });

  test("Enter on a tile opens its sample idea; Escape closes it and returns focus", async ({ page }) => {
    await page.goto("/en");
    const tile = page.locator(".hero-tile-btn").first();
    await tile.focus();
    await page.keyboard.press("Enter");
    const card = page.getByRole("dialog");
    await expect(card).toBeVisible();
    await expect(card).toBeFocused();
    await expect(tile).toHaveAttribute("aria-expanded", "true");
    await expect(card).toContainText("Twist:");
    await axe(page, ".hero", "hero with a card open");
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
    await expect(tile).toBeFocused();
  });

  test("under reduced motion a fling does not keep moving", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en");
    const box = (await page.locator(".hero-field").boundingBox())!;
    await page.mouse.move(box.x + 700, box.y + 150);
    await page.mouse.down();
    await page.mouse.move(box.x + 500, box.y + 150, { steps: 4 });
    await page.mouse.up();
    const a = await planeShift(page);
    await page.waitForTimeout(300);
    expect(await planeShift(page)).toEqual(a);
  });
});

test.describe("scroll reveals", () => {
  test("below the fold content waits, then shows when scrolled to", async ({ page }) => {
    await page.goto("/en");
    const faq = page.locator(".faq-item").first();
    await expect(page.locator("html")).toHaveClass(/reveal-on/);
    expect(await faq.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
    await faq.scrollIntoViewIfNeeded();
    await expect(faq).toHaveAttribute("data-revealed", "");
    await expect.poll(() => faq.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });

  test("nothing is hidden under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en");
    expect(await page.locator(".faq-item").first().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("every section is visible", async ({ page }) => {
    await page.goto("/en");
    for (const sel of [".faq-item", ".gallery-card", ".plan", ".frame"]) {
      expect(await page.locator(sel).first().evaluate((el) => getComputedStyle(el).opacity), sel).toBe("1");
    }
  });
});

test.describe("404", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`unknown pages answer 404 with the inset panel in English and Arabic (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      const en = await page.goto("/en/no-such-page");
      expect(en?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nothing lives at this address");
      await expect(page.locator(".nf-panel .st-btn")).toHaveCount(2);
      await axe(page, ".site", `404 en ${theme}`);
      const ar = await page.goto("/ar/no-such-page");
      expect(ar?.status()).toBe(404);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("لا توجد صفحة على هذا العنوان");
      await axe(page, ".site", `404 ar ${theme}`);
    });
  }
});

test.describe("canvases dashboard", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`lists canvases as cards with a details panel, axe clean (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await mockThumbs(page);
      await page.goto("/en/canvases");
      await expect(page.getByRole("heading", { level: 1, name: "Canvases" })).toBeVisible();
      const cards = page.locator(".lab-card");
      await expect(cards).toHaveCount(4);
      await expect(cards.first().getByRole("link", { name: "Cold checkout" })).toHaveAttribute("href", "/c/e2e-seed");
      await expect(cards.first().locator(".collage img")).toHaveCount(4);
      const details = page.getByRole("complementary", { name: "Details" });
      await expect(details).toContainText("Cold checkout");
      await cards.nth(2).getByRole("button", { name: "Show details" }).click();
      await expect(details).toContainText("Transit dashboard");
      await expect(details.getByRole("link", { name: /pinterest\.com\/pin\// }).first()).toBeVisible();
      await axe(page, ".site", `dashboard ${theme}`);
    });
  }

  test("collapse is remembered after a reload, and Shared links filters", async ({ page }) => {
    await mockThumbs(page);
    await page.goto("/en/canvases");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.locator(".lab")).toHaveAttribute("data-collapsed", "");
    await page.reload();
    await expect(page.locator(".lab")).toHaveAttribute("data-collapsed", "");
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.locator(".lab")).not.toHaveAttribute("data-collapsed", "");
    await page.getByRole("link", { name: /Shared links/ }).click();
    await expect(page).toHaveURL(/view=shared/);
    await expect(page.locator(".lab-card")).toHaveCount(1);
  });

  test("Arabic dashboard is rtl", async ({ page }) => {
    await mockThumbs(page);
    await page.goto("/ar/canvases");
    await expect(page.locator(".site")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: "اللوحات" })).toBeVisible();
    await axe(page, ".site", "dashboard ar");
  });
});

test.describe("share page chrome", () => {
  test("a slim bar sits above the unchanged shared canvas", async ({ page }) => {
    await mockThumbs(page);
    await page.goto(DEMO_SHARE);
    const bar = page.getByRole("navigation", { name: /home/ });
    await expect(bar).toContainText("A canvas made with");
    await expect(bar.getByRole("link", { name: "Add to Claude" })).toHaveAttribute("href", "/en#install");
    await expect(page.getByTestId("view-only-banner")).toBeVisible();
    await expect(page.locator(".react-flow__node")).toHaveCount(7);
    const barBox = (await bar.boundingBox())!;
    const pageBox = (await page.locator(".bn-page").boundingBox())!;
    expect(pageBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
  });
});

test.describe("header", () => {
  test("shows Your canvases when signed in, and Canvases carries a Beta chip", async ({ page }) => {
    await page.goto("/en/pricing");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Your canvases" })).toHaveAttribute("href", "/en/canvases");
    await expect(header.getByRole("link", { name: "Canvases Beta" })).toBeVisible();
    await expect(page.locator(".site [title]")).toHaveCount(0);
  });
});
