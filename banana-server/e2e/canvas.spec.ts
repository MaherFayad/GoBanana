/**
 * Canvas flows (spec section 13): drag from tray, Enter from tray, keyboard move,
 * resize, arrange, save and reload, link card fallback, axe.
 *
 * The API and image hosts are mocked with page.route, so no DB and no third-party
 * network is needed. The "image" served for allowed hosts is a synthetic 1x1 PNG
 * made here, not a copy of anyone's image.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const CANVAS_ID = "e2e-canvas";
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const pin = (n: number, title: string) => ({
  id: `r${n}`,
  thumbUrl: `https://i.pinimg.com/236x/r${n}.jpg`,
  imageUrl: `https://i.pinimg.com/736x/r${n}.jpg`,
  sourceUrl: `https://www.pinterest.com/pin/${n}/`,
  sourceSite: "pinterest.com",
  title,
  width: 736,
  height: 920,
});

const INITIAL_STATE = {
  version: 1,
  viewport: { x: 40, y: 40, zoom: 1 },
  nodes: [
    { id: "sec1", type: "section", x: 560, y: 0, w: 616, h: 420, data: { title: "Glass" } },
    // Already as tall as its text: a note that does not fit refits on load and auto-saves.
    { id: "note1", type: "note", x: 0, y: 0, w: 220, h: 64, data: { text: "Make it feel cold", color: "yellow" } },
    {
      id: "img-broken",
      type: "image",
      x: 0,
      y: 180,
      w: 280,
      h: 210,
      data: {
        imageUrl: "https://cdn.dribbble.com/userupload/broken.png",
        thumbUrl: "https://cdn.dribbble.com/userupload/broken_t.png",
        sourceUrl: "https://dribbble.com/shots/42-broken",
        sourceSite: "dribbble.com",
        title: "Broken shot",
      },
    },
    { id: "sw1", type: "swatch", x: 300, y: 0, w: 180, h: 200, data: { hex: "#1a56db", role: "primary", tag: "ship" } },
  ],
  tray: [pin(1, "Frosted vinyl sleeve"), pin(2, "Glass checkout"), pin(3, "Ice typography")],
};

type Api = { puts: unknown[]; bases: (string | undefined)[]; version: number; conflict: boolean };

const stamp = (v: number) => new Date(Date.UTC(2026, 9, 11, 10, 0, v)).toISOString();

async function mockCanvas(page: Page): Promise<Api> {
  const api: Api = { puts: [], bases: [], version: 0, conflict: false };
  await page.route(`**/api/canvas/${CANVAS_ID}`, async (route) => {
    const req = route.request();
    if (req.method() === "PUT") {
      const body = req.postDataJSON() as { state: unknown; baseUpdatedAt?: string };
      api.bases.push(body.baseUpdatedAt);
      if (api.conflict) {
        await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "changed" }) });
        return;
      }
      api.puts.push(body.state);
      api.version += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, updatedAt: stamp(api.version) }) });
      return;
    }
    const state = api.puts.at(-1) ?? INITIAL_STATE;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ state, updatedAt: stamp(api.version) }),
    });
  });
  // Allowed host: serve a synthetic pixel. Failing host: abort, so the tile shows a link card.
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX }));
  await page.route(/^https:\/\/cdn\.dribbble\.com\//, (route) => route.abort("blockedbyclient"));
  return api;
}

async function openCanvas(page: Page): Promise<Api> {
  const api = await mockCanvas(page);
  await page.goto(`/c/${CANVAS_ID}`);
  await expect(page.locator(".react-flow__node")).toHaveCount(INITIAL_STATE.nodes.length);
  return api;
}

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

/** The board's viewport transform: pan in screen px and zoom. */
async function viewport(page: Page): Promise<{ x: number; y: number; zoom: number }> {
  const t = await page.locator(".react-flow__viewport").evaluate((el) => (el as HTMLElement).style.transform);
  const m = /translate\((-?[\d.e+-]+)px,\s*(-?[\d.e+-]+)px\)\s*scale\((-?[\d.e+-]+)\)/.exec(t);
  if (!m) throw new Error(`no viewport transform: ${t}`);
  return { x: Number(m[1]), y: Number(m[2]), zoom: Number(m[3]) };
}

/** A point on the empty board (below the notch, right of the initial items). */
async function emptyBoardPoint(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator(".bn-flow").boundingBox();
  if (!box) throw new Error("no board");
  return { x: box.x + box.width - 120, y: box.y + box.height - 120 };
}

const selectedIds = (page: Page) =>
  page.locator(".react-flow__node.selected").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.id).sort());

/** Node position in canvas units, read from React Flow's transform. */
async function position(locator: Locator): Promise<{ x: number; y: number }> {
  const t = await locator.evaluate((el) => (el as HTMLElement).style.transform);
  const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(t);
  if (!m) throw new Error(`no transform: ${t}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

async function size(locator: Locator): Promise<{ w: number; h: number }> {
  return locator.evaluate((el) => {
    const s = (el as HTMLElement).style;
    return { w: parseFloat(s.width), h: parseFloat(s.height) };
  });
}

test.describe("moodboard canvas", () => {
  test("page is not indexed", async ({ page }) => {
    await openCanvas(page);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("drag a search result from the tray onto the canvas", async ({ page }) => {
    await openCanvas(page);
    const tile = page.getByRole("button", { name: /Add to canvas: Frosted vinyl sleeve/ });
    await tile.dragTo(page.locator(".react-flow__pane"), { targetPosition: { x: 200, y: 560 } });

    const added = page.getByRole("group", { name: /Image: Frosted vinyl sleeve, from pinterest\.com/ });
    await expect(added).toBeVisible();
    await expect(tile).toHaveCount(0);

    // Source chip is always visible and links to the source page (hard rule 3).
    const chip = added.getByRole("link", { name: /pinterest\.com/ });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("href", "https://www.pinterest.com/pin/1/");

    // Plain <img> from the source host, no referrer, lazy.
    const img = added.locator("img");
    await expect(img).toHaveAttribute("src", /^https:\/\/i\.pinimg\.com\//);
    await expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
    await expect(img).toHaveAttribute("loading", "lazy");
    await expect(img).toHaveAttribute("alt", "Frosted vinyl sleeve");
  });

  test("Enter on a focused tray tile adds it (keyboard alternative to drag)", async ({ page }) => {
    await openCanvas(page);
    const tile = page.getByRole("button", { name: /Add to canvas: Glass checkout/ });
    await tile.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("group", { name: /Image: Glass checkout/ })).toBeVisible();
    await expect(tile).toHaveCount(0);
    // Focus stays in the tray on the next result.
    await expect(page.getByRole("button", { name: /Add to canvas: Ice typography/ })).toBeFocused();
  });

  test("arrow keys move the focused node 8 px, Shift + arrow 32 px", async ({ page }) => {
    await openCanvas(page);
    const note = node(page, "note1");
    await note.focus();
    const start = await position(note);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => position(note)).toEqual({ x: start.x + 16, y: start.y });
    await page.keyboard.press("Shift+ArrowDown");
    await expect.poll(() => position(note)).toEqual({ x: start.x + 16, y: start.y + 32 });
    await page.keyboard.press("ArrowUp");
    await expect.poll(() => position(note)).toEqual({ x: start.x + 16, y: start.y + 24 });
    await expect(note).toBeFocused();
  });

  test("Tab moves between nodes and the focus ring is visible", async ({ page }) => {
    await openCanvas(page);
    await node(page, "note1").focus();
    let reached: string | null = null;
    // The note's menu button and its five color swatches come first.
    for (let i = 0; i < 12 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.classList.contains("react-flow__node") ? el.dataset.id ?? null : null;
      });
    }
    expect(reached).toBe("img-broken");
    // A box-shadow halo ring, plus a transparent outline that forced-colors mode draws.
    const ring = await node(page, "img-broken").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { outline: cs.outlineStyle, shadow: cs.boxShadow };
    });
    expect(ring.outline).not.toBe("none");
    expect(ring.shadow).not.toBe("none");
  });

  test("focused node is not hidden under the toolbar or tray (SC 2.4.11)", async ({ page }) => {
    await openCanvas(page);
    await node(page, "note1").focus();
    const n = await node(page, "note1").boundingBox();
    const bar = await page.locator(".bn-toolbar").boundingBox();
    const tray = await page.locator(".bn-tray").boundingBox();
    expect(n && bar && tray).toBeTruthy();
    if (!n || !bar || !tray) return;
    expect(n.y).toBeGreaterThanOrEqual(bar.y + bar.height);
    expect(n.x).toBeGreaterThanOrEqual(tray.x + tray.width);
  });

  test("resize with the handle and with the keyboard", async ({ page }) => {
    await openCanvas(page);
    const note = node(page, "note1");
    await note.click({ position: { x: 40, y: 40 } });
    const before = await size(note);
    const handle = note.locator(".react-flow__resize-control.handle.bottom.right");
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();
    if (!box) throw new Error("no handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + 40, { steps: 8 });
    await page.mouse.up();
    const dragged = await size(note);
    expect(dragged.w).toBeGreaterThan(before.w + 40);
    expect(dragged.h).toBeGreaterThan(before.h + 20);

    await note.focus();
    await page.keyboard.press("+");
    await expect.poll(() => size(note)).toEqual({ w: dragged.w + 32, h: dragged.h + 32 });
    await page.keyboard.press("-");
    await expect.poll(() => size(note)).toEqual(dragged);
  });

  test("arrange buttons lay items out without overlaps", async ({ page }) => {
    await openCanvas(page);
    await page.getByRole("toolbar", { name: "Canvas tools" }).getByRole("button", { name: "Arrange" }).click();
    await page.getByRole("menuitem", { name: "Grid", exact: true }).click();
    await expect.poll(async () => (await size(node(page, "note1"))).w).toBe(280);
    const ids = ["note1", "img-broken", "sw1"];
    const boxes = await Promise.all(ids.map(async (id) => ({ ...(await position(node(page, id))), ...(await size(node(page, id))) })));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${ids[i]} overlaps ${ids[j]}`).toBe(false);
      }
    }
  });

  test("node menu moves an item into a section (menu alternative to drag)", async ({ page }) => {
    await openCanvas(page);
    await node(page, "note1").focus();
    await page.keyboard.press("m");
    const menu = page.getByRole("menu", { name: /Options for note/ });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    await menu.getByRole("menuitem", { name: "Move to section: Glass" }).press("Enter");
    await expect(menu).toHaveCount(0);
    await expect(node(page, "sec1").getByText("1 item")).toBeVisible();
    await expect(page.getByRole("menuitem")).toHaveCount(0);
  });

  test("a failed image shows a link card with title, site and link", async ({ page }) => {
    await openCanvas(page);
    const tile = node(page, "img-broken");
    const card = tile.getByTestId("link-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Broken shot");
    await expect(card).toContainText("dribbble.com");
    await expect(card.getByRole("link")).toHaveAttribute("href", "https://dribbble.com/shots/42-broken");
    await expect(tile.locator("img")).toHaveCount(0);
  });

  test("ship and explore are shown with text and an icon, not color alone", async ({ page }) => {
    await openCanvas(page);
    const chip = node(page, "sw1").locator('[data-tag="ship"]');
    await expect(chip).toHaveText("Ship");
    await expect(chip.locator("svg")).toHaveCount(1);
  });

  test("auto-save waits 1 s, saves JSON only, and survives a reload", async ({ page }) => {
    const api = await openCanvas(page);
    // Add note starts place mode; a click on the board drops the note there.
    await page.getByRole("button", { name: "Add note" }).click();
    const spot = await emptyBoardPoint(page);
    await page.mouse.click(spot.x, spot.y);
    const editor = page.getByRole("textbox", { name: "Note text" });
    await expect(editor).toBeFocused();
    await editor.fill("Saved across reloads");
    await editor.press("Control+Enter");
    expect(api.puts).toHaveLength(0);
    await expect.poll(() => api.puts.length, { timeout: 5_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId("save-status")).toHaveText(/All changes saved/);

    const saved = JSON.stringify(api.puts.at(-1));
    expect(saved).toContain("Saved across reloads");
    expect(saved).not.toMatch(/data:image|base64/);

    await page.reload();
    await expect(page.getByText("Saved across reloads")).toBeVisible();
  });

  test("saves send the loaded version; a conflict stops saving and asks for a reload", async ({ page }) => {
    const api = await openCanvas(page);
    // Enter on Add note places it at once in the middle of the view (keyboard route).
    await page.getByRole("button", { name: "Add note" }).press("Enter");
    await page.getByRole("textbox", { name: "Note text" }).fill("First");
    await page.getByRole("textbox", { name: "Note text" }).press("Control+Enter");
    await expect.poll(() => api.puts.length, { timeout: 5_000 }).toBe(1);
    expect(api.bases[0]).toBe(stamp(0));

    // Another window saved in between: the server answers 409.
    api.conflict = true;
    await page.getByRole("button", { name: "Add note" }).press("Enter");
    await page.getByRole("textbox", { name: "Note text" }).fill("Second");
    await page.getByRole("textbox", { name: "Note text" }).press("Control+Enter");
    const alert = page.getByRole("alert").filter({ hasText: "This canvas changed in another window. Reload to see the latest." });
    await expect(alert).toBeVisible({ timeout: 5_000 });
    expect(api.bases[1]).toBe(stamp(1));
    await expect(page.getByTestId("save-status")).toHaveText(/Could not save/);
    const tries = api.bases.length;
    await page.getByTestId("save-status").getByRole("button", { name: "Try again" }).click();
    await page.waitForTimeout(300);
    // A stale tab never sends its state again.
    expect(api.bases.length).toBe(tries);
    await expect(alert.getByRole("button", { name: "Reload" })).toBeVisible();
  });

  test("share: create a view-only link, copy it, turn it off @a11y", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const calls: string[] = [];
    const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";
    await page.route(`**/api/canvas/${CANVAS_ID}/share`, async (route) => {
      const method = route.request().method();
      calls.push(method);
      const body = method === "DELETE" ? { token: null, url: null } : { token: TOKEN, url: `http://localhost/s/${TOKEN}` };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await openCanvas(page);
    const share = page.getByRole("button", { name: "Share", exact: true });
    await share.click();
    await expect(share).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Create view link" }).click();
    const link = page.getByRole("textbox", { name: "View-only link" });
    await expect(link).toHaveValue(`http://localhost/s/${TOKEN}`);
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.locator(".st-toast").filter({ hasText: "Link copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost/s/${TOKEN}`);

    const results = await new AxeBuilder({ page }).include(".bn-share").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    await page.getByRole("button", { name: "Turn off link" }).click();
    await expect(page.getByRole("button", { name: "Create view link" })).toBeVisible();
    expect(calls).toEqual(["POST", "DELETE"]);
    await page.keyboard.press("Escape");
    await expect(share).toBeFocused();
    await expect(share).toHaveAttribute("aria-expanded", "false");
  });

  test("axe finds no serious or critical issues @a11y", async ({ page }) => {
    await openCanvas(page);
    const check = async (label: string) => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        serious,
        `${label}: ${JSON.stringify(serious.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), null, 2)}`,
      ).toEqual([]);
    };
    await check("canvas");
    // The React Flow attribution stays visible and passes contrast (it failed at 2.65:1 before).
    await expect(page.locator(".react-flow__attribution a")).toBeVisible();
    const attribution = await new AxeBuilder({ page }).include(".react-flow__attribution").withRules(["color-contrast", "target-size"]).analyze();
    expect(attribution.violations).toEqual([]);
    await node(page, "note1").focus();
    await page.keyboard.press("m");
    await expect(page.getByRole("menu")).toBeVisible();
    await check("node menu open");
  });

  test("wheel pans the board and Ctrl + wheel zooms it", async ({ page }) => {
    await openCanvas(page);
    const p = await emptyBoardPoint(page);
    await page.mouse.move(p.x, p.y);
    const before = await viewport(page);
    await page.mouse.wheel(0, 200);
    await expect.poll(async () => (await viewport(page)).y).toBeLessThan(before.y - 50);
    expect((await viewport(page)).zoom).toBeCloseTo(before.zoom, 5);

    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -300);
    await page.keyboard.up("Control");
    await expect.poll(async () => (await viewport(page)).zoom).toBeGreaterThan(before.zoom + 0.05);
  });

  test("drag on the empty board draws a marquee that selects what it touches", async ({ page }) => {
    await openCanvas(page);
    const note = await node(page, "note1").boundingBox();
    const sw = await node(page, "sw1").boundingBox();
    if (!note || !sw) throw new Error("no nodes");
    // From empty space above-left of the note, across to the middle of the swatch.
    const start = { x: note.x - 20, y: note.y + note.height + 8 };
    await page.mouse.move(start.x, start.y + 200);
    await page.mouse.down();
    await page.mouse.move(sw.x + sw.width / 2, note.y + 10, { steps: 10 });
    await page.mouse.up();
    await expect.poll(() => selectedIds(page)).toEqual(expect.arrayContaining(["note1", "sw1"]));
    // Escape clears the selection.
    await page.keyboard.press("Escape");
    await expect.poll(() => selectedIds(page)).toEqual([]);
  });

  test("Space + drag pans, and the hand tool (H) pans with a plain drag", async ({ page }) => {
    await openCanvas(page);
    const p = await emptyBoardPoint(page);
    await page.mouse.click(p.x, p.y);
    const before = await viewport(page);
    await page.keyboard.down("Space");
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x - 100, p.y - 60, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    await expect.poll(async () => (await viewport(page)).x).toBeLessThan(before.x - 50);
    expect(await selectedIds(page)).toEqual([]);

    await page.keyboard.press("h");
    await expect(page.getByRole("button", { name: "Hand tool" })).toHaveAttribute("aria-pressed", "true");
    const mid = await viewport(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 80, p.y + 80, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await viewport(page)).x).toBeGreaterThan(mid.x + 40);
    await page.keyboard.press("v");
    await expect(page.getByRole("button", { name: "Select tool" })).toHaveAttribute("aria-pressed", "true");
  });

  test("zoom keys: + steps the ladder, Mod+0 resets, Shift+1 fits, arrows pan the focused board", async ({ page }) => {
    await openCanvas(page);
    const board = page.getByRole("main", { name: "Canvas" });
    await board.focus();
    await page.keyboard.press("+");
    await expect(page.getByTestId("zoom-value")).toHaveText("125%");
    await page.keyboard.press("-");
    await page.keyboard.press("-");
    await expect(page.getByTestId("zoom-value")).toHaveText("75%");
    await page.keyboard.press("ControlOrMeta+0");
    await expect(page.getByTestId("zoom-value")).toHaveText("100%");
    const before = await viewport(page);
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await viewport(page)).x).toBeCloseTo(before.x - 40, 3);
    await page.keyboard.press("Shift+ArrowDown");
    await expect.poll(async () => (await viewport(page)).y).toBeCloseTo(before.y - 160, 3);

    await page.keyboard.press("Shift+Digit1");
    // Fit: every item is inside the board.
    await expect
      .poll(async () => {
        const b = await page.locator(".bn-flow").boundingBox();
        const boxes = await Promise.all(["note1", "sec1", "sw1", "img-broken"].map((id) => node(page, id).boundingBox()));
        return boxes.every((n) => n && b && n.x >= b.x && n.x + n.width <= b.x + b.width && n.y >= b.y && n.y + n.height <= b.y + b.height);
      })
      .toBe(true);

    // Zoom menu offers the same commands with their keys.
    await page.getByTestId("zoom-value").click();
    await expect(page.getByRole("menuitem", { name: /Zoom to 100%/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("zoom-value")).toBeFocused();
  });

  test("Mod+D duplicates the focused item and selects the copy", async ({ page }) => {
    await openCanvas(page);
    const note = node(page, "note1");
    await note.focus();
    const start = await position(note);
    await page.keyboard.press("ControlOrMeta+d");
    await expect(page.locator(".react-flow__node")).toHaveCount(INITIAL_STATE.nodes.length + 1);
    const copy = page.locator(".react-flow__node-note.selected");
    await expect(copy).toHaveCount(1);
    await expect(copy).not.toHaveAttribute("data-id", "note1");
    await expect.poll(() => position(copy)).toEqual({ x: start.x + 16, y: start.y + 16 });
    await expect(copy).toBeFocused();
    await expect(copy).toHaveAccessibleName(/Note: Make it feel cold, selected/);
  });

  test("Alt + drag leaves a copy behind, and snapping shows a guide", async ({ page }) => {
    await openCanvas(page);
    const note = node(page, "note1");
    const box = await note.boundingBox();
    if (!box) throw new Error("no note");
    const start = await position(note);
    await page.mouse.move(box.x + 60, box.y + 40);
    await page.keyboard.down("Alt");
    await page.mouse.down();
    // Move down so the note's left edge stays aligned with the image below it (x = 0): a guide.
    await page.mouse.move(box.x + 63, box.y + 40 + 500, { steps: 12 });
    await expect(page.locator(".bn-snap-guide").first()).toBeVisible();
    await page.mouse.up();
    await page.keyboard.up("Alt");
    await expect(page.getByTestId("snap-guides")).toHaveCount(0);
    await expect(page.locator(".react-flow__node")).toHaveCount(INITIAL_STATE.nodes.length + 1);
    // The original moved and snapped back onto x = 0; a copy stays at the start.
    const moved = await position(note);
    expect(moved.x).toBe(start.x);
    expect(moved.y).toBeGreaterThan(start.y + 100);
    const copies = page.locator(".react-flow__node-note").filter({ hasNot: page.locator(`[data-id="note1"]`) });
    const ids = await page.locator(".react-flow__node-note").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.id));
    const copyId = ids.find((id) => id !== "note1");
    expect(copyId).toBeTruthy();
    await expect(copies.first()).toBeVisible();
    expect(await position(node(page, copyId!))).toEqual(start);
  });

  test("right click opens the item menu at the pointer; Mod+A selects everything", async ({ page }) => {
    await openCanvas(page);
    const box = await node(page, "sw1").boundingBox();
    if (!box) throw new Error("no swatch");
    await page.mouse.click(box.x + 40, box.y + 30, { button: "right" });
    const menu = page.getByRole("menu", { name: /Options for color/ });
    await expect(menu).toBeVisible();
    const m = await menu.boundingBox();
    expect(m && Math.abs(m.x - (box.x + 40)) < 4).toBe(true);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await page.getByRole("main", { name: "Canvas" }).focus();
    await page.keyboard.press("ControlOrMeta+a");
    await expect.poll(() => selectedIds(page)).toEqual(["img-broken", "note1", "sec1", "sw1"]);
  });

  test("? opens the shortcut sheet from one registry", async ({ page }) => {
    await openCanvas(page);
    await page.getByRole("main", { name: "Canvas" }).focus();
    await page.keyboard.press("?");
    const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Zoom to fit")).toBeVisible();
    await expect(sheet.getByText("Move the item 8 px")).toBeVisible();
    await expect(sheet.getByText("Drag a copy")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("the results panel resizes with the keyboard splitter", async ({ page }) => {
    await openCanvas(page);
    const splitter = page.getByRole("separator", { name: "Resize search results" });
    await expect(splitter).toHaveAttribute("aria-valuenow", "320");
    await splitter.focus();
    await page.keyboard.press("ArrowRight");
    await expect(splitter).toHaveAttribute("aria-valuenow", "336");
    await page.keyboard.press("Home");
    await expect(splitter).toHaveAttribute("aria-valuenow", "260");
    await page.keyboard.press("End");
    await expect(splitter).toHaveAttribute("aria-valuenow", "520");
    const rail = page.getByRole("button", { name: /Search results, 3 waiting/ });
    await rail.click();
    await expect(rail).toHaveAttribute("aria-pressed", "false");
    await expect(splitter).toHaveCount(0);
  });

  test("axe is clean right to left, with the menu and the sheet open @a11y", async ({ page }) => {
    await openCanvas(page);
    await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"));
    const check = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, `${label}: ${JSON.stringify(serious.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), null, 2)}`).toEqual([]);
    };
    await check("rtl canvas");
    await node(page, "note1").click({ position: { x: 30, y: 30 } });
    await check("rtl note selected");
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await check("shortcut sheet");
  });
});
