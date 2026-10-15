/**
 * "Show in chat" (P0-12, owner decision D1): the user picks a Frankenstein page and the inline
 * canvas draws it to one image in the browser and puts it in the agent's model context through
 * MCP Apps (`ui/update-model-context`). Nothing goes to the server or any storage; the image goes
 * to the host and is dropped here.
 *
 * Shown only when the host accepts model context updates. When it takes text only, the agent gets
 * the layout in words. When a part's host sends no CORS header the page cannot be drawn (the
 * canvas would be tainted), so the agent gets the parts view from get_snapshot instead, and the
 * user is told why.
 */
import { useState } from "react";
import type { App } from "@modelcontextprotocol/ext-apps";
import { Dialog } from "@/components/studio/Dialog";
import { pushToast } from "@/components/studio/Toast";
import { parseState } from "@/canvas/state";
import { contextBlocks, pageContext, snapshotCall, type ContextBlock } from "@/canvas/vision/page-context";
import type { BridgePersistence } from "@/canvas/persistence-bridge";
import type { Part, StitchData } from "@/lib/stitch/types";

// Client only and loaded on demand: the drawing code is not needed until the user asks.
const loadRenderer = typeof window === "undefined" ? null : () => import("@/canvas/vision/render-page");

type Page = { id: string; data: StitchData };

export function ShowPage({ app, canvasId, persistence }: { app: App; canvasId: string; persistence: BridgePersistence }) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<Page[] | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState("");

  const caps = app.getHostCapabilities()?.updateModelContext;
  if (!caps) return null;
  const imagesOk = Boolean(caps.image);

  const openPicker = async () => {
    setOpen(true);
    setProblem("");
    setPages(null);
    try {
      const latest = await persistence.fetchLatest();
      const state = parseState(latest.state);
      setParts(state.parts ?? []);
      setPages(state.nodes.flatMap((n) => (n.type === "stitch" ? [{ id: n.id, data: n.data as StitchData }] : [])));
    } catch {
      setPages([]);
      setProblem("Could not load the pages. Try again.");
    }
  };

  const send = async (page: Page) => {
    if (!loadRenderer) return;
    setBusy(page.id);
    const target = { canvasId, stitchId: page.id, title: page.data.title };
    try {
      const { renderPage } = await loadRenderer();
      const outcome = await renderPage({ title: page.data.title, stitch: page.data, parts });
      let partsView: ContextBlock[] | null = null;
      if (!outcome.ok && outcome.reason === "tainted" && imagesOk) {
        try {
          const res = await app.callServerTool(snapshotCall(target));
          partsView = res.isError ? null : contextBlocks(res.content);
        } catch {
          partsView = null;
        }
      }
      const { content, notice } = pageContext(target, outcome, { imagesOk, partsView });
      await app.updateModelContext({ content });
      pushToast({ kind: notice.kind, title: notice.title, body: notice.body });
      setOpen(false);
    } catch {
      setProblem("Could not send the page to the chat. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button type="button" className="st-btn" data-variant="ghost" data-size="sm" onClick={() => void openPicker()}>
        Show in chat
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Show a page in chat"
        size="sm"
        footer={
          <button type="button" className="st-btn" data-variant="secondary" data-size="sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
        }
      >
        <p className="bn-show-help">
          {imagesOk
            ? "The page is drawn in your browser as one image and added to the chat for the agent. Nothing is uploaded or saved."
            : "This chat app takes text only from the canvas, so the agent gets the page as a text layout."}
        </p>
        {pages === null ? (
          <p role="status">Loading pages</p>
        ) : pages.length === 0 ? (
          <p role="status">{problem || "This board has no Frankenstein pages yet."}</p>
        ) : (
          <ul className="bn-show-list">
            {pages.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="st-btn"
                  data-variant="secondary"
                  data-size="sm"
                  data-loading={busy === p.id ? "inline" : undefined}
                  aria-busy={busy === p.id || undefined}
                  disabled={busy !== null}
                  onClick={() => void send(p)}
                >
                  {p.data.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        {problem && pages && pages.length > 0 && (
          <p className="bn-inline-problem" role="alert">
            {problem}
          </p>
        )}
      </Dialog>
    </>
  );
}
