/**
 * `add_to_canvas` (spec section 6): place references, notes, swatches and sections.
 * Item caps per plan, all or nothing per call. References are resolved from the
 * `references` table (search results saved for this canvas), then from the canvas tray.
 * Screens are Mobbin screens the agent found with the user's own Mobbin connector
 * (lib/sources/mobbin.ts): checked URLs only, hotlinked, never fetched here.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import {
  appendNodes,
  canvasWebUrl,
  itemCount,
  mutateCanvas,
  newNodeId,
  referenceSize,
  siteFromUrl,
  type NewNode,
  type PlacedNode,
} from "@/lib/canvas/store";
import type { ReferenceRecord } from "@/lib/db/types";
import type { Zone } from "@/lib/direction-detail";
import { hexToOklch, normalizeHex } from "@/lib/palette";
import { checkMobbinScreen, MAX_MOBBIN_IMAGE_URL, MAX_MOBBIN_SOURCE_URL, MOBBIN_SITE } from "@/lib/sources/mobbin";
import { canAddItems } from "@/lib/quota";
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

export const TOOL_NAME = "add_to_canvas";
export const MAX_ITEMS_PER_CALL = 50;
/** Longest "what to steal" note on a placed reference. */
export const MAX_NOTE = 280;

export const TOOL_DESCRIPTION =
  "Place items on a canvas: references from search_references (by referenceId), Mobbin screens (screen: imageUrl and sourceUrl from the user's Mobbin connector), notes, swatches and sections. " +
  "Direction results go to that direction's section, art above UI. Per direction: 6 to 8 UI, 2 to 4 art. " +
  `A reference or screen can carry a note (up to ${MAX_NOTE} characters) on what to steal.`;

const item = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("reference"),
    referenceId: z.string().min(1).max(100),
    note: z.string().trim().min(1).max(MAX_NOTE).optional(),
  }),
  z.object({
    type: z.literal("screen"),
    imageUrl: z.string().trim().min(1).max(MAX_MOBBIN_IMAGE_URL),
    sourceUrl: z.string().trim().min(1).max(MAX_MOBBIN_SOURCE_URL),
    title: z.string().trim().min(1).max(200).optional(),
    app: z.string().trim().min(1).max(80).optional(),
    platform: z.enum(["ios", "web"]).optional(),
    note: z.string().trim().min(1).max(MAX_NOTE).optional(),
    directionId: z.string().min(1).max(100).optional(),
  }),
  z.object({ type: z.literal("note"), text: z.string().trim().min(1).max(2000) }),
  z.object({
    type: z.literal("swatch"),
    hex: z.string().regex(/^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i),
    role: z.string().trim().min(1).max(60).optional(),
  }),
  z.object({
    type: z.literal("section"),
    title: z.string().trim().min(1).max(120),
    directionId: z.string().min(1).max(100).optional(),
  }),
]);

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  items: z.array(item).min(1).max(MAX_ITEMS_PER_CALL),
  sectionId: z.string().min(1).max(120).optional().describe("Section to place the items in."),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  items: `items must be a list of 1 to ${MAX_ITEMS_PER_CALL} items. Each is { type: "reference", referenceId, note? } (note up to ${MAX_NOTE} characters), { type: "screen", imageUrl, sourceUrl, title?, app?, platform? ("ios" or "web"), note?, directionId? } (a Mobbin screen: image_url and mobbin_url from the Mobbin connector), { type: "note", text }, { type: "swatch", hex, role? } or { type: "section", title }.`,
  sectionId: "sectionId must be the id of a section on this canvas.",
};

export type AddToCanvasOutput = {
  canvasId: string;
  items: { id: string; type: string; x: number; y: number; sectionId: string | null }[];
  skipped: { index: number; reason: string }[];
  webUrl: string;
};

type Prepared = { node: NewNode; directionId?: string } | { skip: string };

function referenceNode(ref: {
  imageUrl: string;
  thumbUrl?: string | null;
  sourceUrl: string;
  sourceSite?: string | null;
  title?: string | null;
  width?: number | null;
  height?: number | null;
}, extra: { note?: string; zone: Zone }): NewNode {
  const size = referenceSize(ref.width, ref.height);
  return {
    type: "image",
    w: size.w,
    h: size.h,
    data: {
      imageUrl: ref.imageUrl,
      thumbUrl: ref.thumbUrl ?? null,
      sourceUrl: ref.sourceUrl,
      sourceSite: ref.sourceSite || siteFromUrl(ref.sourceUrl),
      title: ref.title ?? null,
      note: extra.note ?? null,
      tag: null,
      ...(extra.zone === "art" ? { zone: "art" as const } : {}),
      width: ref.width ?? null,
      height: ref.height ?? null,
    },
  };
}

function text(out: AddToCanvasOutput, title: string): string {
  const lines = [`Added ${out.items.length} item${out.items.length === 1 ? "" : "s"} to "${title}".`];
  for (const it of out.items) lines.push(`- ${it.type} ${it.id} at (${it.x}, ${it.y})${it.sectionId ? ` in section ${it.sectionId}` : ""}`);
  for (const s of out.skipped) lines.push(`Skipped item ${s.index + 1}: ${s.reason}`);
  lines.push(`Web link: ${out.webUrl}`);
  return lines.join("\n");
}

export function createAddToCanvasTool(deps: CanvasToolDeps) {
  return async function addToCanvas(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, MESSAGES.items!);
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);
    try {
      const { repos } = deps;
      const plan = await repos.users.getPlan(userId);
      const refIds = input.items.flatMap((i) => (i.type === "reference" ? [i.referenceId] : []));
      const owned = await repos.canvases.getOwned(userId, input.canvasId);
      if (!owned) return toolMessage(CANVAS_NOT_FOUND);
      const saved: Map<string, ReferenceRecord> =
        refIds.length > 0 ? await repos.references.getByIds(input.canvasId, refIds) : new Map();
      const directions = await repos.directions.listForCanvas(input.canvasId);
      const directionTitles = new Map(directions.map((d) => [d.bendId ?? d.id, d.title]));
      const loadMatcher = takedownLoader(deps);
      const matcher = await loadMatcher();

      const outcome = await mutateCanvas<{ placed: PlacedNode[]; skipped: { index: number; reason: string }[] }>(repos, userId, input.canvasId, loadMatcher, (state) => {
        if (input.sectionId && !state.nodes.some((n) => n.id === input.sectionId && n.type === "section")) {
          return { error: "That section was not found on this canvas. Call get_canvas to see section ids." };
        }
        const tray = new Map(state.tray.map((r) => [r.id, r]));
        const prepared: Prepared[] = input.items.map((it) => {
          switch (it.type) {
            case "reference": {
              const row = saved.get(it.referenceId);
              const fromTray = tray.get(it.referenceId);
              const ref = row ?? fromTray;
              if (!ref) return { skip: `reference ${it.referenceId} was not found for this canvas. Search with this canvasId first.` };
              if (matcher.isReferenceBlocked(ref)) return { skip: `reference ${it.referenceId} was removed after a takedown request.` };
              // Zone: the tray's tag from the search, else the saved row's lane ("art" lane is art direction).
              const zone = fromTray?.zone ?? (row?.lane === "art" ? "art" : "ui");
              return {
                node: referenceNode(ref, { zone, ...(it.note ? { note: it.note } : {}) }),
                ...(fromTray?.directionId ? { directionId: fromTray.directionId } : {}),
              };
            }
            case "screen": {
              const check = checkMobbinScreen(it.sourceUrl, it.imageUrl);
              if (!check.ok) return { skip: check.reason };
              if (matcher.isReferenceBlocked(it)) return { skip: "that screen was removed after a takedown request." };
              const title = it.app && it.title ? `${it.app}: ${it.title}` : (it.title ?? it.app ?? "Mobbin screen");
              const node = referenceNode(
                { imageUrl: it.imageUrl, sourceUrl: it.sourceUrl, sourceSite: MOBBIN_SITE, title },
                { zone: "ui", ...(it.note ? { note: it.note } : {}) },
              );
              // Mobbin gives no image size: an iPhone screen gets a phone shaped tile.
              if (it.platform === "ios") Object.assign(node, referenceSize(9, 19.5));
              return { node, ...(it.directionId ? { directionId: it.directionId } : {}) };
            }
            case "note":
              return { node: { type: "note", data: { text: it.text, color: "yellow" } } };
            case "swatch": {
              const hex = normalizeHex(it.hex.startsWith("#") ? it.hex : `#${it.hex}`);
              return { node: { type: "swatch", data: { hex, oklch: hexToOklch(hex), role: it.role ?? null, tag: "explore" } } };
            }
            case "section":
              return { node: { type: "section", data: { title: it.title, ...(it.directionId ? { directionId: it.directionId } : {}) } } };
          }
        });

        const nodes = prepared.flatMap((p) => ("node" in p ? [p] : []));
        if (nodes.length === 0) return { error: prepared.map((p, i) => ("skip" in p ? `Item ${i + 1}: ${p.skip}` : "")).filter(Boolean).join("\n") };

        // References found for a saved direction land in that direction's section,
        // which is created on first use (spec section 11: a direction becomes a section).
        const sectionByDirection = new Map<string, string>();
        for (const n of state.nodes) {
          if (n.type === "section" && n.data.directionId) sectionByDirection.set(n.data.directionId, n.id);
        }
        for (const p of nodes) {
          if (p.node.type === "section" && p.node.data.directionId && !p.node.id) {
            p.node.id = (deps.makeId ?? newNodeId)("sec");
            sectionByDirection.set(p.node.data.directionId, p.node.id);
          }
        }
        const autoSections: NewNode[] = [];
        if (!input.sectionId) {
          for (const p of nodes) {
            const dir = p.directionId;
            const title = dir ? directionTitles.get(dir) : undefined;
            if (!dir || !title || sectionByDirection.has(dir)) continue;
            const id = (deps.makeId ?? newNodeId)("sec");
            sectionByDirection.set(dir, id);
            autoSections.push({ type: "section", id, data: { title, directionId: dir } });
          }
        }

        const adding = autoSections.length + nodes.length;
        const cap = canAddItems(plan, itemCount(state), adding, { upgradeUrl: upgradeUrl(deps), now: deps.now?.() });
        if (!cap.ok) return { error: cap.message };

        const all = [...autoSections, ...nodes.map((p) => p.node)];
        const targetFor = (_node: NewNode, i: number): string | null => {
          if (input.sectionId) return input.sectionId;
          const dir = nodes[i - autoSections.length]?.directionId;
          return dir ? sectionByDirection.get(dir) ?? null : null;
        };
        const { state: next, placed } = appendNodes(state, all, targetFor, deps.makeId);

        // Placed references leave the tray, as when the user drags them in.
        const placedRefs = new Set(input.items.flatMap((it, i) => (it.type === "reference" && "node" in prepared[i]! ? [it.referenceId] : [])));
        const finalState = { ...next, tray: next.tray.filter((r) => !placedRefs.has(r.id)) };

        const skipped = prepared.flatMap((p, index) => ("skip" in p ? [{ index, reason: p.skip }] : []));
        return { state: finalState, value: { placed, skipped } };
      });
      if (!outcome.ok) return mutateError(outcome);

      const out: AddToCanvasOutput = {
        canvasId: input.canvasId,
        items: outcome.value.placed.map((p: PlacedNode) => ({ id: p.id, type: p.type, x: p.x, y: p.y, sectionId: p.sectionId })),
        skipped: outcome.value.skipped,
        webUrl: canvasWebUrl(deps.appUrl(), input.canvasId),
      };
      return toolResult(text(out, outcome.canvas.title), out);
    } catch {
      console.error("[add_to_canvas] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createAddToCanvasTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Add to canvas",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
