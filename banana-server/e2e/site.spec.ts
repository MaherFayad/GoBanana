/**
 * Public site in the Studio design language (plan WP-B): axe in light and dark on English and
 * Arabic pages, the takedown form's error states, copy buttons with a "Copied" toast, RTL details
 * (Arabic font, code stays ltr), 320px reflow (SC 1.4.10), target sizes (SC 2.5.8) and no title=
 * tooltips. Runs against `next dev` (playwright.config.ts).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEMES = ["light", "dark"] as const;
const AXE_PAGES = ["/en", "/ar", "/en/pricing", "/ar/pricing", "/en/takedown", "/ar/takedown", "/en/privacy"];
const ALL_PAGES = [...AXE_PAGES, "/ar/privacy", "/en/terms", "/ar/terms", "/en/account", "/ar/account"];

async function axe(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).include(".site").withTags(TAGS).analyze();
  expect(
    results.violations,
    `${label}: ${JSON.stringify(
      results.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target) })),
      null,
      2,
    )}`,
  ).toEqual([]);
}

async function visit(page: Page, url: string) {
  const res = await page.goto(url);
  expect(res?.status(), url).toBe(200);
  await expect(page.locator(".site")).toBeVisible();
}

for (const theme of THEMES) {
  for (const url of AXE_PAGES) {
    test(`axe is clean on ${url} in ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await visit(page, url);
      await axe(page, `${url} ${theme}`);
    });
  }

  for (const locale of ["en", "ar"] as const) {
    test(`takedown errors are tied to fields and axe clean in ${locale} ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await visit(page, `/${locale}/takedown`);
      await page.locator('form.form button[type="submit"]').click();
      const summary = page.locator(".error-summary");
      await expect(summary).toBeFocused();
      await expect(summary.locator("li")).toHaveCount(7);

      const name = page.locator("#name");
      await expect(name).toHaveAttribute("aria-invalid", "true");
      await expect(name).toHaveAttribute("aria-describedby", /name-error/);
      await expect(page.locator("#name-error")).toHaveAttribute("role", "alert");
      await expect(page.locator("#email")).toHaveAttribute("aria-describedby", "email-hint email-error");
      await axe(page, `/${locale}/takedown errors ${theme}`);
    });
  }
}

test("the delete account dialog is a danger alertdialog with Cancel focused", async ({ page }) => {
  // E2E_AUTH_BYPASS signs in a fixed user (playwright.config.ts), so the account page renders.
  await visit(page, "/en/account");
  const opener = page.getByRole("button", { name: "Delete account" });
  await opener.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await expect(dialog.locator(".st-dialog-eyebrow")).toHaveText("Delete account");
  await axe(page, "/en/account dialog");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("copy buttons copy the code and show a Copied toast", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await visit(page, "/en");
  const block = page.getByTestId("code-claude");
  await block.getByRole("button", { name: "Copy command" }).click();
  const toast = page.locator(".st-toast", { hasText: "Copied" });
  await expect(toast).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/^claude mcp add --transport http /);
  await expect(page.getByRole("status").filter({ hasText: "Copied" })).toHaveCount(1);
});

test("Arabic pages are rtl with the Arabic font, while code and the logo stay ltr", async ({ page }) => {
  await visit(page, "/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  const font = await page.locator(".site").evaluate((el) => getComputedStyle(el).fontFamily);
  expect(font).toMatch(/^"?IBM Plex Sans Arabic/);
  for (const id of ["code-server-url", "code-claude", "code-cursor"]) {
    const block = page.getByTestId(id);
    await expect(block).toHaveAttribute("dir", "ltr");
    expect(await block.locator("pre").evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
  }
  expect(await page.locator(".brand").evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
  // The primary call to action is the yellow Studio primary button.
  const cta = page.locator('.hero .st-btn[data-variant="primary"]');
  await expect(cta).toHaveCount(1);
});

test("the skip link is the first stop and moves focus to main", async ({ page }) => {
  await visit(page, "/en/pricing");
  await page.keyboard.press("Tab");
  const skip = page.locator(".skip-link");
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});

test("the current page is marked in the nav by aria-current and an underline", async ({ page }) => {
  await visit(page, "/ar/pricing");
  const current = page.locator('.site-nav [aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("href", "/ar/pricing");
  const bar = await current.evaluate((el) => getComputedStyle(el, "::after").blockSize);
  expect(bar).toBe("2px");
});

test.describe("reflow at 320px", () => {
  test.use({ viewport: { width: 320, height: 640 } });
  for (const url of ALL_PAGES) {
    test(`${url} has no horizontal scroll`, async ({ page }) => {
      await visit(page, url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

for (const url of ["/en", "/ar", "/en/pricing", "/ar/takedown"]) {
  test(`controls on ${url} are at least 24 by 24 px and no title tooltips`, async ({ page }) => {
    await visit(page, url);
    expect(await page.locator(".site [title]").count()).toBe(0);
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(".site button, .site input:not([type=hidden]), .site textarea, .site .st-btn, .site .nav-link")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.width < 24 || r.height < 24) out.push(`${el.tagName}.${el.className} ${r.width}x${r.height}`);
      }
      return out;
    });
    expect(small).toEqual([]);
  });
}
