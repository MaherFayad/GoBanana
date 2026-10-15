/**
 * P0-12 (owner decision D1): "Show in chat" in the inline canvas draws a Frankenstein page to one
 * image in the browser and sends it to the model context with `ui/update-model-context`. Runs the
 * built `ui://banana/canvas` HTML in a sandboxed iframe (opaque origin) under the resource CSP,
 * with a fake host, like e2e/mcp-apps.spec.ts.
 *
 * Image hosts are mocked: cdn.dribbble.com answers with a CORS header (as it does live, checked
 * 2026-10-15), i.pinimg.com without one (as Pinterest does live), so a page with a Pinterest part
 * would taint the canvas and must fall back to the parts view from get_snapshot.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CANVAS_ASSET_PATH } from "../lib/mcp/resources/canvas-asset";
import { canvasCsp, fillCanvasHtml } from "../lib/mcp/resources/canvas";
import { bandsRgba, encodePng, hexToRgba } from "../tests/fixtures/palette-images";

const APP_URL = "https://banana.example.com";
const CANVAS_HTML = fillCanvasHtml(readFileSync(fileURLToPath(new URL(`../public${CANVAS_ASSET_PATH}`, import.meta.url)), "utf8"), APP_URL);
const HOST = "https://host.test/chat";
const SANDBOX = "https://sandbox.test/canvas.html";
const CANVAS_ID = "c0ffee00-0000-4000-8000-000000000002";
const T0 = "2026-10-15T12:00:00.000Z";
/** 80 x 60, red over blue halves, so the drawn page has known colors. */
const PNG = Buffer.from(encodePng(bandsRgba([[hexToRgba("#e63946"), 40], [hexToRgba("#1d3557"), 40]], 60)));

const part = (id: string, role: string, imageUrl: string, site: string) => ({
  id,
  role,
  imageUrl,
  sourceUrl: `https://${site}/shots/${id}`,
  sourceSite: site,
  title: id,
  crop: { x: 0, y: 0, w: 1, h: 0.5 },
  imageWidth: 80,
  imageHeight: 60,
});
const stitchNode = (id: string, title: string, partIds: string[]) => ({
  id,
  type: "stitch",
  x: 0,
  y: id === "st_ok" ? 0 : 1200,
  w: 720,
  h: 900,
  data: { title, platform: "website", mode: "collage", rows: partIds.map((p, i) => ({ id: `r${i}`, slots: [{ id: `s-${id}-${i}`, role: "hero", partId: p }] })) },
});
const STATE = {
  version: 1,
  viewport: { x: 40, y: 40, zoom: 0.5 },
  nodes: [stitchNode("st_ok", "Dribbble only", ["pt-a", "pt-b"]), stitchNode("st_pin", "With a Pinterest part", ["pt-a", "pt-pin"])],
  tray: [],
  parts: [
    part("pt-a", "hero", "https://cdn.dribbble.com/userupload/a.png", "dribbble.com"),
    part("pt-b", "hero", "https://cdn.dribbble.com/userupload/b.png", "dribbble.com"),
    part("pt-pin", "hero", "https://i.pinimg.com/736x/p.jpg", "pinterest.com"),
  ],
};
const OPEN_RESULT = {
  content: [{ type: "text", text: "Opened." }],
  structuredContent: { canvas: { id: CANVAS_ID, title: "Show page", webUrl: `${APP_URL}/c/${CANVAS_ID}`, brief: null, items: 2, sections: 0, tray: 0 }, created: false },
  _meta: { "banana/canvas": { state: STATE, updatedAt: T0 } },
};

function cspHeader(): string {
  const res = canvasCsp({ appUrl: APP_URL }).resourceDomains.join(" ");
  return [`default-src 'none'`, `script-src 'unsafe-inline' ${res}`, `style-src 'unsafe-inline' ${res}`, `img-src ${res}`, `font-src ${res}`, "connect-src 'none'"].join("; ");
}

function hostPage(caps: Record<string, unknown>): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake host</title></head><body><script>
  const frame = () => document.getElementById("app");
  window.__calls = []; window.__context = [];
  const send = (msg) => frame().contentWindow.postMessage(msg, "*");
  function answer(p) {
    if (p.name === "load_canvas_state") return { content: [{ type: "text", text: "Loaded." }], structuredContent: { ok: true, state: ${JSON.stringify(STATE)}, updatedAt: ${JSON.stringify(T0)}, title: "Show page", removed: 0 } };
    if (p.name === "get_snapshot") return { content: [{ type: "text", text: "Row 2: hero (part pt-pin) from pinterest.com" }, { type: "image", data: "UEFSVFM=", mimeType: "image/jpeg" }] };
    return { content: [{ type: "text", text: "Saved." }], structuredContent: { ok: true, updatedAt: ${JSON.stringify(T0)} } };
  }
  window.addEventListener("message", (e) => {
    if (!frame() || e.source !== frame().contentWindow) return;
    const m = e.data; if (!m || m.jsonrpc !== "2.0") return;
    if (m.method === "ui/initialize") { send({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: m.params.protocolVersion, hostInfo: { name: "fake-host", version: "1" },
      hostCapabilities: ${JSON.stringify(caps)}, hostContext: { theme: "dark", displayMode: "inline", platform: "web" } } }); return; }
    if (m.method === "ui/notifications/initialized") { send({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: ${JSON.stringify(OPEN_RESULT)} }); return; }
    if (m.method === "tools/call") { window.__calls.push(m.params.name); send({ jsonrpc: "2.0", id: m.id, result: answer(m.params) }); return; }
    if (m.method === "ui/update-model-context") { window.__context.push(m.params); send({ jsonrpc: "2.0", id: m.id, result: {} }); return; }
    if (m.id !== undefined && m.method) send({ jsonrpc: "2.0", id: m.id, result: {} });
  });
</script><iframe id="app" title="Moodboard canvas" sandbox="allow-scripts" src="${SANDBOX}" style="width:1200px;height:720px;border:0"></iframe></body></html>`;
}

type Ctx = { content: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string })[] };

async function open(page: Page, caps: Record<string, unknown>) {
  await page.route(HOST, (r) => r.fulfill({ status: 200, contentType: "text/html", body: hostPage(caps) }));
  await page.route(SANDBOX, (r) => r.fulfill({ status: 200, contentType: "text/html", headers: { "content-security-policy": cspHeader() }, body: CANVAS_HTML }));
  await page.route(`${APP_URL}/**`, (r) => r.abort("blockedbyclient"));
  await page.route(/^https:\/\/cdn\.dribbble\.com\//, (r) => r.fulfill({ status: 200, contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: PNG }));
  // Playwright adds a permissive CORS header to fulfilled responses that have none, so a header for
  // another origin stands in for Pinterest's missing one: either way the CORS check fails.
  await page.route(/^https:\/\/i\.pinimg\.com\//, (r) =>
    r.fulfill({ status: 200, contentType: "image/png", headers: { "access-control-allow-origin": "https://www.pinterest.com" }, body: PNG }),
  );
  await page.goto(HOST);
  const frame = page.frameLocator("#app");
  await expect(frame.locator('.react-flow__node[data-id="st_ok"]')).toBeVisible();
  return frame;
}

const context = (page: Page) => page.evaluate(() => (window as unknown as { __context: Ctx[] }).__context);

test.describe("Show in chat", () => {
  test("draws a page with CORS images into one PNG and sends it to the model context", async ({ page }) => {
    const frame = await open(page, { serverTools: {}, updateModelContext: { text: {}, image: {} } });
    await frame.getByRole("button", { name: "Show in chat" }).click();
    const dialog = frame.getByRole("dialog", { name: "Show a page in chat" });
    await dialog.getByRole("button", { name: "Dribbble only" }).click();
    await expect(frame.getByLabel("Notifications").getByText('Sent "Dribbble only" to the chat')).toBeVisible();
    const sent = (await context(page)).at(-1)!;
    expect(sent.content.map((b) => b.type)).toEqual(["text", "image"]);
    const text = sent.content[0] as { text: string };
    expect(text.text).toContain("drawn in their browser");
    expect(text.text).toContain("https://dribbble.com/shots/pt-a");
    const img = sent.content[1] as { data: string; mimeType: string };
    expect(img.mimeType).toBe("image/png");
    // Decode the PNG in the page: 1200 wide (1440 frame scaled), red then blue across the top row.
    const px = await page.evaluate(async (data) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      const at = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3));
      return { w: bmp.width, h: bmp.height, left: at(100, 10), right: at(1100, 10) };
    }, img.data);
    expect(px.w).toBe(1200);
    // Two rows of crop aspect (1 * 4/3) / 0.5 = 2.67: 450 px each at 1200 wide.
    expect(px.h).toBe(900);
    expect(px.left[0]).toBeGreaterThan(200);
    expect(px.right[2]).toBeGreaterThan(70);
    expect(px.right[0]).toBeLessThan(60);
    // Nothing went to the server but the board load: no save, no upload.
    const calls = await page.evaluate(() => (window as unknown as { __calls: string[] }).__calls);
    expect(calls.filter((c) => c !== "load_canvas_state")).toEqual([]);
  });

  test("a Pinterest part (no CORS header) would taint the canvas: falls back to the parts view and says so", async ({ page }) => {
    const frame = await open(page, { serverTools: {}, updateModelContext: { text: {}, image: {} } });
    await frame.getByRole("button", { name: "Show in chat" }).click();
    await frame.getByRole("dialog").getByRole("button", { name: "With a Pinterest part" }).click();
    await expect(frame.getByLabel("Notifications").getByText("Sent the parts view instead")).toBeVisible();
    await expect(frame.getByLabel("Notifications").getByText(/Parts from i\.pinimg\.com block drawing the page/)).toBeVisible();
    const sent = (await context(page)).at(-1)!;
    expect((sent.content[0] as { text: string }).text).toMatch(/could not be drawn as one image: parts from i\.pinimg\.com .*\(no CORS header\)/);
    // The parts view from get_snapshot follows, as the server returned it.
    expect(sent.content.slice(1)).toEqual([
      { type: "text", text: "Row 2: hero (part pt-pin) from pinterest.com" },
      { type: "image", data: "UEFSVFM=", mimeType: "image/jpeg" },
    ]);
    const calls = await page.evaluate(() => (window as unknown as { __calls: string[] }).__calls);
    expect(calls).toContain("get_snapshot");
  });

  test("a host that takes text only gets the layout in words", async ({ page }) => {
    const frame = await open(page, { serverTools: {}, updateModelContext: { text: {} } });
    await frame.getByRole("button", { name: "Show in chat" }).click();
    const dialog = frame.getByRole("dialog");
    await expect(dialog.getByText(/takes text only/)).toBeVisible();
    await dialog.getByRole("button", { name: "Dribbble only" }).click();
    await expect(frame.getByLabel("Notifications").getByText("Sent a text layout", { exact: true })).toBeVisible();
    const sent = (await context(page)).at(-1)!;
    expect(sent.content.map((b) => b.type)).toEqual(["text"]);
    expect((sent.content[0] as { text: string }).text).toMatch(/Row 1: hero \(1440 x 540 px/);
  });

  test("the picker is keyboard reachable and axe is clean on it @a11y", async ({ page }) => {
    const frame = await open(page, { serverTools: {}, updateModelContext: { text: {}, image: {} } });
    const trigger = frame.getByRole("button", { name: "Show in chat" });
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = frame.getByRole("dialog", { name: "Show a page in chat" });
    await expect(dialog.getByRole("button", { name: "Dribbble only" })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations, JSON.stringify(results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("no button when the host takes no model context", async ({ page }) => {
    const frame = await open(page, { serverTools: {} });
    await expect(frame.getByRole("button", { name: "Full screen" }).or(frame.getByRole("link", { name: "Open on the web" })).first()).toBeVisible();
    await expect(frame.getByRole("button", { name: "Show in chat" })).toHaveCount(0);
  });
});
