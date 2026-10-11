/**
 * The inline canvas (MCP Apps, spec sections 5 and 9): the `ui://banana/canvas`
 * resource that `open_canvas` points at with `_meta.ui.resourceUri`.
 *
 * The HTML is one self-contained file built by Vite from `ui/canvas/` (React, React
 * Flow and the canvas code all inlined), then turned into a TS module by
 * `npm run build:ui` because a Worker has no filesystem to read it from at runtime.
 *
 * CSP (`_meta.ui.csp`):
 * - `resourceDomains`: the image host allowlist (lib/sources/allowlist.ts, same list the
 *   search adapter filters on) and Google Fonts for type samples. Images load in the
 *   browser from their source; nothing is proxied. User uploads are same-origin paths
 *   behind the web session (`/api/uploads/:id`), so inline they show as link cards.
 * - `connectDomains`: none. Saves go through the host bridge (`save_canvas_state`).
 */
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { APP_NAME } from "@/lib/config";
import { allowlistFromEnv, allowlistToCspDomains } from "@/lib/sources/allowlist";
import { CANVAS_UI_URI } from "@/lib/mcp/tools/open_canvas";
import { CANVAS_HTML } from "./canvas-html.generated";

export { CANVAS_UI_URI, RESOURCE_MIME_TYPE };

/** Type samples load their pairing's Google Fonts stylesheet (CSS host) and font files. */
export const FONT_DOMAINS: readonly string[] = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];

export type CanvasCsp = { resourceDomains: string[]; connectDomains: string[] };

/**
 * CSP for the inline canvas. Read per call so `IMAGE_HOST_ALLOWLIST` comes from the
 * request's environment (OpenNext fills process.env per request).
 */
export function canvasCsp(opts: { imageHostAllowlist?: string } = {}): CanvasCsp {
  const allowlist = allowlistFromEnv(opts.imageHostAllowlist ?? readEnv("IMAGE_HOST_ALLOWLIST"));
  const domains = [...allowlistToCspDomains(allowlist), ...FONT_DOMAINS];
  return { resourceDomains: [...new Set(domains)], connectDomains: [] };
}

function readEnv(name: string): string | undefined {
  try {
    return typeof process !== "undefined" ? process.env?.[name] : undefined;
  } catch {
    return undefined;
  }
}

export const CANVAS_RESOURCE_NAME = "canvas";

export function registerCanvasResource(server: McpServer, html: string = CANVAS_HTML): void {
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
      contents: [{ uri: CANVAS_UI_URI, mimeType: RESOURCE_MIME_TYPE, text: html, _meta: { ui: ui() } }],
    }),
  );
}
