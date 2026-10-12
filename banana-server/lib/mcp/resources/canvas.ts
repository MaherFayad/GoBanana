/**
 * The inline canvas (MCP Apps, spec sections 5 and 9): the `ui://banana/canvas`
 * resource that `open_canvas` points at with `_meta.ui.resourceUri`.
 *
 * The HTML is one self-contained file built by Vite from `ui/canvas/` (React, React
 * Flow and the canvas code all inlined) into `public/mcp-app/canvas.html`
 * (`npm run build:ui`). It ships as a static asset, not inside the Worker bundle (Workers
 * Free caps the bundle at 3 MB gzipped), and is read at request time:
 * - Worker (production): through the `ASSETS` binding, cached per isolate.
 * - `next dev` and Vitest: from public/ on disk.
 * - Tests can inject their own loader (`setCanvasHtmlLoader`).
 *
 * CSP (`_meta.ui.csp`):
 * - `resourceDomains`: the image host allowlist (lib/sources/allowlist.ts, same list the
 *   search adapter filters on), the Mobbin image hosts for screens the agent places from the
 *   user's own Mobbin connector (lib/sources/mobbin.ts), Google Fonts for type samples, and
 *   our own origin (APP_URL) for the UI fonts the view loads from public/ (never inlined, see
 *   ui/canvas/vite.config.ts). Images load in the browser from their source; nothing is
 *   proxied. User uploads are same-origin paths behind the web session
 *   (`/api/uploads/:id`), so inline they show as link cards.
 * - `connectDomains`: none. Saves go through the host bridge (`save_canvas_state`).
 */
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { APP_NAME } from "@/lib/config";
import { allowlistFromEnv, allowlistToCspDomains } from "@/lib/sources/allowlist";
import { MOBBIN_IMAGE_HOSTS } from "@/lib/sources/mobbin";
import { CANVAS_UI_URI } from "@/lib/mcp/tools/open_canvas";
import { APP_ORIGIN_PLACEHOLDER, CANVAS_ASSET_PATH } from "./canvas-asset";

export { CANVAS_UI_URI, RESOURCE_MIME_TYPE };

/** Type samples load their pairing's Google Fonts stylesheet (CSS host) and font files. */
export const FONT_DOMAINS: readonly string[] = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];

export type CanvasCsp = { resourceDomains: string[]; connectDomains: string[] };

/**
 * CSP for the inline canvas. Read per call so `IMAGE_HOST_ALLOWLIST` and `APP_URL` come
 * from the request's environment (OpenNext fills process.env per request).
 */
export function canvasCsp(opts: { imageHostAllowlist?: string; appUrl?: string } = {}): CanvasCsp {
  const allowlist = allowlistFromEnv(opts.imageHostAllowlist ?? readEnv("IMAGE_HOST_ALLOWLIST"));
  const own = appOrigin(opts.appUrl ?? readEnv("APP_URL"));
  const mobbin = MOBBIN_IMAGE_HOSTS.map((h) => `https://${h}`);
  const domains = [...allowlistToCspDomains(allowlist), ...mobbin, ...FONT_DOMAINS, ...(own ? [own] : [])];
  return { resourceDomains: [...new Set(domains)], connectDomains: [] };
}

/** The http(s) origin of APP_URL, or undefined when it is missing or not a URL. */
export function appOrigin(appUrl: string | undefined): string | undefined {
  if (!appUrl?.trim()) return undefined;
  try {
    const url = new URL(appUrl.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function readEnv(name: string): string | undefined {
  try {
    return typeof process !== "undefined" ? process.env?.[name] : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------- HTML

export type CanvasHtmlLoader = () => Promise<string>;

let loaderOverride: CanvasHtmlLoader | undefined;
let cached: Promise<string> | undefined;

/** Tests: read the HTML with `loader` instead (null restores the default). Clears the cache. */
export function setCanvasHtmlLoader(loader: CanvasHtmlLoader | null): void {
  loaderOverride = loader ?? undefined;
  cached = undefined;
}

/**
 * The built canvas HTML as stored (placeholders not filled). Cached per isolate in
 * production; a failed read is not cached, so the next request tries again.
 */
export function loadCanvasHtml(): Promise<string> {
  if (!loaderOverride && process.env.NODE_ENV !== "production") return readFromDisk();
  if (!cached) {
    const pending = (loaderOverride ?? readFromAssets)();
    cached = pending;
    pending.catch(() => {
      if (cached === pending) cached = undefined;
    });
  }
  return cached;
}

/** Fills the app origin into URLs of files the view loads from our host (fonts). */
export function fillCanvasHtml(html: string, appUrl: string | undefined = readEnv("APP_URL")): string {
  if (!html.includes(APP_ORIGIN_PLACEHOLDER)) return html;
  return html.replaceAll(APP_ORIGIN_PLACEHOLDER, appOrigin(appUrl) ?? "");
}

const ASSET_BASE = "https://assets.invalid";

async function readFromAssets(): Promise<string> {
  const assets = getCloudflareContext().env.ASSETS;
  if (!assets) throw new Error("canvas: ASSETS binding missing");
  let res = await assets.fetch(new URL(CANVAS_ASSET_PATH, ASSET_BASE));
  // Workers static assets serve `x.html` at `x` (html_handling) and redirect the long form.
  const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
  if (location) res = await assets.fetch(new URL(location, ASSET_BASE));
  if (!res.ok) throw new Error(`canvas: asset read failed (${res.status})`);
  return res.text();
}

async function readFromDisk(): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  return readFile(join(process.cwd(), "public", CANVAS_ASSET_PATH), "utf8");
}

// ---------------------------------------------------------------------------- resource

export const CANVAS_RESOURCE_NAME = "canvas";

export function registerCanvasResource(server: McpServer, load: CanvasHtmlLoader = loadCanvasHtml): void {
  const ui = () => ({ csp: canvasCsp(), prefersBorder: true });
  registerAppResource(
    server,
    CANVAS_RESOURCE_NAME,
    CANVAS_UI_URI,
    {
      title: `${APP_NAME} moodboard canvas`,
      description: "The moodboard canvas, shown inline in chat. Every reference keeps its source link.",
      _meta: { ui: ui() },
    },
    async () => ({
      contents: [{ uri: CANVAS_UI_URI, mimeType: RESOURCE_MIME_TYPE, text: fillCanvasHtml(await load()), _meta: { ui: ui() } }],
    }),
  );
}
