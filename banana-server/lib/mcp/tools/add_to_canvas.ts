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
import { CULTURE_MESSAGE, cultureSchema, type Culture } from "@/lib/culture";
import { hexToOklch, normalizeHex } from "@/lib/palette";
import { checkMobbinScreen, MAX_MOBBIN_IMAGE_URL, MAX_MOBBIN_SOURCE_URL, MOBBIN_SITE } from "@/lib/sources/mobbin";
import { parseHttpUrl } from "@/lib/sources/url";
import { cleanStyles, MAX_STYLE_TAGS, STYLE_IDS, type StyleId } from "@/lib/styles/ids";
import { parseState } from "@/canvas/state";
import type { StoredNode } from "@/canvas/types";
import { placedWithThumbs } from "@/lib/vision/wrap";
import { fetchXPost, MAX_POST_URL, parsePostUrl, postCredit, X_SITE, type FetchPostOutcome } from "@/lib/xpost";
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
import { reconcileHintFor } from "./reconcile_direction";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "add_to_canvas";
export const MAX_ITEMS_PER_CALL = 50;
/** Longest "what to steal" note on a placed reference. */
export const MAX_NOTE = 280;
/** Longest build screenshot or build link URL. */
export const MAX_BUILD_URL = 2048;
/** Gap between a Frankenstein page and the builds placed next to it. */
const BUILD_GAP = 48;

export const TOOL_DESCRIPTION =
  "Place items on a canvas: references from search_references (by referenceId), Mobbin screens (screen: imageUrl and sourceUrl from the user's Mobbin connector), notes, swatches and sections. " +
  "Direction results go to that direction's section, art above UI. Per direction: 6 to 8 UI, 2 to 4 art. " +
  `A reference or screen can carry a note (up to ${MAX_NOTE} characters) on what to steal.`;

const item = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("reference"),
    referenceId: z.string().min(1).max(100),
    note: z.string().trim().min(1).max(MAX_NOTE).optional(),
    culture: cultureSchema.optional(),
    styles: z.array(z.enum(STYLE_IDS)).min(1).max(MAX_STYLE_TAGS).optional().describe("Style ids read from the thumbnail, main first (docs/styles)."),
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
    screenId: z.string().trim().min(1).max(100).optional(),
    culture: cultureSchema.optional(),
  }),
  z.object({
    type: z.literal("build"),
    imageUrl: z.string().trim().min(1).max(MAX_BUILD_URL),
    url: z.string().trim().min(1).max(MAX_BUILD_URL),
    stitchId: z.string().min(1).max(120),
    title: z.string().trim().min(1).max(200).optional(),
    note: z.string().trim().min(1).max(MAX_NOTE).optional(),
  }),
  z.object({
    type: z.literal("xpost"),
    url: z.string().trim().min(1).max(MAX_POST_URL),
    note: z.string().trim().min(1).max(MAX_NOTE).optional(),
    directionId: z.string().min(1).max(100).optional(),
    zone: z.enum(["ui", "art"]).optional(),
    culture: cultureSchema.optional(),
  }),
  z.object({ type: z.literal("note"), text: z.string().trim().min(1).max(2000), culture: cultureSchema.optional() }),
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
  items: z
    .array(item)
    .min(1)
    .max(MAX_ITEMS_PER_CALL)
    .describe(
      "A screen with the screenId of one already on the board refreshes its image in place (Mobbin image links expire). " +
        "A reference, screen or note can carry culture { tradition, region, community?, tier: 'open' | 'care' | 'sacred', meaning, credit, sourceUrl? }: the board shows a culture chip and the exports carry it. " +
        "A build { type: 'build', imageUrl, url, stitchId } is an https screenshot link of the user's own build, placed next to its Frankenstein page for side by side review; never image bytes. " +
        "An xpost { type: 'xpost', url, note?, directionId?, zone? } is one X post link (x.com/<handle>/status/<id>) the user or you found: the canvas shows X's official embed; nothing from X is stored but the link, author and text.",
    ),
  sectionId: z.string().min(1).max(120).optional().describe("Section to place the items in."),
  thumbs: z.boolean().optional().describe("Show a small thumbnail of each placed reference in the result; look at them before you write notes. Default true."),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  items: `items must be a list of 1 to ${MAX_ITEMS_PER_CALL} items. Each is { type: "reference", referenceId, note?, styles? } (styles: 1 or 2 style ids, main first; note up to ${MAX_NOTE} characters), { type: "screen", imageUrl, sourceUrl, title?, app?, platform? ("ios" or "web"), note?, directionId? } (a Mobbin screen: image_url and mobbin_url from the Mobbin connector; screenId refreshes one already placed), { type: "build", imageUrl, url, stitchId, title?, note? } (an https screenshot link of the user's build, next to its Frankenstein page), { type: "xpost", url, note?, directionId?, zone? } (one X post link), { type: "note", text }, any of reference, screen and note can add culture (tradition, region, community?, tier, meaning, credit, sourceUrl?), { type: "swatch", hex, role? } or { type: "section", title }.`,
  sectionId: "sectionId must be the id of a section on this canvas.",
};

type PlacedOut = {
  id: string;
  type: string;
  x: number;
  y: number;
  sectionId: string | null;
  /** Image items: what the tile shows, for the thumbnails in the result. */
  imageUrl?: string;
  thumbUrl?: string;
  title?: string;
  sourceSite?: string;
};

export type AddToCanvasOutput = {
  canvasId: string;
  items: PlacedOut[];
  /** Mobbin screens already on the board whose image was refreshed in place. */
  updated?: PlacedOut[];
  skipped: { index: number; reason: string }[];
  webUrl: string;
};

type Prepared = { node: NewNode; directionId?: string; stitchId?: string; refresh?: string } | { skip: string };

/** A clean https URL (no credentials) within MAX_BUILD_URL characters, or null. */
function httpsUrl(value: string): URL | null {
  if (value.length > MAX_BUILD_URL) return null;
  const url = parseHttpUrl(value);
  return url && url.protocol === "https:" && !url.username && !url.password ? url : null;
}

/** Absolute position of a stored node (children of a section are stored relative to it). */
function absolute(nodes: readonly StoredNode[], n: StoredNode): { x: number; y: number } {
  const parent = n.parentId ? nodes.find((p) => p.id === n.parentId) : undefined;
  return { x: n.x + (parent?.x ?? 0), y: n.y + (parent?.y ?? 0) };
}

function imageOut(node: StoredNode | NewNode): Pick<PlacedOut, "imageUrl" | "thumbUrl" | "title" | "sourceSite"> {
  if (node.type !== "image") return {};
  const d = node.data;
  return { imageUrl: d.imageUrl, ...(d.thumbUrl ? { thumbUrl: d.thumbUrl } : {}), ...(d.title ? { title: d.title } : {}), sourceSite: d.sourceSite };
}

function referenceNode(ref: {
  imageUrl: string;
  thumbUrl?: string | null;
  sourceUrl: string;
  sourceSite?: string | null;
  title?: string | null;
  width?: number | null;
  height?: number | null;
}, extra: { note?: string; zone: Zone; culture?: Culture; styles?: StyleId[] }): NewNode {
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
      ...(extra.culture ? { culture: extra.culture } : {}),
      ...(extra.styles?.length ? { styles: extra.styles } : {}),
      width: ref.width ?? null,
      height: ref.height ?? null,
    },
  };
}

function text(out: AddToCanvasOutput, title: string): string {
  const lines = [`Added ${out.items.length} item${out.items.length === 1 ? "" : "s"} to "${title}".${out.updated?.length ? ` Refreshed ${out.updated.length}.` : ""}`];
  for (const it of out.items) lines.push(`- ${it.type} ${it.id} at (${it.x}, ${it.y})${it.sectionId ? ` in section ${it.sectionId}` : ""}`);
  for (const u of out.updated ?? []) lines.push(`- refreshed the image of ${u.type} ${u.id} in place`);
  for (const s of out.skipped) lines.push(`Skipped item ${s.index + 1}: ${s.reason}`);
  lines.push(`Web link: ${out.webUrl}`);
  return lines.join("\n");
}

export type AddToCanvasDeps = CanvasToolDeps & {
  /** X's oEmbed lookup (lib/xpost), injectable so tests never call X. */
  fetchXPost?: (url: string) => Promise<FetchPostOutcome>;
};

const X_MISSING: Record<"bad_url" | "not_found" | "unavailable", string> = {
  bad_url: "that is not a link to one X post (x.com/<handle>/status/<id>).",
  not_found: "X says that post does not exist, was deleted or is private.",
  unavailable: "X did not answer for that post. Try again in a minute.",
};

export function createAddToCanvasTool(deps: AddToCanvasDeps) {
  return async function addToCanvas(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, MESSAGES.items!);
    if (!parsed.ok) {
      // A bad culture object gets its own message (parseArgs only names the top field).
      const bad = inputSchema.safeParse(raw ?? {});
      const inCulture = !bad.success && bad.error.issues.some((i) => i.path.includes("culture"));
      return toolMessage(inCulture ? CULTURE_MESSAGE : parsed.message);
    }
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
      // X posts: author and text from X's oEmbed (cached by post id), before the canvas is locked.
      const lookup = deps.fetchXPost ?? ((url: string) => fetchXPost(url));
      const xposts = new Map<number, FetchPostOutcome>();
      await Promise.all(
        input.items.map(async (it, i) => {
          if (it.type !== "xpost") return;
          xposts.set(i, parsePostUrl(it.url) ? await lookup(it.url) : { ok: false, reason: "bad_url" });
        }),
      );

      const placedAt = (deps.now?.() ?? new Date()).toISOString();
      const outcome = await mutateCanvas<{ placed: PlacedOut[]; updated: PlacedOut[]; skipped: { index: number; reason: string }[] }>(repos, userId, input.canvasId, loadMatcher, (state) => {
        if (input.sectionId && !state.nodes.some((n) => n.id === input.sectionId && n.type === "section")) {
          return { error: "That section was not found on this canvas. Call get_canvas to see section ids." };
        }
        const tray = new Map(state.tray.map((r) => [r.id, r]));
        const prepared: Prepared[] = input.items.map((it, index) => {
          switch (it.type) {
            case "reference": {
              const row = saved.get(it.referenceId);
              const fromTray = tray.get(it.referenceId);
              const ref = row ?? fromTray;
              if (!ref) return { skip: `reference ${it.referenceId} was not found for this canvas. Search with this canvasId first.` };
              if (matcher.isReferenceBlocked(ref)) return { skip: `reference ${it.referenceId} was removed after a takedown request.` };
              // Zone: the tray's tag from the search, else the saved row's lane ("art" lane is art direction).
              const zone = fromTray?.zone ?? (row?.lane === "art" ? "art" : "ui");
              // Style tags: the agent's own, else the tray's from the search or an earlier rating.
              const styles = cleanStyles(it.styles) ?? fromTray?.styles;
              return {
                node: referenceNode(ref, { zone, ...(it.note ? { note: it.note } : {}), ...(it.culture ? { culture: it.culture } : {}), ...(styles ? { styles } : {}) }),
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
                { zone: "ui", ...(it.note ? { note: it.note } : {}), ...(it.culture ? { culture: it.culture } : {}) },
              );
              if (node.type === "image") Object.assign(node.data, { placedAt, ...(it.screenId ? { mobbinId: it.screenId } : {}) });
              // The same screen already on the board: refresh its image link in place (Mobbin links expire).
              const existing = state.nodes.find(
                (n) =>
                  n.type === "image" &&
                  n.data.sourceSite === MOBBIN_SITE &&
                  it.screenId !== undefined &&
                  (n.data.mobbinId === it.screenId || (!n.data.mobbinId && n.data.sourceUrl === it.sourceUrl)),
              );
              if (existing) return { node, refresh: existing.id };
              // Mobbin gives no image size: an iPhone screen gets a phone shaped tile.
              if (it.platform === "ios") Object.assign(node, referenceSize(9, 19.5));
              return { node, ...(it.directionId ? { directionId: it.directionId } : {}) };
            }
            case "build": {
              if (/^data:/i.test(it.imageUrl)) return { skip: "pass an https link to the screenshot, not image bytes. Nothing is stored." };
              const image = httpsUrl(it.imageUrl);
              const link = httpsUrl(it.url);
              if (!image) return { skip: "imageUrl must be an https link to a screenshot of the build." };
              if (!link) return { skip: "url must be the https link to the build." };
              if (!state.nodes.some((n) => n.type === "stitch" && n.id === it.stitchId)) {
                return { skip: `Frankenstein page ${it.stitchId} was not found on this canvas. Call get_canvas to see page ids.` };
              }
              const ref = { imageUrl: image.toString(), sourceUrl: link.toString() };
              if (matcher.isReferenceBlocked(ref)) return { skip: "that link was removed after a takedown request." };
              const node = referenceNode({ ...ref, title: it.title ?? "Build" }, { zone: "ui", ...(it.note ? { note: it.note } : {}) });
              if (node.type === "image") Object.assign(node.data, { kind: "build" as const, stitchId: it.stitchId, placedAt });
              return { node, stitchId: it.stitchId };
            }
            case "xpost": {
              const found = xposts.get(index);
              if (!found?.ok) return { skip: X_MISSING[found?.reason ?? "unavailable"] };
              const p = found.post;
              const profile = `https://x.com/${p.authorHandle}`;
              if (matcher.isBlocked(p.url) || matcher.isBlocked(profile)) return { skip: "that post was removed after a takedown request." };
              if (state.nodes.some((n) => n.type === "xpost" && n.data.postId === p.postId)) {
                return { skip: `${postCredit(p)} is already on this canvas.` };
              }
              const node: NewNode = {
                type: "xpost",
                data: {
                  sourceUrl: p.url,
                  sourceSite: X_SITE,
                  postId: p.postId,
                  authorName: p.authorName,
                  authorHandle: p.authorHandle,
                  text: p.text,
                  note: it.note ?? null,
                  tag: null,
                  ...(it.zone === "art" ? { zone: "art" as const } : {}),
                  ...(it.culture ? { culture: it.culture } : {}),
                  placedAt,
                },
              };
              return { node, ...(it.directionId ? { directionId: it.directionId } : {}) };
            }
            case "note":
              return { node: { type: "note", data: { text: it.text, color: "yellow", ...(it.culture ? { culture: it.culture } : {}) } } };
            case "swatch": {
              const hex = normalizeHex(it.hex.startsWith("#") ? it.hex : `#${it.hex}`);
              return { node: { type: "swatch", data: { hex, oklch: hexToOklch(hex), role: it.role ?? null, tag: "explore" } } };
            }
            case "section":
              return { node: { type: "section", data: { title: it.title, ...(it.directionId ? { directionId: it.directionId } : {}) } } };
          }
        });

        // Refreshes change tiles in place; builds go next to their Frankenstein page; the rest are appended.
        const updated: PlacedOut[] = [];
        let base = state;
        for (const p of prepared) {
          if (!("node" in p) || !p.refresh || p.node.type !== "image") continue;
          const fresh = p.node.data;
          base = {
            ...base,
            nodes: base.nodes.map((n) => {
              if (n.id !== p.refresh || n.type !== "image") return n;
              const data = {
                ...n.data,
                imageUrl: fresh.imageUrl,
                thumbUrl: null,
                ...(fresh.placedAt ? { placedAt: fresh.placedAt } : {}),
                ...(fresh.mobbinId ? { mobbinId: fresh.mobbinId } : {}),
                ...(fresh.note ? { note: fresh.note } : {}),
                ...(fresh.culture ? { culture: fresh.culture } : {}),
              };
              const abs = absolute(base.nodes, n);
              updated.push({ id: n.id, type: n.type, x: abs.x, y: abs.y, sectionId: n.parentId ?? null, ...imageOut({ ...n, data }) });
              return { ...n, data };
            }),
          };
        }
        const builds = prepared.flatMap((p) => ("node" in p && p.stitchId ? [p] : []));
        const nodes = prepared.flatMap((p) => ("node" in p && !p.refresh && !p.stitchId ? [p] : []));
        if (nodes.length === 0 && builds.length === 0 && updated.length === 0) return { error: prepared.map((p, i) => ("skip" in p ? `Item ${i + 1}: ${p.skip}` : "")).filter(Boolean).join("\n") };

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

        const adding = autoSections.length + nodes.length + builds.length;
        if (adding > 0) {
          const cap = canAddItems(plan, itemCount(state), adding, { upgradeUrl: upgradeUrl(deps), now: deps.now?.() });
          if (!cap.ok) return { error: cap.message };
        }

        const buildPlaced: PlacedOut[] = [];
        for (const b of builds) {
          const page = base.nodes.find((n) => n.type === "stitch" && n.id === b.stitchId)!;
          // Right of the page, below any build already there.
          const beside = base.nodes.filter((n) => n.type === "image" && n.data.kind === "build" && n.data.stitchId === b.stitchId);
          const x = page.x + page.w + BUILD_GAP;
          const y = beside.length > 0 ? Math.max(...beside.map((n) => n.y + n.h)) + BUILD_GAP : page.y;
          const id = (deps.makeId ?? newNodeId)("img");
          const stored = { id, type: "image", x, y, w: page.w, h: page.h, ...(page.parentId ? { parentId: page.parentId } : {}), data: b.node.data } as StoredNode;
          base = { ...base, nodes: [...base.nodes, stored] };
          const abs = absolute(base.nodes, stored);
          buildPlaced.push({ id, type: "image", x: abs.x, y: abs.y, sectionId: page.parentId ?? null, ...imageOut(stored) });
        }

        const all = [...autoSections, ...nodes.map((p) => p.node)];
        const targetFor = (_node: NewNode, i: number): string | null => {
          if (input.sectionId) return input.sectionId;
          const dir = nodes[i - autoSections.length]?.directionId;
          return dir ? sectionByDirection.get(dir) ?? null : null;
        };
        const appended = all.length > 0 ? appendNodes(base, all, targetFor, deps.makeId) : { state: parseState(base), placed: [] as PlacedNode[] };
        const next = appended.state;
        const placed: PlacedOut[] = [
          ...appended.placed.map((p, i) => ({ id: p.id, type: p.type, x: p.x, y: p.y, sectionId: p.sectionId, ...imageOut(all[i]!) })),
          ...buildPlaced,
        ];

        // Placed references leave the tray, as when the user drags them in.
        const placedRefs = new Set(input.items.flatMap((it, i) => (it.type === "reference" && "node" in prepared[i]! ? [it.referenceId] : [])));
        const finalState = { ...next, tray: next.tray.filter((r) => !placedRefs.has(r.id)) };

        const skipped = prepared.flatMap((p, index) => ("skip" in p ? [{ index, reason: p.skip }] : []));
        return { state: finalState, value: { placed, updated, skipped } };
      });
      if (!outcome.ok) return mutateError(outcome);

      const out: AddToCanvasOutput = {
        canvasId: input.canvasId,
        items: outcome.value.placed,
        ...(outcome.value.updated.length > 0 ? { updated: outcome.value.updated } : {}),
        skipped: outcome.value.skipped,
        webUrl: canvasWebUrl(deps.appUrl(), input.canvasId),
      };
      const hint = await reconcileHintFor(deps.repos, userId, outcome.canvas, outcome.state);
      return toolResult(`${text(out, outcome.canvas.title)}${hint ? `\n${hint}` : ""}`, out);
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
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, ctx) => placedWithThumbs(await live(args, authExtra(ctx)?.userId), args),
  );
};
