/**
 * Visual QA for the signed-in pages and the 404 on the GoBanana desktop (DECISIONS.md,
 * 2026-10-12). Not a gate: skipped unless VISUAL_QA=1.
 *
 *   VISUAL_QA=1 npx playwright test e2e/site-v3-shots.spec.ts --project=chromium
 *
 * Writes PNGs to ../docs/screenshots/site-v3/: the canvases Finder window (icons, list, no match,
 * phone rows and the bottom sheet), the account System Settings window, the Trash 404 and the
 * legal pages, in English and Arabic at 1440x900 and on an iPhone 13. Runs with the E2E sign-in
 * bypass (demo cards); thumbnails are synthetic gradients, never anyone's image.
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { devices, expect, test, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

// iPhone 13 metrics in Chromium (the device preset would switch the browser to WebKit).
const { defaultBrowserType: _webkit, ...IPHONE } = devices["iPhone 13"];

test.skip(!process.env.VISUAL_QA, "visual QA screenshots run only with VISUAL_QA=1");

const OUT = fileURLToPath(new URL("../../docs/screenshots/site-v3/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const SIZES = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { ...IPHONE } } as const;
const LOCALES = ["en", "ar"] as const;
const COLORS: [number, number, number][][] = [
  [[186, 222, 255], [74, 108, 170]],
  [[255, 214, 170], [196, 72, 92]],
  [[200, 240, 220], [40, 120, 110]],
  [[236, 226, 255], [96, 70, 170]],
  [[250, 250, 240], [150, 150, 140]],
  [[255, 236, 180], [190, 120, 40]],
];

async function open(page: Page, url: string) {
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) => {
    const n = Number(/r(\d+)\.jpg$/.exec(route.request().url())?.[1] ?? 1);
    const [from, to] = COLORS[(n - 1) % COLORS.length]!;
    return route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(320, 240, from!, to!) });
  });
  await page.goto(url);
  await expect(page.locator(".site")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*, *::before, *::after { caret-color: transparent !important; } nextjs-portal { display: none !important; }" });
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage });
}

for (const [size, use] of Object.entries(SIZES)) {
  test.describe(size, () => {
    test.use(use);
    for (const locale of LOCALES) {
      test(`canvases ${locale}`, async ({ page }) => {
        await open(page, `/${locale}/canvases`);
        await shot(page, `canvases-${locale}-${size}`);
        if (size === "phone") {
          await page.locator(".lab-card").nth(2).locator(".lab-card-hit").click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await shot(page, `canvases-sheet-${locale}-${size}`);
        } else {
          await page.locator(".dash-view-btn").nth(1).click();
          await shot(page, `canvases-list-${locale}-${size}`);
          await page.locator(".dash-search-input").fill("zzz");
          await shot(page, `canvases-nomatch-${locale}-${size}`);
        }
      });

      for (const path of ["account", "no-such-page", "terms", "takedown"]) {
        test(`${path} ${locale}`, async ({ page }) => {
          await open(page, `/${locale}/${path}`);
          await shot(page, `${path === "no-such-page" ? "404" : path}-${locale}-${size}`, path !== "no-such-page");
        });
      }
    }
  });
}
