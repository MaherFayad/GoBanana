/**
 * `reconcile_direction`: make one direction's spec match its board. Runs the extract_palette
 * pipeline on the direction's placed art and UI images (great ratings count three times), saves the
 * palette, contrast (ship at 4.5:1 for text or 3:1 for UI parts), mood and the color of each
 * Frankenstein part on the direction (directions.detail.reconciled), rewrites the spec's color line
 * (and typography when the board has a type sample) and returns the conflicts with the old spec.
 *
 * Hard rule 2: same exception as extract_palette. Thumbnails are fetched into memory only from
 * allowlisted hosts, decoded, sampled and dropped. Only hex colors, ratios and short lines are saved.
 * export_kit calls `reconcileDirection` itself for a kept direction that changed since its last run.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, loadCanvas, toSnapshot, type CanvasState } from "@/lib/canvas/store";
import type { CanvasSnapshot, ReferenceItem } from "@/lib/canvas/types";
import type { CanvasRecord, DirectionRecord, Repos } from "@/lib/db/types";
import type { Reconciled } from "@/lib/direction-detail";
import { findPairing } from "@/lib/export/model";
import { voiceFonts, voiceFontsText } from "@/lib/kit/voice-fonts";
import { cropColors, extractPalette, fetchThumbIntoMemory } from "@/lib/palette";
import type { FetchLike } from "@/lib/palette/fetch";
import {
  boardColorLine,
  directionImages,
  directionTypeSamples,
  findConflicts,
  isStale,
  itemsKey,
  moodLine,
  RECONCILE_MIN_IMAGES,
  reconcileHint,
  reconciledSpec,
  reconcilePairs,
  type Conflict,
} from "@/lib/reconcile";
import { allowlistFromEnv, isAllowedImageUrl, type ImageHostAllowlist } from "@/lib/sources/allowlist";
import { itemKey } from "@/lib/sources/web-search";
import { CANVAS_NOT_FOUND, lazyTool, plausibleId, takedownLoader, TRY_AGAIN, type CanvasToolDeps } from "./canvas-shared";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "reconcile_direction";

export const TOOL_DESCRIPTION =
  "Make a direction's spec match its board: reads the colors of the direction's placed images (great ratings count more), " +
  "saves the palette with WCAG checks (ship at 4.5:1 text or 3:1 UI), mood and part colors, and rewrites the spec's color line. " +
  "Call it after placing or rating images for a direction and before export_kit. Tell the user about any conflicts it returns.";

/** Images read per direction, great ones first. */
export const MAX_RECONCILE_IMAGES = 12;
/** Frankenstein parts measured per direction. */
const MAX_PARTS = 12;
/** A great image counts this many times in the palette. */
export const GREAT_WEIGHT = 3;
const CONCURRENCY = 4;
const PALETTE_SIZE = 6;

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  directionId: z.string().min(1).max(100).describe("Direction id from get_canvas or bend_brief."),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  directionId: "Pass a directionId from get_canvas.",
};

export const DIRECTION_NOT_FOUND = "This canvas has no direction with that id. Call get_canvas to see the direction ids.";

export type ReconcileDeps = CanvasToolDeps & {
  fetchImpl?: FetchLike;
  allowlist?: () => ImageHostAllowlist;
};

export type ReconcileOutcome = {
  directionId: string;
  title: string;
  reconciled: Reconciled;
  conflicts: Conflict[];
  /** Images on the direction that could not be read, with the reason. */
  skipped: { itemId: string; reason: string }[];
  /** Placed images found for the direction. */
  placed: number;
};

/** Direction status for hints and export: its placed images, fingerprint and whether it changed. */
export type DirectionState = { row: DirectionRecord; images: ReferenceItem[]; great: Set<string>; key: string; stale: boolean };

export async function directionStates(
  repos: Pick<Repos, "feedback">,
  userId: string,
  snapshot: CanvasSnapshot,
  rows: readonly DirectionRecord[],
): Promise<DirectionState[]> {
  const perRow = rows.map((row) => ({ row, images: directionImages(snapshot, row) }));
  const keys = perRow.flatMap((r) => r.images.map((i) => itemKey(i.sourceUrl)));
  const verdicts = keys.length > 0 ? await repos.feedback.verdictsFor(userId, keys) : new Map();
  return perRow.map(({ row, images }) => {
    const great = new Set(images.filter((i) => verdicts.get(itemKey(i.sourceUrl)) === "great").map((i) => i.id));
    const key = itemsKey(images, great);
    return { row, images, great, key, stale: isStale(row.detail, key) };
  });
}

/** Titles of kept or unrated directions with 3 or more placed images that changed since their last reconcile. */
export function needsReconcile(states: readonly DirectionState[]): string[] {
  return states.filter((s) => s.stale && s.images.length >= RECONCILE_MIN_IMAGES && s.row.detail?.verdict !== "drop").map((s) => s.row.title);
}

/**
 * The add_to_canvas and rate_references nudge: a line naming the directions with 3 or more placed
 * images that changed since their last reconcile, or null. Never throws (a hint is optional).
 */
export async function reconcileHintFor(
  repos: Pick<Repos, "feedback" | "directions">,
  userId: string,
  canvas: CanvasRecord,
  state: CanvasState,
): Promise<string | null> {
  try {
    const rows = await repos.directions.listForCanvas(canvas.id);
    if (rows.length === 0) return null;
    const snapshot = toSnapshot({ canvas, state, directions: rows });
    return reconcileHint(needsReconcile(await directionStates(repos, userId, snapshot, rows)));
  } catch {
    return null;
  }
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Reconcile one direction and save the result on it. The caller has loaded the canvas for this
 * user (takedown filter applied) and built its snapshot.
 */
export async function reconcileDirection(
  deps: ReconcileDeps,
  userId: string,
  snapshot: CanvasSnapshot,
  row: DirectionRecord,
): Promise<ReconcileOutcome> {
  const [state] = await directionStates(deps.repos, userId, snapshot, [row]);
  const images = state!.images;
  const isGreat = (i: ReferenceItem) => state!.great.has(i.id);
  const allowlist = deps.allowlist?.() ?? allowlistFromEnv();
  const skipped: ReconcileOutcome["skipped"] = [];

  // Great images first, so they are read when a direction has more than the cap.
  const ordered = [...images.filter(isGreat), ...images.filter((i) => !isGreat(i))];
  const targets: { itemId: string; url: string; weight: number }[] = [];
  for (const i of ordered) {
    const url = i.thumbUrl || i.imageUrl;
    if (!isAllowedImageUrl(url, allowlist)) {
      skipped.push({ itemId: i.id, reason: "its image host is not on the allowlist" });
      continue;
    }
    if (targets.length < MAX_RECONCILE_IMAGES) targets.push({ itemId: i.id, url, weight: isGreat(i) ? GREAT_WEIGHT : 1 });
  }

  // Parts on this direction's Frankenstein pages (and pages with no direction).
  const ids = new Set([row.id, ...(row.bendId ? [row.bendId] : [])]);
  const partIds = new Set(
    (snapshot.stitches ?? [])
      .filter((st) => !st.directionId || ids.has(st.directionId))
      .flatMap((st) => st.rows.flatMap((r) => r.slots.map((s) => s.partId))),
  );
  const parts = (snapshot.parts ?? []).filter((p) => partIds.has(p.id) && isAllowedImageUrl(p.thumbUrl || p.imageUrl, allowlist)).slice(0, MAX_PARTS);

  // In memory only: one fetch per URL, shared by images and parts, dropped when this call returns.
  const urls = [...new Set([...targets.map((t) => t.url), ...parts.map((p) => p.thumbUrl || p.imageUrl)])];
  const fetched = await mapLimit(urls, CONCURRENCY, (url) => fetchThumbIntoMemory(url, { allowedHosts: allowlist.entries, fetchImpl: deps.fetchImpl }));
  const bytesByUrl = new Map<string, Uint8Array>();
  urls.forEach((u, i) => {
    const r = fetched[i]!;
    if (r.ok) bytesByUrl.set(u, r.bytes);
  });

  const imgs: Uint8Array[] = [];
  const weights: number[] = [];
  const readIds: string[] = [];
  for (const t of targets) {
    const bytes = bytesByUrl.get(t.url);
    if (!bytes) {
      skipped.push({ itemId: t.itemId, reason: "the image could not be loaded" });
      continue;
    }
    imgs.push(bytes);
    weights.push(t.weight);
    readIds.push(t.itemId);
  }
  const result = imgs.length > 0 ? extractPalette({ images: imgs, weights, size: PALETTE_SIZE }) : { palette: [], contrast: [], skipped: [] };
  for (const s of result.skipped) {
    const id = readIds[s.index];
    if (id) skipped.push({ itemId: id, reason: s.reason === "unsupported_format" ? "its format (for example WebP) is not supported yet" : "the image could not be read" });
  }
  const partColors: Record<string, string[]> = {};
  for (const p of parts) {
    const bytes = bytesByUrl.get(p.thumbUrl || p.imageUrl);
    const colors = bytes ? cropColors(bytes, p.crop) : [];
    if (colors.length > 0) partColors[p.id] = colors;
  }
  imgs.length = 0;
  bytesByUrl.clear();

  const palette = result.palette.map((c) => ({ hex: c.hex, oklch: c.oklch, role: c.role }));
  const contrast = reconcilePairs(result.contrast);
  const readSet = new Set(readIds);
  const greatRead = images.filter((i) => readSet.has(i.id) && isGreat(i)).length;
  const reconciled: Reconciled = {
    at: (deps.now?.() ?? new Date()).toISOString(),
    itemsKey: state!.key,
    palette,
    contrast,
    mood: moodLine(palette),
    images: readIds.length - result.skipped.length,
    great: greatRead,
    parts: partColors,
  };

  const spec = row.detail?.spec;
  const fonts = voiceFonts(spec?.typeVoice);
  const sample = directionTypeSamples(snapshot, row)
    .map((s) => findPairing(s.pairingId))
    .find((p) => p !== undefined);
  const sampleDiffers = !!sample && sample.display.family !== fonts.latinDisplay.family;
  const sampleLine = sample ? `${sample.display.family} for display and ${sample.body.family} for body, from the type sample on the board.` : undefined;
  const conflicts =
    palette.length > 0 || sampleDiffers
      ? findConflicts(spec, palette, { voiceFonts: voiceFontsText(fonts), ...(sampleDiffers && sample ? { sample: sample.name } : {}) })
      : [];
  const newSpec = palette.length > 0 || sampleLine ? reconciledSpec(spec, palette.length > 0 ? boardColorLine(palette, contrast) : spec?.color ?? "", sampleLine) : undefined;

  await deps.repos.directions.setReconciled(row.canvasId, row.id, { reconciled, ...(newSpec ? { spec: newSpec } : {}) });
  return { directionId: row.bendId ?? row.id, title: row.title, reconciled, conflicts, skipped, placed: images.length };
}

export function reconcileText(out: ReconcileOutcome): string {
  const r = out.reconciled;
  const lines = [`Reconciled "${out.title}" with its board: ${r.images} of ${out.placed} placed images read${r.great > 0 ? ` (${r.great} rated great, counted ${GREAT_WEIGHT} times)` : ""}.`];
  if (r.palette.length === 0) {
    lines.push("No colors could be read from this direction's images, so the spec color line is unchanged. Place images from allowlisted hosts (JPEG or PNG) and run it again.");
  } else {
    lines.push("Palette:", ...r.palette.map((c) => `- ${c.hex} ${c.oklch} (${c.role})`));
    const text = r.contrast.filter((p) => p.passesText);
    const ui = r.contrast.filter((p) => !p.passesText && p.passesUi);
    lines.push(`${text.length} pairs pass 4.5:1 for text and ${ui.length} more pass 3:1 for UI parts only; both are tagged ship.`);
    for (const p of text.slice(0, 6)) lines.push(`- ${p.fg} on ${p.bg}: ${p.ratio}:1 (text)`);
    if (r.mood) lines.push(`Mood: ${r.mood}`);
  }
  const partCount = Object.keys(r.parts ?? {}).length;
  if (partCount > 0) lines.push(`Measured the main colors of ${partCount} Frankenstein part${partCount === 1 ? "" : "s"}.`);
  if (out.conflicts.length > 0) {
    lines.push("Conflicts between the old spec and the board (tell the user about each one; the board now wins in exports):");
    for (const c of out.conflicts) lines.push(`- ${c.axis}: the spec said "${c.spec}". ${c.board}`);
  } else if (r.palette.length > 0) {
    lines.push("No conflicts: the spec and the board agree.");
  }
  for (const s of out.skipped) lines.push(`Skipped ${s.itemId}: ${s.reason}.`);
  if (out.placed < RECONCILE_MIN_IMAGES) lines.push(`Only ${out.placed} image${out.placed === 1 ? " is" : "s are"} placed for this direction; ${RECONCILE_MIN_IMAGES} or more give a steadier palette.`);
  lines.push("export_kit now uses this palette for the direction's DESIGN.md and tokens.");
  return lines.join("\n");
}

export function createReconcileDirectionTool(deps: ReconcileDeps) {
  return async function reconcileDirectionTool(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, "Pass a canvasId and a directionId.");
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);

    try {
      const loaded = await loadCanvas(deps.repos, userId, input.canvasId, takedownLoader(deps));
      if (!loaded) return toolMessage(CANVAS_NOT_FOUND);
      const directions = await deps.repos.directions.listForCanvas(input.canvasId);
      const row = directions.find((d) => d.id === input.directionId || d.bendId === input.directionId);
      if (!row) return toolMessage(DIRECTION_NOT_FOUND);
      const snapshot = toSnapshot({ canvas: loaded.canvas, state: loaded.state, directions, webUrl: canvasWebUrl(deps.appUrl(), input.canvasId) });
      const out = await reconcileDirection(deps, userId, snapshot, row);
      return toolResult(`${reconcileText(out)}\nWeb link: ${canvasWebUrl(deps.appUrl(), input.canvasId)}`, { canvasId: input.canvasId, ...out });
    } catch {
      console.error("[reconcile_direction] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createReconcileDirectionTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Reconcile direction",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
