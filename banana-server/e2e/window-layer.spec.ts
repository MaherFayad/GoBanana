/**
 * Windows over the site (components/window/WindowLayer, DECISIONS 2026-10-12): the canvas and
 * account settings open as a window over the page that opened them (Next intercepting routes),
 * close and Back return to that page, and a direct load still shows the window on the desk.
 * Also the narrow menu bar's Menu (a WAI-ARIA menu button).
 */
import { expect, test } from "@playwright/test";
import { mockSeedCanvas, SEED_CANVAS_ID } from "./support/seed-canvas";

test.describe("canvas window over the dashboard", () => {
  test("opens over the dashboard, closes back to it, and Back closes it too", async ({ page }) => {
    await mockSeedCanvas(page);
    await page.goto("/en/canvases");
    const card = page.locator(".lab-card").first().getByRole("button", { name: "Cold checkout" });
    await card.click();
    await card.click();
    const win = page.getByRole("dialog", { name: /GoBanana|Banana/ });
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

    // Red: back to the dashboard, focus on the card.
    await page.getByRole("link", { name: "Close canvas, back to your canvases" }).click();
    await expect(page).toHaveURL(/\/en\/canvases$/);
    await expect(page.locator(".wl")).toHaveCount(0);
    await expect(card).toBeFocused();

    // Back closes it as well.
    await card.click();
    await card.click();
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/canvases$/);
    await expect(page.locator(".wl")).toHaveCount(0);
  });

  test("a direct load shows the window on the desk, not a dialog", async ({ page }) => {
    await mockSeedCanvas(page);
    await page.goto(`/c/${SEED_CANVAS_ID}`);
    await expect(page.locator(".wl[data-mode='page'] .react-flow__node").first()).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Close canvas, back to your canvases" })).toHaveAttribute("href", "/en/canvases");
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

  test("a direct load is the settings page", async ({ page }) => {
    await page.goto("/en/account");
    await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
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
});
