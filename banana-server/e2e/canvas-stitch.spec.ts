/**
 * Frankenstein pages (stitch frames) in the canvas: slots cropped with CSS from hotlinked
 * images, source links on every slot, the three views, keyboard reorder, the Parts tab and
 * "Cut part" with the crop editor. docs/stitch-spec.md.
 *
 * The API and the image host are mocked with page.route; images are synthetic gradients.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { decodeImage } from "../lib/palette/decode";
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

async function open(
  page: Page,
  state: ReturnType<typeof boardState> = boardState(),
  image: (url: string) => Buffer = () => gradientPng(60, 120, [240, 220, 180], [40, 50, 90]),
): Promise<{ puts: Array<{ nodes: Array<{ id: string; data: { rows?: Array<{ slots: Array<{ id: string }> }> } }>; parts?: unknown[] }> }> {
  const api = { puts: [] as never[] };
  await page.route(`**/api/canvas/${CANVAS_ID}`, async (route) => {
    if (route.request().method() === "PUT") {
      api.puts.push((route.request().postDataJSON() as { state: never }).state);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state, updatedAt: "2026-10-12T10:00:00.000Z" }) });
  });
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: image(route.request().url()) }),
  );
  await page.goto(`/c/${CANVAS_ID}`);
  await expect(page.locator('.react-flow__node[data-id="st1"]')).toBeVisible();
  return api;
}

const slots = (page: Page) => page.locator('.react-flow__node[data-id="st1"] .bn-stitch-slot');
const slotOrder = (page: Page) => slots(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.slotId).join(","));

test.describe("Frankenstein pages", () => {
  test("parts side by side share the row height: the shorter crop covers its box, no empty band", async ({ page }) => {
    const state = boardState();
    const stitch = state.nodes[1] as { data: { rows: unknown[] } };
    // A wide band (nav, aspect 10) next to a tall part (hero2, aspect about 1.7).
    stitch.data.rows = [{ id: "r1", slots: [{ id: "sa", role: "nav", partId: "pt-nav" }, { id: "sb", role: "hero", partId: "pt-hero2" }] }];
    await open(page, state);
    const boxes = await slots(page).evaluateAll((els) =>
      els.map((el) => {
        const crop = el.querySelector(".bn-crop")!.getBoundingClientRect();
        const img = el.querySelector("img")!;
        const fit = img.parentElement!.getBoundingClientRect();
        return { cropH: crop.height, cropW: crop.width, fitH: fit.height, fitW: fit.width };
      }),
    );
    expect(boxes).toHaveLength(2);
    expect(Math.abs(boxes[0]!.cropH - boxes[1]!.cropH)).toBeLessThan(2);
    for (const b of boxes) {
      expect(b.fitH).toBeGreaterThanOrEqual(b.cropH - 1);
      expect(b.fitW).toBeGreaterThanOrEqual(b.cropW - 1);
    }
  });

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

  test("views: wireframe shows role labels and notes, harmonize uses one duotone filter and never inverts", async ({ page }) => {
    const api = await open(page);
    const frame = page.locator('.react-flow__node[data-id="st1"]');
    await frame.getByRole("radio", { name: "Wireframe" }).click();
    await expect(frame.locator(".bn-stitch-wire-label")).toHaveText(["Nav", "Hero", "Footer"]);
    await expect(frame.locator(".bn-stitch-note")).toBeVisible();
    // Arrow keys move through the view switch.
    await frame.getByRole("radio", { name: "Wireframe" }).press("ArrowRight");
    await expect(frame.getByRole("radio", { name: "Harmonize" })).toHaveAttribute("aria-checked", "true");
    await expect(frame.getByRole("radio", { name: "Harmonize" })).toBeFocused();
    const filters = await slots(page).locator(".bn-crop").evaluateAll((els) => els.map((el) => (el as HTMLElement).style.filter));
    expect(new Set(filters).size).toBe(1);
    expect(filters[0]).toMatch(/^url\("?#bn-harmonize-/);
    expect(filters.join(" ")).not.toContain("invert");
    // No direction colors on this page: the neutral ink and surface tokens.
    await expect(frame.locator(".bn-stitch")).toHaveAttribute("data-harmonize", "neutral");
    await expect.poll(() => JSON.stringify(api.puts.at(-1) ?? {}), { timeout: 5_000 }).toContain('"mode":"harmonize"');
  });

  test("a page saved in the legacy even view opens and saves as harmonize", async ({ page }) => {
    const state = boardState();
    (state.nodes[1] as { data: { mode: string } }).data.mode = "even";
    await open(page, state);
    const frame = page.locator('.react-flow__node[data-id="st1"]');
    // Pages open in collage; the saved view is still read as harmonize, never as an unknown mode.
    await expect(frame.getByRole("radio", { name: "Collage" })).toHaveAttribute("aria-checked", "true");
    await expect(frame.getByRole("radio")).toHaveText(["Collage", "Wireframe", "Harmonize"]);
  });

  test("harmonize: a page cut from 3 sources reads as one palette; keyboard switches views; axe passes @a11y", async ({ page }, testInfo) => {
    const ink = [26, 26, 46] as const;
    const surface = [244, 241, 222] as const;
    const state = boardState();
    const stitch = state.nodes[1] as { data: Record<string, unknown> };
    stitch.data.harmonize = { ink: "#1a1a2e", surface: "#f4f1de" };
    // Three sources with clashing colors: warm orange, a dark green, a saturated violet.
    const looks: Record<string, [[number, number, number], [number, number, number]]> = {
      s1: [[250, 140, 30], [120, 40, 0]],
      s2: [[10, 60, 30], [90, 200, 120]],
      s3: [[200, 60, 240], [30, 0, 80]],
    };
    await open(page, state, (url) => {
      const key = /\/(s\d+)\.jpg/.exec(url)?.[1] ?? "s1";
      const [from, to] = looks[key] ?? looks.s1!;
      return gradientPng(60, 120, from, to);
    });
    const frame = page.locator('.react-flow__node[data-id="st1"]');
    const pageEl = frame.locator(".bn-stitch-page");
    await expect(slots(page).locator("img")).toHaveCount(3);
    await expect.poll(() => slots(page).locator("img").evaluateAll((els) => els.every((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0))).toBe(true);

    // Measure only the parts: hide the chips and notes that sit over them.
    await page.addStyleTag({ content: ".bn-stitch-slot-bar, .bn-stitch-note { visibility: hidden !important; }" });
    // Distance of each pixel from the ink to surface line, in RGB units (0 means on the duotone).
    const offPalette = async (name: string) => {
      const png = await pageEl.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: "disabled" });
      if (process.env.STITCH_SHOTS) await pageEl.screenshot({ path: `${process.env.STITCH_SHOTS}/${name}.png`, animations: "disabled" });
      const img = decodeImage(new Uint8Array(png));
      if (!img.ok) throw new Error("screenshot did not decode");
      const d = [surface[0] - ink[0], surface[1] - ink[1], surface[2] - ink[2]];
      const len2 = d[0]! ** 2 + d[1]! ** 2 + d[2]! ** 2;
      const dist: number[] = [];
      for (let i = 0; i < img.rgba.length; i += 4) {
        const p = [img.rgba[i]! - ink[0], img.rgba[i + 1]! - ink[1], img.rgba[i + 2]! - ink[2]];
        const t = Math.max(0, Math.min(1, (p[0]! * d[0]! + p[1]! * d[1]! + p[2]! * d[2]!) / len2));
        dist.push(Math.hypot(p[0]! - t * d[0]!, p[1]! - t * d[1]!, p[2]! - t * d[2]!));
      }
      dist.sort((a, b) => a - b);
      return dist[Math.floor(dist.length * 0.98)]!;
    };
    const collage = await offPalette("harmonize-off-collage");
    expect(collage).toBeGreaterThan(60);

    // Keyboard: Tab-reachable radio group, arrows pick the view.
    await frame.getByRole("radio", { name: "Collage" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(frame.getByRole("radio", { name: "Harmonize" })).toHaveAttribute("aria-checked", "true");
    await expect(frame.getByRole("radio", { name: "Harmonize" })).toBeFocused();
    await expect(frame.locator(".bn-stitch")).toHaveAttribute("data-harmonize", "direction");
    await expect(frame.locator("svg.bn-harmonize-defs feFuncR")).toHaveAttribute("tableValues", /^0\.102 0\.9569$/);
    const harmonized = await offPalette("harmonize-on-direction");
    expect(harmonized).toBeLessThan(12);

    const results = await new AxeBuilder({ page }).include('.react-flow__node[data-id="st1"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    await page.keyboard.press("Home");
    await expect(frame.getByRole("radio", { name: "Collage" })).toHaveAttribute("aria-checked", "true");
    await expect(frame.locator("svg.bn-harmonize-defs")).toHaveCount(0);
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

  test("chips stay readable at any zoom: tiny slots hide them until hover, notes stop growing when zoomed in", async ({ page }) => {
    await open(page);
    const shot = process.env.STITCH_SHOTS;
    const emptySpot = () => page.getByRole("main", { name: "Canvas" }).focus();
    const slot = slots(page).first();
    // Zoom far out: the slots are tiny on screen, so their chips wait for hover or focus.
    await emptySpot();
    for (let i = 0; i < 8; i++) await page.keyboard.press("-");
    await expect(slot).toHaveAttribute("data-chrome", "tiny");
    await expect(slot.locator(".bn-stitch-slot-bar")).toBeHidden();
    if (shot) await page.screenshot({ path: `${shot}/stitch-out.png` });
    await slot.hover();
    await expect(slot.locator(".bn-stitch-slot-bar")).toBeVisible();
    // Zoom far in: chips and notes keep their on-screen size.
    await emptySpot();
    for (let i = 0; i < 14; i++) await page.keyboard.press("+");
    const hero = slots(page).nth(1);
    await hero.scrollIntoViewIfNeeded();
    await expect(hero).toHaveAttribute("data-chrome", "full");
    await hero.hover();
    const note = hero.locator(".bn-stitch-note");
    await expect(note).toBeVisible();
    const px = await note.evaluate((el) => {
      const zoom = Number(getComputedStyle(el).getPropertyValue("--bn-zoom")) || 1;
      return parseFloat(getComputedStyle(el).fontSize) * zoom;
    });
    expect(px).toBeLessThan(16);
    if (shot) await page.screenshot({ path: `${shot}/stitch-in.png` });
  });
});
