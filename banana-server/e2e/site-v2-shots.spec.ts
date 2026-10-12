/**
 * Visual QA for the GoBanana desktop landing page (DECISIONS.md, 2026-10-12). Not a gate: skipped
 * unless VISUAL_QA=1.
 *
 *   VISUAL_QA=1 npx playwright test e2e/site-v2-shots.spec.ts --project=chromium
 *
 * Writes PNGs to ../docs/screenshots/site-v2/: the desktop (hero) and every window section in
 * English and Arabic at 1440x900 and on an iPhone 13, plus the pricing page and the open states
 * (Quick Look, a second Mail message, an example board). The site is dark only. Image CDN
 * requests get synthetic gradients, so these files never hold anyone's work (hard rule 2).
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { devices, expect, test, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

// iPhone 13 metrics in Chromium (the device preset would switch the browser to WebKit).
const { defaultBrowserType: _webkit, ...IPHONE } = devices["iPhone 13"];

test.skip(!process.env.VISUAL_QA, "visual QA screenshots run only with VISUAL_QA=1");

const OUT = fileURLToPath(new URL("../../docs/screenshots/site-v2/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const SIZES = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { ...IPHONE } } as const;
const LOCALES = ["en", "ar"] as const;
// The scroll story sections (docs/landing-motion-spec.md), in page order.
const SECTIONS = ["#canvas", "#gallery", "#how", "#faq", "#ship", "#pricing", "#kit", "#next", "#end-title"];
const COLORS: [number, number, number][][] = [
  [[186, 222, 255], [74, 108, 170]],
  [[255, 214, 170], [196, 72, 92]],
  [[200, 240, 220], [40, 120, 110]],
  [[236, 226, 255], [96, 70, 170]],
];

async function open(page: Page, url: string) {
  await page.route(/^https:\/\/(cdn\.dribbble\.com|mir-s3-cdn-cf\.behance\.net|i\.pinimg\.com)\//, (route) => {
    const url = route.request().url();
    let h = 0;
    for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0;
    const [from, to] = COLORS[h % COLORS.length]!;
    return route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(320, 240, from!, to!) });
  });
  await page.goto(url);
  // Hydrated: the menu bar clock is client only.
  await expect(page.locator(".menubar-clock")).not.toBeEmpty();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*, *::before, *::after { caret-color: transparent !important; } nextjs-portal { display: none !important; }" });
}

/** Scrolls through the page so every reveal fires, then brings `selector` near the top. */
async function scrollTo(page: Page, selector: string) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(30);
  }
  await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ block: "start" }));
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage });
}

for (const [size, use] of Object.entries(SIZES)) {
  test.describe(size, () => {
    test.use(use);
    for (const locale of LOCALES) {
      test(`landing ${locale}`, async ({ page }) => {
        await open(page, `/${locale}`);
        await shot(page, `desk-${locale}-${size}`);
        for (const id of SECTIONS) {
          await scrollTo(page, id);
          await shot(page, `section-${id.slice(1)}-${locale}-${size}`);
        }
      });

      test(`pricing ${locale}`, async ({ page }) => {
        await open(page, `/${locale}/pricing`);
        await shot(page, `pricing-${locale}-${size}`, true);
      });
    }
  });
}

test.describe("open states", () => {
  test.use(SIZES.desktop);
  for (const locale of LOCALES) {
    test(`Quick Look, Mail and an example board ${locale}`, async ({ page }) => {
      await open(page, `/${locale}`);
      await page.locator(".desk-icon").first().click();
      await expect(page.locator(".quicklook")).toBeVisible();
      await shot(page, `quicklook-${locale}`);
      await page.keyboard.press("Escape");
      await scrollTo(page, "#faq");
      await page.locator(".mail-row").nth(2).click();
      await shot(page, `mail-${locale}`);
      await scrollTo(page, "#gallery");
      await page.locator(".gallery-reveal .st-btn").first().focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot(page, `board-${locale}`);
    });
  }
});
