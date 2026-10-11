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
    { id: "note1", type: "note", x: 0, y: 0, w: 220, h: 140, data: { text: "Make it feel cold", color: "yellow" } },
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


for (const scheme of ["light", "dark"] as const) {
  test("wpc share " + scheme, async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const calls: string[] = [];
    const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";
    await page.route("**/api/canvas/" + CANVAS_ID + "/share", async (route) => {
      const method = route.request().method();
      calls.push(method);
      const body = method === "DELETE" ? { token: null, url: null } : { token: TOKEN, url: "http://localhost/s/" + TOKEN };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    const api = await openCanvas(page);
    const share = page.getByRole("button", { name: "Share", exact: true });
    await share.click();
    await expect(share).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("dialog", { name: "Share canvas" })).toBeVisible();
    await page.screenshot({ path: "/tmp/claude-0/-home-user-GoBanana/0cc4290f-149c-5200-b293-536a6a7ad19a/scratchpad/share-empty-" + scheme + ".png" });
    const axe1 = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    console.log("AXE empty", scheme, JSON.stringify(axe1.violations.map((v) => ({ id: v.id, impact: v.impact, t: v.nodes.map((n) => n.target) }))));
    await page.getByRole("button", { name: "Create view link" }).click();
    const link = page.getByRole("textbox", { name: "View-only link" });
    await expect(link).toHaveValue("http://localhost/s/" + TOKEN);
    await expect(link).toBeFocused();
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.locator(".st-toast").filter({ hasText: "Link copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("http://localhost/s/" + TOKEN);
    await page.screenshot({ path: "/tmp/claude-0/-home-user-GoBanana/0cc4290f-149c-5200-b293-536a6a7ad19a/scratchpad/share-link-" + scheme + ".png" });
    const axe2 = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    console.log("AXE link", scheme, JSON.stringify(axe2.violations.map((v) => ({ id: v.id, impact: v.impact, t: v.nodes.map((n) => n.target) }))));
    await page.getByRole("button", { name: "Turn off link" }).click();
    await expect(page.getByRole("button", { name: "Create view link" })).toBeVisible();
    expect(calls).toEqual(["POST", "DELETE"]);
    await page.keyboard.press("Escape");
    await expect(share).toBeFocused();
    await expect(share).toHaveAttribute("aria-expanded", "false");
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/api/uploads", async (route) => {
      await gate;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "/api/uploads/abc" }) });
    });
    await page.locator(".bn-upload input[type=file]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG_1PX });
    await expect(page.locator(".bn-upload label")).toHaveAttribute("data-loading", "inline");
    await page.screenshot({ path: "/tmp/claude-0/-home-user-GoBanana/0cc4290f-149c-5200-b293-536a6a7ad19a/scratchpad/wpc-uploading-" + scheme + ".png", clip: { x: 900, y: 0, width: 540, height: 40 } });
    release();
    await expect(page.locator(".st-toast").filter({ hasText: "Image uploaded" })).toBeVisible();
    await page.screenshot({ path: "/tmp/claude-0/-home-user-GoBanana/0cc4290f-149c-5200-b293-536a6a7ad19a/scratchpad/wpc-upload-" + scheme + ".png" });
    api.conflict = true;
    await page.getByRole("button", { name: "Add note" }).click();
    await page.getByRole("textbox", { name: "Note text" }).fill("Second");
    await page.getByRole("textbox", { name: "Note text" }).press("Control+Enter");
    await expect(page.getByRole("alert").filter({ hasText: "This canvas changed in another window" })).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "/tmp/claude-0/-home-user-GoBanana/0cc4290f-149c-5200-b293-536a6a7ad19a/scratchpad/wpc-conflict-" + scheme + ".png" });
    const axe3 = await new AxeBuilder({ page }).include(".bn-banner").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    console.log("AXE banner", scheme, JSON.stringify(axe3.violations.map((v) => ({ id: v.id, impact: v.impact, t: v.nodes.map((n) => n.target) }))));
  });
}
