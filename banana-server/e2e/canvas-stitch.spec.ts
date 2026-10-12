/**
 * Frankenstein pages (stitch frames) in the canvas: slots cropped with CSS from hotlinked
 * images, source links on every slot, the three views, keyboard reorder, the Parts tab and
 * "Cut part" with the crop editor. docs/stitch-spec.md.
 *
 * The API and the image host are mocked with page.route; images are synthetic gradients.
 */
import { expect, test, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

const CANVAS_ID = "e2e-stitch";

const part = (id: string, n: number, role: string, crop: { x: number; y: number; w: number; h: number }, extra: Record<string, unknown> = {}) => ({
  id,
  role,
  imageUrl: `https://i.pinimg.com/736x/s${n}.jpg`,
  sourceUrl: `https://www.pinterest.com/pin/${n}/`,
  sourceSite: "pinterest.com",
  title: `Shot ${n}`,
  crop,
  imageWidth: 1200,
  imageHeight: 2400,
  ...extra,
});

function boardState() {
  return {
    version: 1,
    viewport: { x: 40, y: 40, zoom: 1 },
    nodes: [
      {
        id: "img1",
        type: "image",
        x: 820,
        y: 0,
        w: 280,
        h: 210,
        data: {
          imageUrl: "https://i.pinimg.com/736x/s9.jpg",
          sourceUrl: "https://www.pinterest.com/pin/9/",
          sourceSite: "pinterest.com",
          title: "Shot 9",
          width: 1200,
          height: 900,
        },
      },
      {
        id: "st1",
        type: "stitch",
        x: 0,
        y: 0,
        w: 720,
        h: 600,
        data: {
          title: "Editorial nav over a game store",
          platform: "website",
          mode: "collage",
          note: "Steal the structure, not the pixels",
          rows: [
            { id: "r1", slots: [{ id: "sa", role: "nav", partId: "pt-nav" }] },
            { id: "r2", slots: [{ id: "sb", role: "hero", partId: "pt-hero", note: "The split hero" }] },
            { id: "r3", slots: [{ id: "sc", role: "footer", partId: "pt-foot" }] },
          ],
        },
      },
    ],
    tray: [],
    parts: [
      part("pt-nav", 1, "nav", { x: 0, y: 0, w: 1, h: 0.05 }),
      part("pt-hero", 2, "hero", { x: 0, y: 0.05, w: 1, h: 0.2 }, { theme: "dark" }),
      part("pt-foot", 3, "footer", { x: 0, y: 0.9, w: 1, h: 0.1 }),
      part("pt-hero2", 4, "hero", { x: 0, y: 0.1, w: 1, h: 0.3 }),
    ],
  };
}

async function open(page: Page): Promise<{ puts: Array<{ nodes: Array<{ id: string; data: { rows?: Array<{ slots: Array<{ id: string }> }> } }>; parts?: unknown[] }> }> {
  const api = { puts: [] as never[] };
  await page.route(`**/api/canvas/${CANVAS_ID}`, async (route) => {
    if (route.request().method() === "PUT") {
      api.puts.push((route.request().postDataJSON() as { state: never }).state);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state: boardState(), updatedAt: "2026-10-12T10:00:00.000Z" }) });
  });
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(60, 120, [240, 220, 180], [40, 50, 90]) }),
  );
  await page.goto(`/c/${CANVAS_ID}`);
  await expect(page.locator('.react-flow__node[data-id="st1"]')).toBeVisible();
  return api;
}

const slots = (page: Page) => page.locator('.react-flow__node[data-id="st1"] .bn-stitch-slot');
const slotOrder = (page: Page) => slots(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.slotId).join(","));

test.describe("Frankenstein pages", () => {
  test("slots show CSS crops of hotlinked images with a source link each", async ({ page }) => {
    await open(page);
    await expect(slots(page)).toHaveCount(3);
    const frame = page.locator('.react-flow__node[data-id="st1"]');
    await expect(frame).toHaveAttribute("aria-label", /Frankenstein page: Editorial nav/);
    const img = slots(page).nth(0).locator("img");
    await expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
    await expect(img).toHaveAttribute("src", "https://i.pinimg.com/736x/s1.jpg");
    // Hero crop: y 5%, h 20% of a 1:2 image -> box aspect 1 / (0.2 * 2) = 2.5, image moved up 5%.
    const s = await slots(page).nth(1).locator(".bn-crop").evaluate((el) => ({
      aspect: (el as HTMLElement).style.aspectRatio,
      transform: (el.querySelector("img") as HTMLElement).style.transform,
    }));
    expect(Number.parseFloat(s.aspect)).toBeCloseTo(2.5);
    expect(s.transform).toContain("-5%");
    for (let i = 0; i < 3; i++) {
      const link = slots(page).nth(i).locator("a.bn-source");
      await expect(link).toHaveAttribute("href", /pinterest\.com\/pin\//);
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  });

  test("views: wireframe shows role labels and notes, even inverts dark parts", async ({ page }) => {
    const api = await open(page);
    const frame = page.locator('.react-flow__node[data-id="st1"]');
    await frame.getByRole("radio", { name: "Wireframe" }).click();
    await expect(frame.locator(".bn-stitch-wire-label")).toHaveText(["Nav", "Hero", "Footer"]);
    await expect(frame.locator(".bn-stitch-note")).toBeVisible();
    // Arrow keys move through the view switch.
    await frame.getByRole("radio", { name: "Wireframe" }).press("ArrowRight");
    await expect(frame.getByRole("radio", { name: "Even" })).toHaveAttribute("aria-checked", "true");
    const filter = await slots(page).nth(1).locator(".bn-crop").evaluate((el) => (el as HTMLElement).style.filter);
    expect(filter).toContain("invert(1)");
    const light = await slots(page).nth(0).locator(".bn-crop").evaluate((el) => (el as HTMLElement).style.filter);
    expect(light).not.toContain("invert");
    await expect.poll(() => JSON.stringify(api.puts.at(-1) ?? {}), { timeout: 5_000 }).toContain('"mode":"even"');
  });

  test("keyboard: arrows move between parts, Alt and arrows reorder, and it is saved", async ({ page }) => {
    const api = await open(page);
    await slots(page).nth(0).focus();
    await page.keyboard.press("ArrowDown");
    await expect(slots(page).nth(1)).toBeFocused();
    await page.keyboard.press("Alt+ArrowUp");
    await expect.poll(() => slotOrder(page)).toBe("sb,sa,sc");
    await expect(page.locator('.react-flow__node[data-id="st1"] .bn-stitch-slot[data-slot-id="sb"]')).toBeFocused();
    await expect(page.locator(".bn-visually-hidden[aria-live]")).toContainText("Moved up");
    await expect
      .poll(() => api.puts.at(-1)?.nodes.find((n) => n.id === "st1")?.data.rows?.map((r) => r.slots[0]?.id).join(","), { timeout: 5_000 })
      .toBe("sb,sa,sc");
  });

  test("Swap with part from the slot menu brings in another part of the same role", async ({ page }) => {
    await open(page);
    await slots(page).nth(1).focus();
    await page.keyboard.press("m");
    await page.getByRole("menuitem", { name: "Swap with part..." }).click();
    await page.getByRole("menuitem", { name: /Hero from pinterest\.com: Shot 4/ }).click();
    await expect(slots(page).nth(1).locator("img")).toHaveAttribute("src", "https://i.pinimg.com/736x/s4.jpg");
  });

  test("Parts tab: pick parts and Frankenstein them into a new page", async ({ page }) => {
    await open(page);
    await page.getByRole("tab", { name: /Parts/ }).click();
    await expect(page.locator(".bn-parts-role")).toHaveText([/Nav/, /Hero/, /Footer/]);
    await page.locator('[data-testid="part-pt-foot"] .bn-parts-pick').focus();
    await page.keyboard.press("Space");
    await page.locator('[data-testid="part-pt-nav"] .bn-parts-pick').focus();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "Frankenstein it (2)" }).click();
    await expect(page.locator(".react-flow__node-stitch")).toHaveCount(2);
    const fresh = page.locator('.react-flow__node-stitch:not([data-id="st1"]) .bn-stitch-slot img');
    await expect(fresh).toHaveCount(2);
    await expect(fresh.nth(0)).toHaveAttribute("src", /s3\.jpg/);
  });

  test("Cut part on an image opens the crop editor and adds a part", async ({ page }) => {
    const api = await open(page);
    await page.locator('.react-flow__node[data-id="img1"]').focus();
    await page.keyboard.press("m");
    await page.getByRole("menuitem", { name: "Cut part" }).click();
    const dialog = page.getByRole("dialog", { name: "Cut part" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Top band" }).click();
    await expect(dialog.getByLabel("Height")).toHaveValue("10");
    await dialog.getByLabel("Role").selectOption("nav");
    await dialog.getByLabel("Theme").selectOption("dark");
    await dialog.getByRole("button", { name: "Add part" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => api.puts.at(-1)?.parts?.length ?? 0, { timeout: 5_000 }).toBe(5);
    // Escape closes without saving.
    await page.locator('.react-flow__node[data-id="img1"]').focus();
    await page.keyboard.press("m");
    await page.getByRole("menuitem", { name: "Cut part" }).click();
    await expect(page.getByRole("dialog", { name: "Cut part" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Cut part" })).toBeHidden();
  });
});
