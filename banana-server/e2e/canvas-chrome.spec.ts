/**
 * Canvas window chrome (the GoBanana desktop look, DECISIONS 2026-10-12): the web canvas is an
 * app window (traffic lights, board name, save state, Share), the shared canvas wears the same
 * read-only chrome plus a "Made with" notification card, and the inline canvas keeps no window
 * chrome. Board content never takes the chrome font.
 *
 * Screenshots: CANVAS_SHOTS=<dir> also writes canvas-*.png there (not a gate).
 */
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { CANVAS_ASSET_PATH } from "../lib/mcp/resources/canvas-asset";
import { canvasCsp, fillCanvasHtml } from "../lib/mcp/resources/canvas";
import { gradientPng, mockSeedCanvas, SEED_CANVAS_ID, SEED_STATE } from "./support/seed-canvas";

const SHOTS = process.env.CANVAS_SHOTS;
const DEMO_SHARE = "/s/e2e-share-demo-token-0000000000";
const IPHONE_13 = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*, *::before, *::after { caret-color: transparent !important; } nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

async function openCanvas(page: Page) {
  await mockSeedCanvas(page);
  await page.goto(`/c/${SEED_CANVAS_ID}`);
  await expect(page.locator(".react-flow__node")).toHaveCount(SEED_STATE.nodes.length);
}

async function openShared(page: Page) {
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: gradientPng(240, 180, [200, 210, 240], [70, 100, 170]) }),
  );
  await page.goto(DEMO_SHARE);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}

// ---------------------------------------------------------------- inline harness (fake MCP Apps host)

const APP_URL = "https://banana.example.com";
const HOST = "https://host.test/chat";
const SANDBOX = "https://sandbox.test/canvas.html";
const ASSETS_DIR = new URL("../public/mcp-app/assets/", import.meta.url);

function hostPage(width: number, height: number): string {
  const result = {
    content: [{ type: "text", text: "Opened canvas." }],
    structuredContent: {
      canvas: { id: SEED_CANVAS_ID, title: "Cold checkout", webUrl: `${APP_URL}/c/${SEED_CANVAS_ID}`, brief: null, items: 10, sections: 1, tray: 3 },
      created: false,
    },
    _meta: { "banana/canvas": { state: SEED_STATE, updatedAt: "2026-10-15T12:00:00.000Z" } },
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake host</title>
<style>body{margin:0;padding:16px;background:#262624}iframe{display:block;margin:0 auto;border:0;border-radius:12px}</style></head><body>
<script>
  const frame = () => document.getElementById("app");
  const send = (msg) => frame().contentWindow.postMessage(msg, "*");
  window.addEventListener("message", (e) => {
    if (!frame() || e.source !== frame().contentWindow) return;
    const m = e.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.method === "ui/initialize") {
      send({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: m.params.protocolVersion, hostInfo: { name: "fake-host", version: "1.0.0" },
        hostCapabilities: { serverTools: {}, openLinks: {}, updateModelContext: { text: {} } },
        hostContext: { theme: "dark", displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"], platform: "web" } } });
      return;
    }
    if (m.method === "ui/notifications/initialized") {
      send({ jsonrpc: "2.0", method: "ui/notifications/tool-input", params: { arguments: { canvasId: ${JSON.stringify(SEED_CANVAS_ID)} } } });
      send({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: ${JSON.stringify(result)} });
      return;
    }
    if (m.id !== undefined && m.method) send({ jsonrpc: "2.0", id: m.id, result: { content: [], structuredContent: { ok: true, updatedAt: "2026-10-15T12:00:01.000Z" } } });
  });
</script>
<iframe id="app" title="Moodboard canvas" sandbox="allow-scripts" src="${SANDBOX}" style="width:${width}px;height:${height}px"></iframe>
</body></html>`;
}

async function openInline(page: Page, width: number) {
  const html = fillCanvasHtml(readFileSync(fileURLToPath(new URL(`../public${CANVAS_ASSET_PATH}`, import.meta.url)), "utf8"), APP_URL);
  const csp = canvasCsp({ appUrl: APP_URL });
  const res = csp.resourceDomains.join(" ");
  const cspHeader = [
    "default-src 'none'",
    `script-src 'unsafe-inline' ${res}`,
    `style-src 'unsafe-inline' ${res}`,
    `img-src ${res}`,
    `font-src ${res}`,
    `connect-src ${csp.connectDomains.join(" ") || "'none'"}`,
  ].join("; ");
  await page.route(HOST, (route) => route.fulfill({ status: 200, contentType: "text/html", body: hostPage(width, 640) }));
  await page.route(SANDBOX, (route) => route.fulfill({ status: 200, contentType: "text/html", headers: { "content-security-policy": cspHeader }, body: html }));
  await page.route(`${APP_URL}/mcp-app/assets/*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "font/woff2",
      headers: { "access-control-allow-origin": "*" },
      body: readFileSync(fileURLToPath(new URL(basename(new URL(route.request().url()).pathname), ASSETS_DIR))),
    }),
  );
  await mockSeedCanvas(page);
  await page.goto(HOST);
  const frame = page.frameLocator("#app");
  await expect(frame.locator(".react-flow__node")).toHaveCount(SEED_STATE.nodes.length);
  return frame;
}

// ---------------------------------------------------------------- tests

test.describe("canvas window chrome", () => {
  test("web canvas: title bar with lights, board name, save state and Share", async ({ page }) => {
    await openCanvas(page);
    const bar = page.getByRole("banner");
    const close = bar.getByRole("link", { name: "Close canvas, back to your canvases" });
    await expect(close).toHaveAttribute("href", "/en/canvases");
    await expect(bar.getByRole("button", { name: "Full screen" })).toHaveAttribute("aria-pressed", "false");
    await expect(bar.getByRole("heading", { level: 1 })).toContainText("on");
    await expect(bar.getByTestId("save-status")).toBeVisible();
    await expect(bar.getByRole("button", { name: "Share", exact: true })).toBeVisible();
    // 24px targets, 24px apart (SC 2.5.8).
    const box = (await close.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const after = getComputedStyle(el, "::after");
      return { w: r.width - 2 * parseFloat(after.left), h: r.height - 2 * parseFloat(after.top) };
    }))!;
    expect(box.w).toBeGreaterThanOrEqual(24);
    expect(box.h).toBeGreaterThanOrEqual(24);
    await shot(page, "canvas-editor-desktop");
  });

  test("chrome uses Instrument Sans, board content does not", async ({ page }) => {
    await openCanvas(page);
    const chrome = await page.locator(".bn-toolbar-title").evaluate((el) => getComputedStyle(el).fontFamily);
    expect(chrome).toMatch(/^"?Instrument Sans/);
    const notch = await page.locator(".bn-notch .st-btn").first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(notch).toMatch(/^"?Instrument Sans/);
    const note = await page.locator(".bn-note").first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(note).not.toMatch(/Instrument Sans/);
  });

  test("shared canvas: read-only window and a dismissible Made with card", async ({ page }) => {
    await openShared(page);
    // One bar: a "View only" chip in the title bar, no banner, and the site's call to action at its end.
    await expect(page.getByTestId("view-only-banner")).toHaveCount(0);
    await expect(page.getByRole("banner").getByTestId("save-status")).toHaveText("View only");
    await expect(page.getByRole("banner").getByRole("link")).toHaveCount(1);
    await expect(page.getByRole("banner").getByRole("link", { name: "Add to Claude" })).toHaveAttribute("href", "/en/install");
    const card = page.getByRole("complementary", { name: /^About / });
    await expect(card).toContainText("Made with");
    await expect(card.getByRole("link", { name: "See how it works" })).toHaveAttribute("href", "/en");
    await shot(page, "canvas-shared-desktop");
    // Hidden while a board item has focus (SC 2.4.11).
    await page.locator(".react-flow__node").first().focus();
    await expect(card).toBeHidden();
    await page.locator(".bn-flow").focus();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Dismiss" }).click();
    await expect(card).toHaveCount(0);
    await expect(page.locator(".bn-flow")).toBeFocused();
  });

  test("inline canvas: no window chrome", async ({ page }) => {
    const frame = await openInline(page, 760);
    await expect(frame.getByTestId("window-lights")).toHaveCount(0);
    await expect(frame.locator(".bn-canvas[data-window]")).toHaveCount(0);
    await shot(page, "canvas-inline");
  });
});

test.describe("iPhone 13", () => {
  test.use(IPHONE_13);

  test("web canvas", async ({ page }) => {
    await openCanvas(page);
    // One row: the title bar is no taller than its controls, and More holds zoom, Upload, Share, help.
    const bar = (await page.locator(".bn-toolbar").boundingBox())!;
    expect(bar.height).toBeLessThan(60);
    await expect(page.getByRole("button", { name: "Share", exact: true })).toBeHidden();
    const more = page.getByRole("button", { name: "More" });
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Share", exact: true })).toBeVisible();
    await expect(page.getByTestId("zoom-value")).toBeVisible();
    await expect(page.getByRole("button", { name: "Keyboard shortcuts" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(more).toBeFocused();
    await shot(page, "canvas-editor-iphone13");
  });

  test("shared canvas", async ({ page }) => {
    await openShared(page);
    await shot(page, "canvas-shared-iphone13");
  });
});
