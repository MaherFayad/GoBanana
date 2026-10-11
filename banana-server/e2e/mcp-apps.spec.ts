/**
 * Inline canvas (MCP Apps) in a fake host. The built `ui://banana/canvas` HTML runs in a
 * sandboxed iframe (`allow-scripts`, opaque origin) under a strict CSP made from the
 * resource's `_meta.ui.csp`, like Claude and ChatGPT serve it. The host side is a small
 * hand-written JSON-RPC peer that speaks the ext-apps postMessage protocol:
 * `ui/initialize`, `ui/notifications/tool-result`, `tools/call` (save_canvas_state),
 * `ui/open-link` and `ui/update-model-context`.
 *
 * No Next server is needed: everything is served with page.route. Image hosts are
 * mocked with a synthetic 1x1 PNG (allowed host) and an aborted request (link card).
 * UI fonts are served from APP_URL's static assets (public/mcp-app/assets, with the CORS
 * header public/_headers sends), the way the Worker serves them.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { CANVAS_ASSET_PATH } from "../lib/mcp/resources/canvas-asset";
import { canvasCsp, fillCanvasHtml } from "../lib/mcp/resources/canvas";

/** Our own origin (APP_URL): the view loads its UI fonts from here. */
const APP_URL = "https://banana.example.com";
/** The built view (`npm run build:ui`), as the `ui://banana/canvas` resource serves it. */
const CANVAS_HTML = fillCanvasHtml(
  readFileSync(fileURLToPath(new URL(`../public${CANVAS_ASSET_PATH}`, import.meta.url)), "utf8"),
  APP_URL,
);
const ASSETS_DIR = new URL("../public/mcp-app/assets/", import.meta.url);

const HOST = "https://host.test/chat";
const SANDBOX = "https://sandbox.test/canvas.html";
const CANVAS_ID = "c0ffee00-0000-4000-8000-000000000001";
const T0 = "2026-10-15T12:00:00.000Z";
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const STATE = {
  version: 1,
  viewport: { x: 40, y: 40, zoom: 1 },
  nodes: [
    // Already as tall as its text: a note that does not fit refits on load and auto-saves.
    { id: "note1", type: "note", x: 0, y: 0, w: 220, h: 64, data: { text: "Make it feel cold", color: "yellow" } },
    {
      id: "img-pin",
      type: "image",
      x: 260,
      y: 0,
      w: 280,
      h: 210,
      data: {
        imageUrl: "https://i.pinimg.com/736x/r1.jpg",
        thumbUrl: "https://i.pinimg.com/236x/r1.jpg",
        sourceUrl: "https://www.pinterest.com/pin/1/",
        sourceSite: "pinterest.com",
        title: "Frosted vinyl sleeve",
      },
    },
    {
      id: "img-broken",
      type: "image",
      x: 0,
      y: 240,
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
  ],
  tray: [],
};

const OPEN_RESULT = {
  content: [{ type: "text", text: `Opened canvas "Cold checkout" (id ${CANVAS_ID}).` }],
  structuredContent: {
    canvas: {
      id: CANVAS_ID,
      title: "Cold checkout",
      webUrl: `https://banana.example.com/c/${CANVAS_ID}`,
      brief: null,
      items: 3,
      sections: 0,
      tray: 0,
    },
    created: false,
  },
  // View only: the host hands result _meta to the view, not to the model.
  _meta: { "banana/canvas": { state: STATE, updatedAt: T0 } },
};

/** CSP header a host would build from `_meta.ui.csp` (spec default plus our declared domains). */
function cspHeader(): string {
  const csp = canvasCsp({ appUrl: APP_URL });
  const res = csp.resourceDomains.join(" ");
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' ${res}`,
    `style-src 'unsafe-inline' ${res}`,
    `img-src ${res}`,
    `font-src ${res}`,
    `connect-src ${csp.connectDomains.join(" ") || "'none'"}`,
    "frame-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

type HostOptions = { theme?: "light" | "dark"; width?: number };

function hostPage(openResult: unknown, { theme = "light", width = 1200 }: HostOptions = {}): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake host</title></head><body>
<script>
  const frame = () => document.getElementById("app");
  window.__calls = []; window.__links = []; window.__context = []; window.__conflict = null;
  let version = 0;
  const send = (msg) => frame().contentWindow.postMessage(msg, "*");
  function answer(params) {
    if (params.name === "load_canvas_state") {
      // window.__server stands in for a later save by an agent tool (add_to_canvas, search).
      const srv = window.__server || { state: ${JSON.stringify(STATE)}, updatedAt: ${JSON.stringify(T0)} };
      return { content: [{ type: "text", text: "Loaded." }], structuredContent: { ok: true, state: srv.state, updatedAt: srv.updatedAt, title: "Cold checkout", removed: 0 } };
    }
    if (params.name !== "save_canvas_state") {
      return { isError: true, content: [{ type: "text", text: "Unknown tool" }] };
    }
    if (window.__conflict) {
      const c = window.__conflict; window.__conflict = null;
      return { isError: true, content: [{ type: "text", text: "This canvas changed somewhere else since it was opened here." }],
        structuredContent: { ok: false, reason: "conflict", message: "changed", state: c.state, updatedAt: c.updatedAt, title: "Cold checkout" } };
    }
    version += 1;
    const updatedAt = new Date(Date.parse(${JSON.stringify(T0)}) + version * 1000).toISOString();
    return { content: [{ type: "text", text: "Saved at " + updatedAt + "." }], structuredContent: { ok: true, updatedAt } };
  }
  window.addEventListener("message", (e) => {
    if (!frame() || e.source !== frame().contentWindow) return;
    const m = e.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.method === "ui/initialize") {
      send({ jsonrpc: "2.0", id: m.id, result: {
        protocolVersion: m.params.protocolVersion,
        hostInfo: { name: "fake-host", version: "1.0.0" },
        hostCapabilities: { serverTools: {}, openLinks: {}, updateModelContext: { text: {} } },
        hostContext: { theme: ${JSON.stringify(theme)}, displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"], platform: "web" },
      } });
      return;
    }
    if (m.method === "ui/notifications/initialized") {
      send({ jsonrpc: "2.0", method: "ui/notifications/tool-input", params: { arguments: { canvasId: ${JSON.stringify(CANVAS_ID)} } } });
      send({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: ${JSON.stringify(openResult)} });
      return;
    }
    if (m.method === "tools/call") { window.__calls.push(m.params); send({ jsonrpc: "2.0", id: m.id, result: answer(m.params) }); return; }
    if (m.method === "ui/open-link") { window.__links.push(m.params.url); send({ jsonrpc: "2.0", id: m.id, result: {} }); return; }
    if (m.method === "ui/update-model-context") { window.__context.push(m.params); send({ jsonrpc: "2.0", id: m.id, result: {} }); return; }
    if (m.method === "ui/request-display-mode") { send({ jsonrpc: "2.0", id: m.id, result: { mode: m.params.mode } }); return; }
    if (m.id !== undefined && m.method) send({ jsonrpc: "2.0", id: m.id, result: {} });
  });
</script>
<iframe id="app" title="Moodboard canvas" sandbox="allow-scripts" src="${SANDBOX}" style="width:${width}px;height:720px;border:0"></iframe>
</body></html>`;
}

type Call = { name: string; arguments: { canvasId: string; baseUpdatedAt?: string; state: typeof STATE } };

async function openInHost(
  page: Page,
  openResult: unknown = OPEN_RESULT,
  options: HostOptions = {},
): Promise<{ frame: FrameLocator; cspErrors: string[]; fontRequests: string[] }> {
  const cspErrors: string[] = [];
  const fontRequests: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy/i.test(msg.text())) cspErrors.push(msg.text());
  });
  page.on("request", (req) => {
    if (req.resourceType() === "font" || /\.(woff2?|ttf|otf)(\?|$)/i.test(req.url()) || /fonts\.(googleapis|gstatic)\.com/.test(req.url())) {
      fontRequests.push(req.url());
    }
  });
  await page.route(HOST, (route) => route.fulfill({ status: 200, contentType: "text/html", body: hostPage(openResult, options) }));
  await page.route(`${APP_URL}/mcp-app/assets/*`, (route) => {
    const name = basename(new URL(route.request().url()).pathname);
    route.fulfill({
      status: 200,
      contentType: "font/woff2",
      headers: { "access-control-allow-origin": "*" },
      body: readFileSync(fileURLToPath(new URL(name, ASSETS_DIR))),
    });
  });
  await page.route(SANDBOX, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      headers: { "content-security-policy": cspHeader() },
      body: CANVAS_HTML,
    }),
  );
  await page.route(/^https:\/\/i\.pinimg\.com\//, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX }));
  await page.route(/^https:\/\/cdn\.dribbble\.com\//, (route) => route.abort("blockedbyclient"));
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort("blockedbyclient"));
  await page.goto(HOST);
  return { frame: page.frameLocator("#app"), cspErrors, fontRequests };
}

const node = (frame: FrameLocator, id: string) => frame.locator(`.react-flow__node[data-id="${id}"]`);
/** Every tools/call the view made, live-refresh polls included. */
const allCalls = (page: Page) => page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls);
/** Tool calls other than the live refresh's load_canvas_state polls. */
const calls = async (page: Page) => (await allCalls(page)).filter((c) => c.name !== "load_canvas_state");

async function position(locator: Locator): Promise<{ x: number; y: number }> {
  const t = await locator.evaluate((el) => (el as HTMLElement).style.transform);
  const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(t);
  if (!m) throw new Error(`no transform: ${t}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

test.describe("inline canvas in an MCP Apps host", () => {
  test("renders the open_canvas result under a strict CSP; allowlisted images load, others show link cards", async ({ page }) => {
    const { frame, cspErrors } = await openInHost(page);
    await expect(frame.locator(".react-flow__node")).toHaveCount(3);
    await expect(frame.getByText("Cold checkout").first()).toBeVisible();
    const pin = node(frame, "img-pin").locator("img");
    await expect(pin).toHaveAttribute("src", /^https:\/\/i\.pinimg\.com\//);
    await expect.poll(() => pin.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBe(1);
    const card = node(frame, "img-broken").getByTestId("link-card");
    await expect(card).toBeVisible();
    await expect(card.getByRole("link")).toHaveAttribute("href", "https://dribbble.com/shots/42-broken");
    expect(cspErrors).toEqual([]);
  });

  test("reads the board from result _meta without any extra tool call", async ({ page }) => {
    const { frame } = await openInHost(page);
    await expect(frame.locator(".react-flow__node")).toHaveCount(3);
    expect(await calls(page)).toEqual([]);
  });

  test("loads the board through load_canvas_state when the host drops result _meta", async ({ page }) => {
    const { _meta: _dropped, ...withoutMeta } = OPEN_RESULT;
    const { frame } = await openInHost(page, withoutMeta);
    await expect(frame.locator(".react-flow__node")).toHaveCount(3);
    const [load] = await allCalls(page);
    expect(load!.name).toBe("load_canvas_state");
    expect(load!.arguments.canvasId).toBe(CANVAS_ID);
    // Saves still carry the version the load returned.
    await node(frame, "note1").focus();
    await node(frame, "note1").press("ArrowRight");
    await expect.poll(async () => (await calls(page)).length, { timeout: 5_000 }).toBe(1);
    const save = (await calls(page))[0]!;
    expect(save.name).toBe("save_canvas_state");
    expect(save.arguments.baseUpdatedAt).toBe(T0);
  });

  test("auto-saves through save_canvas_state with the last version it saw", async ({ page }) => {
    const { frame } = await openInHost(page);
    const note = node(frame, "note1");
    await note.focus();
    const before = await position(note);
    await note.press("ArrowRight");
    await expect.poll(async () => (await calls(page)).length, { timeout: 5_000 }).toBe(1);
    const [first] = await calls(page);
    expect(first!.name).toBe("save_canvas_state");
    expect(first!.arguments.canvasId).toBe(CANVAS_ID);
    expect(first!.arguments.baseUpdatedAt).toBe(T0);
    const saved = first!.arguments.state.nodes.find((n) => n.id === "note1")!;
    expect(saved.x).toBe(before.x + 8);
    expect(JSON.stringify(first!.arguments.state)).not.toMatch(/data:image|base64/);

    await note.press("ArrowDown");
    await expect.poll(async () => (await calls(page)).length, { timeout: 5_000 }).toBe(2);
    const second = (await calls(page))[1]!;
    expect(second.arguments.baseUpdatedAt).toBe(new Date(Date.parse(T0) + 1000).toISOString());
    await expect(frame.getByTestId("save-status")).toHaveText(/All changes saved/);
    // The model hears that the canvas changed, so it calls get_canvas before describing it.
    const ctx = await page.evaluate(() => (window as unknown as { __context: { content: { text: string }[] }[] }).__context);
    expect(ctx.at(-1)!.content[0]!.text).toContain(CANVAS_ID);
  });

  test("a conflict offers load latest; saves continue from the newer version", async ({ page }) => {
    const { frame } = await openInHost(page);
    const LATEST = "2026-10-15T12:05:00.000Z";
    await page.evaluate(
      ([state, updatedAt]) => {
        (window as unknown as { __conflict: unknown }).__conflict = { state, updatedAt };
      },
      [{ ...STATE, nodes: [...STATE.nodes, { id: "note-agent", type: "note", x: 600, y: 0, w: 220, h: 140, data: { text: "Added by the agent", color: "blue" } }] }, LATEST] as const,
    );
    await node(frame, "note1").focus();
    await node(frame, "note1").press("ArrowRight");
    const banner = frame.getByRole("alert").filter({ hasText: "changed in chat or on the web" });
    await expect(banner).toBeVisible({ timeout: 5_000 });
    const load = banner.getByRole("button", { name: "Load the latest version" });
    await expect(load).toBeFocused();
    await load.press("Enter");
    await expect(banner).toHaveCount(0);
    await expect(node(frame, "note-agent")).toBeVisible();
    await expect(frame.locator(".react-flow__node")).toHaveCount(4);

    const n = (await calls(page)).length;
    await node(frame, "note-agent").focus();
    await node(frame, "note-agent").press("ArrowDown");
    await expect.poll(async () => (await calls(page)).length, { timeout: 5_000 }).toBe(n + 1);
    expect((await calls(page)).at(-1)!.arguments.baseUpdatedAt).toBe(LATEST);
  });

  test("a conflict can keep the user's version", async ({ page }) => {
    const { frame } = await openInHost(page);
    const LATEST = "2026-10-15T12:06:00.000Z";
    await page.evaluate(
      ([state, updatedAt]) => {
        (window as unknown as { __conflict: unknown }).__conflict = { state, updatedAt };
      },
      [{ ...STATE, nodes: [] }, LATEST] as const,
    );
    const note = node(frame, "note1");
    await note.focus();
    await note.press("ArrowRight");
    const banner = frame.getByRole("alert").filter({ hasText: "changed in chat or on the web" });
    await expect(banner).toBeVisible({ timeout: 5_000 });
    await banner.getByRole("button", { name: "Keep my version" }).click();
    await expect(banner).toHaveCount(0);
    const last = (await calls(page)).at(-1)!;
    expect(last.arguments.baseUpdatedAt).toBe(LATEST);
    expect(last.arguments.state.nodes.map((x) => x.id).sort()).toEqual(["img-broken", "img-pin", "note1"]);
    await expect(frame.locator(".react-flow__node")).toHaveCount(3);
  });

  test("source links open through the host", async ({ page }) => {
    const { frame } = await openInHost(page);
    await node(frame, "img-pin").getByRole("link", { name: /pinterest\.com/ }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __links: string[] }).__links))
      .toEqual(["https://www.pinterest.com/pin/1/"]);
    expect(page.context().pages()).toHaveLength(1);
  });

  test("a tool error shows the plain message", async ({ page }) => {
    const { frame } = await openInHost(page, {
      isError: true,
      content: [{ type: "text", text: "You have used your 3 free canvases. Upgrade: https://banana.example.com/en/pricing" }],
    });
    await expect(frame.getByRole("alert").filter({ hasText: "free canvases" })).toContainText("You have used your 3 free canvases.");
  });

  for (const theme of ["light", "dark"] as const) {
    test(`axe finds no issues in the inline canvas with the ${theme} host theme @a11y`, async ({ page }) => {
      const { frame } = await openInHost(page, OPEN_RESULT, { theme });
      await expect(frame.locator(".react-flow__node")).toHaveCount(3);
      // Dark only, whatever the host theme; on the document too, so portaled tooltips and toasts match.
      await expect(frame.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(frame.locator(".bn-inline")).toHaveAttribute("data-theme", "dark");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations, JSON.stringify(results.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
    });

    test(`axe is clean on the conflict choice with the ${theme} host theme @a11y`, async ({ page }) => {
      const { frame } = await openInHost(page, OPEN_RESULT, { theme });
      await page.evaluate((state) => {
        (window as unknown as { __conflict: unknown }).__conflict = { state, updatedAt: "2026-10-15T12:07:00.000Z" };
      }, STATE);
      await node(frame, "note1").focus();
      await node(frame, "note1").press("ArrowRight");
      await expect(frame.getByRole("alert").filter({ hasText: "changed in chat or on the web" })).toBeVisible({ timeout: 5_000 });
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations, JSON.stringify(results.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
    });
  }

  test("UI fonts load from the app origin only, never from a third-party host", async ({ page }) => {
    const { frame, fontRequests, cspErrors } = await openInHost(page);
    await expect(frame.locator(".react-flow__node")).toHaveCount(3);
    const view = page.frames().find((f) => f.url() === SANDBOX)!;
    // Inter is in use and loaded (not the system fallback).
    await expect
      .poll(() => view.evaluate(() => document.fonts.ready.then(() => document.fonts.check('600 16px "Inter Variable"'))))
      .toBe(true);
    expect(fontRequests.length).toBeGreaterThan(0);
    for (const url of fontRequests) expect(url.startsWith(`${APP_URL}/mcp-app/assets/`), url).toBe(true);
    // Fonts are separate files, never inlined into the HTML.
    expect(CANVAS_HTML).not.toMatch(/data:font|font\/woff2;base64|application\/font-woff/);
    expect(cspErrors).toEqual([]);
  });

  test("the results panel starts collapsed inline, with the count on its toggle", async ({ page }) => {
    const { frame } = await openInHost(page);
    await expect(frame.locator(".react-flow__node")).toHaveCount(3);
    const toggle = frame.getByRole("button", { name: /^Search results, \d+ waiting$/ });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(frame.getByRole("heading", { name: "Search results" })).toHaveCount(0);
  });

  test("a change saved on the server shows up without a reload, and new results do not open the panel", async ({ page }) => {
    const { frame } = await openInHost(page);
    await expect(frame.locator(".react-flow__node")).toHaveCount(3);
    const later = new Date(Date.parse(T0) + 3_600_000).toISOString();
    const added = { id: "note-agent", type: "note", x: 0, y: 300, w: 220, h: 64, data: { text: "Added by the agent", color: "blue" } };
    const result = {
      id: "r9",
      thumbUrl: "https://i.pinimg.com/236x/r9.jpg",
      imageUrl: "https://i.pinimg.com/736x/r9.jpg",
      sourceUrl: "https://www.pinterest.com/pin/9/",
      sourceSite: "pinterest.com",
      title: "Fresh result",
    };
    await page.evaluate(
      ({ state, updatedAt }) => {
        (window as unknown as { __server: unknown }).__server = { state, updatedAt };
      },
      { state: { ...STATE, nodes: [...STATE.nodes, added], tray: [result] }, updatedAt: later },
    );
    // Polls every 4 s with focus and 15 s without; no reload, no new open_canvas result.
    await expect(node(frame, "note-agent")).toBeVisible({ timeout: 20_000 });
    await expect(frame.locator(".react-flow__node")).toHaveCount(4);
    const toggle = frame.getByRole("button", { name: /^Search results, 1 waiting$/ });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(frame.locator(".bn-rail-count")).toHaveAttribute("data-pulse", "");
    await expect(frame.getByText("1 new result", { exact: false })).toHaveCount(1);
    // Later saves build on the version that was applied: no conflict.
    await node(frame, "note1").focus();
    await node(frame, "note1").press("ArrowRight");
    await expect.poll(async () => (await calls(page)).at(-1)?.arguments.baseUpdatedAt, { timeout: 5_000 }).toBe(later);
  });

  test("a narrow frame switches the view to compact", async ({ page }) => {
    const { frame } = await openInHost(page, OPEN_RESULT, { width: 600 });
    await expect(frame.locator(".react-flow__node")).toHaveCount(3);
    await expect(frame.locator(".bn-inline")).toHaveAttribute("data-compact", "");
    await expect(frame.getByRole("link", { name: "Open on the web" })).toBeVisible();
    // CanvasApp compact: the results panel starts closed behind a "Results (N)" toggle.
    const results = frame.getByRole("button", { name: /^Results \(\d+\)$/ });
    await expect(results).toBeVisible();
    await expect(results).toHaveAttribute("aria-pressed", "false");
  });
});
