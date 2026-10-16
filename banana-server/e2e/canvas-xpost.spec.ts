/**
 * X post tiles (DECISIONS.md 2026-10-16, X post embeds).
 *
 * Web canvas: X's official embed, loaded lazily, with the link card as the fallback. X's widget
 * script is mocked with page.route (a stand-in that draws a box the way widgets.js would), so no
 * live call to X is made; a blocked script shows the card with the author, the text and
 * "Open on X".
 *
 * Inline canvas (MCP Apps): the built view in a sandboxed iframe under the CSP made from our
 * `_meta.ui.csp` (no frame-src, no X hosts). The post is a link card with the author and
 * "Open on X", never the post text, and the view sends no request to any X host.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CANVAS_ASSET_PATH } from "../lib/mcp/resources/canvas-asset";
import { canvasCsp, fillCanvasHtml } from "../lib/mcp/resources/canvas";

const CANVAS_ID = "e2e-xpost";
const POST = "https://x.com/jack/status/20";
const TEXT = "just setting up my twttr";
const X_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(twitter\.com|x\.com|twimg\.com)\//;

const xNode = {
  id: "xp1",
  type: "xpost",
  x: 0,
  y: 0,
  w: 340,
  h: 420,
  data: { sourceUrl: POST, sourceSite: "x.com", postId: "20", authorName: "jack", authorHandle: "jack", text: TEXT, note: "steal: the plain first line", tag: null },
};
const STATE = { version: 1, viewport: { x: 40, y: 60, zoom: 1 }, nodes: [xNode], tray: [] };

/** Stands in for platform.twitter.com/widgets.js: draws a box for the post, like X's iframe would. */
const FAKE_WIDGETS = `window.twttr = { widgets: { createTweet: function (id, el) {
  var d = document.createElement("div"); d.setAttribute("data-testid", "fake-tweet"); d.textContent = "X embed of post " + id;
  d.style.height = "300px"; el.appendChild(d); return Promise.resolve(d); } } };`;

async function openWeb(page: Page, widgets: "ok" | "blocked") {
  const xRequests: string[] = [];
  page.on("request", (r) => {
    if (X_HOSTS.test(r.url())) xRequests.push(r.url());
  });
  await page.route(`**/api/canvas/${CANVAS_ID}`, async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state: STATE, updatedAt: "2026-10-16T10:00:00.000Z" }) });
  });
  await page.route(X_HOSTS, (route) =>
    widgets === "ok" && route.request().url() === "https://platform.twitter.com/widgets.js"
      ? route.fulfill({ status: 200, contentType: "text/javascript", body: FAKE_WIDGETS })
      : route.abort("blockedbyclient"),
  );
  await page.goto(`/c/${CANVAS_ID}`);
  await expect(page.locator('.react-flow__node[data-id="xp1"]')).toBeVisible();
  return { xRequests, tile: page.locator('.react-flow__node[data-id="xp1"]') };
}

test.describe("X post on the web canvas", () => {
  test("shows X's embed once the tile is on screen, with the source chip and the note", async ({ page }) => {
    const { tile, xRequests } = await openWeb(page, "ok");
    await expect(tile.getByTestId("fake-tweet")).toHaveText("X embed of post 20");
    await expect(tile.getByTestId("x-card")).toHaveCount(0);
    await expect(tile.locator(".bn-source")).toHaveAttribute("href", POST);
    await expect(tile.getByText("steal: the plain first line")).toBeVisible();
    await expect(tile.getByTestId("x-chip")).toBeVisible();
    // Only X's widget script, loaded once; nothing else from X by us.
    expect(xRequests).toEqual(["https://platform.twitter.com/widgets.js"]);
  });

  test("keeps the link card with author, text and Open on X when X cannot load, and is axe clean", async ({ page }) => {
    const { tile } = await openWeb(page, "blocked");
    const card = tile.getByTestId("x-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("jack");
    await expect(card).toContainText("@jack");
    await expect(card).toContainText(TEXT);
    await expect(card.getByRole("link", { name: /Open on X/ })).toHaveAttribute("href", POST);
    await expect(card).toContainText("The post could not load here.");
    const results = await new AxeBuilder({ page }).include('.react-flow__node[data-id="xp1"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
  });

  test("is noted and marked from the keyboard like any reference", async ({ page }) => {
    const { tile } = await openWeb(page, "blocked");
    await tile.focus();
    await expect(tile).toHaveAttribute("aria-label", /X post by jack \(@jack\)/);
    await page.keyboard.press("m");
    await page.getByRole("menuitem", { name: "Mark as Ship" }).click();
    await expect(tile.locator('[data-tag="ship"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------- inline (MCP Apps)

const APP_URL = "https://banana.example.com";
const HOST = "https://host.test/chat";
const SANDBOX = "https://sandbox.test/canvas.html";
const INLINE_ID = "c0ffee00-0000-4000-8000-0000000000aa";
const CANVAS_HTML = fillCanvasHtml(readFileSync(fileURLToPath(new URL(`../public${CANVAS_ASSET_PATH}`, import.meta.url)), "utf8"), APP_URL);

/** The CSP a host builds from our `_meta.ui.csp`: no frameDomains, so frame-src 'none'. */
function cspHeader(): string {
  const csp = canvasCsp({ appUrl: APP_URL });
  const res = csp.resourceDomains.join(" ");
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' ${res}`,
    `style-src 'unsafe-inline' ${res}`,
    `img-src ${res}`,
    `font-src ${res}`,
    "connect-src 'none'",
    "frame-src 'none'",
  ].join("; ");
}

const OPEN_RESULT = {
  content: [{ type: "text", text: "Opened." }],
  structuredContent: { canvas: { id: INLINE_ID, title: "X board", webUrl: `${APP_URL}/c/${INLINE_ID}`, brief: null, items: 1, sections: 0, tray: 0 }, created: false },
  _meta: { "banana/canvas": { state: STATE, updatedAt: "2026-10-16T10:00:00.000Z" } },
};

function hostPage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake host</title></head><body><script>
  const frame = () => document.getElementById("app");
  const send = (msg) => frame().contentWindow.postMessage(msg, "*");
  window.addEventListener("message", (e) => {
    if (!frame() || e.source !== frame().contentWindow) return;
    const m = e.data; if (!m || m.jsonrpc !== "2.0") return;
    if (m.method === "ui/initialize") {
      send({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: m.params.protocolVersion, hostInfo: { name: "fake-host", version: "1.0.0" },
        hostCapabilities: { serverTools: {}, openLinks: {} }, hostContext: { theme: "light", displayMode: "inline", platform: "web" } } });
      return;
    }
    if (m.method === "ui/notifications/initialized") {
      send({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: ${JSON.stringify(OPEN_RESULT)} });
      return;
    }
    if (m.method === "tools/call") { send({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: "ok" }], structuredContent: { ok: true, updatedAt: new Date().toISOString() } } }); return; }
    if (m.id !== undefined && m.method) send({ jsonrpc: "2.0", id: m.id, result: {} });
  });
</script><iframe id="app" title="Moodboard canvas" sandbox="allow-scripts" src="${SANDBOX}" style="width:1200px;height:720px;border:0"></iframe></body></html>`;
}

test.describe("X post in the inline canvas (MCP Apps)", () => {
  test("is a link card with the author and Open on X, no post text and no request to X", async ({ page }) => {
    const xRequests: string[] = [];
    const cspErrors: string[] = [];
    page.on("request", (r) => {
      if (X_HOSTS.test(r.url())) xRequests.push(r.url());
    });
    page.on("console", (msg) => {
      if (/Content Security Policy/i.test(msg.text())) cspErrors.push(msg.text());
    });
    await page.route(HOST, (route) => route.fulfill({ status: 200, contentType: "text/html", body: hostPage() }));
    await page.route(SANDBOX, (route) => route.fulfill({ status: 200, contentType: "text/html", headers: { "content-security-policy": cspHeader() }, body: CANVAS_HTML }));
    await page.route(`${APP_URL}/**`, (route) => route.abort("blockedbyclient"));
    await page.route(X_HOSTS, (route) => route.abort("blockedbyclient"));
    await page.goto(HOST);
    const frame = page.frameLocator("#app");
    const tile = frame.locator('.react-flow__node[data-id="xp1"]');
    const card = tile.getByTestId("x-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("@jack");
    await expect(card.getByRole("link", { name: /Open on X/ })).toHaveAttribute("href", POST);
    await expect(tile).not.toContainText(TEXT);
    await expect(tile.getByTestId("x-embed")).toHaveCount(0);
    // Our CSP declares no X host and no frame host.
    const csp = canvasCsp({ appUrl: APP_URL }) as { resourceDomains: string[]; frameDomains?: string[] };
    expect(csp.resourceDomains.some((d) => /twitter|x\.com|twimg/.test(d))).toBe(false);
    expect(csp.frameDomains ?? []).toEqual([]);
    await page.waitForTimeout(500);
    expect(xRequests).toEqual([]);
    expect(cspErrors).toEqual([]);
  });
});
