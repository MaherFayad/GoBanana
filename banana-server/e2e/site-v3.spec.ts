/**
 * Signed-in pages and the 404 on the GoBanana desktop (docs/site-redesign-spec.md): the canvases
 * dashboard as a Finder window (a window over the home page on a direct load, see
 * window-layer.spec.ts) (search, Icons / List, collapse, Shared links, the Inspector, and
 * on phones a segmented control, rows and a bottom-sheet dialog), the account page as a System
 * Settings window with usage meters, and the "moved to the Trash" 404. Runs against `next dev`
 * with the E2E sign-in bypass (demo cards and sample usage, no database).
 *
 * Thumbnails are synthetic gradients served by page.route, never anyone's image.
 */
import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

// iPhone 13 metrics in Chromium (the device preset would switch the browser to WebKit).
const { defaultBrowserType: _webkit, ...IPHONE } = devices["iPhone 13"];

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axe(page: Page, include: string, label: string) {
  const results = await new AxeBuilder({ page }).include(include).withTags(TAGS).analyze();
  expect(results.violations, `${label}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), null, 2)}`).toEqual([]);
}

async function mockThumbs(page: Page) {
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(240, 180, [200, 210, 240], [70, 100, 170]) }),
  );
}

async function openDashboard(page: Page, url = "/en/canvases") {
  await mockThumbs(page);
  await page.goto(url);
  await expect(page.locator(".wl .dash-win")).toBeVisible();
}

test.describe("canvases dashboard (Finder window)", () => {
  test("lists canvases with a sidebar, toolbar and Inspector; axe clean", async ({ page }) => {
    await openDashboard(page);
    await expect(page.locator(".site-header.menubar")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Canvases" })).toBeVisible();
    // Working traffic lights: the dashboard is a window that closes.
    const lights = page.locator(".dash-side .dwin-lights");
    await expect(lights.getByRole("button", { name: "Close GoBanana canvases" })).toBeVisible();
    await expect(lights.getByRole("button", { name: "Minimise GoBanana canvases" })).toBeVisible();
    const cards = page.locator(".lab-card");
    await expect(cards).toHaveCount(4);
    // A card is one quiet button (its title) plus one meta line; no per-card details button.
    await expect(cards.first().getByRole("button", { name: "Cold checkout" })).toHaveAttribute("aria-pressed", "true");
    await expect(cards.first().locator(".lab-card-meta")).toContainText("14 references · ");
    await expect(page.getByRole("button", { name: "Show details" })).toHaveCount(0);
    await expect(cards.first().locator(".collage img")).toHaveCount(4);
    // A canvas with no references gets the designed tile with the Bend mark, not blank cells.
    await expect(cards.nth(3).locator(".collage.is-blank .brand-mark")).toHaveCount(1);

    const inspector = page.getByRole("complementary", { name: "Details" });
    await expect(inspector).toContainText("Cold checkout");
    await expect(inspector.getByRole("link", { name: "Open canvas" })).toHaveAttribute("href", "/c/e2e-seed");
    // Keyboard: focus on a card fills the Inspector.
    await cards.nth(2).getByRole("button", { name: "Transit dashboard" }).focus();
    await expect(inspector).toContainText("Transit dashboard");
    await expect(cards.nth(2)).toHaveAttribute("data-selected", "");
    await expect(cards.nth(2).getByRole("button", { name: "Transit dashboard" })).toHaveAttribute("aria-pressed", "true");
    await expect(inspector.getByRole("link", { name: /pinterest\.com\/pin\// }).first()).toBeVisible();
    await expect(inspector.getByRole("link", { name: "Open canvas" })).toHaveAttribute("href", "/c/e2e-swiss");
    // Enter (or one click) opens it.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/c\/e2e-swiss$/);
    await page.goBack();
    await expect(page.locator(".dash-win")).toBeVisible();

    const sidebar = page.getByRole("complementary", { name: "Workspace navigation" });
    await expect(sidebar.getByRole("link", { name: "Setup guide" })).toHaveAttribute("href", "/docs/setup/overview/");
    await expect(sidebar.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/en/account");
    await expect(sidebar.getByRole("button", { name: "Sign out" })).toBeVisible();
    await axe(page, ".wl", "dashboard");
  });

  test("search filters titles and briefs, announces the count, and clears", async ({ page }) => {
    await openDashboard(page);
    const search = page.getByRole("searchbox", { name: "Search canvases" });
    await search.fill("swiss");
    await expect(page.locator(".lab-card")).toHaveCount(1);
    await expect(page.locator(".lab-card")).toContainText("Transit dashboard");
    await expect(page.getByRole("status").filter({ hasText: "Canvases shown: 1" })).toHaveCount(1);
    await search.fill("loyalty");
    await expect(page.locator(".lab-card")).toContainText("Souq loyalty card");
    await search.fill("nothing like this");
    await expect(page.getByRole("heading", { name: /No canvases match/ })).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(page.locator(".lab-card")).toHaveCount(4);
  });

  test("Icons / List is a pressed-button pair, remembered after a reload with the collapse", async ({ page }) => {
    await openDashboard(page);
    const view = page.getByRole("group", { name: "View as" });
    await expect(view.getByRole("button", { name: "Icons" })).toHaveAttribute("aria-pressed", "true");
    await view.getByRole("button", { name: "List" }).click();
    await expect(page.locator(".lab")).toHaveAttribute("data-view", "list");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.locator(".lab")).toHaveAttribute("data-collapsed", "");
    await page.reload();
    await expect(page.locator(".lab")).toHaveAttribute("data-view", "list");
    await expect(page.locator(".lab")).toHaveAttribute("data-collapsed", "");
    await expect(page.getByRole("group", { name: "View as" }).getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.locator(".lab")).not.toHaveAttribute("data-collapsed", "");
    await axe(page, ".wl", "dashboard list view");
  });

  test("Shared links filters the list", async ({ page }) => {
    await openDashboard(page);
    await page.getByRole("complementary", { name: "Workspace navigation" }).getByRole("link", { name: /Shared links/ }).click();
    await expect(page).toHaveURL(/view=shared/);
    await expect(page.getByRole("heading", { level: 1, name: "Shared links" })).toBeVisible();
    await expect(page.locator(".lab-card")).toHaveCount(1);
    // In place: one window, not a second one stacked by the intercepted route.
    await expect(page.locator(".wl")).toHaveCount(1);
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Canvases" })).toBeVisible();
    await expect(page.locator(".lab-card")).toHaveCount(4);
  });

  test("New canvas explains where canvases start and links to the setup guide", async ({ page }) => {
    await openDashboard(page);
    const button = page.getByRole("button", { name: "New canvas" });
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".lab-new")).toBeVisible();
    await expect(page.locator(".lab-new a")).toHaveAttribute("href", "/docs/setup/overview/");
  });

  test("Arabic dashboard is rtl, mirrors the sidebar to the right, and is axe clean", async ({ page }) => {
    await openDashboard(page, "/ar/canvases");
    await expect(page.locator(".site")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: "اللوحات" })).toBeVisible();
    const side = (await page.locator(".dash-side").boundingBox())!;
    const main = (await page.locator(".dash-main").boundingBox())!;
    expect(side.x).toBeGreaterThan(main.x);
    await expect(page.getByRole("searchbox", { name: "البحث في اللوحات" })).toBeVisible();
    await expect(page.locator(".wl").getByRole("link", { name: "دليل الإعداد" })).toHaveAttribute("href", "/docs/ar/setup/overview/");
    await axe(page, ".wl", "dashboard ar");
  });

  test.describe("on a phone", () => {
    test.use({ ...IPHONE });

    test("a segmented control, rows with a small collage, and details in a bottom sheet dialog", async ({ page }) => {
      await openDashboard(page);
      await expect(page.locator(".dash-inspector")).toBeHidden();
      await expect(page.getByRole("group", { name: "View as" })).toBeHidden();
      const seg = page.getByRole("navigation", { name: "Show" });
      await expect(seg).toBeVisible();
      await expect(seg.getByRole("link", { name: /Canvases/ })).toHaveAttribute("aria-current", "page");
      const card = page.locator(".lab-card").nth(2);
      const collage = (await card.locator(".collage").boundingBox())!;
      expect(collage.width).toBeLessThan(80);

      const opener = card.getByRole("button", { name: "Transit dashboard" });
      await opener.click();
      const sheet = page.getByRole("dialog", { name: "Transit dashboard" });
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAttribute("aria-modal", "true");
      // Pinned to the bottom of the screen.
      const box = (await sheet.boundingBox())!;
      expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1);
      await expect(sheet.getByRole("link", { name: "Open canvas" })).toHaveAttribute("href", "/c/e2e-swiss");
      // Focus stays inside: Tab from the last control wraps into the dialog, never the page.
      for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog")))).toBe(true);
      await axe(page, ".dash-sheet", "dashboard sheet");
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(opener).toBeFocused();
    });

    test("no sideways scroll at 320px", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await openDashboard(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  });
});

test.describe("account (System Settings window)", () => {
  test("the list jumps to Plan, Usage and Shared links; usage shows as meters", async ({ page }) => {
    await page.goto("/en/account");
    await expect(page.locator(".wl .settings.dwin")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
    const list = page.getByRole("navigation", { name: "Settings" });
    expect(await list.getByRole("link").evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual([
      "#plan-title",
      "#usage-title",
      "#shared-title",
    ]);
    await expect(list.getByRole("button", { name: "Sign out" })).toBeVisible();
    await list.getByRole("link", { name: "Usage this month" }).click();
    await expect(page).toHaveURL(/#usage-title$/);

    const meter = page.getByRole("meter", { name: "Searches used this month" });
    await expect(meter).toHaveAttribute("aria-valuenow", "37");
    await expect(meter).toHaveAttribute("aria-valuemax", "300");
    await expect(meter).toHaveAttribute("aria-valuetext", "37 of 300");
    await expect(page.getByRole("link", { name: "See shared links" })).toHaveAttribute("href", "/en/canvases?view=shared");
    await axe(page, ".wl", "account");
  });

  test("Arabic account mirrors the list to the right", async ({ page }) => {
    await page.goto("/ar/account");
    const side = (await page.locator(".settings-side").boundingBox())!;
    const pane = (await page.locator(".settings-pane").boundingBox())!;
    expect(side.x).toBeGreaterThan(pane.x);
    await axe(page, ".wl", "account ar");
  });
});

test.describe("404 (Trash window)", () => {
  for (const [locale, title] of [
    ["en", "This file has moved to the Trash."],
    ["ar", "نُقل هذا الملف إلى سلة المهملات."],
  ] as const) {
    test(`unknown pages answer 404 with the Trash window (${locale})`, async ({ page }) => {
      const res = await page.goto(`/${locale}/no-such-page`);
      expect(res?.status()).toBe(404);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.locator(".nf-window.dwin")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      const actions = page.locator(".nf-actions a");
      await expect(actions).toHaveCount(2);
      expect(await actions.evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual([`/${locale}`, locale === "ar" ? "/docs/ar/" : "/docs/"]);
      await expect(page.locator("nav.dock")).toBeVisible();
      await axe(page, ".site", `404 ${locale}`);
    });
  }
});

test.describe("legal pages", () => {
  test("headings use the desk style while the reading column stays", async ({ page }) => {
    await page.goto("/en/terms");
    const h1 = page.getByRole("heading", { level: 1 });
    const look = await h1.evaluate((el) => ({ weight: getComputedStyle(el).fontWeight, font: getComputedStyle(el).fontFamily }));
    expect(look.weight).toBe("500");
    expect(look.font).toMatch(/Instrument Sans/);
    const width = await page.locator(".legal").evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThan(900);
  });
});
