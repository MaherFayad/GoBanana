/**
 * `attach_screenshot`: the user's own Claude captured a screenshot of one X post on the canvas
 * (with its own screenshot or browser tool) and hands it over, so cut_parts and Frankenstein can
 * use the post like an uploaded image. Owner decision 2026-10-16: "the user is their claude,
 * just provide the tools for that". GoBanana's server never fetches or captures X itself.
 *
 * The bytes go through the upload path (lib/uploads: plan check, 10 MB per file, the user's
 * storage cap, 50 MB in the beta, type sniffed from the bytes) and are stored as the user's own
 * upload; the X post item keeps its path. Every part cut from it keeps the post link and the
 * author credit.
 */
import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { canvasWebUrl, mutateCanvas, parseState } from "@/lib/canvas/store";
import { getRepos } from "@/lib/db";
import { getUploadsBucket } from "@/lib/uploads/bucket";
import { createDbUploadRepo } from "@/lib/uploads/db";
import { MAX_UPLOAD_BYTES, UPLOAD_MESSAGES, sniffImageType, uploadPath } from "@/lib/uploads/rules";
import { createUpload, deleteUpload, type UploadDeps } from "@/lib/uploads/service";
import { imageSize } from "@/lib/vision/look";
import { MAX_POST_URL, parsePostUrl, postCredit } from "@/lib/xpost";
import { CANVAS_NOT_FOUND, liveCanvasDeps, mutateError, plausibleId, takedownLoader, TRY_AGAIN, type CanvasToolDeps } from "./canvas-shared";
import { idSchema } from "./stitch-shared";
import { lenient, parseArgs, toolMessage, toolResult, type RegisterTool, type ToolResult } from "./types";

export const TOOL_NAME = "attach_screenshot";

export const TOOL_DESCRIPTION =
  "Attach your screenshot of one X post on the canvas (itemId) so cut_parts and Frankenstein can use it. " +
  "Capture that one post with your own screenshot or browser tool; image is base64 PNG, JPEG or WebP; sourceUrl is the post link. Stored as the user's upload.";

/** Base64 of the largest upload, plus room for a data URL prefix. */
export const MAX_IMAGE_CHARS = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 100;

export const inputSchema = z.object({
  canvasId: z.string().min(1).max(100),
  itemId: idSchema.describe("The X post item on the canvas (add_to_canvas { type: 'xpost', url } places one)."),
  image: z.string().min(1).max(MAX_IMAGE_CHARS).describe("The screenshot as base64 (a data:image/...;base64, prefix is fine). PNG, JPEG or WebP, up to 10 MB."),
  sourceUrl: z.string().trim().min(1).max(MAX_POST_URL).describe("The post link, x.com/<handle>/status/<id>."),
});

const MESSAGES: Record<string, string> = {
  canvasId: "Pass the canvasId from open_canvas.",
  itemId: "itemId must be the id of an X post item on this canvas. Call get_canvas to see item ids.",
  image: `image must be a base64 PNG, JPEG or WebP screenshot, up to ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
  sourceUrl: "sourceUrl must be the X post link, x.com/<handle>/status/<id>.",
};

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Bytes of a base64 string (with or without a data URL prefix), or null when it is not base64. */
export function decodeImage(value: string): { bytes: Uint8Array<ArrayBuffer>; declared?: string } | null {
  let body = value.trim();
  let declared: string | undefined;
  const prefix = /^data:([a-z]+\/[a-z0-9.+-]+);base64,/i.exec(body);
  if (prefix) {
    declared = prefix[1]!.toLowerCase();
    body = body.slice(prefix[0].length);
  }
  body = body.replace(/\s+/g, "");
  if (!body || body.length % 4 === 1 || !B64.test(body)) return null;
  try {
    const bin = atob(body);
    const bytes = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, ...(declared ? { declared } : {}) };
  } catch {
    return null;
  }
}

export type AttachScreenshotOutput = {
  canvasId: string;
  itemId: string;
  screenshotUrl: string;
  width?: number;
  height?: number;
  sourceUrl: string;
  credit: string;
  webUrl: string;
};

export type AttachScreenshotDeps = CanvasToolDeps & { uploads: () => UploadDeps };

export function createAttachScreenshotTool(deps: AttachScreenshotDeps) {
  return async function attachScreenshot(raw: unknown, userId: string | undefined): Promise<ToolResult> {
    if (!userId) return toolMessage("You are not signed in. Reconnect to sign in again.");
    const parsed = parseArgs(inputSchema, raw, MESSAGES, MESSAGES.image!);
    if (!parsed.ok) return toolMessage(parsed.message);
    const input = parsed.data;
    if (!plausibleId(input.canvasId)) return toolMessage(CANVAS_NOT_FOUND);
    const link = parsePostUrl(input.sourceUrl);
    if (!link) return toolMessage(MESSAGES.sourceUrl!);
    const decoded = decodeImage(input.image);
    if (!decoded) return toolMessage(MESSAGES.image!);
    if (decoded.bytes.byteLength > MAX_UPLOAD_BYTES) return toolMessage(UPLOAD_MESSAGES.too_large);
    // Screenshots only: no GIF, and the bytes decide, never the declared type.
    const sniffed = sniffImageType(decoded.bytes);
    if (!sniffed || !IMAGE_TYPES.has(sniffed)) return toolMessage(MESSAGES.image!);
    try {
      const { repos } = deps;
      const owned = await repos.canvases.getOwned(userId, input.canvasId);
      if (!owned) return toolMessage(CANVAS_NOT_FOUND);
      const node = parseState(owned.state).nodes.find((n) => n.id === input.itemId);
      if (!node || node.type !== "xpost") return toolMessage(MESSAGES.itemId!);
      if (node.data.postId !== link.postId) {
        return toolMessage(`sourceUrl is a different post. Item ${input.itemId} is ${node.data.sourceUrl}; capture that post.`);
      }

      const uploads = deps.uploads();
      const stored = await createUpload(uploads, userId, { bytes: decoded.bytes, declaredType: sniffed });
      if (!stored.ok) return toolMessage(UPLOAD_MESSAGES[stored.error]);
      const size = imageSize(decoded.bytes);
      const path = uploadPath(stored.value.id);

      let previous: string | undefined;
      const outcome = await mutateCanvas<{ credit: string; sourceUrl: string }>(repos, userId, input.canvasId, takedownLoader(deps), (state) => {
        const current = state.nodes.find((n) => n.id === input.itemId);
        if (!current || current.type !== "xpost") return { error: MESSAGES.itemId! };
        previous = current.data.screenshotUrl;
        const data = {
          ...current.data,
          screenshotUrl: path,
          ...(size ? { screenshotWidth: size.width, screenshotHeight: size.height } : {}),
        };
        if (!size) {
          delete data.screenshotWidth;
          delete data.screenshotHeight;
        }
        return {
          state: { ...state, nodes: state.nodes.map((n) => (n.id === current.id ? { ...current, data } : n)) },
          value: { credit: postCredit(current.data), sourceUrl: current.data.sourceUrl },
        };
      });
      if (!outcome.ok) {
        // Nothing points at the new upload: remove it so it does not count against the user's space.
        await deleteUpload(uploads, userId, stored.value.id).catch(() => undefined);
        return mutateError(outcome);
      }
      // The old screenshot goes too, unless a part or another item still shows it.
      if (previous && previous !== path) {
        const shown = JSON.stringify(outcome.state).includes(`"${previous}"`);
        const oldId = previous.split("/").pop();
        if (!shown && oldId) await deleteUpload(uploads, userId, oldId).catch(() => undefined);
      }

      const out: AttachScreenshotOutput = {
        canvasId: input.canvasId,
        itemId: input.itemId,
        screenshotUrl: path,
        ...(size ? { width: size.width, height: size.height } : {}),
        sourceUrl: outcome.value.sourceUrl,
        credit: outcome.value.credit,
        webUrl: canvasWebUrl(deps.appUrl(), input.canvasId),
      };
      const dims = size ? ` (${size.width} x ${size.height} px)` : "";
      return toolResult(
        `Attached your screenshot${dims} to X post ${input.itemId}: ${out.credit} ${out.sourceUrl}. ` +
          `Next: cut_parts { cuts: [{ itemId: "${input.itemId}", role, crop }] } with crops measured on your screenshot. Every part keeps the post link and credit.\nWeb link: ${out.webUrl}`,
        out,
      );
    } catch {
      console.error("[attach_screenshot] failed");
      return toolMessage(TRY_AGAIN);
    }
  };
}

let tool: ReturnType<typeof createAttachScreenshotTool> | undefined;
function live(raw: unknown, userId: string | undefined): Promise<ToolResult> {
  // Object.assign keeps the lazy `repos` getter (a spread would read the database config here).
  tool ??= createAttachScreenshotTool(
    Object.assign(liveCanvasDeps(), {
      uploads: (): UploadDeps => ({
        repo: createDbUploadRepo(),
        bucket: getUploadsBucket,
        getPlan: (id: string) => getRepos().users.getPlan(id),
      }),
    }),
  );
  return tool(raw, userId);
}

export const register: RegisterTool = (server) => {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Attach screenshot",
      description: TOOL_DESCRIPTION,
      inputSchema: lenient(inputSchema),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args, ctx) => live(args, authExtra(ctx)?.userId),
  );
};
