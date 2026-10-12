/**
 * The GoBanana desktop landing page (docs/site-redesign-spec.md, DECISIONS.md 2026-10-12): the
 * sticky menu bar, the "Add to Claude" window (copy, move with the keyboard, close and reopen),
 * the dock, the Mail-style FAQ by keyboard, desktop icons with Quick Look, the phone home screen
 * without sideways scroll, and Arabic mirroring. Runs against `next dev` with the E2E sign-in
 * bypass (playwright.config.ts), which checks the examples against an empty takedown list.
 *
 * Image CDN requests are answered with synthetic gradients, never anyone's image. Landing copy
 * changes often, so landing elements are found by role and structure, not by their words.
 */
import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

// iPhone 13 metrics in Chromium (the device preset would switch the browser to WebKit).
const { defaultBrowserType: _webkit, ...IPHONE } = devices["iPhone 13"];

const CDN = /^https:\/\/(cdn\.dribbble\.com|mir-s3-cdn-cf\.behance\.net|i\.pinimg\.com)\//;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function mockCdn(page: Page) {
  await page.route(CDN, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(160, 120, [200, 210, 230], [90, 70, 140]) }),
  );
}

/** Hydrated: the menu bar clock is client only, so its text means React has run. */
async function hydrated(page: Page) {
  await expect(page.locator(".menubar-clock")).not.toBeEmpty();
}

/** Opens a page and waits for hydration. */
async function open(page: Page, url: string) {
  await mockCdn(page);
  await page.goto(url);
  await hydrated(page);
}

async function axe(page: Page, include: string, label: string) {
  const results = await new AxeBuilder({ page }).include(include).withTags(TAGS).analyze();
  expect(results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), label).toEqual([]);
}

const hrefs = (page: Page, selector: string) => page.locator(selector).evaluateAll((els) => els.map((el) => el.getAttribute("href")));

test.describe("menu bar", () => {
  test("stays at the top while scrolling, with the nav, language, Your canvases and Add to Claude", async ({ page }) => {
    await open(page, "/en");
    const bar = page.getByRole("banner");
    expect(await hrefs(page, "header .site-nav a")).toEqual(["/en#how", "/en/gallery", "/docs/", "/en/pricing"]);
    // Signed in through the E2E bypass, so the bar links to the canvases.
    await expect(bar.locator(".menubar-link")).toHaveAttribute("href", "/en/canvases");
    await expect(bar.locator(".menubar-pill")).toHaveAttribute("href", "/en#install");
    await expect(bar.locator(".lang-switch")).toHaveAttribute("lang", "ar");
    // The clock is client only and decorative.
    await expect(bar.locator(".menubar-clock")).toHaveAttribute("aria-hidden", "true");
    await expect(bar.locator(".menubar-clock")).not.toBeEmpty();

    await page.evaluate(() => window.scrollTo(0, 2000));
    await expect.poll(async () => (await bar.boundingBox())?.y).toBe(0);
    await axe(page, ".menubar", "menu bar");
  });
});

test.describe("Add to Claude window", () => {
  test("the copy button copies the server address and shows a Copied toast", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page, "/en");
    const win = page.locator("#install");
    await expect(win).toHaveRole("region");
    await expect(win).toHaveAccessibleName(/.+/);
    await expect(win.getByRole("heading", { level: 2 })).toContainText("GoBanana");
    await win.getByTestId("code-server-url").getByRole("button").click();
    await expect(page.locator(".st-toast")).toHaveCount(1);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/api\/mcp$/);
  });

  test("moves 16px per arrow key from its title, goes back with the green light, and closes and reopens", async ({ page }) => {
    await open(page, "/en");
    const win = page.locator("#install");
    const handle = win.locator(".dwin-handle");
    await expect(handle).toHaveRole("button");
    await expect(handle).toHaveAccessibleName(/.+/);
    await handle.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await expect(win).toHaveAttribute("data-moved", "");
    expect(await win.evaluate((el) => (el as HTMLElement).style.translate)).toBe("16px 16px");

    await win.locator(".dwin-light[data-light='zoom']").click();
    await expect(win).not.toHaveAttribute("data-moved", "");

    await win.locator(".dwin-light[data-light='close']").click();
    const reopen = page.locator(".dwin-reopen");
    await expect(reopen).toBeFocused();
    await reopen.press("Enter");
    await expect(page.locator("#install .dwin-handle")).toBeFocused();
    // Escape anywhere in the window closes it too.
    await page.keyboard.press("Escape");
    await expect(page.locator(".dwin-reopen")).toBeFocused();
  });

  test("does not move under reduced motion, and the lights still work", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/en");
    await expect(page.locator("#install .dwin-handle")).toHaveCount(0);
    const min = page.locator("#install .dwin-light[data-light='min']");
    await min.click();
    await expect(min).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#install-body")).toBeHidden();
  });
});

test.describe("dock", () => {
  test("links home, to the sections, the docs and pricing, with a visible name on focus", async ({ page }) => {
    await open(page, "/en");
    const dock = page.locator("nav.dock");
    await expect(dock).toHaveAccessibleName(/.+/);
    expect(await hrefs(page, "nav.dock a")).toEqual(["/en", "/en/canvases", "/docs/", "/en/pricing"]);
    const links = dock.getByRole("link");
    // Every item has a real text name, shown over the icon on focus.
    for (const name of await links.evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ""))) expect(name).not.toBe("");
    await links.nth(2).focus();
    await expect(links.nth(2).locator(".dock-label")).toHaveCSS("opacity", "1");
    // Fixed to the bottom of the viewport.
    const box = (await dock.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThan(900 - 40);
  });

  test("Arabic links to the Arabic docs and mirrors the order (home at the right)", async ({ page }) => {
    await open(page, "/ar");
    const links = page.locator("nav.dock").getByRole("link");
    await expect(links.nth(2)).toHaveAttribute("href", "/docs/ar/");
    const first = (await links.first().boundingBox())!;
    const last = (await links.last().boundingBox())!;
    expect(first.x).toBeGreaterThan(last.x);
  });
});

test.describe("Mail FAQ", () => {
  test("rows are disclosure buttons: Tab and Enter open a message in the reading pane", async ({ page }) => {
    await open(page, "/en");
    const list = page.locator(".mail-list");
    await expect(list).toHaveAccessibleName(/.+/);
    await list.scrollIntoViewIfNeeded();
    const rows = list.locator(".mail-row");
    await expect(rows.first()).toHaveAttribute("aria-expanded", "true");
    await rows.first().focus();
    await page.keyboard.press("Tab");
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(rows.nth(1)).toHaveAttribute("aria-expanded", "true");
    await expect(rows.first()).toHaveAttribute("aria-expanded", "false");
    const pane = page.locator(`[id="${await rows.nth(1).getAttribute("aria-controls")}"]`);
    await expect(pane).toBeVisible();
    await expect(pane).toHaveRole("region");
    await page.keyboard.press("Tab");
    await page.keyboard.press(" ");
    await expect(rows.nth(2)).toHaveAttribute("aria-expanded", "true");
    await axe(page, ".mail", "mail faq");
  });

  test.describe("on a phone", () => {
    test.use({ ...IPHONE });
    test("works as an accordion: a second press closes the open message", async ({ page }) => {
      await open(page, "/en");
      const rows = page.locator(".mail-list .mail-row");
      await rows.first().scrollIntoViewIfNeeded();
      await rows.first().click();
      await expect(rows.first()).toHaveAttribute("aria-expanded", "false");
      await rows.nth(1).click();
      await expect(rows.nth(1)).toHaveAttribute("aria-expanded", "true");
    });
  });
});

test.describe("desktop icons and Quick Look", () => {
  test("an icon opens Quick Look with the source link; Escape closes it and focus returns", async ({ page }) => {
    await open(page, "/en");
    const icons = page.locator(".desk-icons").getByRole("button");
    await expect(icons).toHaveCount(4);
    const icon = icons.first();
    await icon.focus();
    await page.keyboard.press("Enter");
    await expect(icon).toHaveAttribute("aria-expanded", "true");
    const look = page.locator(".quicklook");
    await expect(look).toBeVisible();
    // The window's move handle takes focus, so the keyboard is already inside it.
    await expect(look.locator(".dwin-handle")).toBeFocused();
    const source = look.locator(".dwin-body a");
    await expect(source).toHaveAttribute("target", "_blank");
    await expect(source).toHaveAttribute("rel", "noopener noreferrer");
    expect(await source.getAttribute("href")).toMatch(/^https:\/\/(www\.|fr\.)?(dribbble\.com|behance\.net|pinterest\.com)\//);
    await expect(look.locator("img")).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(await look.locator("img").getAttribute("alt")).toBeTruthy();
    await axe(page, ".desk-icons-wrap", "quick look");
    await page.keyboard.press("Escape");
    await expect(look).toHaveCount(0);
    await expect(icon).toBeFocused();
  });

  test("an image that does not load falls back to the generative art", async ({ page }) => {
    await page.route(CDN, (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto("/en");
    await hydrated(page);
    const icon = page.locator(".desk-icon").first();
    await expect(icon.locator(".art")).toHaveCount(1);
    await expect(icon.locator("img")).toHaveCount(0);
  });
});

test.describe("phone home screen", () => {
  test.use({ ...IPHONE });
  for (const url of ["/en", "/ar", "/en/pricing", "/ar/canvases", "/en/account", "/en/no-such-page", "/en/gallery", "/ar/gallery"]) {
    test(`${url} has no sideways scroll`, async ({ page }) => {
      await mockCdn(page);
      await page.goto(url);
      await expect(page.locator(".site")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("the nav moves to the dock, and windows stack without a move handle", async ({ page }) => {
    await open(page, "/en");
    await expect(page.getByRole("banner").locator(".site-nav")).toBeHidden();
    await expect(page.locator("nav.dock")).toBeVisible();
    await expect(page.locator("#install .dwin-handle")).toHaveCount(0);
    const win = (await page.locator("#install").boundingBox())!;
    expect(win.width).toBeGreaterThan(390 - 2 * 32);
  });
});

test.describe("Arabic", () => {
  test("the page is rtl with the Arabic font; the menu bar mirrors, window lights stay left as on macOS", async ({ page }) => {
    await open(page, "/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    const font = await page.locator(".site").evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toMatch(/IBM Plex Sans Arabic/);
    // Brand at the right edge of the menu bar, the Add to Claude pill at the left.
    const brand = (await page.getByRole("banner").locator(".brand").boundingBox())!;
    const pill = (await page.getByRole("banner").locator(".menubar-pill").boundingBox())!;
    expect(brand.x).toBeGreaterThan(pill.x);
    // As macOS draws an Arabic window: the lights stay at the left, close first, and the title is centred.
    const win = (await page.locator("#install").boundingBox())!;
    const close = (await page.locator("#install .dwin-light[data-light='close']").boundingBox())!;
    const zoom = (await page.locator("#install .dwin-light[data-light='zoom']").boundingBox())!;
    expect(close.x).toBeLessThan(win.x + win.width / 2);
    expect(close.x).toBeLessThan(zoom.x);
    const title = (await page.locator("#install .dwin-title").boundingBox())!;
    expect(Math.abs(title.x + title.width / 2 - (win.x + win.width / 2))).toBeLessThan(4);
    // Code stays ltr.
    await expect(page.getByTestId("code-server-url").first().locator("code")).toHaveAttribute("dir", "ltr");
    await axe(page, ".s-hero", "ar hero");
  });
});

test.describe("export kit", () => {
  test("the fan holds five export windows with real, ltr excerpts", async ({ page }) => {
    await open(page, "/ar");
    const fan = page.locator(".kit-fan");
    await expect(fan).toHaveAccessibleName(/.+/);
    const wins = fan.locator(".fan-win");
    await expect(wins).toHaveCount(5);
    for (const pre of await wins.locator("pre").all()) {
      await expect(pre).toHaveAttribute("dir", "ltr");
      await expect(pre).not.toBeEmpty();
    }
  });
});

test.describe("board row", () => {
  for (const locale of ["en", "ar"] as const) {
    test(`${locale}: without motion it scrolls on its own, and Next and Previous move it by keyboard`, async ({ page }) => {
      // With motion, story-motion.ts pins the row to the page scroll instead.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await open(page, `/${locale}`);
      const scroller = page.locator(".row-scroller");
      const next = page.locator(".row-controls .row-btn").last();
      const prev = page.locator(".row-controls .row-btn").first();
      await expect(next).toHaveAccessibleName(/.+/);
      await expect(prev).toHaveAccessibleName(/.+/);
      await next.scrollIntoViewIfNeeded();
      await next.focus();
      await page.keyboard.press("Enter");
      // Forward is to the right in English and to the left (negative scrollLeft) in Arabic.
      const sign = locale === "ar" ? -1 : 1;
      await expect.poll(() => scroller.evaluate((el) => Math.sign(el.scrollLeft))).toBe(sign);
      await prev.focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => scroller.evaluate((el) => Math.abs(el.scrollLeft))).toBeLessThan(1);
    });
  }
});

test.describe("real examples", () => {
  test("the home board shows a direction, art and UI references, each linked to its source", async ({ page }) => {
    await open(page, "/en");
    const board = page.locator("#board-win .ex-board");
    // The window is taller than the screen: bring its title bar in under the fixed menu bar
    // (scroll-padding), not the board's middle, so the lights are not covered when axe runs.
    await page.locator("#board-win").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
    await expect(board.locator(".ex-title")).not.toBeEmpty();
    const links = board.locator(".ex-tile-link");
    expect(await links.count()).toBeGreaterThanOrEqual(9);
    for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) expect(href).toMatch(/^https:\/\//);
    await expect(board.locator(".ex-tile-link").first()).toHaveAttribute("rel", "noopener noreferrer");
    await axe(page, ".s-board", "example board");
  });

  test("the Frankenstein page switches views and keeps a source link on every slot", async ({ page }) => {
    await open(page, "/en");
    const stitch = page.locator("#stitch-win .ex-stitch");
    await stitch.scrollIntoViewIfNeeded();
    const slots = stitch.locator(".ex-slot");
    expect(await slots.count()).toBeGreaterThanOrEqual(4);
    await expect(stitch.locator(".ex-slot figcaption a")).toHaveCount(await slots.count());
    await stitch.getByRole("button", { name: "Wireframe" }).click();
    await expect(stitch).toHaveAttribute("data-mode", "wireframe");
    await expect(stitch.locator(".ex-role").first()).toBeVisible();
    await stitch.getByRole("button", { name: "Even" }).click();
    await expect(stitch.getByRole("button", { name: "Even" })).toHaveAttribute("aria-pressed", "true");
    await axe(page, ".s-stitch", "Frankenstein page");
  });

  test("the gallery filters by platform with plain links", async ({ page }) => {
    await open(page, "/en/gallery");
    const all = await page.locator(".gx-item:visible").count();
    expect(all).toBeGreaterThanOrEqual(4);
    await page.locator(".gx-filter a", { hasText: "Mobile app" }).click();
    await expect(page).toHaveURL(/platform=mobile/);
    await expect(page.locator(".gx-filter a[aria-current='page']")).toHaveText("Mobile app");
    const mobile = await page.locator(".gx-item:visible").count();
    expect(mobile).toBeGreaterThan(0);
    expect(mobile).toBeLessThan(all);
    await axe(page, ".gx", "gallery");
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("every window is visible", async ({ page }) => {
    await page.goto("/en");
    for (const sel of [".mail-row", ".ex-card", ".ex-board", ".price-table", ".fan-win", "#install", "[data-reveal]"]) {
      expect(await page.locator(sel).first().evaluate((el) => getComputedStyle(el).opacity), sel).toBe("1");
    }
  });
});
