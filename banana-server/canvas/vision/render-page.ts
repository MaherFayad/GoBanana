/**
 * Draws a Frankenstein page to one image in the user's browser (P0-12, owner decision D1), so the
 * inline canvas can put it in the agent's context through MCP Apps. Client only, and loaded with
 * import() when the user asks, so it never reaches the server bundle.
 *
 * The parts are hotlinked images. Each is loaded with CORS (crossOrigin "anonymous", no referrer)
 * and drawn onto a <canvas> with its crop; the result is encoded in memory and handed to the
 * caller. Nothing is uploaded or stored: the bytes go to the host's model context and are dropped.
 *
 * A host that sends no CORS header (Pinterest, checked 2026-10-15) would taint the canvas: the
 * browser refuses to read it back. Such an image fails the CORS load, a plain load then tells
 * "no CORS" from "broken link", and the page is reported as tainted with those hosts instead of
 * drawn. A failed read back (SecurityError) is reported the same way.
 */
import type { Part, StitchData } from "@/lib/stitch/types";
import { displaySrc, FALLBACK_IMAGE_ASPECT, imageAspectOf } from "../stitch/crop";
import { layoutMap, pageLayout, type PageLayout } from "./page-layout";

/** Widest and tallest image sent; the frame is scaled down to fit both. */
export const RENDER_MAX_WIDTH = 1200;
export const RENDER_MAX_HEIGHT = 6000;
/** Over this a PNG is re-encoded as JPEG so the model context stays light. */
export const RENDER_MAX_PNG_BYTES = 3.5 * 1024 * 1024;
const LOAD_TIMEOUT_MS = 10_000;

export type RenderOutcome =
  | { ok: true; data: string; mimeType: "image/png" | "image/jpeg"; width: number; height: number; map: string[]; missing: string[] }
  | { ok: false; reason: "tainted"; hosts: string[]; map: string[] }
  | { ok: false; reason: "empty" | "failed"; hosts: string[]; map: string[] };

type Loaded = { status: "ok"; img: HTMLImageElement } | { status: "no_cors"; aspect: number | null } | { status: "failed" };

function load(src: string, cors: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.decoding = "async";
    const timer = setTimeout(() => done(null), LOAD_TIMEOUT_MS);
    function done(v: HTMLImageElement | null) {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(v);
    }
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = src;
  });
}

async function loadPart(url: string): Promise<Loaded> {
  const sources = [displaySrc(url), url].filter((u, i, all) => all.indexOf(u) === i);
  for (const src of sources) {
    const img = await load(src, true);
    if (img) return { status: "ok", img };
  }
  // Loads without CORS but not with it: the host sends no CORS header, so it would taint.
  for (const src of sources) {
    const img = await load(src, false);
    if (img) return { status: "no_cors", aspect: imageAspectOf(img.naturalWidth, img.naturalHeight) };
  }
  return { status: "failed" };
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};
const uniq = (xs: string[]) => [...new Set(xs)].sort();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** A Studio token value from the page, else a CSS system color (the canvas is drawn like the frame). */
function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const toBlob = (c: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, quality));

export async function renderPage(opts: { title: string; stitch: StitchData; parts: readonly Part[] }): Promise<RenderOutcome> {
  const { stitch, title } = opts;
  const parts = new Map(opts.parts.map((p) => [p.id, p]));
  const used = uniq(stitch.rows.flatMap((r) => r.slots.map((s) => parts.get(s.partId)?.imageUrl ?? "")).filter(Boolean));
  const loaded = new Map(await Promise.all(used.map(async (u) => [u, await loadPart(u)] as const)));

  const fallback = FALLBACK_IMAGE_ASPECT[stitch.platform] ?? FALLBACK_IMAGE_ASPECT.website;
  const aspectOf = (p: Part | null) => {
    const l = p ? loaded.get(p.imageUrl) : undefined;
    const measured = l?.status === "ok" ? imageAspectOf(l.img.naturalWidth, l.img.naturalHeight) : l?.status === "no_cors" ? l.aspect : null;
    return measured ?? imageAspectOf(p?.imageWidth, p?.imageHeight) ?? fallback;
  };
  const layout: PageLayout = pageLayout(stitch, parts, aspectOf);
  const map = layoutMap(title, stitch, layout);

  const noCors = uniq(used.filter((u) => loaded.get(u)?.status === "no_cors").map(hostOf));
  const failed = uniq(used.filter((u) => loaded.get(u)?.status === "failed").map(hostOf));
  if (layout.cells.length === 0 || layout.height <= 0) return { ok: false, reason: "empty", hosts: [], map };
  if (noCors.length > 0) return { ok: false, reason: "tainted", hosts: noCors, map };
  if (failed.length === used.length) return { ok: false, reason: "failed", hosts: failed, map };

  const scale = Math.min(1, RENDER_MAX_WIDTH / layout.width, RENDER_MAX_HEIGHT / layout.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(layout.width * scale));
  canvas.height = Math.max(1, Math.round(layout.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, reason: "failed", hosts: [], map };
  ctx.fillStyle = token("--st-bg-body", "Canvas");
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  for (const cell of layout.cells) {
    const [x, y, w, h] = [cell.box.x * scale, cell.box.y * scale, cell.box.w * scale, cell.box.h * scale];
    const l = cell.part ? loaded.get(cell.part.imageUrl) : undefined;
    if (l?.status === "ok") {
      const { naturalWidth: nw, naturalHeight: nh } = l.img;
      ctx.drawImage(l.img, cell.src.x * nw, cell.src.y * nh, cell.src.w * nw, cell.src.h * nh, x, y, w, h);
    } else {
      // Same as the canvas: an empty box that says the image is not available.
      ctx.fillStyle = token("--st-bg-surface-2", "ButtonFace");
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = token("--st-text-muted", "GrayText");
      ctx.font = `${Math.max(11, Math.round(14 * scale))}px system-ui, sans-serif`;
      ctx.fillText(`${cell.role}: image not available`, x + 8, y + Math.min(h - 6, 22));
    }
  }

  // Belt and braces: a tainted canvas throws on read back.
  try {
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    return { ok: false, reason: "tainted", hosts: uniq(used.map(hostOf)), map };
  }
  let blob = await toBlob(canvas, "image/png");
  let mimeType: "image/png" | "image/jpeg" = "image/png";
  if (blob && blob.size > RENDER_MAX_PNG_BYTES) {
    blob = await toBlob(canvas, "image/jpeg", 0.85);
    mimeType = "image/jpeg";
  }
  if (!blob) return { ok: false, reason: "failed", hosts: [], map };
  const data = await blobToBase64(blob);
  canvas.width = canvas.height = 0;
  return { ok: true, data, mimeType, width: Math.round(layout.width * scale), height: Math.round(layout.height * scale), map, missing: failed };
}
