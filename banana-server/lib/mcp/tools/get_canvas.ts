/**
 * `get_canvas` (spec section 6): read a canvas back as sections, items with source
 * links and notes, palettes and the brief. Takedown filter applied on load.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, loadCanvas, toSnapshot, type TrayReference } from "@/lib/canvas/store";
import type { CanvasItem, CanvasSnapshot } from "@/lib/canvas/types";
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
  "Read a canvas: its brief, directions, sections, items with their source links and notes, swatches and palettes. " +
  "Use it to see what the user kept or changed before you suggest next steps or export.";

export const inputSchema = z.object({ canvasId: z.string().min(1).max(100) });

export type GetCanvasOutput = { canvas: CanvasSnapshot; tray: TrayReference[] };

function describeItem(it: CanvasItem): string {
  switch (it.type) {
    case "image":
    case "upload":
      return `${it.type} ${it.id}: ${it.title ?? "Untitled"} (${it.sourceSite}) ${it.sourceUrl}${it.tag ? ` [${it.tag}]` : ""}${it.note ? ` note: ${it.note}` : ""}`;
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

export function canvasText(c: CanvasSnapshot, trayCount: number): string {
  const lines = [`Canvas "${c.title}" (id ${c.id}).`, `Web link: ${c.webUrl ?? ""}`];
  if (c.brief) lines.push(`Brief: ${c.brief}`);
  if (c.directions.length > 0) {
    lines.push("Directions:");
    for (const d of c.directions) lines.push(`- ${d.id}: ${d.title} (search: ${d.searchQuery})`);
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
  if (trayCount > 0) lines.push(`${trayCount} search results wait in the tray. Place them with add_to_canvas.`);
  lines.push("Always show each reference's source link next to it.");
  return lines.join("\n");
}

export function createGetCanvasTool(deps: CanvasToolDeps) {
  return async function getCanvas(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, {}, "Pass the canvasId from open_canvas.");
    if (!parsed.ok) return toolMessage(parsed.message);
    const { canvasId } = parsed.data;
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
      const out: GetCanvasOutput = { canvas, tray: loaded.state.tray };
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
