/**
 * Visual QA for the restructured site (DECISIONS.md, 2026-10-11). Not a gate: skipped unless
 * VISUAL_QA=1.
 *
 *   VISUAL_QA=1 npx playwright test e2e/site-v2-shots.spec.ts --project=chromium
 *
 * Writes PNGs to ../docs/screenshots/site-v2/: the landing page (top, and mid-page after
 * scrolling through the reveals) in English and Arabic, light and dark, at 1440x900 and 390x844;
 * pricing, the 404 page, the canvases dashboard (E2E sign-in bypass, demo cards) and the share
 * page chrome (demo token) in both sizes. Thumbnails are synthetic gradients served by
 * page.route, never anyone's image.
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

test.skip(!process.env.VISUAL_QA, "visual QA screenshots run only with VISUAL_QA=1");

const OUT = fileURLToPath(new URL("../../docs/screenshots/site-v2/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const SIZES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;
const THEMES = ["light", "dark"] as const;
const LOCALES = ["en", "ar"] as const;
const COLORS: [number, number, number][][] = [
  [[186, 222, 255], [74, 108, 170]],
  [[255, 214, 170], [196, 72, 92]],
  [[200, 240, 220], [40, 120, 110]],
  [[236, 226, 255], [96, 70, 170]],
  [[250, 250, 240], [150, 150, 140]],
  [[255, 236, 180], [190, 120, 40]],
];

async function mockThumbs(page: Page) {
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) => {
    const n = Number(/r(\d+)\.jpg$/.exec(route.request().url())?.[1] ?? 1);
    const [from, to] = COLORS[(n - 1) % COLORS.length]!;
    return route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(320, 240, from!, to!) });
  });
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*, *::before, *::after { caret-color: transparent !important; } nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}${name}.png` });
}

/** Scrolls down through the page so every reveal fires, then stops on the graph section. */
async function scrollToMiddle(page: Page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(40);
  }
  await page.locator("#how").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.evaluate(() => window.scrollBy(0, -80));
}

for (const [size, viewport] of Object.entries(SIZES)) {
  test.describe(size, () => {
    test.use({ viewport });

    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        test(`landing ${locale} ${theme}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.goto(`/${locale}`);
          await expect(page.locator(".hero-field")).toBeVisible();
          await shot(page, `landing-top-${locale}-${theme}-${size}`);
          await scrollToMiddle(page);
          await shot(page, `landing-mid-${locale}-${theme}-${size}`);
        });
      }

      test(`pricing ${locale}`, async ({ page }) => {
        await page.goto(`/${locale}/pricing`);
        await shot(page, `pricing-${locale}-light-${size}`);
      });

      test(`404 ${locale}`, async ({ page }) => {
        await page.goto(`/${locale}/no-such-page`);
        await expect(page.locator(".nf-panel")).toBeVisible();
        await shot(page, `404-${locale}-light-${size}`);
      });

      test(`dashboard ${locale}`, async ({ page }) => {
        await mockThumbs(page);
        await page.goto(`/${locale}/canvases`);
        await expect(page.locator(".lab-card")).toHaveCount(4);
        await shot(page, `dashboard-${locale}-light-${size}`);
      });
    }

    test("dashboard en dark", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await mockThumbs(page);
      await page.goto("/en/canvases");
      await expect(page.locator(".lab-card")).toHaveCount(4);
      await shot(page, `dashboard-en-dark-${size}`);
    });

    test("hero tile card en", async ({ page }) => {
      await page.goto("/en");
      const tile = page.locator(".hero-idea").nth(1);
      await tile.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot(page, `landing-tile-card-en-light-${size}`);
    });

    test("share chrome", async ({ page }) => {
      await mockThumbs(page);
      await page.goto("/s/e2e-share-demo-token-0000000000");
      await expect(page.locator(".react-flow__node")).toHaveCount(7);
      await shot(page, `share-en-light-${size}`);
    });
  });
}

test.describe("dashboard collapsed", () => {
  test.use({ viewport: SIZES.desktop });
  test("collapsed sidebar", async ({ page }) => {
    await mockThumbs(page);
    await page.goto("/en/canvases");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await shot(page, "dashboard-en-light-desktop-collapsed");
  });
});
