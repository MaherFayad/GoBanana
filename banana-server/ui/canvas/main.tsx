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
 * which the resource CSP allows (lib/mcp/resources/canvas.ts). "Show in chat" (ShowPage.tsx)
 * draws a Frankenstein page onto a <canvas> in memory and sends it to the model context only.
 *
 * Look (plan WP-C step 7): Studio tokens and primitives, the host theme on `data-theme`, a
 * 36px top bar with "Open on the web", the conflict choice as a warning alert, toasts inside
 * the frame, and a compact layout under 720px. UI fonts load from APP_URL's static assets
 * (never inlined; see vite.config.ts); without them `system-ui` is the fallback.
 */
import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  App,
  PostMessageTransport,
  type McpUiHostContext,
  type McpUiToolResultNotification,
} from "@modelcontextprotocol/ext-apps";
import { CanvasApp, type CanvasRefreshHandle } from "@/canvas/CanvasApp";
import { createRefreshScheduler, isNewer } from "@/canvas/refresh";
import { ExternalIcon, WarningIcon } from "@/components/studio/icons";
import { ToastProvider } from "@/components/studio/Toast";
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
import { ShowPage } from "./ShowPage";
import "@/styles/fonts.css";
import "@/styles/studio-tokens.css";
import "@/styles/studio-components.css";
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

/**
 * Host events that may mean the board changed (another tool result, a context change). The
 * host only sends this view the result of the call that opened it, so these are hints; the
 * live refresh polls load_canvas_state as well (canvas/refresh.ts).
 */
const hostPokes = new Set<() => void>();
const pokeRefresh = () => {
  for (const p of hostPokes) p();
};

// Register before connect so the one-shot notifications are never missed.
app.addEventListener("toolresult", (result) => {
  // A second result for the same canvas is a refresh, not a new view.
  const same = hostState.result && readOpenCanvasResult(hostState.result);
  const next = readOpenCanvasResult(result);
  if (same?.ok && next.ok && same.canvas.id === next.canvas.id) {
    pokeRefresh();
    return;
  }
  setHost({ result, cancelled: false });
});
app.addEventListener("toolcancelled", () => setHost({ cancelled: true }));
app.addEventListener("hostcontextchanged", (ctx) => {
  setHost({ context: { ...hostState.context, ...ctx } });
  pokeRefresh();
});

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
/** Under this frame width the canvas goes compact: rail collapsed, panel closed. */
const COMPACT_WIDTH = 720;

function useFrameHeight(ctx: McpUiHostContext): string {
  if (ctx.displayMode === "fullscreen" || ctx.displayMode === "pip") return "100vh";
  const dims = ctx.containerDimensions as { height?: number; maxHeight?: number } | undefined;
  if (dims?.height) return "100vh";
  const max = dims?.maxHeight;
  return `${max ? Math.min(INLINE_HEIGHT, max) : INLINE_HEIGHT}px`;
}

function useCompact(): boolean {
  const [compact, setCompact] = useState(() => window.innerWidth < COMPACT_WIDTH);
  useEffect(() => {
    const sync = () => setCompact(window.innerWidth < COMPACT_WIDTH);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);
  return compact;
}

function Root() {
  const host = useHost();
  // Dark only (owner decision), whatever the host theme.
  const theme = "dark" as const;
  const height = useFrameHeight(host.context);
  const compact = useCompact();
  const opened = useMemo(() => (host.result ? readOpenCanvasResult(host.result) : null), [host.result]);

  // The theme on the root too, so the page canvas, scrollbars and anything portaled to
  // <body> (tooltips, toasts) match.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  let body: ReactNode;
  if (opened?.ok) {
    body = <InlineCanvas key={opened.canvas.id} canvas={opened.canvas} theme={theme} host={host} compact={compact} />;
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
    <div
      className="bn-inline"
      data-theme={theme}
      data-compact={compact ? "" : undefined}
      style={{ "--inline-h": height } as CSSProperties}
    >
      <ToastProvider>{body}</ToastProvider>
    </div>
  );
}

function Message({ role, text }: { role: "status" | "alert"; text: string }) {
  return (
    <div className="bn-inline-message">
      {role === "alert" ? (
        <div className="st-alert" data-tone="danger" role="alert">
          <span className="st-alert-icon">
            <WarningIcon size={16} />
          </span>
          <div className="st-alert-content">
            <p>{text}</p>
          </div>
        </div>
      ) : (
        <div className="st-empty" data-variant="centered" role="status">
          <span className="st-spinner" aria-hidden="true" />
          <p className="st-empty-body">{text}</p>
        </div>
      )}
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

function InlineCanvas({
  canvas,
  theme,
  host,
  compact,
}: {
  canvas: OpenedCanvas;
  theme?: "light" | "dark";
  host: HostState;
  compact: boolean;
}) {
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
  const refreshRef = useRef<CanvasRefreshHandle | null>(null);

  // Live refresh: poll while visible (faster with focus), refresh at once when the frame comes
  // back or the host pokes, back off on errors. Newer server states are offered to the board,
  // which applies them unless the user has unsaved work or is mid-gesture.
  useEffect(() => {
    const scheduler = createRefreshScheduler(
      async () => {
        if (persistence.conflict) return;
        const latest = await persistence.fetchLatest();
        if (!isNewer(latest.updatedAt, persistence.baseUpdatedAt)) return;
        const decision = refreshRef.current?.offer(latest, { conflict: persistence.conflict !== null });
        if (decision === "apply") persistence.adopt(latest.updatedAt);
      },
      { isVisible: () => document.visibilityState === "visible", isFocused: () => document.hasFocus() },
    );
    const update = () => scheduler.update();
    const poke = () => scheduler.poke();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", poke);
    window.addEventListener("blur", update);
    hostPokes.add(poke);
    scheduler.start();
    return () => {
      scheduler.stop();
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", poke);
      window.removeEventListener("blur", update);
      hostPokes.delete(poke);
    };
  }, [persistence]);

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
          <a
            className="st-btn"
            data-variant="secondary"
            data-size="sm"
            href={canvas.webUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalIcon size={16} />
            <span>Open on the web</span>
          </a>
        )}
        <ShowPage app={app} canvasId={canvas.id} persistence={persistence} />
        {canFullscreen && (
          <button type="button" className="st-btn" data-variant="ghost" data-size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </button>
        )}
      </div>
      {conflict && (
        <div ref={bannerRef} className="bn-inline-conflict">
          <div className="st-alert" data-tone="warning" role="alert">
            <span className="st-alert-icon">
              <WarningIcon size={16} />
            </span>
            <div className="st-alert-content">
              <p className="st-alert-title">This canvas changed in chat or on the web after it opened here.</p>
              <p>Your latest changes are not saved yet. Choose which version to keep.</p>
              <div className="bn-inline-actions">
                <button
                  type="button"
                  className="st-btn"
                  data-variant="primary"
                  data-size="sm"
                  onClick={loadLatest}
                  disabled={busy}
                >
                  Load the latest version
                </button>
                <button
                  type="button"
                  className="st-btn"
                  data-variant="secondary"
                  data-size="sm"
                  data-loading={busy ? "inline" : undefined}
                  aria-busy={busy || undefined}
                  onClick={() => void keepMine()}
                  disabled={busy}
                >
                  {busy ? "Saving your version…" : "Keep my version"}
                </button>
              </div>
              {problem && <p className="bn-inline-problem">{problem}</p>}
            </div>
          </div>
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
        compact={compact}
        onSaved={onSaved}
        trayCollapsedByDefault
        refreshRef={refreshRef}
      />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
