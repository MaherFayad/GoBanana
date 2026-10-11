/**
 * Visual QA for the landing visuals pass (DECISIONS.md, 2026-10-11). Not a gate: skipped unless
 * VISUAL_QA=1.
 *
 *   VISUAL_QA=1 npx playwright test e2e/site-v3-shots.spec.ts --project=chromium
 *
 * Writes PNGs to ../docs/screenshots/site-v3/: the landing page's hero, gallery, export, set up and
 * pricing sections in English and Arabic, light and dark, at 1440x900 and 390x844; the pricing,
 * takedown, account, 404 and dashboard pages (Arabic, where the bidi fixes landed, plus English
 * pricing); and the open states (gallery reveal, example board, hero idea).
 *
 * Showcase images are hotlinked on the live site. Here every image CDN request is answered with
 * a synthetic gradient, so these files never hold anyone's work (hard rule 2).
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

test.skip(!process.env.VISUAL_QA, "visual QA screenshots run only with VISUAL_QA=1");

const OUT = fileURLToPath(new URL("../../docs/screenshots/site-v3/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const SIZES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;
const THEMES = ["light", "dark"] as const;
const LOCALES = ["en", "ar"] as const;
const SECTIONS = { gallery: "#gallery", export: "#ship-title", setup: "#install", pricing: "#pricing-title" } as const;
const COLORS: [number, number, number][][] = [
  [[186, 222, 255], [74, 108, 170]],
  [[255, 214, 170], [196, 72, 92]],
  [[200, 240, 220], [40, 120, 110]],
  [[236, 226, 255], [96, 70, 170]],
  [[250, 250, 240], [150, 150, 140]],
  [[255, 236, 180], [190, 120, 40]],
];

/** Every image CDN request (showcase and dashboard thumbnails) gets a synthetic gradient. */
async function mockImages(page: Page) {
  await page.route(/^https:\/\/(cdn\.dribbble\.com|mir-s3-cdn-cf\.behance\.net|i\.pinimg\.com)\//, (route) => {
    const url = route.request().url();
    let h = 0;
    for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0;
    const [from, to] = COLORS[h % COLORS.length]!;
    return route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(320, 240, from!, to!) });
  });
}

async function open(page: Page, url: string) {
  await mockImages(page);
  await page.goto(url);
  await expect(page.locator(".site")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*, *::before, *::after { caret-color: transparent !important; } nextjs-portal { display: none !important; }" });
}

/** Scrolls through the page so every reveal fires, then brings `selector` to the top. */
async function scrollTo(page: Page, selector: string) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(30);
  }
  await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.evaluate(() => window.scrollBy(0, -72));
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage });
}

for (const [size, viewport] of Object.entries(SIZES)) {
  test.describe(size, () => {
    test.use({ viewport });

    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        test(`landing ${locale} ${theme}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme });
          await open(page, `/${locale}`);
          await shot(page, `landing-top-${locale}-${theme}-${size}`);
          for (const [name, selector] of Object.entries(SECTIONS)) {
            await scrollTo(page, selector);
            await shot(page, `landing-${name}-${locale}-${theme}-${size}`);
          }
          await scrollTo(page, ".final");
          await shot(page, `landing-final-${locale}-${theme}-${size}`);
        });
      }

      test(`pricing page ${locale}`, async ({ page }) => {
        await open(page, `/${locale}/pricing`);
        await shot(page, `pricing-page-${locale}-light-${size}`, true);
      });
    }

    for (const path of ["takedown", "account", "no-such-page", "canvases"]) {
      test(`ar ${path}`, async ({ page }) => {
        await open(page, `/ar/${path}`);
        await shot(page, `ar-${path === "no-such-page" ? "404" : path}-light-${size}`, path !== "canvases");
      });
    }
  });
}

test.describe("open states", () => {
  test.use({ viewport: SIZES.desktop });

  for (const locale of LOCALES) {
    test(`gallery reveal and example board ${locale}`, async ({ page }) => {
      await open(page, `/${locale}`);
      await scrollTo(page, "#gallery");
      await page.locator(".gallery-reveal .st-btn").first().focus();
      await shot(page, `landing-gallery-reveal-${locale}-light-desktop`);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot(page, `landing-gallery-dialog-${locale}-light-desktop`);
    });

    test(`export tab switch ${locale}`, async ({ page }) => {
      await open(page, `/${locale}`);
      await scrollTo(page, "#ship-title");
      await page.getByRole("tab").nth(2).click();
      await shot(page, `landing-export-tokens-${locale}-light-desktop`);
    });

    test(`hero idea ${locale}`, async ({ page }) => {
      await open(page, `/${locale}`);
      await page.locator(".hero-idea").nth(2).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot(page, `landing-hero-idea-${locale}-light-desktop`);
    });
  }
});
