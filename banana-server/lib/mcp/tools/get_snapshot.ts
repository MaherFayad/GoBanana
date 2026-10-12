/**
 * `get_snapshot`: let the agent see the board without a browser. For a section, the thumbnails of
 * its references with their positions; for a Frankenstein page (stitch), its rows in order, each
 * part's source image with its crop rect, role and note. A parts view, not a rendered composite:
 * nothing is drawn on the server. Thumbnails pass through lib/vision/thumbs.ts (memory only,
 * allowlisted hosts, small source sizes, capped per call).
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, loadCanvas, toSnapshot } from "@/lib/canvas/store";
import type { FetchLike } from "@/lib/palette/fetch";
import type { ImageHostAllowlist } from "@/lib/sources/allowlist";
import { boardView, sectionView, stitchView } from "@/lib/vision/snapshot";
import { MAX_THUMBS, thumbBlocks, type McpContent, type VisionResult } from "@/lib/vision/thumbs";
import { CANVAS_NOT_FOUND, lazyTool, plausibleId, takedownLoader, TRY_AGAIN, type CanvasToolDeps } from "./canvas-shared";
import { lenient, parseArgs, toolMessage, type RegisterTool } from "./types";

export const TOOL_NAME = "get_snapshot";

export const TOOL_DESCRIPTION =
  "See the board without a browser. With a sectionId: the thumbnails of that section's references with their positions. " +
  "With a stitchId: the Frankenstein page's rows in order, each part's source image with its crop rect (the band the page uses), role and note. " +
  "With neither: the board's sections, pages and first references. " +
  `This is a parts view, not a rendered composite image of the page. Up to ${MAX_THUMBS} thumbnails per call. ` +
  "Call it before you write any screen, and look at every image: build from what you see, not from titles.";

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  sectionId: z.string().min(1).max(120).optional().describe("Section to show."),
  stitchId: z.string().min(1).max(120).optional().describe("Frankenstein page (stitch) to show, part by part."),
  thumbs: z.boolean().optional().describe("Include the thumbnails. Default true."),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas or get_canvas.",
  sectionId: "sectionId must be a section id from get_canvas.",
  stitchId: "stitchId must be a Frankenstein page id from get_canvas.",
  thumbs: "thumbs must be true or false.",
};

export type GetSnapshotDeps = CanvasToolDeps & { fetchImpl?: FetchLike; allowlist?: () => ImageHostAllowlist };

export function createGetSnapshotTool(deps: GetSnapshotDeps) {
  return async function getSnapshot(raw: unknown, userId: string | undefined): Promise<VisionResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, "Pass a canvasId, and a sectionId or a stitchId.");
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);
    if (input.sectionId && input.stitchId) return toolMessage("Pass a sectionId or a stitchId, not both.");

    try {
      const loaded = await loadCanvas(deps.repos, userId, input.canvasId, takedownLoader(deps));
      if (!loaded) return toolMessage(CANVAS_NOT_FOUND);
      const canvas = toSnapshot({ canvas: loaded.canvas, state: loaded.state, webUrl: canvasWebUrl(deps.appUrl(), input.canvasId) });
      const view = input.stitchId
        ? stitchView(canvas, input.stitchId)
        : input.sectionId
          ? sectionView(canvas, input.sectionId)
          : boardView(canvas);
      if (!view) {
        return toolMessage(
          input.stitchId
            ? "That Frankenstein page was not found on this canvas. Call get_canvas to see page ids."
            : "That section was not found on this canvas. Call get_canvas to see section ids.",
        );
      }
      const content: McpContent[] = [{ type: "text", text: view.head.join("\n") }];
      if (input.thumbs === false) {
        content.push({ type: "text", text: view.targets.map((t) => t.label).join("\n") });
      } else if (view.targets.length > 0) {
        const { blocks } = await thumbBlocks(view.targets, {
          fetchImpl: deps.fetchImpl,
          ...(deps.allowlist ? { allowlist: deps.allowlist() } : {}),
        });
        content.push(...blocks);
      }
      content.push({ type: "text", text: [...view.tail, `Web link: ${canvas.webUrl ?? ""}`, "Always show each reference's source link next to it."].join("\n") });
      return { content, structuredContent: view.structured };
    } catch {
      console.error("[get_snapshot] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

const live = lazyTool(createGetSnapshotTool);

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Snapshot",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
