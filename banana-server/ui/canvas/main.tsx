/**
 * Inline canvas entry (MCP Apps, spec section 9). Bundled by ui/canvas/vite.config.ts
 * into one HTML file and served as `ui://banana/canvas`.
 *
 * Flow:
 * 1. Connect to the host over postMessage (`App` from @modelcontextprotocol/ext-apps).
 * 2. The host sends the `open_canvas` result (`ui/notifications/tool-result`):
 *    `structuredContent.canvas` has the id, title and web link (the model sees this), and
 *    `_meta["banana/canvas"]` has the board state and updatedAt (view only). Without that
 *    `_meta`, the board loads through the app-only `load_canvas_state` tool.
 * 3. CanvasApp renders it and auto-saves through `save_canvas_state` (canvas/persistence-bridge.ts).
 *
 * Never fetches image bytes: tiles are plain <img> tags that load from the source host,
 * which the resource CSP allows (lib/mcp/resources/canvas.ts).
 */
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  App,
  PostMessageTransport,
  type McpUiHostContext,
  type McpUiToolResultNotification,
} from "@modelcontextprotocol/ext-apps";
import { CanvasApp } from "@/canvas/CanvasApp";
import type { CanvasPersistence } from "@/canvas/persistence";
import {
  ConflictError,
  createBridgePersistence,
  readOpenCanvasResult,
  type BridgePersistence,
  type ConflictInfo,
  type OpenedCanvas,
} from "@/canvas/persistence-bridge";
import type { CanvasState } from "@/canvas/types";
import { APP_NAME } from "@/lib/config";
import "./inline.css";

// ---------------------------------------------------------------------------- host store

type HostState = {
  connected: boolean;
  connectError: boolean;
  result: McpUiToolResultNotification["params"] | null;
  cancelled: boolean;
  context: McpUiHostContext;
};

let hostState: HostState = { connected: false, connectError: false, result: null, cancelled: false, context: {} };
const listeners = new Set<() => void>();
function setHost(patch: Partial<HostState>) {
  hostState = { ...hostState, ...patch };
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useHost = () => useSyncExternalStore(subscribe, () => hostState);

const app = new App({ name: `${APP_NAME} canvas`, version: "0.1.0" }, {}, { autoResize: true });

// Register before connect so the one-shot notifications are never missed.
app.addEventListener("toolresult", (result) => setHost({ result, cancelled: false }));
app.addEventListener("toolcancelled", () => setHost({ cancelled: true }));
app.addEventListener("hostcontextchanged", (ctx) => setHost({ context: { ...hostState.context, ...ctx } }));

// Source links (`target="_blank"`) open through the host: sandboxed frames may block popups.
document.addEventListener(
  "click",
  (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    const a = (e.target as Element | null)?.closest?.("a[href]");
    if (!(a instanceof HTMLAnchorElement)) return;
    const url = a.href;
    if (!/^https?:\/\//i.test(url)) return;
    e.preventDefault();
    void openExternal(url);
  },
  true,
);

async function openExternal(url: string): Promise<void> {
  try {
    if (hostState.connected && app.getHostCapabilities()?.openLinks) {
      const res = await app.openLink({ url });
      if (!res.isError) return;
    }
  } catch {
    // Fall through to a plain new tab.
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

app
  .connect(new PostMessageTransport(window.parent, window.parent))
  .then(() => setHost({ connected: true, context: { ...app.getHostContext(), ...hostState.context } }))
  .catch(() => setHost({ connectError: true }));

// ---------------------------------------------------------------------------- views

const INLINE_HEIGHT = 640;

function useFrameHeight(ctx: McpUiHostContext): string {
  if (ctx.displayMode === "fullscreen" || ctx.displayMode === "pip") return "100vh";
  const dims = ctx.containerDimensions as { height?: number; maxHeight?: number } | undefined;
  if (dims?.height) return "100vh";
  const max = dims?.maxHeight;
  return `${max ? Math.min(INLINE_HEIGHT, max) : INLINE_HEIGHT}px`;
}

function Root() {
  const host = useHost();
  const theme = host.context.theme === "dark" || host.context.theme === "light" ? host.context.theme : undefined;
  const height = useFrameHeight(host.context);
  const opened = useMemo(() => (host.result ? readOpenCanvasResult(host.result) : null), [host.result]);

  let body: ReactNode;
  if (opened?.ok) {
    body = <InlineCanvas key={opened.canvas.id} canvas={opened.canvas} theme={theme} host={host} />;
  } else if (opened && !opened.ok) {
    body = <Message role="alert" text={opened.message} />;
  } else if (host.cancelled) {
    body = <Message role="alert" text="The canvas was not opened. Ask again to open it." />;
  } else if (host.connectError) {
    body = <Message role="alert" text="This canvas only works inside a chat app that supports MCP Apps." />;
  } else {
    body = <Message role="status" text="Loading canvas" />;
  }

  return (
    <div className="bn-canvas bn-inline" data-theme={theme} style={{ height }}>
      {body}
    </div>
  );
}

function Message({ role, text }: { role: "status" | "alert"; text: string }) {
  return (
    <div className={role === "alert" ? "bn-error" : "bn-loading"} role={role}>
      <p>{text}</p>
    </div>
  );
}

type Session = { version: number; state: unknown; persistence: CanvasPersistence & { retire(): void } };

/** A per-mount view of the shared persistence. A replaced mount can no longer save. */
function mountPersistence(p: BridgePersistence): CanvasPersistence & { retire(): void } {
  let retired = false;
  return {
    load: () => p.load(),
    save: (state: CanvasState) => (retired ? Promise.resolve() : p.save(state)),
    retire() {
      retired = true;
    },
  };
}

function InlineCanvas({ canvas, theme, host }: { canvas: OpenedCanvas; theme?: "light" | "dark"; host: HostState }) {
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const bannerRef = useRef<HTMLDivElement>(null);
  const [persistence] = useState(() =>
    createBridgePersistence({
      app,
      canvasId: canvas.id,
      initialState: canvas.state,
      updatedAt: canvas.updatedAt,
      onConflict: (info) => setConflict(info),
    }),
  );
  const [session, setSession] = useState<Session>(() => ({
    version: 0,
    state: canvas.state,
    persistence: mountPersistence(persistence),
  }));

  // Move focus to the conflict choices when they appear, so keyboard users find them.
  const hasConflict = conflict !== null;
  useEffect(() => {
    if (hasConflict) bannerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [hasConflict]);

  const remount = (state: unknown) => {
    session.persistence.retire();
    setConflict(null);
    setProblem("");
    setSession({ version: session.version + 1, state, persistence: mountPersistence(persistence) });
  };

  const loadLatest = () => {
    if (!persistence.conflict) return;
    const latest = persistence.conflict.state;
    persistence.acceptLatest();
    remount(latest);
  };

  const keepMine = async () => {
    const pending = persistence.conflict;
    if (!pending) return;
    setBusy(true);
    try {
      await persistence.keepMine();
      remount(pending.mine);
    } catch (e) {
      // A newer conflict re-opens the choice through onConflict; anything else is a plain error.
      if (!(e instanceof ConflictError)) setProblem("Could not save your version. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onSaved = useCallback(() => {
    if (!app.getHostCapabilities()?.updateModelContext) return;
    void app
      .updateModelContext({
        content: [
          {
            type: "text",
            text: `The user changed the canvas "${canvas.title}" (canvasId ${canvas.id}) inline. Call get_canvas before you describe or export it.`,
          },
        ],
      })
      .catch(() => undefined);
  }, [canvas.id, canvas.title]);

  const canFullscreen = host.context.availableDisplayModes?.includes("fullscreen") ?? false;
  const isFullscreen = host.context.displayMode === "fullscreen";
  const toggleFullscreen = () => {
    void app
      .requestDisplayMode({ mode: isFullscreen ? "inline" : "fullscreen" })
      .then((r) => setHost({ context: { ...hostState.context, displayMode: r.mode } }))
      .catch(() => undefined);
  };

  return (
    <>
      <div className="bn-inline-bar">
        {canvas.webUrl && (
          <a className="bn-inline-link" href={canvas.webUrl} target="_blank" rel="noopener noreferrer">
            Open on the web
          </a>
        )}
        {canFullscreen && (
          <button type="button" className="bn-btn" aria-pressed={isFullscreen} onClick={toggleFullscreen}>
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </button>
        )}
      </div>
      {conflict && (
        <div ref={bannerRef} className="bn-inline-conflict" role="alert">
          <p>
            This canvas changed in chat or on the web after it opened here. Your latest changes are not saved yet.
            Choose which version to keep.
          </p>
          <div className="bn-inline-actions">
            <button type="button" className="bn-btn bn-btn-primary" onClick={loadLatest} disabled={busy}>
              Load the latest version
            </button>
            <button type="button" className="bn-btn" onClick={() => void keepMine()} disabled={busy}>
              Keep my version
            </button>
          </div>
          {problem && <p className="bn-inline-problem">{problem}</p>}
        </div>
      )}
      <CanvasApp
        key={session.version}
        canvasId={canvas.id}
        appName={APP_NAME}
        title={canvas.title}
        // Undefined when the host dropped the result `_meta`: CanvasApp then loads through
        // the persistence, which calls the app-only load_canvas_state tool.
        initialState={session.state}
        persistence={session.persistence}
        theme={theme}
        onSaved={onSaved}
      />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
