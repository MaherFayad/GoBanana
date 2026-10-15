/**
 * DIST-05: the Add to Claude window carries the prefilled custom connector link and its Team and
 * Enterprise variant, and keeps the manual steps under the button. The link format is not in
 * Anthropic's docs, so this test pins it. Runs against `next dev` (playwright.config.ts); the
 * MCP address is whatever the server reports (the placeholder host when APP_URL is unset).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";

async function parts(link: Locator) {
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  const url = new URL(href!);
  return { url, connectorUrl: url.searchParams.get("connectorUrl") ?? "" };
}

test.describe("Add to Claude buttons", () => {
  for (const [locale, name] of [
    ["en", "Add GoBanana to Claude"],
    ["ar", "أضف GoBanana إلى Claude"],
  ] as const) {
    test(`${locale}: the prefilled link has the documented shape`, async ({ page }) => {
      await page.goto(`/${locale}/install`);
      const button = page.getByTestId("add-to-claude");
      await expect(button).toHaveText(name);
      const { url, connectorUrl } = await parts(button);
      expect(url.origin).toBe("https://claude.ai");
      expect(url.pathname).toBe("/customize/connectors");
      expect(url.searchParams.get("modal")).toBe("add-custom-connector");
      expect(url.searchParams.get("connectorName")).toBe("GoBanana");
      expect(connectorUrl).toMatch(/^https:\/\/.+\/api\/mcp$/);
      // The MCP address is URL encoded once, not twice.
      expect(url.search).toContain(`connectorUrl=${encodeURIComponent(connectorUrl)}`);
      await expect(button).toHaveAttribute("rel", /noopener/);

      const admin = await parts(page.getByTestId("add-to-claude-admin"));
      expect(admin.url.origin).toBe("https://claude.ai");
      expect(admin.url.pathname).toBe("/admin-settings/connectors");
      expect(admin.url.searchParams.get("modal")).toBe("add-custom-connector");
      expect(admin.connectorUrl).toBe(connectorUrl);
    });
  }

  test("the window has no axe violations in both languages @a11y", async ({ page }) => {
    for (const locale of ["en", "ar"]) {
      await page.goto(`/${locale}/install`);
      await expect(page.getByTestId("add-to-claude")).toBeVisible();
      const results = await new AxeBuilder({ page }).include("#install").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations.map((v) => v.id), locale).toEqual([]);
    }
  });

  test("the manual steps stay under the button", async ({ page }) => {
    await page.goto("/en/install");
    const panel = page.getByRole("tabpanel").first();
    const button = panel.getByTestId("add-to-claude");
    await expect(panel.getByRole("list").first()).toBeVisible();
    const steps = await panel.getByRole("list").first().boundingBox();
    const at = await button.boundingBox();
    expect(steps!.y).toBeGreaterThan(at!.y);
    await expect(page.getByTestId("install-repo")).toBeVisible();
  });
});
