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
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { CANVAS_HTML } from "../lib/mcp/resources/canvas-html.generated";
import { canvasCsp } from "../lib/mcp/resources/canvas";

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
    { id: "note1", type: "note", x: 0, y: 0, w: 220, h: 140, data: { text: "Make it feel cold", color: "yellow" } },
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
      tray: 0,
      updatedAt: T0,
      state: STATE,
    },
    created: false,
  },
};

/** CSP header a host would build from `_meta.ui.csp` (spec default plus our declared domains). */
function cspHeader(): string {
  const csp = canvasCsp();
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

function hostPage(openResult: unknown): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake host</title></head><body>
<script>
  const frame = () => document.getElementById("app");
  window.__calls = []; window.__links = []; window.__context = []; window.__conflict = null;
  let version = 0;
  const send = (msg) => frame().contentWindow.postMessage(msg, "*");
  function answer(params) {
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
        hostContext: { theme: "light", displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"], platform: "web" },
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
<iframe id="app" title="Moodboard canvas" sandbox="allow-scripts" src="${SANDBOX}" style="width:1200px;height:720px;border:0"></iframe>
</body></html>`;
}

type Call = { name: string; arguments: { canvasId: string; baseUpdatedAt?: string; state: typeof STATE } };

async function openInHost(page: Page, openResult: unknown = OPEN_RESULT): Promise<{ frame: FrameLocator; cspErrors: string[] }> {
  const cspErrors: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy/i.test(msg.text())) cspErrors.push(msg.text());
  });
  await page.route(HOST, (route) => route.fulfill({ status: 200, contentType: "text/html", body: hostPage(openResult) }));
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
  return { frame: page.frameLocator("#app"), cspErrors };
}

const node = (frame: FrameLocator, id: string) => frame.locator(`.react-flow__node[data-id="${id}"]`);
const calls = (page: Page) => page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls);

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
    await expect(frame.getByRole("alert")).toContainText("You have used your 3 free canvases.");
  });

  test("axe finds no serious or critical issues in the inline canvas @a11y", async ({ page }) => {
    const { frame } = await openInHost(page);
    await expect(frame.locator(".react-flow__node")).toHaveCount(3);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
  });
});
