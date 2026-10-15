/**
 * What the inline canvas puts in the agent's context when the user shows it a Frankenstein page
 * (P0-12, owner decision D1), and what it tells the user. Pure: the caller renders the page
 * (render-page.ts), asks the server for the parts view when needed, and sends the blocks with
 * `App.updateModelContext`.
 *
 * - Drawn: a text line with the layout map, then the image. Nothing is stored anywhere.
 * - Not drawn because a host sends no CORS header (the canvas would be tainted): the parts view
 *   from get_snapshot (server side pass-through thumbnails, each with its crop rect), after a line
 *   that says why, plus the layout map.
 * - The host does not take images in the model context: the layout map as text.
 */
import type { RenderOutcome } from "./render-page";

export type ContextBlock = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
export type Notice = { kind: "success" | "info" | "warning"; title: string; body: string };

export type PageTarget = { canvasId: string; stitchId: string; title: string };

const list = (hosts: string[]) => (hosts.length <= 1 ? hosts.join("") : `${hosts.slice(0, -1).join(", ")} and ${hosts.at(-1)}`);

export function snapshotCall(t: PageTarget) {
  return { name: "get_snapshot", arguments: { canvasId: t.canvasId, stitchId: t.stitchId } };
}

/**
 * The context blocks and the notice for one outcome. `imagesOk`: the host takes image blocks in
 * the model context. `partsView`: get_snapshot's content for the page, when the page could not be
 * drawn and the call worked.
 */
export function pageContext(
  t: PageTarget,
  outcome: RenderOutcome,
  opts: { imagesOk: boolean; partsView?: ContextBlock[] | null },
): { content: ContextBlock[]; notice: Notice } {
  const ids = `(canvasId ${t.canvasId}, stitchId ${t.stitchId})`;
  const map = outcome.map.join("\n");

  if (outcome.ok && opts.imagesOk) {
    const missing = outcome.missing.length ? ` Parts from ${list(outcome.missing)} did not load and show as empty boxes.` : "";
    return {
      content: [
        {
          type: "text",
          text:
            `The user showed you the Frankenstein page "${t.title}" ${ids} as one image, drawn in their browser from the hotlinked parts in their original colors, ${outcome.width} x ${outcome.height} px. Not stored anywhere.${missing} ` +
            `Look at it before you write or change any screen: name what reads as one page and what clashes. Each part's source link is in the map below; always show them.\n${map}`,
        },
        { type: "image", data: outcome.data, mimeType: outcome.mimeType },
      ],
      notice: { kind: "success", title: `Sent "${t.title}" to the chat`, body: "The agent sees the page with your next message." },
    };
  }

  if (!outcome.ok && outcome.reason === "tainted") {
    const why = `The Frankenstein page "${t.title}" ${ids} could not be drawn as one image: parts from ${list(outcome.hosts)} come from a host that does not allow it (no CORS header), so the browser will not read the drawing back.`;
    if (opts.imagesOk && opts.partsView?.length) {
      return {
        content: [{ type: "text", text: `${why} Here is the parts view instead: each part's source image with the crop the page uses, then the layout.\n${map}` }, ...opts.partsView],
        notice: { kind: "warning", title: "Sent the parts view instead", body: `Parts from ${list(outcome.hosts)} block drawing the page as one image, so the agent gets each part with its crop.` },
      };
    }
    return {
      content: [{ type: "text", text: `${why} Call get_snapshot with this stitchId for the parts view. Layout:\n${map}` }],
      notice: { kind: "warning", title: "Sent a text layout instead", body: `Parts from ${list(outcome.hosts)} block drawing the page as one image. The agent can call get_snapshot for the parts.` },
    };
  }

  if (outcome.ok || outcome.reason === "failed" || outcome.reason === "empty") {
    const lead = outcome.ok
      ? `The user showed you the Frankenstein page "${t.title}" ${ids}. This chat app does not take images from the canvas, so here is its layout in words.`
      : outcome.reason === "empty"
        ? `The user showed you the Frankenstein page "${t.title}" ${ids}, but it has no rows yet.`
        : `The user showed you the Frankenstein page "${t.title}" ${ids}, but its images did not load in their browser.`;
    return {
      content: [{ type: "text", text: `${lead} Call get_snapshot with this stitchId to see the parts.\n${map}` }],
      notice: outcome.ok
        ? { kind: "info", title: "Sent a text layout", body: "This chat app does not take images from the canvas, so the agent got the page as a text layout." }
        : outcome.reason === "empty"
          ? { kind: "info", title: "This page has no rows yet", body: "The agent got a note that it is empty." }
          : { kind: "warning", title: "The images did not load", body: "The agent got a text layout of the page instead." },
    };
  }
  return { content: [], notice: { kind: "warning", title: "Could not send the page", body: "Try again." } };
}

/** Keeps only text and image blocks from a tool result's content (what updateModelContext takes here). */
export function contextBlocks(content: unknown): ContextBlock[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((b): ContextBlock[] => {
    if (b && typeof b === "object" && (b as { type?: unknown }).type === "text" && typeof (b as { text?: unknown }).text === "string") {
      return [{ type: "text", text: (b as { text: string }).text }];
    }
    if (b && typeof b === "object" && (b as { type?: unknown }).type === "image") {
      const { data, mimeType } = b as { data?: unknown; mimeType?: unknown };
      if (typeof data === "string" && typeof mimeType === "string") return [{ type: "image", data, mimeType }];
    }
    return [];
  });
}
