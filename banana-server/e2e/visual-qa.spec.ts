/**
 * Visual QA screenshots (plan Step 4). Not a gate: skipped unless VISUAL_QA=1.
 *
 *   VISUAL_QA=1 npx playwright test e2e/visual-qa.spec.ts --project=chromium
 *
 * Writes PNGs to ../docs/screenshots (see the README there): the seeded canvas, the share
 * dialog, the public site in English and Arabic, and the inline canvas in a fake MCP Apps
 * host, each in light and dark at 1440x900 and 390x844, plus /ar at 200% zoom.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { CANVAS_ASSET_PATH } from "../lib/mcp/resources/canvas-asset";
import { canvasCsp, fillCanvasHtml } from "../lib/mcp/resources/canvas";
import { mockSeedCanvas, SEED_CANVAS_ID, SEED_STATE } from "./support/seed-canvas";

test.skip(!process.env.VISUAL_QA, "visual QA screenshots run only with VISUAL_QA=1");

const OUT = fileURLToPath(new URL("../../docs/screenshots/", import.meta.url));
const THEMES = ["light", "dark"] as const;
const SIZES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;

async function shot(page: Page, name: string) {
  // Let fonts and the 220ms viewport animation settle, and hide the text caret.
  await page.evaluate(() => document.fonts.ready);
  // The Next dev tools badge is not part of the product.
  await page.addStyleTag({ content: "*, *::before, *::after { caret-color: transparent !important; } nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}${name}.png` });
}

async function openCanvas(page: Page) {
  await mockSeedCanvas(page);
  await page.goto(`/c/${SEED_CANVAS_ID}`);
  await expect(page.locator(".react-flow__node")).toHaveCount(SEED_STATE.nodes.length);
  await expect(page.locator('.react-flow__node[data-id="img3"] img')).toBeVisible();
}

// ---------------------------------------------------------------- inline canvas (fake host)

const APP_URL = "https://banana.example.com";
const HOST = "https://host.test/chat";
const SANDBOX = "https://sandbox.test/canvas.html";
const ASSETS_DIR = new URL("../public/mcp-app/assets/", import.meta.url);

function hostPage(theme: "light" | "dark", width: number, height: number): string {
  const result = {
    content: [{ type: "text", text: "Opened canvas." }],
    structuredContent: {
      canvas: { id: SEED_CANVAS_ID, title: "Cold checkout", webUrl: `${APP_URL}/c/${SEED_CANVAS_ID}`, brief: null, items: 10, sections: 1, tray: 3 },
      created: false,
    },
    _meta: { "banana/canvas": { state: SEED_STATE, updatedAt: "2026-10-15T12:00:00.000Z" } },
  };
  const bg = theme === "dark" ? "#1f1f1f" : "#f6f6f4";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake host</title>
<style>body{margin:0;padding:16px;background:${bg}}iframe{display:block;margin:0 auto;border:0;border-radius:12px}</style></head><body>
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
        hostContext: { theme: ${JSON.stringify(theme)}, displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"], platform: "web" } } });
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

async function openInline(page: Page, theme: "light" | "dark", viewportWidth: number) {
  const width = Math.min(viewportWidth - 32, 760);
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
  await page.route(HOST, (route) => route.fulfill({ status: 200, contentType: "text/html", body: hostPage(theme, width, 640) }));
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
  await expect(frame.locator('.react-flow__node[data-id="img3"] img')).toBeVisible();
}

// ---------------------------------------------------------------- shots

for (const [size, viewport] of Object.entries(SIZES)) {
  test.describe(`${size}`, () => {
    test.use({ viewport });
    for (const theme of THEMES) {
      test(`canvas ${theme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        await openCanvas(page);
        await shot(page, `canvas-${theme}-${size}`);
      });

      test(`share dialog ${theme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        await openCanvas(page);
        await page.getByRole("button", { name: "Share", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Create view link" }).click();
        await expect(dialog.getByRole("button", { name: "Copy link" })).toBeVisible();
        await shot(page, `share-dialog-${theme}-${size}`);
      });

      for (const [name, url] of [
        ["site-en", "/en"],
        ["site-ar", "/ar"],
        ["pricing-en", "/en/pricing"],
      ] as const) {
        test(`${name} ${theme}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.goto(url);
          await expect(page.locator(".site")).toBeVisible();
          await shot(page, `${name}-${theme}-${size}`);
        });
      }

      test(`inline canvas ${theme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        await openInline(page, theme, viewport.width);
        await shot(page, `inline-canvas-${theme}-${size}`);
      });
    }
  });
}

test.describe("Arabic at 200% zoom", () => {
  // Browser zoom at 200% on a 1440x900 window: half the CSS viewport at twice the pixel density.
  test.use({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });
  for (const theme of THEMES) {
    test(`site-ar 200% ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/ar");
      await expect(page.locator(".site")).toBeVisible();
      await shot(page, `site-ar-${theme}-zoom200`);
    });
  }
});
