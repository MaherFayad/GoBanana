/**
 * Windows over the site (components/window/WindowLayer, DECISIONS 2026-10-12): the canvas, the
 * canvases dashboard and account settings open as a window over the page that opened them (Next
 * intercepting routes), close and Back return to that page. A direct load of the canvas shows it
 * on the desk; a direct load of the dashboard or account settings shows the window over the home
 * page (the landing behind it, inert), opening on first paint.
 * Also the narrow menu bar's Menu (a WAI-ARIA menu button).
 */
import { expect, test, type Page } from "@playwright/test";
import { mockSeedCanvas, SEED_CANVAS_ID } from "./support/seed-canvas";

const DASHBOARD = { name: "GoBanana canvases" };

/** The CSS animation the window runs on first paint (a direct load). */
const openAnimation = (page: Page) => page.locator(".wl .wl-window").evaluate((el) => getComputedStyle(el).animationName);

/** Whether the landing sits under an inert ancestor (the window is up). */
const landingInert = (page: Page) => page.locator(".story").evaluate((el) => Boolean(el.closest("[inert]")));

test.describe("canvas window over the dashboard", () => {
  test("opens over the dashboard, closes back to it, and Back closes it too", async ({ page }) => {
    await mockSeedCanvas(page);
    await page.goto("/en/canvases");
    const card = page.locator(".lab-card").first().getByRole("button", { name: "Cold checkout" });
    // One click opens it.
    await card.click();
    const win = page.getByRole("dialog", { name: /\| GoBanana$/ });
    await expect(win).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/c/${SEED_CANVAS_ID}$`));
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    // The dashboard stays behind, inert.
    await expect(page.locator(".dash-win")).toHaveCount(1);
    await expect(page.locator(".site")).toHaveAttribute("inert", "");

    // Green: the window fills the screen.
    const zoom = page.getByRole("button", { name: "Full screen" });
    await zoom.click();
    await expect(zoom).toHaveAttribute("aria-pressed", "true");
    await zoom.click();

    // Red: back to the dashboard window, focus on the card.
    await page.getByRole("link", { name: "Close canvas, back to your canvases" }).click();
    await expect(page).toHaveURL(/\/en\/canvases$/);
    await expect(page.locator(".wl[data-kind='canvas']")).toHaveCount(0);
    await expect(page.getByRole("dialog", DASHBOARD)).toBeVisible();
    await expect(card).toBeFocused();

    // Back closes it as well.
    // One click opens it.
    await card.click();
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/canvases$/);
    await expect(page.locator(".wl[data-kind='canvas']")).toHaveCount(0);
    await expect(page.getByRole("dialog", DASHBOARD)).toBeVisible();
  });

  test("a direct load shows the window on the desk, not a dialog", async ({ page }) => {
    await mockSeedCanvas(page);
    await page.goto(`/c/${SEED_CANVAS_ID}`);
    await expect(page.locator(".wl[data-mode='page'] .react-flow__node").first()).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Close canvas, back to your canvases" })).toHaveAttribute("href", "/en/canvases");
  });
});

test.describe("canvases dashboard as a window", () => {
  test("opens over the home page from the menu bar; Escape returns to it", async ({ page }) => {
    await page.goto("/en");
    const link = page.locator(".menubar-link", { hasText: "Your canvases" });
    await link.click();
    await expect(page.getByRole("dialog", DASHBOARD)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/canvases$/);
    await expect(page.locator(".wl")).toHaveAttribute("data-mode", "overlay");
    await expect(page).toHaveTitle("GoBanana canvases");
    // The landing stays behind it, inert, and is not drawn twice.
    await expect(page.locator(".story")).toHaveCount(1);
    expect(await landingInert(page)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator(".wl")).toHaveCount(0);
    expect(await landingInert(page)).toBe(false);
    await expect(link).toBeFocused();
  });

  test("the dock icon opens it over another page; yellow minimizes it into the dock", async ({ page }) => {
    await page.goto("/en/pricing");
    await page.locator(".dock a[href='/en/canvases']").click();
    await expect(page.getByRole("dialog", DASHBOARD)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/canvases$/);
    await expect(page.locator(".story")).toHaveCount(0);
    await page.locator(".wl").getByRole("button", { name: "Minimise GoBanana canvases" }).click();
    await expect(page).toHaveURL(/\/en\/pricing$/);
    await expect(page.locator(".wl")).toHaveCount(0);
  });

  test("a direct load shows it over the home page with the reveal; close goes home", async ({ page }) => {
    await page.goto("/en/canvases");
    const win = page.getByRole("dialog", DASHBOARD);
    await expect(win).toBeVisible();
    await expect(page.locator(".wl")).toHaveAttribute("data-mode", "home");
    await expect(page).toHaveTitle("Canvases | GoBanana");
    expect(await openAnimation(page)).toBe("wl-open");
    await expect(page.locator(".story")).toHaveCount(1);
    expect(await landingInert(page)).toBe(true);
    await win.locator(".dash-side").getByRole("button", { name: "Close GoBanana canvases" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator(".wl")).toHaveCount(0);
    await expect(page.locator(".story")).toHaveCount(1);
    expect(await landingInert(page)).toBe(false);
  });

  test("a canvas opened from it closes back to the dashboard window", async ({ page }) => {
    await mockSeedCanvas(page);
    await page.goto("/en");
    await page.locator(".menubar-link", { hasText: "Your canvases" }).click();
    const card = page.locator(".wl .lab-card").first().getByRole("button", { name: "Cold checkout" });
    // One click opens it.
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/c/${SEED_CANVAS_ID}$`));
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    await page.getByRole("link", { name: "Close canvas, back to your canvases" }).click();
    await expect(page).toHaveURL(/\/en\/canvases$/);
    await expect(page.getByRole("dialog", DASHBOARD)).toBeVisible();
    await expect(page.locator(".story")).toHaveCount(1);
  });

  test.describe("under reduced motion", () => {
    test("a direct load fades in instead of growing", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/en/canvases");
      await expect(page.getByRole("dialog", DASHBOARD)).toBeVisible();
      expect(await openAnimation(page)).toBe("wl-fade");
    });
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test("fills the screen under the menu bar and still opens with the reveal", async ({ page }) => {
      await page.goto("/en/canvases");
      await expect(page.getByRole("dialog", DASHBOARD)).toBeVisible();
      expect(await openAnimation(page)).toBe("wl-open");
      const bar = (await page.locator(".site-header.menubar").boundingBox())!;
      const box = (await page.locator(".wl .wl-window").boundingBox())!;
      expect(Math.round(box.y)).toBe(Math.round(bar.y + bar.height));
      expect(box.x).toBe(0);
      expect(Math.round(box.width)).toBe(390);
      expect(Math.round(box.y + box.height)).toBe(844);
      // The phone title bar holds the working lights.
      await page.locator(".dash-phone-bar").getByRole("button", { name: "Close GoBanana canvases" }).click();
      await expect(page).toHaveURL(/\/en$/);
    });
  });
});

test.describe("account settings over a page", () => {
  test("opens over the page it came from; Escape returns to it", async ({ page }) => {
    await page.goto("/en/pricing");
    await page.locator(".site-footer").getByRole("link", { name: "Account" }).click();
    const win = page.getByRole("dialog", { name: "Account settings" });
    await expect(win).toBeVisible();
    await expect(page).toHaveURL(/\/en\/account$/);
    await expect(win.getByRole("button", { name: "Close Account settings" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/en\/pricing$/);
    await expect(page.locator(".wl")).toHaveCount(0);
  });

  test("a direct load sits over the home page; Escape goes home", async ({ page }) => {
    await page.goto("/en/account");
    const win = page.getByRole("dialog", { name: "Account settings" });
    await expect(win).toBeVisible();
    await expect(win.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
    await expect(page.locator(".wl")).toHaveAttribute("data-mode", "home");
    await expect(page).toHaveTitle(/^Account/);
    expect(await openAnimation(page)).toBe("wl-open");
    expect(await landingInert(page)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator(".wl")).toHaveCount(0);
    await expect(page.locator(".story")).toHaveCount(1);
  });
});

test.describe("narrow menu bar", () => {
  test.use({ viewport: { width: 390, height: 800 } });
  test("folds into a Menu that works with the keyboard", async ({ page }) => {
    await page.goto("/en/pricing");
    await expect(page.locator(".menubar-clock")).toBeHidden();
    const trigger = page.getByRole("button", { name: "Menu" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu", { name: "Menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitem").last()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });

  test("Your canvases in the Menu opens the dashboard window", async ({ page }) => {
    await page.goto("/en/pricing");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Your canvases" }).click();
    await expect(page.getByRole("dialog", DASHBOARD)).toBeVisible();
    await expect(page.locator(".wl")).toHaveAttribute("data-mode", "overlay");
  });
});

test.describe("example board window", () => {
  test("a click anywhere on a home card opens its board over the page; Escape closes back home", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en");
    const card = page.locator(".ex-card").first();
    const key = await card.getAttribute("data-board");
    await card.scrollIntoViewIfNeeded();
    // The card's thumbnails are pictures, not links: the stretched "Open the board" takes the click.
    await expect(card.locator(".ex-tile a")).toHaveCount(0);
    // Click the title, not the link: the link's stretched overlay sits over the whole card.
    const at = (await card.locator(".ex-card-title").boundingBox())!;
    await page.mouse.click(at.x + 10, at.y + at.height / 2);
    await expect(page).toHaveURL(new RegExp(`/en/board/${key}$`));
    const win = page.locator(".wl");
    await expect(win).toHaveAttribute("data-mode", "overlay");
    await expect(win.locator(".ex-board")).toBeVisible();
    // Inside the window every tile links to its source.
    expect(await win.locator(".ex-tile a[target=_blank]").count()).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator(".wl")).toHaveCount(0);
  });

  test("a direct load shows the board over the home page; an unknown key is a 404", async ({ page }) => {
    await page.goto("/en/board/coffee");
    await expect(page.locator(".wl")).toHaveAttribute("data-mode", "home");
    expect(await landingInert(page)).toBe(true);
    const res = await page.goto("/en/board/nope");
    expect(res?.status()).toBe(404);
  });
});
