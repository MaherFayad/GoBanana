/**
 * Shared wiring for the "Frankenstein it" tools (cut_parts, frankenstein_page, remix_frankenstein,
 * update_frankenstein). Not a tool itself. Internal names say "stitch"; every text the user or agent
 * reads says "Frankenstein page".
 */
import { z } from "zod";
import { appendNodes, parseState, resolveStitchRows, type NewNode, type PlacedNode } from "@/lib/canvas/store";
import type { CanvasState, StoredNode } from "@/canvas/types";
import { GAP } from "@/lib/layout";
import { skeleton, skeletonLines, type SkeletonRow } from "@/lib/stitch/skeleton";
import { stitchSize, STITCH_DISPLAY_WIDTH, STITCH_HEADER } from "@/lib/stitch/size";
import { PART_ROLES, STITCH_MODES, type Part, type StitchData } from "@/lib/stitch/types";

/** Title of the canvas section that holds Frankenstein pages. */
export const STITCH_SECTION_TITLE = "Frankenstein pages";
export const SECTION_PAD = 16;

export const roleSchema = z.enum(PART_ROLES);
export const modeSchema = z.enum(STITCH_MODES);
export const platformSchema = z.enum(["mobile", "tablet", "website", "webapp"]);
export const cropSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().gt(0).max(1),
    h: z.number().gt(0).max(1),
  })
  .describe("Crop as fractions (0 to 1) of the image: x and y from the top left, w and h the size.");
export const idSchema = z.string().min(1).max(120);

export const ROLES_TEXT = PART_ROLES.join(", ");

/** "pt-" + a short id, unique in the library. */
export function newPartId(makeId: (prefix: string) => string, taken: Set<string>): string {
  for (let i = 0; i < 20; i++) {
    const raw = makeId("pt").replace(/^pt_/, "").replace(/-/g, "").slice(0, 12);
    const id = `pt-${raw}`;
    if (!taken.has(id)) {
      taken.add(id);
      return id;
    }
  }
  throw new Error("could not make a part id");
}

/** "st-" + id for a new stitch frame (the plugin and the UI read the prefix). */
export function newStitchId(makeId: (prefix: string) => string): string {
  return makeId("st").replace(/^st_/, "st-");
}

/** The section that holds Frankenstein pages, when the canvas has one. */
export function stitchSectionId(state: CanvasState): string | undefined {
  return state.nodes.find((n) => n.type === "section" && n.data.title === STITCH_SECTION_TITLE)?.id;
}

export function stitchNodes(state: CanvasState): Extract<StoredNode, { type: "stitch" }>[] {
  return state.nodes.filter((n): n is Extract<StoredNode, { type: "stitch" }> => n.type === "stitch");
}

/**
 * Place new stitch frames side by side in the "Frankenstein pages" section, creating it when
 * missing (to the right of the board). Returns the new state, the placed frames and the section id.
 */
export function placeInStitchSection(
  state: CanvasState,
  stitches: readonly StitchData[],
  makeId: (prefix: string) => string,
): { state: CanvasState; placed: PlacedNode[]; sectionId: string; createdSection: boolean } {
  const parts = state.parts ?? [];
  const existing = stitchSectionId(state);
  const sectionId = existing ?? makeId("sec");
  const nodes: NewNode[] = [];
  if (!existing) nodes.push({ type: "section", id: sectionId, data: { title: STITCH_SECTION_TITLE } });
  for (const data of stitches) {
    const size = stitchSize(data, parts);
    nodes.push({ type: "stitch", id: newStitchId(makeId), data, w: size.w, h: size.h });
  }
  const out = appendNodes(state, nodes, (n) => (n.type === "section" ? null : sectionId), makeId);
  return { state: out.state, placed: out.placed.filter((p) => p.type === "stitch"), sectionId, createdSection: !existing };
}

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Place remixed frames in a row right of the original, in the same section. When that space is
 * taken, they go in the "Frankenstein pages" section like new pages.
 */
export function placeRightOf(
  state: CanvasState,
  original: StoredNode,
  stitches: readonly StitchData[],
  makeId: (prefix: string) => string,
): { state: CanvasState; placed: PlacedNode[] } {
  const parts = state.parts ?? [];
  const siblings = state.nodes.filter((n) => n.id !== original.id && (n.parentId ?? null) === (original.parentId ?? null));
  let x = original.x + original.w + GAP;
  const fresh: StoredNode[] = [];
  for (const data of stitches) {
    const size = stitchSize(data, parts);
    // Same display scale as the original when the user resized it.
    const scale = original.w / (STITCH_DISPLAY_WIDTH[(original.data as StitchData).platform] ?? original.w);
    const w = Math.round(size.w * (Number.isFinite(scale) && scale > 0 ? scale : 1));
    const h = Math.round(STITCH_HEADER + (size.h - STITCH_HEADER) * (w / size.w));
    const rect = { x, y: original.y, w, h };
    if (siblings.some((s) => overlaps(rect, s))) {
      const out = placeInStitchSection(state, stitches, makeId);
      return { state: out.state, placed: out.placed };
    }
    fresh.push({ id: newStitchId(makeId), type: "stitch", x, y: original.y, w, h, ...(original.parentId ? { parentId: original.parentId } : {}), data } as StoredNode);
    x += w + GAP;
  }
  let nodes = [...state.nodes, ...fresh];
  const parent = original.parentId ? state.nodes.find((n) => n.id === original.parentId) : undefined;
  if (parent && parent.type === "section") {
    const right = Math.max(...fresh.map((n) => n.x + n.w)) + SECTION_PAD;
    const bottom = Math.max(...fresh.map((n) => n.y + n.h)) + SECTION_PAD;
    nodes = nodes.map((n) => {
      if (n.id !== parent.id || n.type !== "section") return n;
      if (n.data.collapsed) return { ...n, w: Math.max(n.w, right), data: { ...n.data, expandedHeight: Math.max(n.data.expandedHeight ?? 0, bottom) } };
      return { ...n, w: Math.max(n.w, right), h: Math.max(n.h, bottom) };
    });
  }
  const px = parent?.x ?? 0;
  const py = parent?.y ?? 0;
  return {
    state: parseState({ ...state, nodes }),
    placed: fresh.map((n) => ({ id: n.id, type: "stitch", x: n.x + px, y: n.y + py, w: n.w, h: n.h, sectionId: parent?.id ?? null })),
  };
}

export type StitchSummary = {
  id: string;
  title: string;
  platform: StitchData["platform"];
  mode: StitchData["mode"];
  variant?: number;
  variantOf?: string;
  note?: string;
  skeleton: SkeletonRow[];
};

export function summarize(id: string, data: StitchData, parts: readonly Part[]): StitchSummary {
  return {
    id,
    title: data.title,
    platform: data.platform,
    mode: data.mode,
    ...(data.variant ? { variant: data.variant } : {}),
    ...(data.variantOf ? { variantOf: data.variantOf } : {}),
    ...(data.note ? { note: data.note } : {}),
    skeleton: skeleton(resolveStitchRows(data, parts)),
  };
}

/** Text block for one page: title line plus the numbered skeleton. */
export function stitchText(id: string, data: StitchData, parts: readonly Part[]): string[] {
  return [
    `- ${data.title} (${id}, ${data.platform}, ${data.mode})${data.note ? `: ${data.note}` : ""}`,
    ...skeletonLines(resolveStitchRows(data, parts), "    "),
  ];
}

export const SOURCE_REMINDER = "Show each slot's source link next to it. Take the structure, not the pixels.";
