/**
 * `extract_palette` (spec section 6): colors and WCAG contrast from image items on a canvas.
 *
 * Hard rule 2 exception: thumbnails are fetched into memory only (allowlisted hosts,
 * checked on every redirect), decoded, sampled and dropped. Bytes never reach the
 * database, the canvas state, a cache or a log. Only hex colors and ratios are saved.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { appendNodes, canvasWebUrl, itemCount, loadCanvas, mutateCanvas, type NewNode, type PlacedNode } from "@/lib/canvas/store";
import {
  DEFAULT_SIZE,
  extractPalette,
  fetchThumbIntoMemory,
  MAX_SIZE,
  MIN_SIZE,
  type ContrastPair,
} from "@/lib/palette";
import type { FetchLike } from "@/lib/palette/fetch";
import { canAddItems } from "@/lib/quota";
import { allowlistFromEnv, isAllowedImageUrl, type ImageHostAllowlist } from "@/lib/sources/allowlist";
import {
  CANVAS_NOT_FOUND,
  lazyTool,
  mutateError,
  plausibleId,
  takedownLoader,
  TRY_AGAIN,
  upgradeUrl,
  type CanvasToolDeps,
} from "./canvas-shared";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "extract_palette";
export const MAX_IMAGES = 12;
/** Parallel thumbnail fetches. */
const CONCURRENCY = 4;

export const TOOL_DESCRIPTION =
  "Pull a color palette from image items on a canvas, with WCAG contrast checks. " +
  "Pairs tagged ship pass 4.5:1 for text; explore pairs are for concepts only. " +
  "Pass addSwatches to put the colors on the canvas as swatches.";

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  itemIds: z.array(z.string().min(1).max(120)).min(1).max(MAX_IMAGES).describe("Image item ids from get_canvas or add_to_canvas."),
  size: z.number().int().min(MIN_SIZE).max(MAX_SIZE).default(DEFAULT_SIZE).describe("Number of colors, 5 to 9. Default 6."),
  addSwatches: z.boolean().optional().describe("Also place the colors on the canvas as swatches."),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  itemIds: `itemIds must list 1 to ${MAX_IMAGES} image item ids from the canvas.`,
  size: `size must be a whole number from ${MIN_SIZE} to ${MAX_SIZE}.`,
  addSwatches: "addSwatches must be true or false.",
};

export type ExtractPaletteDeps = CanvasToolDeps & {
  fetchImpl?: FetchLike;
  allowlist?: () => ImageHostAllowlist;
};

export type ExtractPaletteOutput = {
  canvasId: string;
  paletteId: string;
  palette: { hex: string; oklch: string; role: string }[];
  contrast: ContrastPair[];
  skipped: { itemId: string; reason: string }[];
  swatches: { id: string; hex: string; x: number; y: number }[];
};

const SKIP_REASONS: Record<string, string> = {
  not_found: "not an image item on this canvas",
  not_allowed: "its image host is not on the allowlist",
  invalid_url: "its image link is not valid",
  host_not_allowed: "its image host is not on the allowlist",
  http_error: "the image could not be loaded",
  not_an_image: "the link did not return an image",
  too_large: "the image is too large",
  timeout: "the image took too long to load",
  network_error: "the image could not be loaded",
  too_many_redirects: "the image link redirects too many times",
  unsupported_format: "its format (for example WebP) is not supported yet",
  decode_failed: "the image could not be read",
};

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

function text(out: ExtractPaletteOutput): string {
  const lines = [`Palette of ${out.palette.length} colors:`];
  for (const c of out.palette) lines.push(`- ${c.hex} ${c.oklch} (${c.role})`);
  const ship = out.contrast.filter((p) => p.tag === "ship");
  lines.push(`${ship.length} of ${out.contrast.length} contrast pairs pass 4.5:1 for text (ship); the rest are explore only.`);
  for (const p of ship.slice(0, 8)) lines.push(`- ${p.fg} on ${p.bg}: ${p.ratio}:1`);
  for (const s of out.skipped) lines.push(`Skipped ${s.itemId}: ${s.reason}.`);
  if (out.swatches.length > 0) lines.push(`Added ${out.swatches.length} swatches to the canvas.`);
  return lines.join("\n");
}

export function createExtractPaletteTool(deps: ExtractPaletteDeps) {
  return async function extractPaletteTool(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, "Pass a canvasId and the itemIds of image items.");
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);

    try {
      const loadMatcher = takedownLoader(deps);
      const loaded = await loadCanvas(deps.repos, userId, input.canvasId, loadMatcher);
      if (!loaded) return toolMessage(CANVAS_NOT_FOUND);

      const allowlist = deps.allowlist?.() ?? allowlistFromEnv();
      const byId = new Map(loaded.state.nodes.map((n) => [n.id, n]));
      const skipped: { itemId: string; reason: string }[] = [];
      const targets: { itemId: string; url: string; sectionId: string | null }[] = [];
      for (const itemId of [...new Set(input.itemIds)]) {
        const node = byId.get(itemId);
        if (!node || (node.type !== "image" && node.type !== "upload")) {
          skipped.push({ itemId, reason: SKIP_REASONS.not_found! });
          continue;
        }
        const url = node.data.thumbUrl || node.data.imageUrl;
        if (!isAllowedImageUrl(url, allowlist)) {
          skipped.push({ itemId, reason: SKIP_REASONS.not_allowed! });
          continue;
        }
        targets.push({ itemId, url, sectionId: node.parentId ?? null });
      }

      // In memory only. Each result is dropped as soon as the palette is computed.
      const fetched = await mapLimit(targets, CONCURRENCY, (t) =>
        fetchThumbIntoMemory(t.url, { allowedHosts: allowlist.entries, fetchImpl: deps.fetchImpl }),
      );
      const images: Uint8Array[] = [];
      const imageItems: string[] = [];
      fetched.forEach((r, i) => {
        const t = targets[i]!;
        if (r.ok) {
          images.push(r.bytes);
          imageItems.push(t.itemId);
        } else {
          skipped.push({ itemId: t.itemId, reason: SKIP_REASONS[r.reason] ?? "the image could not be loaded" });
        }
      });
      if (images.length === 0) {
        return toolMessage(
          `No image could be read, so there is no palette. ${skipped.map((s) => `${s.itemId}: ${s.reason}.`).join(" ")}`.trim(),
        );
      }

      const result = extractPalette({ images, size: input.size });
      images.length = 0;
      for (const s of result.skipped) {
        const itemId = imageItems[s.index];
        if (itemId) skipped.push({ itemId, reason: SKIP_REASONS[s.reason] ?? "the image could not be read" });
      }
      if (result.palette.length === 0) {
        return toolMessage(`Could not find colors in those images. ${skipped.map((s) => `${s.itemId}: ${s.reason}.`).join(" ")}`.trim());
      }

      const palette = result.palette.map((c) => ({ hex: c.hex, oklch: c.oklch, role: c.role }));
      const paletteId = await deps.repos.palettes.insert(input.canvasId, palette, result.contrast);

      let swatches: ExtractPaletteOutput["swatches"] = [];
      if (input.addSwatches) {
        const shipHexes = new Set(result.contrast.filter((p) => p.tag === "ship").flatMap((p) => [p.fg, p.bg]));
        const sections = new Set(targets.map((t) => t.sectionId));
        const sectionId = sections.size === 1 ? [...sections][0] ?? null : null;
        const plan = await deps.repos.users.getPlan(userId);
        const nodes: NewNode[] = palette.map((c) => ({
          type: "swatch",
          data: { hex: c.hex, oklch: c.oklch, role: c.role, tag: shipHexes.has(c.hex) ? "ship" : "explore" },
        }));
        const outcome = await mutateCanvas<PlacedNode[]>(deps.repos, userId, input.canvasId, loadMatcher, (state) => {
          const cap = canAddItems(plan, itemCount(state), nodes.length, { upgradeUrl: upgradeUrl(deps), now: deps.now?.() });
          if (!cap.ok) return { error: cap.message };
          const { state: next, placed } = appendNodes(state, nodes, () => sectionId, deps.makeId);
          return { state: next, value: placed };
        });
        if (!outcome.ok) {
          const msg = mutateError(outcome).content[0]?.text ?? "";
          skipped.push({ itemId: "swatches", reason: `the palette was saved but swatches were not added: ${msg}` });
        } else {
          swatches = outcome.value.map((p, i) => ({ id: p.id, hex: palette[i]!.hex, x: p.x, y: p.y }));
        }
      }

      const out: ExtractPaletteOutput = { canvasId: input.canvasId, paletteId, palette, contrast: result.contrast, skipped, swatches };
      return toolResult(`${text(out)}\nWeb link: ${canvasWebUrl(deps.appUrl(), input.canvasId)}`, out);
    } catch {
      console.error("[extract_palette] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createExtractPaletteTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Extract palette",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
