/**
 * MCP Apps build of the canvas (spec section 9): one self-contained HTML file with all
 * JS and CSS inlined (vite-plugin-singlefile), served as the `ui://banana/canvas`
 * resource.
 *
 * Output: public/mcp-app/canvas.html, a static asset. The Worker reads it at request time
 * through the ASSETS binding (lib/mcp/resources/canvas.ts), so it is not part of the
 * Worker bundle (Workers Free caps that at 3 MB gzipped).
 *
 * Fonts are the one thing not inlined: font files are written next to the HTML
 * (public/mcp-app/assets/) and referenced by absolute URL on our own origin. The view runs
 * on the host's sandbox origin, so the URL starts with a placeholder that canvas.ts swaps
 * for APP_URL's origin when serving, and APP_URL's origin is in the resource CSP
 * (`resourceDomains`). public/_headers lets those files load cross-origin.
 *
 * Run with `npm run build:ui` (also runs as part of `npm run build`).
 */
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { APP_ORIGIN_PLACEHOLDER, CANVAS_ASSET_DIR, CANVAS_ASSET_PATH } from "../../lib/mcp/resources/canvas-asset.ts";

const root = fileURLToPath(new URL("./", import.meta.url));
const repo = fileURLToPath(new URL("../../", import.meta.url));
const OUT_DIR = fileURLToPath(new URL(`../../public/${CANVAS_ASSET_DIR}`, import.meta.url));
const HTML_NAME = CANVAS_ASSET_PATH.split("/").pop()!;
const FONT_FILE = /\.(woff2?|ttf|otf)$/i;

/**
 * Keeps font files out of the HTML (singlefile's recommended config inlines every asset),
 * renames index.html and checks that nothing but fonts is loaded from outside the file.
 * Listed after viteSingleFile so its `config` hook runs last.
 */
function canvasOutput(): Plugin {
  return {
    name: "banana-canvas-html",
    enforce: "post",
    config(config) {
      config.build ??= {};
      config.build.assetsInlineLimit = (file) => !FONT_FILE.test(file);
      config.build.assetsDir = "assets";
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const asset = Object.values(bundle).find((f) => f.type === "asset" && f.fileName.endsWith(".html"));
        if (!asset || asset.type !== "asset") throw new Error("build:ui: no HTML in the bundle");
        const html = typeof asset.source === "string" ? asset.source : new TextDecoder().decode(asset.source);
        if (/<script[^>]+\bsrc=/i.test(html) || /<link[^>]+rel=["']?stylesheet/i.test(html)) {
          throw new Error("build:ui: the canvas HTML must not load external scripts or stylesheets");
        }
        for (const f of Object.values(bundle)) {
          if (f !== asset && !FONT_FILE.test(f.fileName)) throw new Error(`build:ui: ${f.fileName} was not inlined`);
        }
        asset.fileName = HTML_NAME;
        this.info(`wrote public${CANVAS_ASSET_PATH} (${Math.round(html.length / 1024)} KB)`);
      },
    },
  };
}

export default defineConfig({
  root,
  // The canvas reads APP_NAME through props; this keeps any stray `process.env` read safe.
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.APP_NAME": JSON.stringify(process.env.APP_NAME?.trim() || "Banana"),
  },
  resolve: { alias: { "@": repo.replace(/\/$/, "") } },
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true }), canvasOutput()],
  logLevel: "warn",
  experimental: {
    // Fonts load from our origin (see the header comment); everything else is inlined.
    renderBuiltUrl(filename) {
      return FONT_FILE.test(filename) ? `${APP_ORIGIN_PLACEHOLDER}/${CANVAS_ASSET_DIR}/${filename}` : undefined;
    },
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    target: "es2022",
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4096,
    reportCompressedSize: false,
  },
});
