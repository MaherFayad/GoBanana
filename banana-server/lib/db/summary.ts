/**
 * Pure helpers for the canvas list (`CanvasRepo.listOwned`), shared by the Drizzle and the
 * in-memory repos. No database imports, so Vitest covers them directly.
 */
import { SUMMARY_PREVIEWS, type CanvasPreviewRef } from "./types";

export const LIST_LIMIT_DEFAULT = 48;
export const LIST_LIMIT_MAX = 200;

/** A whole number from 1 to LIST_LIMIT_MAX; anything else gives the default. */
export function clampListLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return LIST_LIMIT_DEFAULT;
  return Math.min(LIST_LIMIT_MAX, Math.max(1, Math.floor(limit)));
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Keeps preview entries that carry the URLs a collage needs; drops anything else. */
export function cleanPreviews(raw: unknown, max = SUMMARY_PREVIEWS): CanvasPreviewRef[] {
  const list = typeof raw === "string" ? safeJson(raw) : raw;
  if (!Array.isArray(list)) return [];
  const out: CanvasPreviewRef[] = [];
  for (const v of list) {
    if (!v || typeof v !== "object") continue;
    const { thumbUrl, imageUrl, sourceUrl } = v as Record<string, unknown>;
    if (typeof imageUrl !== "string" || !imageUrl || typeof sourceUrl !== "string" || !sourceUrl) continue;
    out.push({ thumbUrl: typeof thumbUrl === "string" && thumbUrl ? thumbUrl : null, imageUrl, sourceUrl });
    if (out.length >= max) break;
  }
  return out;
}

const isRefNode = (n: unknown): n is { type: string; data?: unknown } =>
  !!n && typeof n === "object" && ((n as { type?: unknown }).type === "image" || (n as { type?: unknown }).type === "upload");

/** Reference count and the first previews of a raw `canvases.state`, the same way the SQL reads them. */
export function referencesFromState(state: unknown): { count: number; previews: CanvasPreviewRef[] } {
  const nodes = state && typeof state === "object" ? (state as { nodes?: unknown }).nodes : undefined;
  if (!Array.isArray(nodes)) return { count: 0, previews: [] };
  const refs = nodes.filter(isRefNode);
  return { count: refs.length, previews: cleanPreviews(refs.slice(0, SUMMARY_PREVIEWS).map((n) => n.data)) };
}
