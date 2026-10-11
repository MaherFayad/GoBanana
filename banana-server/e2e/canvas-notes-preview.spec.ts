/**
 * Sticky notes that never scroll, the compact presentation, the image preview, node chrome
 * under zoom, and place mode for Add note and Add section (DECISIONS.md, 2026-10-11).
 *
 * The API and the image host are mocked with page.route; images are synthetic gradients.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { gradientPng } from "./support/seed-canvas";

const CANVAS_ID = "e2e-notes";

const LONG =
  "WILD: The whole checkout is one tall seed packet. The order summary is printed on the back like planting instructions, and the pay button is the tear strip at the top.\n" +
  "SALVAGE: A flippable 'ticket card'. Front shows the total, back shows the line items, flip with one tap.";

const image = (id: string, n: number, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: "image",
  x,
  y,
  w: 280,
  h: 210,
  ...extra,
  data: {
    imageUrl: `https://i.pinimg.com/736x/r${n}.jpg`,
    thumbUrl: `https://i.pinimg.com/236x/r${n}.jpg`,
    sourceUrl: `https://www.pinterest.com/pin/${n}/`,
    sourceSite: "pinterest.com",
    title: `Shot ${n}`,
    width: 1200,
    height: 900,
  },
});

function boardState(zoom = 1) {
  return {
    version: 1,
    viewport: { x: 40, y: 60, zoom },
    nodes: [
      { id: "sec1", type: "section", x: 0, y: 0, w: 616, h: 300, data: { title: "Seed packet" } },
      // As add_to_canvas used to place it: 280 x 178, too short for its text.
      { id: "long", type: "note", x: 16, y: 48, w: 280, h: 178, parentId: "sec1", data: { text: LONG, color: "yellow" } },
      { id: "short", type: "note", x: 320, y: 48, w: 220, h: 64, parentId: "sec1", data: { text: "Make it feel cold", color: "blue" } },
      image("img1", 1, 700, 0, { zIndex: 3 }),
      image("img2", 2, 1000, 0),
    ],
    tray: [],
  };
}

async function open(page: Page, state: unknown = boardState()): Promise<{ puts: unknown[] }> {
  const api = { puts: [] as unknown[] };
  await page.route(`**/api/canvas/${CANVAS_ID}`, async (route) => {
    if (route.request().method() === "PUT") {
      api.puts.push((route.request().postDataJSON() as { state: unknown }).state);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state, updatedAt: "2026-10-11T10:00:00.000Z" }) });
  });
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(64, 48, [186, 222, 255], [74, 108, 170]) }),
  );
  await page.goto(`/c/${CANVAS_ID}`);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  return api;
}

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const height = (l: Locator) => l.evaluate((el) => Number.parseFloat((el as HTMLElement).style.height));

test.describe("sticky notes", () => {
  test("a long note has no scrollbar and grows to fit its text; its section grows with it", async ({ page }) => {
    const api = await open(page);
    const long = node(page, "long");
    await expect.poll(() => height(long), { timeout: 5_000 }).toBeGreaterThan(178);
    const fit = await long.locator(".bn-note").evaluate((el) => {
      const note = el as HTMLElement;
      const body = note.querySelector(".bn-note-body") as HTMLElement;
      const styles = [note, body].map((e) => getComputedStyle(e).overflowY);
      return { note: note.scrollHeight <= note.clientHeight, body: body.scrollHeight <= body.clientHeight, styles };
    });
    expect(fit.note).toBe(true);
    expect(fit.body).toBe(true);
    expect(fit.styles).not.toContain("auto");
    expect(fit.styles).not.toContain("scroll");
    // Labels render as chips; the stored text is unchanged.
    await expect(long.locator(".bn-note-label")).toHaveText(["WILD", "SALVAGE"]);
    const sec = await height(node(page, "sec1"));
    expect(sec).toBeGreaterThanOrEqual(48 + (await height(long)) + 16);
    // The fitted height is saved.
    await expect.poll(() => api.puts.length, { timeout: 5_000 }).toBeGreaterThan(0);
    const saved = JSON.stringify(api.puts.at(-1));
    expect(saved).toContain(JSON.stringify(LONG).slice(1, 40));
  });

  test("a note resized small shows the compact view, and focus shows the full text", async ({ page }) => {
    await open(page);
    const long = node(page, "long");
    await expect.poll(() => height(long)).toBeGreaterThan(178);
    await long.click({ position: { x: 60, y: 30 } });
    const handle = long.locator(".react-flow__resize-control.handle.bottom.right");
    const box = await handle.boundingBox();
    if (!box) throw new Error("no handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 150, { steps: 8 });
    await page.mouse.up();

    const note = long.locator(".bn-note");
    await expect(note).toHaveAttribute("data-compact", "");
    await expect(long.locator(".bn-note-more")).toHaveText(/^\+\d+ lines?$/);
    const body = await long.locator(".bn-note-body").evaluate((el) => ({ overflow: getComputedStyle(el).overflowY }));
    expect(body.overflow).toBe("hidden");

    await page.mouse.move(5, 5);
    await page.locator(".bn-flow").click({ position: { x: 900, y: 600 } });
    await long.focus();
    const peek = page.locator(".bn-note-peek");
    await expect(peek).toBeVisible();
    await expect(peek).toContainText("flip with one tap.");
    // Escape closes the popover (dismissible) and leaves focus on the note.
    await page.keyboard.press("Escape");
    await expect(peek).toHaveCount(0);
    await expect(long).toBeFocused();

    // Keyboard route back: Options > Fit to text.
    await page.keyboard.press("m");
    await page.getByRole("menuitem", { name: "Fit to text" }).click();
    await expect(note).not.toHaveAttribute("data-compact", "");
    await expect.poll(() => height(long)).toBeGreaterThan(178);
  });

  test("the Compact menu item is the keyboard route to a small note", async ({ page }) => {
    await open(page);
    const long = node(page, "long");
    await expect.poll(() => height(long)).toBeGreaterThan(178);
    await long.focus();
    await page.keyboard.press("m");
    await page.getByRole("menuitem", { name: "Compact" }).click();
    await expect(long.locator(".bn-note")).toHaveAttribute("data-compact", "");
    expect(await height(long)).toBeLessThan(120);
  });

  test("the editor grows as you type and never scrolls", async ({ page }) => {
    await open(page);
    const short = node(page, "short");
    await short.focus();
    await page.keyboard.press("F2");
    const editor = page.getByRole("textbox", { name: "Note text" });
    await expect(editor).toBeFocused();
    const before = await height(short);
    await editor.fill("A much longer note now. ".repeat(12));
    await expect.poll(() => height(short)).toBeGreaterThan(before + 40);
    const area = await editor.evaluate((el) => ({ fits: el.scrollHeight <= el.clientHeight + 1, overflow: getComputedStyle(el).overflowY }));
    expect(area.fits).toBe(true);
    expect(area.overflow).toBe("hidden");
  });
});

test.describe("image preview", () => {
  test("a click opens the preview; Escape closes it and focus returns to the tile", async ({ page }) => {
    await open(page);
    const tile = node(page, "img1");
    await tile.locator(".bn-image-frame").click({ position: { x: 140, y: 90 } });
    const dialog = page.getByRole("dialog", { name: "Shot 1" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Source: pinterest\.com/ })).toHaveAttribute("href", "https://www.pinterest.com/pin/1/");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(tile).toBeFocused();
  });

  test("+ zooms, and the arrows move to the next image at fit size", async ({ page }) => {
    await open(page);
    await node(page, "img1").focus();
    await page.keyboard.press(" ");
    const dialog = page.getByRole("dialog", { name: "Shot 1" });
    await expect(dialog).toBeVisible();
    const readout = dialog.locator(".bn-preview-zoom");
    await expect(readout).not.toHaveText("100%");
    const fit = Number.parseInt((await readout.textContent()) ?? "0", 10);
    await page.keyboard.press("+");
    await expect.poll(async () => Number.parseInt((await readout.textContent()) ?? "0", 10)).toBeGreaterThan(fit);
    await dialog.getByRole("button", { name: "Fit" }).click();
    await dialog.locator(".bn-preview-stage").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("dialog", { name: "Shot 2" })).toBeVisible();
  });

  test("Copy image link writes the link to the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page);
    await node(page, "img1").focus();
    await page.keyboard.press(" ");
    const dialog = page.getByRole("dialog", { name: "Shot 1" });
    await dialog.getByRole("button", { name: "Copy image link" }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("https://i.pinimg.com/736x/r1.jpg");
    await expect(page.getByText("Image link copied")).toBeVisible();
  });

  test("dragging an image moves it and does not open the preview", async ({ page }) => {
    await open(page);
    const tile = node(page, "img1");
    const box = await tile.boundingBox();
    if (!box) throw new Error("no tile");
    const start = await tile.evaluate((el) => (el as HTMLElement).style.transform);
    await page.mouse.move(box.x + 140, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 160, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await tile.evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(start);
  });
});

test.describe("node chrome under zoom", () => {
  test("the menu button keeps its on-screen size at 300%", async ({ page }) => {
    const sizeAt = async (zoom: number) => {
      const p = await page.context().newPage();
      await open(p, boardState(zoom));
      const tile = node(p, "img1");
      await tile.hover();
      const b = await tile.getByRole("button", { name: /^Options for/ }).boundingBox();
      await p.close();
      if (!b) throw new Error("no menu button");
      return b;
    };
    const one = await sizeAt(1);
    const three = await sizeAt(3);
    expect(Math.abs(three.width - one.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(three.height - one.height)).toBeLessThanOrEqual(2);
  });
});

test.describe("place mode for Add note and Add section", () => {
  const zOf = (l: Locator) => l.evaluate((el) => Number(getComputedStyle(el).zIndex) || 0);

  test("a click drops the note where it lands, on top, in edit mode", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Click to place. Esc to cancel")).toBeVisible();
    const flow = await page.locator(".bn-flow").boundingBox();
    if (!flow) throw new Error("no board");
    const at = { x: flow.x + flow.width - 260, y: flow.y + flow.height - 200 };
    await page.mouse.move(at.x, at.y);
    await expect(page.locator(".bn-place-ghost")).toBeVisible();
    await page.mouse.click(at.x, at.y);
    await expect(page.getByRole("textbox", { name: "Note text" })).toBeFocused();
    const added = page.locator(".react-flow__node-note").filter({ has: page.getByRole("textbox", { name: "Note text" }) });
    const box = await added.boundingBox();
    if (!box) throw new Error("no note");
    expect(Math.abs(box.x + box.width / 2 - at.x)).toBeLessThan(4);
    expect(Math.abs(box.y + box.height / 2 - at.y)).toBeLessThan(4);
    const others = await Promise.all(["img1", "img2", "long", "short"].map((id) => zOf(node(page, id))));
    expect(await zOf(added)).toBeGreaterThan(Math.max(...others));
  });

  test("Escape cancels place mode", async ({ page }) => {
    await open(page);
    const count = await page.locator(".react-flow__node").count();
    await page.getByRole("button", { name: "Add section" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Click to place. Esc to cancel")).toHaveCount(0);
    const flow = await page.locator(".bn-flow").boundingBox();
    await page.mouse.click(flow!.x + flow!.width - 200, flow!.y + flow!.height - 150);
    await expect(page.locator(".react-flow__node")).toHaveCount(count);
  });

  test("Enter on Add note places it in the middle of the view, at a free spot", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Add note" }).press("Enter");
    const editor = page.getByRole("textbox", { name: "Note text" });
    await expect(editor).toBeFocused();
    await editor.fill("Placed by keyboard");
    await editor.press("Control+Enter");
    const added = page.locator(".react-flow__node-note").filter({ hasText: "Placed by keyboard" });
    await expect(added).toBeFocused();
    const box = (await added.boundingBox())!;
    const flow = (await page.locator(".bn-flow").boundingBox())!;
    // Near the middle of the view (moved only as far as needed to clear other items).
    expect(Math.abs(box.x + box.width / 2 - (flow.x + flow.width / 2))).toBeLessThan(400);
    for (const id of ["sec1", "img1", "img2"]) {
      const o = (await node(page, id).boundingBox())!;
      const overlap = box.x < o.x + o.width && o.x < box.x + box.width && box.y < o.y + o.height && o.y < box.y + box.height;
      expect(overlap, `overlaps ${id}`).toBe(false);
    }
  });
});
