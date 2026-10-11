/**
 * Inline canvas (MCP Apps, spec sections 9 and 13):
 * - the `ui://banana/canvas` resource lists and reads with the MCP Apps mime type and CSP,
 * - its HTML is self-contained (no external script or stylesheet),
 * - open_canvas declares the UI and returns what the inline app needs,
 * - save_canvas_state is app-only and enforces ownership, size, embedded bytes and conflicts,
 * - the bridge persistence drives that tool end to end with in-memory repos.
 */
import { describe, expect, it, vi } from "vitest";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { buildAuthedMcpHandler } from "@/app/api/[transport]/handler";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appOrigin,
  canvasCsp,
  CANVAS_UI_URI,
  fillCanvasHtml,
  FONT_DOMAINS,
  loadCanvasHtml,
  RESOURCE_MIME_TYPE,
  setCanvasHtmlLoader,
} from "@/lib/mcp/resources/canvas";
import { APP_ORIGIN_PLACEHOLDER, CANVAS_ASSET_PATH } from "@/lib/mcp/resources/canvas-asset";
import { createOpenCanvasTool, inputSchema as openInput, VIEW_META_KEY } from "@/lib/mcp/tools/open_canvas";
import { createLoadCanvasStateTool, TOOL_DESCRIPTION as LOAD_DESC } from "@/lib/mcp/tools/load_canvas_state";
import { lenient } from "@/lib/mcp/tools/types";
import type { RegisterTool } from "@/lib/mcp/tools/types";
import {
  CONFLICT_MESSAGE,
  createSaveCanvasStateTool,
  TOOL_DESCRIPTION as SAVE_DESC,
  type SaveCanvasOutput,
} from "@/lib/mcp/tools/save_canvas_state";
import {
  ConflictError,
  createBridgePersistence,
  LOAD_TOOL,
  readOpenCanvasResult,
  SAVE_TOOL,
  VIEW_META_KEY as BRIDGE_META_KEY,
  type ToolCaller,
} from "@/canvas/persistence-bridge";
import { DEFAULT_IMAGE_HOSTS } from "@/lib/sources/allowlist";
import type { CanvasState } from "@/canvas/types";
import { ALICE, BOB, imageNode, makeDeps, seedCanvas, state, text } from "./tools-fixtures";

/** The built view (`npm run build:ui`, checked in), served as a static asset in production. */
const CANVAS_HTML = readFileSync(join(process.cwd(), "public", CANVAS_ASSET_PATH), "utf8");

// ---------------------------------------------------------------------------- MCP wire

const ORIGIN = "https://banana.example.com";
const verifyToken = async (_req: Request, token?: string): Promise<AuthInfo | undefined> =>
  token === "good"
    ? { token, clientId: "client", scopes: [], extra: { workosId: "user_01", userId: ALICE, email: "a@example.com" } }
    : undefined;
const mcp = buildAuthedMcpHandler({ verifyToken, publicOrigin: () => ORIGIN });

async function rpc(method: string, params?: unknown): Promise<Record<string, unknown>> {
  const res = await mcp(
    new Request(`${ORIGIN}/api/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
        authorization: "Bearer good",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) }),
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.text();
  const line = body.trim().startsWith("{") ? body : body.split("\n").find((l) => l.startsWith("data:"))!.slice(5);
  const msg = JSON.parse(line) as { result?: Record<string, unknown>; error?: unknown };
  expect(msg.error).toBeUndefined();
  return msg.result!;
}

type UiMeta = { ui?: { csp?: { resourceDomains?: string[]; connectDomains?: string[] }; prefersBorder?: boolean } };

describe("ui://banana/canvas resource", () => {
  it("is listed with the MCP Apps mime type and a CSP built from the image allowlist", async () => {
    const result = await rpc("resources/list");
    const resources = result.resources as { uri: string; mimeType?: string; _meta?: UiMeta }[];
    const canvas = resources.find((r) => r.uri === CANVAS_UI_URI);
    expect(canvas).toBeDefined();
    expect(RESOURCE_MIME_TYPE).toBe("text/html;profile=mcp-app");
    expect(canvas!.mimeType).toBe(RESOURCE_MIME_TYPE);
    const csp = canvas!._meta?.ui?.csp;
    for (const host of DEFAULT_IMAGE_HOSTS) expect(csp?.resourceDomains).toContain(`https://${host}`);
    for (const font of FONT_DOMAINS) expect(csp?.resourceDomains).toContain(font);
    expect(csp?.connectDomains ?? []).toEqual([]);
  });

  it("reads as one self-contained HTML file with the CSP on the content item", async () => {
    const result = await rpc("resources/read", { uri: CANVAS_UI_URI });
    const [item, ...rest] = result.contents as { uri: string; mimeType: string; text: string; _meta?: UiMeta }[];
    expect(rest).toHaveLength(0);
    expect(item!.uri).toBe(CANVAS_UI_URI);
    expect(item!.mimeType).toBe(RESOURCE_MIME_TYPE);
    const html = item!.text;
    // As built, with APP_URL's origin filled into the font URLs.
    expect(html).toBe(fillCanvasHtml(CANVAS_HTML));
    expect(html).not.toContain(APP_ORIGIN_PLACEHOLDER);
    expect(html.length).toBeGreaterThan(10_000);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<div id="root">');
    // No external scripts or stylesheets: everything is inlined.
    expect(html).not.toMatch(/<script[^>]+\bsrc\s*=/i);
    expect(html).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
    expect(html).toMatch(/<script type="module"[^>]*>[\s\S]{1000,}/);
    // Images are never embedded as bytes.
    expect(html).not.toMatch(/src=["']data:image/i);
    expect(item!._meta?.ui?.csp?.resourceDomains).toContain("https://i.pinimg.com");
    expect(item!._meta?.ui?.prefersBorder).toBe(true);
  });

  it("builds the CSP from IMAGE_HOST_ALLOWLIST", () => {
    const csp = canvasCsp({ imageHostAllowlist: "i.pinimg.com, *.example-cdn.com", appUrl: "" });
    expect(csp.resourceDomains).toEqual(["https://i.pinimg.com", "https://*.example-cdn.com", ...FONT_DOMAINS]);
    expect(csp.connectDomains).toEqual([]);
  });

  it("allows our own origin (APP_URL) for the view's font files", () => {
    const csp = canvasCsp({ imageHostAllowlist: "i.pinimg.com", appUrl: "https://banana.example.com/some/path/" });
    expect(csp.resourceDomains).toEqual(["https://i.pinimg.com", ...FONT_DOMAINS, "https://banana.example.com"]);
    expect(appOrigin("https://banana-server.<your-subdomain>.workers.dev")).toBeUndefined();
    expect(appOrigin("ftp://example.com")).toBeUndefined();
    expect(appOrigin(undefined)).toBeUndefined();
  });

  it("fills the app origin into font URLs and leaves other HTML alone", () => {
    const css = `@font-face{src:url(${APP_ORIGIN_PLACEHOLDER}/mcp-app/assets/inter.woff2)}`;
    expect(fillCanvasHtml(css, "https://banana.example.com/")).toBe("@font-face{src:url(https://banana.example.com/mcp-app/assets/inter.woff2)}");
    // The built view loads its UI fonts from our origin, as separate files (never inlined).
    const filled = fillCanvasHtml(CANVAS_HTML, "https://banana.example.com");
    expect(filled).toBe(CANVAS_HTML.replaceAll(APP_ORIGIN_PLACEHOLDER, "https://banana.example.com"));
    const fontUrls = [...new Set(filled.match(/https:\/\/banana\.example\.com\/[^)"'\s]+/g) ?? [])];
    expect(fontUrls.length).toBeGreaterThan(0);
    for (const url of fontUrls) expect(url).toMatch(/^https:\/\/banana\.example\.com\/mcp-app\/assets\/[\w.-]+\.woff2$/);
    expect(CANVAS_HTML).not.toMatch(/data:font|font\/woff2;base64/);
  });

  it("serves the HTML from an injected loader, caches it and retries after a failure", async () => {
    let calls = 0;
    setCanvasHtmlLoader(async () => {
      calls += 1;
      if (calls === 1) throw new Error("asset down");
      return "<!doctype html><div id=\"root\"></div>";
    });
    try {
      await expect(loadCanvasHtml()).rejects.toThrow("asset down");
      expect(await loadCanvasHtml()).toBe("<!doctype html><div id=\"root\"></div>");
      expect(await loadCanvasHtml()).toBe("<!doctype html><div id=\"root\"></div>");
      expect(calls).toBe(2);
      const result = await rpc("resources/read", { uri: CANVAS_UI_URI });
      expect((result.contents as { text: string }[])[0]!.text).toBe("<!doctype html><div id=\"root\"></div>");
    } finally {
      setCanvasHtmlLoader(null);
    }
  });
});

describe("tool listing", () => {
  it("open_canvas points at the canvas UI; save_canvas_state and load_canvas_state are app-only", async () => {
    const result = await rpc("tools/list");
    const tools = result.tools as { name: string; _meta?: Record<string, unknown>; inputSchema: { required?: string[] } }[];
    const open = tools.find((t) => t.name === "open_canvas")!;
    expect(open._meta).toMatchObject({ ui: { resourceUri: "ui://banana/canvas" }, "ui/resourceUri": "ui://banana/canvas" });
    const save = tools.find((t) => t.name === SAVE_TOOL)!;
    expect(save._meta).toEqual({ ui: { visibility: ["app"] } });
    expect(save.inputSchema.required?.sort()).toEqual(["canvasId", "state"]);
    const load = tools.find((t) => t.name === LOAD_TOOL)!;
    expect(load._meta).toEqual({ ui: { visibility: ["app"] } });
    expect(load.inputSchema.required).toEqual(["canvasId"]);
    for (const d of [SAVE_DESC, LOAD_DESC]) expect(d).not.toMatch(/[\u2014\u2013]/);
  });
});

// ---------------------------------------------------------------------------- tools

const ok = (r: { structuredContent?: Record<string, unknown> }) => r.structuredContent as SaveCanvasOutput;

describe("open_canvas result for the inline app", () => {
  it("keeps the board out of structuredContent and puts it in the result _meta for the view", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_a", 1)]));
    const res = await createOpenCanvasTool(deps)({ canvasId: c.id }, ALICE);
    expect(BRIDGE_META_KEY).toBe(VIEW_META_KEY);
    // What the model may see: small and without the board.
    expect(res.structuredContent).toEqual({
      canvas: { id: c.id, title: "Board", webUrl: `https://app.example.test/c/${c.id}`, brief: "flight checkout screen", items: 1, sections: 0, tray: 0 },
      created: false,
    });
    expect(JSON.stringify(res.structuredContent)).not.toContain("img_a");
    expect(JSON.stringify(res.content)).not.toContain("img_a");
    expect(res._meta?.[VIEW_META_KEY]).toMatchObject({ updatedAt: c.updatedAt.toISOString() });
    const read = readOpenCanvasResult(res);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.canvas.id).toBe(c.id);
    expect(read.canvas.updatedAt).toBe(c.updatedAt.toISOString());
    expect((read.canvas.state as CanvasState).nodes.map((n) => n.id)).toEqual(["img_a"]);
    expect(read.canvas.webUrl).toContain(`/c/${c.id}`);

    const created = readOpenCanvasResult(await createOpenCanvasTool(deps)({ title: "New" }, ALICE));
    expect(created.ok && (created.canvas.state as CanvasState).nodes).toEqual([]);
    expect(created.ok && created.canvas.updatedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it("keeps result _meta on the wire (tools/call through the real MCP handler)", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_a", 1)]));
    const open = createOpenCanvasTool(deps);
    const registerTest: RegisterTool = (server) => {
      server.registerTool("open_canvas", { description: "test", inputSchema: lenient(openInput) }, async (args) => open(args, ALICE));
    };
    const h = buildAuthedMcpHandler({ verifyToken, tools: [registerTest] });
    const res = await h(
      new Request(`${ORIGIN}/api/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-06-18",
          authorization: "Bearer good",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "open_canvas", arguments: { canvasId: c.id } } }),
      }),
    );
    const body = await res.text();
    const line = body.trim().startsWith("{") ? body : body.split("\n").find((l) => l.startsWith("data:"))!.slice(5);
    const result = (JSON.parse(line) as { result: { _meta?: Record<string, { state: CanvasState }> } }).result;
    expect(result._meta?.[VIEW_META_KEY]?.state.nodes.map((n) => n.id)).toEqual(["img_a"]);
  });

  it("reads a result without _meta as 'board not delivered'", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_a", 1)]));
    const { _meta: _dropped, ...stripped } = await createOpenCanvasTool(deps)({ canvasId: c.id }, ALICE);
    const read = readOpenCanvasResult(stripped);
    expect(read).toEqual({ ok: true, canvas: { id: c.id, title: "Board", webUrl: `https://app.example.test/c/${c.id}` } });
  });

  it("passes a tool error through as a plain message", () => {
    const read = readOpenCanvasResult({ isError: true, content: [{ type: "text", text: "You have used your 3 free canvases." }] });
    expect(read).toEqual({ ok: false, message: "You have used your 3 free canvases." });
  });
});

describe("save_canvas_state", () => {
  async function setup() {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_a", 1)]));
    return { deps, repos, c, save: createSaveCanvasStateTool(deps) };
  }

  it("saves the owner's state and returns the new version", async () => {
    const { repos, c, save } = await setup();
    const next = state([imageNode("img_a", 1, { x: 40 }), imageNode("img_b", 2, { x: 400 })]);
    const res = await save({ canvasId: c.id, state: next, baseUpdatedAt: c.updatedAt.toISOString() }, ALICE);
    expect(res.isError).toBeFalsy();
    const out = ok(res);
    expect(out.ok).toBe(true);
    const row = await repos.canvases.getOwned(ALICE, c.id);
    expect((row!.state as CanvasState).nodes.map((n) => n.id)).toEqual(["img_a", "img_b"]);
    expect(out.ok && out.updatedAt).toBe(row!.updatedAt.toISOString());
  });

  it("does not save to another user's canvas and answers like a missing one", async () => {
    const { repos, c, save } = await setup();
    const res = await save({ canvasId: c.id, state: state() }, BOB);
    expect(res.isError).toBe(true);
    expect(ok(res)).toMatchObject({ ok: false, reason: "not_found" });
    const missing = await save({ canvasId: "00000000-0000-4000-8000-000000000000", state: state() }, ALICE);
    expect(text(missing)).toBe(text(res));
    expect(((await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState).nodes).toHaveLength(1);
  });

  it("needs a signed-in user", async () => {
    const { c, save } = await setup();
    expect(ok(await save({ canvasId: c.id, state: state() }, undefined))).toMatchObject({ ok: false, reason: "signed_out" });
  });

  it("refuses embedded image bytes anywhere in the state", async () => {
    const { repos, c, save } = await setup();
    const bad = state([imageNode("img_a", 1)]);
    (bad.nodes[0]!.data as { thumbUrl: string }).thumbUrl = "data:image/png;base64,iVBORw0KGgo=";
    const res = await save({ canvasId: c.id, state: bad }, ALICE);
    expect(ok(res)).toMatchObject({ ok: false, reason: "invalid" });
    expect(text(res)).toContain("Images must be links");
    const blob = await save({ canvasId: c.id, state: { ...state(), extra: ["blob:https://x/1"] } }, ALICE);
    expect(ok(blob)).toMatchObject({ ok: false, reason: "invalid" });
    expect(((await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState).nodes[0]!.data).not.toMatchObject({
      thumbUrl: expect.stringMatching(/^data:/),
    });
  });

  it("refuses state over the size cap", async () => {
    const { c, save } = await setup();
    const big = state(
      Array.from({ length: 1500 }, (_, i) =>
        imageNode(`img_${i}`, i, { data: { ...imageNode("x", i).data, title: "x".repeat(800) } } as never),
      ),
    );
    const res = await save({ canvasId: c.id, state: big }, ALICE);
    expect(ok(res)).toMatchObject({ ok: false, reason: "too_large" });
  });

  it("refuses bad input with a plain message", async () => {
    const { c, save } = await setup();
    expect(ok(await save({ canvasId: c.id }, ALICE))).toMatchObject({ ok: false, reason: "invalid" });
    expect(ok(await save({ canvasId: c.id, state: { nodes: "no" } }, ALICE))).toMatchObject({ ok: false, reason: "invalid" });
    expect(ok(await save({ canvasId: "../../x", state: state() }, ALICE))).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("answers a stale baseUpdatedAt with a conflict and the latest state", async () => {
    const { repos, c, save } = await setup();
    // Someone else (an agent tool or the web canvas) saved after the inline canvas opened.
    await repos.canvases.saveState(ALICE, c.id, state([imageNode("img_a", 1), imageNode("img_agent", 3)]));
    const res = await save({ canvasId: c.id, state: state(), baseUpdatedAt: c.updatedAt.toISOString() }, ALICE);
    expect(res.isError).toBe(true);
    const out = ok(res);
    expect(out).toMatchObject({ ok: false, reason: "conflict", message: CONFLICT_MESSAGE, title: "Board" });
    if (out.ok || out.reason !== "conflict") return;
    expect(out.state.nodes.map((n) => n.id)).toEqual(["img_a", "img_agent"]);
    const row = await repos.canvases.getOwned(ALICE, c.id);
    expect(out.updatedAt).toBe(row!.updatedAt.toISOString());
    expect((row!.state as CanvasState).nodes).toHaveLength(2);
  });

  it("hides taken down items in the conflict state", async () => {
    const { deps, repos } = makeDeps({ takedowns: ["https://www.pinterest.com/pin/3/"] });
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_a", 1)]));
    await repos.canvases.saveState(ALICE, c.id, state([imageNode("img_a", 1), imageNode("img_gone", 3)]));
    const out = ok(await createSaveCanvasStateTool(deps)({ canvasId: c.id, state: state(), baseUpdatedAt: c.updatedAt.toISOString() }, ALICE));
    expect(out.ok === false && out.reason === "conflict" && out.state.nodes.map((n) => n.id)).toEqual(["img_a"]);
  });
});

describe("load_canvas_state", () => {
  it("loads the owner's board with the takedown filter and refuses other users", async () => {
    const { deps, repos } = makeDeps({ takedowns: ["https://www.pinterest.com/pin/3/"] });
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_a", 1), imageNode("img_gone", 3)]));
    const load = createLoadCanvasStateTool(deps);
    const res = await load({ canvasId: c.id }, ALICE);
    expect(res.isError).toBeFalsy();
    const out = res.structuredContent as { ok: true; state: CanvasState; updatedAt: string; removed: number };
    expect(out.state.nodes.map((n) => n.id)).toEqual(["img_a"]);
    expect(out.removed).toBe(1);
    expect(out.updatedAt).toBe(c.updatedAt.toISOString());

    const bob = await load({ canvasId: c.id }, BOB);
    expect(bob.isError).toBe(true);
    expect(bob.structuredContent).toMatchObject({ ok: false, reason: "not_found" });
    expect(JSON.stringify(bob)).not.toContain("img_a");
    expect((await load({ canvasId: c.id }, undefined)).structuredContent).toMatchObject({ reason: "signed_out" });
    expect((await load({}, ALICE)).structuredContent).toMatchObject({ reason: "invalid" });
  });
});

// ---------------------------------------------------------------------------- bridge

describe("bridge persistence over save_canvas_state", () => {
  async function setup() {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_a", 1)]));
    const tool = createSaveCanvasStateTool(deps);
    const load = createLoadCanvasStateTool(deps);
    const calls: { name: string; arguments?: Record<string, unknown> }[] = [];
    const app: ToolCaller = {
      async callServerTool(params) {
        calls.push(params);
        if (params.name === LOAD_TOOL) return load(params.arguments, ALICE);
        if (params.name !== SAVE_TOOL) throw new Error(`unexpected tool ${params.name}`);
        return tool(params.arguments, ALICE);
      },
    };
    const opened = readOpenCanvasResult(await createOpenCanvasTool(deps)({ canvasId: c.id }, ALICE));
    if (!opened.ok) throw new Error("open failed");
    const onConflict = vi.fn();
    const p = createBridgePersistence({
      app,
      canvasId: c.id,
      initialState: opened.canvas.state,
      updatedAt: opened.canvas.updatedAt,
      onConflict,
    });
    return { repos, c, p, calls, onConflict, app };
  }

  const nodesOf = async (repos: ReturnType<typeof makeDeps>["repos"], id: string) =>
    ((await repos.canvases.getOwned(ALICE, id))!.state as CanvasState).nodes.map((n) => n.id);

  it("loads the open_canvas state and saves with the version it last saw", async () => {
    const { repos, c, p, calls } = await setup();
    expect(((await p.load()) as CanvasState).nodes.map((n) => n.id)).toEqual(["img_a"]);
    await p.save(state([imageNode("img_a", 1), imageNode("img_b", 2)]));
    await p.save(state([imageNode("img_b", 2)]));
    expect(await nodesOf(repos, c.id)).toEqual(["img_b"]);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.arguments!.baseUpdatedAt).toBe(c.updatedAt.toISOString());
    expect(calls[1]!.arguments!.baseUpdatedAt).not.toBe(calls[0]!.arguments!.baseUpdatedAt);
    expect(p.baseUpdatedAt).toBe((await repos.canvases.getOwned(ALICE, c.id))!.updatedAt.toISOString());
  });

  it("falls back to load_canvas_state when the board did not arrive in _meta", async () => {
    const { repos, c, app, calls } = await setup();
    await repos.canvases.saveState(ALICE, c.id, state([imageNode("img_a", 1), imageNode("img_b", 2)]));
    const p = createBridgePersistence({ app, canvasId: c.id });
    expect(((await p.load()) as CanvasState).nodes.map((n) => n.id)).toEqual(["img_a", "img_b"]);
    expect(calls.map((x) => x.name)).toEqual([LOAD_TOOL]);
    const latest = (await repos.canvases.getOwned(ALICE, c.id))!.updatedAt.toISOString();
    expect(p.baseUpdatedAt).toBe(latest);
    await p.save(state([imageNode("img_b", 2)]));
    expect(calls[1]!.arguments!.baseUpdatedAt).toBe(latest);
    expect(await nodesOf(repos, c.id)).toEqual(["img_b"]);
  });

  it("holds saves after a conflict until the user loads the latest version", async () => {
    const { repos, c, p, calls, onConflict } = await setup();
    await repos.canvases.saveState(ALICE, c.id, state([imageNode("img_agent", 3)]));
    await expect(p.save(state([imageNode("img_mine", 4)]))).rejects.toBeInstanceOf(ConflictError);
    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(p.conflict?.state).toMatchObject({ nodes: [{ id: "img_agent" }] });
    // Held: no server call, the newest local state is kept for "keep mine".
    await expect(p.save(state([imageNode("img_mine2", 5)]))).rejects.toBeInstanceOf(ConflictError);
    expect(calls).toHaveLength(1);
    expect(p.conflict?.mine.nodes[0]!.id).toBe("img_mine2");
    expect(await nodesOf(repos, c.id)).toEqual(["img_agent"]);

    p.acceptLatest();
    expect(p.conflict).toBeNull();
    await p.save(state([imageNode("img_agent", 3), imageNode("img_after", 6)]));
    expect(await nodesOf(repos, c.id)).toEqual(["img_agent", "img_after"]);
  });

  it("keeps the user's version when asked", async () => {
    const { repos, c, p } = await setup();
    await repos.canvases.saveState(ALICE, c.id, state([imageNode("img_agent", 3)]));
    await expect(p.save(state([imageNode("img_mine", 4)]))).rejects.toBeInstanceOf(ConflictError);
    await p.keepMine();
    expect(p.conflict).toBeNull();
    expect(await nodesOf(repos, c.id)).toEqual(["img_mine"]);
    await p.save(state([imageNode("img_mine", 4), imageNode("img_next", 7)]));
    expect(await nodesOf(repos, c.id)).toEqual(["img_mine", "img_next"]);
  });

  it("turns tool errors and transport failures into PersistenceErrors", async () => {
    const failing: ToolCaller = {
      callServerTool: async () => {
        throw new Error("host went away");
      },
    };
    const p = createBridgePersistence({ app: failing, canvasId: "c1", initialState: null });
    await expect(p.save(state())).rejects.toThrow("Could not reach the server");
    const refusing: ToolCaller = {
      callServerTool: async () => ({
        isError: true,
        content: [{ type: "text", text: "Images must be links. Embedded image data cannot be saved." }],
        structuredContent: { ok: false, reason: "invalid" },
      }),
    };
    const q = createBridgePersistence({ app: refusing, canvasId: "c1", initialState: null });
    await expect(q.save(state())).rejects.toMatchObject({ status: 400, message: expect.stringContaining("Images must be links") });
    expect(q.conflict).toBeNull();
  });
});
