/**
 * `get_canvas` (spec section 6): read a canvas back as sections, items with source
 * links and notes, palettes and the brief. Takedown filter applied on load. Without a canvasId it
 * lists the user's recent canvases, so an agent in a new chat can extend a board instead of
 * starting another.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, loadCanvas, toSnapshot, type TrayReference } from "@/lib/canvas/store";
import type { CanvasDirection, CanvasItem, CanvasSnapshot } from "@/lib/canvas/types";
import { roleName, skeleton, skeletonLines, type SkeletonRow } from "@/lib/stitch/skeleton";
import { PART_ROLES, type Crop, type PartRole, type StitchMode, type StitchPlatform } from "@/lib/stitch/types";
import {
  CANVAS_NOT_FOUND,
  lazyTool,
  plausibleId,
  takedownLoader,
  TRY_AGAIN,
  type CanvasToolDeps,
} from "./canvas-shared";
import { canvasWithThumbs } from "@/lib/vision/wrap";
import { UNTRUSTED_NOTE, webTitle } from "@/lib/mcp/untrusted";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "get_canvas";

export const TOOL_DESCRIPTION =
  "Read a canvas: brief, directions with spec, sections, items with source links and notes, palettes, parts and Frankenstein pages. " +
  "Call it with summary: true first (ids, titles, roles, notes, directionIds only), then the full view only when you need the details. " +
  "Leave out canvasId to list the user's recent canvases, so you can add to one instead of creating another.";

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100).optional().describe("Canvas to read. Leave out to list recent canvases."),
  thumbs: z
    .boolean()
    .optional()
    .describe("Show small thumbnails of up to 12 placed references; look at them before you judge the board. Default true. Mobbin images that need a refresh are flagged either way."),
  summary: z.boolean().optional().describe("Compact view: ids, titles, roles, notes and directionIds only. Use it first."),
});

/** A full get_canvas text above this many characters ends with a hint to use summary mode. */
export const LARGE_RESULT = 12_000;

export type CanvasSummary = {
  canvasId: string;
  title: string;
  webUrl: string | null;
  directions: { id: string; title: string; verdict: "keep" | "drop" | null; reconciled: boolean }[];
  sections: { id: string; title: string; directionId: string | null }[];
  items: { id: string; type: string; title?: string; role?: string; note?: string; directionId?: string }[];
  parts: { id: string; role: string; note?: string }[];
  stitches: { id: string; title: string; directionId?: string }[];
};

const clip = (s: string | null | undefined, max: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
};

/** Summary mode: ids, titles, roles, notes and directionIds only (no specs, URLs or geometry). */
export function canvasSummary(c: CanvasSnapshot): CanvasSummary {
  const sectionDir = new Map(c.sections.map((s) => [s.id, s.directionId ?? null]));
  return {
    canvasId: c.id ?? "",
    title: c.title,
    webUrl: c.webUrl ?? null,
    directions: c.directions.map((d) => ({ id: d.id, title: d.title, verdict: d.detail?.verdict ?? null, reconciled: !!d.detail?.reconciled })),
    sections: c.sections.map((s) => ({ id: s.id, title: s.title, directionId: s.directionId ?? null })),
    items: c.items.map((it) => {
      const dir = it.sectionId ? sectionDir.get(it.sectionId) : null;
      const base = { id: it.id, type: it.type, ...(dir ? { directionId: dir } : {}) };
      switch (it.type) {
        case "image":
        case "upload":
          return { ...base, ...(it.title ? { title: clip(it.title, 80) } : {}), role: it.zone === "art" ? "art" : "ui", ...(it.note ? { note: clip(it.note, 160) } : {}) };
        case "note":
          return { ...base, note: clip(it.text, 160) };
        case "swatch":
          return { ...base, title: it.hex, ...(it.role ? { role: it.role } : {}) };
        case "typeSample":
          return { ...base, title: it.pairingId };
        case "section":
          return { ...base, title: it.title };
      }
    }),
    parts: (c.parts ?? []).map((p) => ({ id: p.id, role: p.role, ...(p.note ? { note: clip(p.note, 160) } : {}) })),
    stitches: (c.stitches ?? []).map((s) => ({ id: s.id, title: s.title, ...(s.directionId ? { directionId: s.directionId } : {}) })),
  };
}

export function summaryText(s: CanvasSummary): string {
  const lines = [`Canvas "${s.title}" (id ${s.canvasId}), summary. Web link: ${s.webUrl ?? ""}`];
  for (const d of s.directions) {
    lines.push(`Direction ${d.id}: ${d.title} [${d.verdict === "keep" ? "kept" : d.verdict === "drop" ? "dropped" : "not rated"}${d.reconciled ? ", reconciled" : ""}]`);
  }
  const byDir = new Map<string | null, CanvasSummary["items"]>();
  for (const it of s.items) byDir.set(it.directionId ?? null, [...(byDir.get(it.directionId ?? null) ?? []), it]);
  for (const [dir, items] of byDir) {
    lines.push(dir ? `Items of direction ${dir}:` : "Items with no direction:");
    for (const it of items) lines.push(`  - ${it.type} ${it.id}${it.role ? ` (${it.role})` : ""}${it.title ? `: ${webTitle(it.title)}` : ""}${it.note ? ` note: ${it.note}` : ""}`);
  }
  if (s.parts.length > 0) lines.push(`Parts: ${s.parts.map((p) => `${p.id} (${p.role})`).join(", ")}`);
  for (const st of s.stitches) lines.push(`Frankenstein page ${st.id}: ${st.title}${st.directionId ? ` (direction ${st.directionId})` : ""}`);
  lines.push("Call get_canvas without summary for specs, source links and palettes. Always show each reference's source link when you mention it.", UNTRUSTED_NOTE);
  return lines.join("\n");
}

/** Canvases the list shows, most recently updated first. */
export const RECENT_CANVASES = 10;

export type PartSummary = { id: string; role: PartRole; sourceSite: string; sourceUrl: string; title?: string; crop: Crop; note?: string; guessed?: boolean };
export type StitchOverview = { id: string; title: string; platform: StitchPlatform; mode: StitchMode; note?: string; variantOf?: string; skeleton: SkeletonRow[] };

export type GetCanvasOutput = {
  canvas: Omit<CanvasSnapshot, "parts" | "stitches">;
  tray: TrayReference[];
  /** Parts library grouped by role (roles with parts only, in PART_ROLES order). */
  parts: { role: PartRole; parts: PartSummary[] }[];
  /** Frankenstein pages (stitch frames), compact. */
  stitches: StitchOverview[];
};

export function partsByRole(c: CanvasSnapshot): GetCanvasOutput["parts"] {
  const list = c.parts ?? [];
  return PART_ROLES.flatMap((role) => {
    const parts = list
      .filter((p) => p.role === role)
      .map((p) => ({
        id: p.id,
        role: p.role,
        sourceSite: p.sourceSite,
        sourceUrl: p.sourceUrl,
        ...(p.title ? { title: p.title } : {}),
        crop: p.crop,
        ...(p.note ? { note: p.note } : {}),
        ...(p.guessedCrop ? { guessed: true } : {}),
      }));
    return parts.length > 0 ? [{ role, parts }] : [];
  });
}

export function stitchOverview(c: CanvasSnapshot): StitchOverview[] {
  return (c.stitches ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    platform: s.platform,
    mode: s.mode,
    ...(s.note ? { note: s.note } : {}),
    ...(s.variantOf ? { variantOf: s.variantOf } : {}),
    skeleton: skeleton(s.rows),
  }));
}

/** Text lines for the parts library and the Frankenstein pages. */
export function stitchLines(c: CanvasSnapshot): string[] {
  const lines: string[] = [];
  const groups = partsByRole(c);
  if (groups.length > 0) {
    lines.push(`Parts library (${(c.parts ?? []).length}):`);
    for (const g of groups) {
      lines.push(`  ${roleName(g.role)}:`);
      for (const p of g.parts) lines.push(`    - ${p.id} from ${p.sourceSite} ${p.sourceUrl}${p.guessed ? " (guessed crop)" : ""}${p.note ? ` note: ${p.note}` : ""}`);
    }
  }
  const stitches = c.stitches ?? [];
  if (stitches.length > 0) {
    lines.push(`Frankenstein pages (${stitches.length}):`);
    for (const s of stitches) {
      lines.push(`- ${s.title} (${s.id}, ${s.platform}, ${s.mode})${s.variantOf ? ` remix of ${s.variantOf}` : ""}${s.note ? `: ${s.note}` : ""}`);
      lines.push(...(s.rows.length > 0 ? skeletonLines(s.rows, "    ") : ["    (no rows yet)"]));
    }
  }
  return lines;
}

function describeItem(it: CanvasItem): string {
  switch (it.type) {
    case "image":
    case "upload":
      return `${it.type} ${it.id}: ${webTitle(it.title)} (${it.sourceSite}) ${it.sourceUrl}${it.zone === "art" ? " [art direction]" : ""}${it.tag ? ` [${it.tag}]` : ""}${it.note ? ` note: ${it.note}` : ""}`;
    case "note":
      return `note ${it.id}: ${it.text.replace(/\s+/g, " ").slice(0, 200)}`;
    case "swatch":
      return `swatch ${it.id}: ${it.hex}${it.role ? ` ${it.role}` : ""} [${it.tag}]`;
    case "typeSample":
      return `type sample ${it.id}: ${it.pairingId}`;
    case "section":
      return `section ${it.id}: ${it.title}`;
  }
}

/** Platform, pages, verdict and a compact visual spec of one direction, indented under it. */
export function directionDetailLines(d: CanvasDirection): string[] {
  const det = d.detail;
  const verdict = det?.verdict === "keep" ? "kept" : det?.verdict === "drop" ? "dropped" : "not rated";
  const head = [det?.platform ? `platform ${det.platform}` : null, det?.pages?.length ? `pages: ${det.pages.join(", ")}` : null, verdict];
  const lines = [`  ${head.filter(Boolean).join("; ")}`];
  const spec = det?.spec;
  if (spec) {
    const parts = [
      `type ${spec.typeVoice}`,
      spec.signature && `signature: ${spec.signature}`,
      spec.pattern && `pattern: ${spec.pattern}`,
      spec.layout && `layout: ${spec.layout}`,
      spec.color && `color: ${spec.color}`,
      spec.styleWords.length > 0 && `style: ${spec.styleWords.join(", ")}`,
    ].filter(Boolean);
    lines.push(`  spec: ${parts.join(" | ")}`);
  }
  return lines;
}

/** get_canvas leaves out the long build prompt; exports read the full detail from the snapshot. */
function compactDirections(c: CanvasSnapshot): CanvasSnapshot {
  return {
    ...c,
    directions: c.directions.map((d) => {
      if (!d.detail) return d;
      const { prompt: _prompt, ...detail } = d.detail;
      return { ...d, detail };
    }),
  };
}

export function canvasText(c: CanvasSnapshot, trayCount: number): string {
  const lines = [`Canvas "${c.title}" (id ${c.id}).`, `Web link: ${c.webUrl ?? ""}`];
  if (c.brief) lines.push(`Brief: ${c.brief}`);
  if (c.directions.length > 0) {
    lines.push("Directions:");
    for (const d of c.directions) {
      lines.push(`- ${d.id}: ${d.title} (search: ${d.searchQuery})`);
      lines.push(...directionDetailLines(d));
    }
  }
  const bySection = new Map<string | null, CanvasItem[]>();
  for (const it of c.items) {
    const key = it.sectionId ?? null;
    bySection.set(key, [...(bySection.get(key) ?? []), it]);
  }
  for (const s of c.sections) {
    lines.push(`Section ${s.id}: ${s.title}${s.directionId ? ` (direction ${s.directionId})` : ""}`);
    for (const it of bySection.get(s.id) ?? []) lines.push(`  - ${describeItem(it)}`);
  }
  const loose = bySection.get(null) ?? [];
  if (loose.length > 0) {
    lines.push("Not in a section:");
    for (const it of loose) lines.push(`  - ${describeItem(it)}`);
  }
  if (c.items.length === 0 && c.sections.length === 0) lines.push("The canvas is empty.");
  c.palettes.forEach((p, i) => {
    lines.push(`Palette ${i + 1}: ${p.colors.map((col) => `${col.hex}${col.role ? ` ${col.role}` : ""}`).join(", ")}`);
  });
  lines.push(...stitchLines(c));
  if (trayCount > 0) lines.push(`${trayCount} search results wait in the tray. Place them with add_to_canvas.`);
  lines.push("Always show each reference's source link next to it.", UNTRUSTED_NOTE);
  return lines.join("\n");
}

async function listRecent(deps: CanvasToolDeps, userId: string): Promise<ToolResult> {
  try {
    const list = await deps.repos.canvases.listOwned(userId, { limit: RECENT_CANVASES });
    const canvases = list.map((c) => ({
      id: c.id,
      title: c.title,
      brief: c.brief,
      updatedAt: c.updatedAt.toISOString(),
      references: c.referenceCount,
      directions: c.directionCount,
      webUrl: canvasWebUrl(deps.appUrl(), c.id),
    }));
    if (canvases.length === 0) return toolResult("No canvases yet. Create one with new_canvas.", { canvases });
    const lines = ["Recent canvases, newest first:"];
    for (const c of canvases) {
      lines.push(`- ${c.id}: "${c.title}" (${c.references} references, ${c.directions} directions, updated ${c.updatedAt.slice(0, 10)})${c.brief ? ` brief: ${c.brief.replace(/\s+/g, " ").slice(0, 120)}` : ""}`);
    }
    lines.push("If the user's request continues one of these, pass its canvasId to bend_brief, search_references and add_to_canvas to add to it.");
    lines.push(
      "The directions count is the bend_brief directions saved on that board (kept or not rated). For the same brief, reuse its board instead of starting a new one; to start clean, bend again into it.",
    );
    return toolResult(lines.join("\n"), { canvases });
  } catch {
    console.error("[get_canvas] list failed");
    return toolMessage(TRY_AGAIN);
  }
}

export function createGetCanvasTool(deps: CanvasToolDeps) {
  return async function getCanvas(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, {}, "Pass a canvasId, or nothing to list recent canvases.");
    if (!parsed.ok) return toolMessage(parsed.message);
    const { canvasId, summary } = parsed.data;
    if (!canvasId) return listRecent(deps, userId);
    if (!plausibleId(canvasId)) return toolMessage(CANVAS_NOT_FOUND);

    try {
      const loaded = await loadCanvas(deps.repos, userId, canvasId, takedownLoader(deps));
      if (!loaded) return toolMessage(CANVAS_NOT_FOUND);
      const [directions, palettes] = await Promise.all([
        deps.repos.directions.listForCanvas(canvasId),
        deps.repos.palettes.listForCanvas(canvasId),
      ]);
      const canvas = toSnapshot({
        canvas: loaded.canvas,
        state: loaded.state,
        directions,
        palettes,
        webUrl: canvasWebUrl(deps.appUrl(), canvasId),
      });
      if (summary) {
        const s = canvasSummary(canvas);
        return toolResult(summaryText(s), s);
      }
      const { parts: _p, stitches: _s, ...rest } = compactDirections(canvas);
      const out: GetCanvasOutput = { canvas: rest, tray: loaded.state.tray, parts: partsByRole(canvas), stitches: stitchOverview(canvas) };
      let text = canvasText(canvas, loaded.state.tray.length);
      if (text.length > LARGE_RESULT) text += "\nThis board is large: next time call get_canvas with summary: true first, then read the full view only when you need the details.";
      return toolResult(text, out);
    } catch {
      console.error("[get_canvas] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createGetCanvasTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Read canvas",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args, ctx) => canvasWithThumbs(await live(args, authExtra(ctx)?.userId), args),
  );
};
