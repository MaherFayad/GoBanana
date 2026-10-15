/**
 * VAL-04 client review on the share page and VAL-09 swipe file page, by keyboard and with axe,
 * in English and Arabic. Runs against `next dev` with the E2E sign-in bypass (playwright.config.ts):
 * the demo share page has two demo directions and an in-memory review store; the library shows two
 * demo items. Image hosts are answered with synthetic gradients, never anyone's image.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

const SHARE = "/s/e2e-share-demo-token-0000000000";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function mockCdn(page: Page) {
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(160, 120, [200, 210, 230], [90, 70, 140]) }),
  );
}

async function axe(page: Page, include: string, label: string) {
  const results = await new AxeBuilder({ page }).include(include).withTags(TAGS).analyze();
  expect(results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), label).toEqual([]);
}

test.describe("client review on the share page", () => {
  test("opens by keyboard, keeps and drops, comments, and survives a reload (en)", async ({ page }) => {
    await mockCdn(page);
    await page.goto(`${SHARE}?lang=en`);
    const toggle = page.getByRole("button", { name: "Review", exact: true });
    await toggle.focus();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = page.getByRole("complementary", { name: "Your review" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Your review" })).toBeFocused();

    const first = panel.getByRole("group", { name: "Your verdict on Checkout as a frosted vinyl sleeve" });
    await first.getByRole("button", { name: "Keep" }).focus();
    await page.keyboard.press("Enter");
    await expect(panel.getByRole("status")).toHaveText("Saved.");
    await expect(first.getByRole("button", { name: "Kept" })).toHaveAttribute("aria-pressed", "true");

    const comment = panel.getByLabel("Comment on Checkout as a frosted vinyl sleeve");
    await comment.fill("Love the frost on the price row.");
    await panel.getByRole("button", { name: "Save comment" }).first().click();
    await expect(panel.getByRole("status")).toHaveText("Saved.");

    // The second direction can be dropped; pressing again clears it.
    const second = panel.getByRole("group", { name: "Your verdict on Checkout as a 1970s airline ticket" });
    await second.getByRole("button", { name: "Drop" }).click();
    await expect(second.getByRole("button", { name: "Dropped" })).toHaveAttribute("aria-pressed", "true");
    await second.getByRole("button", { name: "Dropped" }).click();
    await expect(panel.getByRole("status")).toHaveText("Cleared.");

    await axe(page, ".rv-panel", "review panel open");

    // Escape closes the panel and gives focus back to the button.
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();

    // The same browser gets its answers back.
    await page.reload();
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await expect(page.getByRole("group", { name: "Your verdict on Checkout as a frosted vinyl sleeve" }).getByRole("button", { name: "Kept" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Comment on Checkout as a frosted vinyl sleeve")).toHaveValue("Love the frost on the price row.");
  });

  test("reads right to left in Arabic and passes axe", async ({ page }) => {
    await mockCdn(page);
    await page.goto(`${SHARE}?lang=ar`);
    const toggle = page.getByRole("button", { name: "مراجعة", exact: true });
    await toggle.click();
    const panel = page.getByRole("complementary", { name: "رأيك" });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("dir", "rtl");
    await expect(panel).toHaveAttribute("lang", "ar");
    await panel.getByRole("button", { name: "إبقاء" }).first().click();
    await expect(panel.getByRole("status")).toHaveText("تم الحفظ.");
    await axe(page, ".rv-panel", "review panel ar");
    // The language link switches back.
    await panel.getByRole("link", { name: "اقرأ هذه اللوحة بالإنجليزية" }).click();
    await expect(page).toHaveURL(/lang=en/);
  });

  test("refuses a comment past the limit by the field, and posts from other sites are refused by the API", async ({ page, request }) => {
    await page.goto(`${SHARE}?lang=en`);
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await expect(page.getByLabel("Comment on Checkout as a frosted vinyl sleeve")).toHaveAttribute("maxlength", "500");
    const res = await request.post("/api/review/e2e-share-demo-token-0000000000", {
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      data: { reviewerKey: "abcdefabcdefabcdefabcdef12345678", directionKey: "bd-demo0001", verdict: "keep" },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("swipe file page", () => {
  test("lists saved items with source links and filter fields (en)", async ({ page }) => {
    await mockCdn(page);
    await page.goto("/en/library");
    await expect(page.getByRole("heading", { level: 1, name: "Swipe file" })).toBeVisible();
    const list = page.getByRole("list").filter({ has: page.getByText("Split nav with a search pill") });
    await expect(list.getByRole("link", { name: /Source: pinterest.com/ })).toHaveAttribute("href", "https://www.pinterest.com/pin/1/");
    await expect(list.getByRole("button", { name: "Remove Split nav with a search pill from the swipe file" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Role" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search words" })).toBeVisible();
    await axe(page, ".settings", "library en");
  });

  test("works right to left in Arabic and passes axe", async ({ page }) => {
    await mockCdn(page);
    await page.goto("/ar/library");
    await expect(page.getByRole("heading", { level: 1, name: "مكتبتي" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "الدور" })).toBeVisible();
    await axe(page, ".settings", "library ar");
  });

  test("is reachable from the account window", async ({ page }) => {
    await page.goto("/en/account");
    await page.getByRole("link", { name: "Open swipe file" }).click();
    await expect(page).toHaveURL(/\/en\/library/);
  });
});
