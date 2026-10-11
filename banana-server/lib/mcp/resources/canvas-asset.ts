/**
 * Where the built inline canvas lives. Shared by ui/canvas/vite.config.ts (writes it) and
 * lib/mcp/resources/canvas.ts (reads it). No imports: the Vite config loads this file too.
 *
 * The HTML is a static asset (public/mcp-app/canvas.html, served through the Worker's
 * ASSETS binding), not a module, so its ~750 KB stay out of the Worker bundle.
 */

/** Folder under public/ that `npm run build:ui` owns (emptied on every build). */
export const CANVAS_ASSET_DIR = "mcp-app";

/** Public path of the HTML, as the ASSETS binding and `next dev` serve it. */
export const CANVAS_ASSET_PATH = `/${CANVAS_ASSET_DIR}/canvas.html`;

/**
 * Stands in for the app origin in URLs of files the HTML loads from our own host (fonts).
 * The view runs in the host's sandbox on another origin, so these URLs must be absolute;
 * APP_URL is only known at request time, so canvas.ts swaps it in when serving.
 */
export const APP_ORIGIN_PLACEHOLDER = "__BANANA_APP_ORIGIN__";
