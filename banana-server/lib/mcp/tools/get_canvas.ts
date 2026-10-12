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
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "get_canvas";

export const TOOL_DESCRIPTION =
  "Read a canvas: its brief, directions (platform, pages, kept or not, visual spec), sections, items with their source links and notes, swatches and palettes. " +
  "Also the parts library and the Frankenstein pages. Use it to see what the user kept or changed before next steps or export. " +
  "Leave out canvasId to list the user's recent canvases, so you can add to one instead of creating another.";

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100).optional().describe("Canvas to read. Leave out to list recent canvases."),
});

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
      return `${it.type} ${it.id}: ${it.title ?? "Untitled"} (${it.sourceSite}) ${it.sourceUrl}${it.zone === "art" ? " [art direction]" : ""}${it.tag ? ` [${it.tag}]` : ""}${it.note ? ` note: ${it.note}` : ""}`;
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
  lines.push("Always show each reference's source link next to it.");
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
    const { canvasId } = parsed.data;
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
      const { parts: _p, stitches: _s, ...rest } = compactDirections(canvas);
      const out: GetCanvasOutput = { canvas: rest, tray: loaded.state.tray, parts: partsByRole(canvas), stitches: stitchOverview(canvas) };
      return toolResult(canvasText(canvas, loaded.state.tray.length), out);
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
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
