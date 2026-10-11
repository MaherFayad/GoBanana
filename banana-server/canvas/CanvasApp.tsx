"use client";

/**
 * The moodboard canvas (spec section 9). One React Flow app used on the web
 * (`/c/:id`) and inline in chat (MCP Apps). Where state comes from and goes to is
 * decided by the `persistence` adapter.
 */
import "@xyflow/react/dist/style.css";
import "./canvas.css";

import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type NodeChange,
  type OnNodeDrag,
  type Viewport,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { createAutoSaver, type SaveStatus } from "./autosave";
import { CanvasActionsContext, type CanvasActions } from "./context";
import {
  cascade,
  absoluteRect,
  bringForward,
  nodeSize,
  removeNode,
  reparent,
  sectionAt,
  toggleCollapsed,
} from "./geometry";
import { noteNode, referenceNode, sectionNode } from "./factory";
import { directionWord, nudgeDelta, resizeBy, resizeDirection } from "./keyboard";
import { arrangeNodes, LAYOUT_LABELS, type LayoutKind } from "./layout-adapter";
import { nodeLabel } from "./labels";
import { nodeTypes } from "./nodes";
import type { CanvasPersistence } from "./persistence";
import { deserializeState, orderNodes, serializeState, stateKey, type Deserialized, type IsBlocked } from "./state";
import { Toolbar } from "./Toolbar";
import { Tray, TRAY_DND_TYPE } from "./Tray";
import { MIN_SIZE, type CanvasFlowNode, type CanvasState, type TrayReference } from "./types";

export interface CanvasAppProps {
  canvasId: string;
  /** Product name from `lib/config.ts` APP_NAME (passed in so the client never reads env). */
  appName: string;
  title?: string;
  /** Stored state JSON. Leave undefined to load through `persistence.load()`. */
  initialState?: unknown;
  persistence: CanvasPersistence;
  /** Takedown predicate (for example `matcher.isBlocked` from lib/takedown.ts). Runs on load. */
  isBlocked?: IsBlocked;
  /** Shared links are view only (spec section 2 rule 6). */
  readOnly?: boolean;
  /** Load Google Fonts CSS for type samples. Turn off where the host CSP blocks it. */
  loadFonts?: boolean;
  /** Force a color scheme; default follows the system. */
  theme?: "light" | "dark";
  /** Called after each successful save. */
  onSaved?: (state: CanvasState) => void;
}

/**
 * Accessible names on nodes, cached per node object so React Flow only re-renders
 * nodes that changed. Node objects are immutable, so a WeakMap is safe.
 */
const labelCache = new WeakMap<CanvasFlowNode, CanvasFlowNode>();
function withLabel(n: CanvasFlowNode): CanvasFlowNode {
  let v = labelCache.get(n);
  if (!v) {
    v = { ...n, ariaLabel: nodeLabel(n) } as CanvasFlowNode;
    labelCache.set(n, v);
  }
  return v;
}

type LoadState = { status: "ready"; data: Deserialized } | { status: "loading" } | { status: "error" };

export function CanvasApp(props: CanvasAppProps) {
  const { initialState, persistence, isBlocked } = props;
  const [load, setLoad] = useState<LoadState>(() =>
    initialState === undefined || initialState === null
      ? { status: "loading" }
      : { status: "ready", data: deserializeState(initialState, { isBlocked }) },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (load.status !== "loading") return;
    let cancelled = false;
    persistence
      .load()
      .then((raw) => {
        if (!cancelled) setLoad({ status: "ready", data: deserializeState(raw ?? {}, { isBlocked }) });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [load.status, attempt, persistence, isBlocked]);

  return (
    <div className="bn-canvas" data-theme={props.theme}>
      {load.status === "ready" ? (
        <ReactFlowProvider>
          <CanvasEditor {...props} initial={load.data} />
        </ReactFlowProvider>
      ) : load.status === "loading" ? (
        <div className="bn-loading" role="status">
          Loading canvas
        </div>
      ) : (
        <div className="bn-error" role="alert">
          <p>Could not load this canvas.</p>
          <button
            type="button"
            className="bn-btn"
            onClick={() => {
              setLoad({ status: "loading" });
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

const ARIA_LABELS = {
  "node.a11yDescription.default":
    "Press Enter or Space to select. Arrow keys move the item 8 pixels, Shift and arrow keys 32 pixels. Plus and minus resize it. M opens its menu. Delete removes it.",
  "node.a11yDescription.keyboardDisabled": "View only.",
  "node.a11yDescription.ariaLiveMessage": ({ direction, x, y }: { direction: string; x: number; y: number }) =>
    `Moved ${direction} to ${x}, ${y}`,
};

function CanvasEditor({
  canvasId,
  appName,
  title = "Untitled canvas",
  persistence,
  readOnly = false,
  loadFonts = true,
  onSaved,
  theme,
  initial,
}: CanvasAppProps & { initial: Deserialized }) {
  const rf = useReactFlow<CanvasFlowNode>();
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<CanvasFlowNode>(initial.nodes);
  const [tray, setTray] = useState<TrayReference[]>(initial.tray);
  const [viewport, setViewport] = useState<Viewport>(initial.viewport);
  const [trayOpen, setTrayOpen] = useState(!readOnly);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);
  // Latest nodes and tray for event handlers (kept in sync after each commit).
  const nodesRef = useRef(nodes);
  const trayRef = useRef(tray);
  useLayoutEffect(() => {
    nodesRef.current = nodes;
    trayRef.current = tray;
  }, [nodes, tray]);
  const trayId = `bn-tray-${useId().replace(/:/g, "")}`;

  // ------------------------------------------------------------------ auto-save
  const [saver] = useState(() =>
    createAutoSaver(
      async (state) => {
        await persistence.save(state);
        onSaved?.(state);
      },
      { onStatus: setSaveStatus, initialKey: stateKey(serializeState(initial.nodes, initial.viewport, initial.tray)) },
    ),
  );

  useEffect(() => {
    if (readOnly) return;
    if (nodes.some((n) => n.dragging || n.resizing)) return;
    saver.schedule(serializeState(nodes, viewport, tray));
  }, [nodes, viewport, tray, readOnly, saver]);

  useEffect(() => {
    const flush = () => void saver.flush();
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [saver]);

  // ------------------------------------------------------------------ helpers
  const announce = useCallback((m: string) => {
    // Toggle a trailing space so the same message is read again.
    setMessage((prev) => (prev === m ? `${m} ` : m));
  }, []);

  const focusNode = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const el = flowRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
      el?.focus();
    });
  }, []);

  const viewportCenter = useCallback(() => {
    const r = flowRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [rf]);

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      if (readOnly) {
        onNodesChangeBase(changes.filter((c) => c.type === "dimensions" || c.type === "select"));
        return;
      }
      // Removals go through `remove` so sections keep their contents.
      onNodesChangeBase(changes.filter((c) => c.type !== "remove"));
    },
    [onNodesChangeBase, readOnly],
  );

  // Put a node into the section under its center, or take it out when it left its section.
  const settleIntoSection = useCallback((list: CanvasFlowNode[], ids: string[]): CanvasFlowNode[] => {
    let out = list;
    for (const id of ids) {
      const n = out.find((x) => x.id === id);
      if (!n || n.type === "section") continue;
      const r = absoluteRect(n, out);
      const sec = sectionAt({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, out, n.id);
      const target = sec?.id ?? null;
      if (target !== (n.parentId ?? null)) out = reparent(out, id, target);
    }
    return out;
  }, []);

  // ------------------------------------------------------------------ actions
  const remove = useCallback(
    (id: string) => {
      const list = nodesRef.current.filter((n) => !n.hidden);
      const i = list.findIndex((n) => n.id === id);
      const next = list[i + 1] ?? list[i - 1];
      setNodes((nds) => removeNode(nds, id));
      announce("Item removed");
      if (next && next.id !== id) focusNode(next.id);
      else requestAnimationFrame(() => flowRef.current?.focus());
    },
    [announce, focusNode, setNodes],
  );

  const resize = useCallback(
    (id: string, direction: -1 | 1) => {
      const n = nodesRef.current.find((x) => x.id === id);
      if (!n) return;
      const size = resizeBy(nodeSize(n), direction, MIN_SIZE[n.type], n.type === "image" || n.type === "upload");
      setNodes((nds) =>
        nds.map((x) => (x.id === id ? ({ ...x, width: size.w, height: size.h } as CanvasFlowNode) : x)),
      );
      announce(`Size ${size.w} by ${size.h}`);
    },
    [announce, setNodes],
  );

  const sectionsKey = nodes
    .filter((n) => n.type === "section")
    .map((n) => `${n.id}\u0000${n.type === "section" ? n.data.title : ""}`)
    .join("\u0001");
  const sections = useMemo(
    () =>
      sectionsKey
        ? sectionsKey.split("\u0001").map((s) => {
            const [id = "", t = ""] = s.split("\u0000");
            return { id, title: t };
          })
        : [],
    [sectionsKey],
  );

  const actions = useMemo<CanvasActions>(
    () => ({
      readOnly,
      loadFonts,
      sections,
      updateData: (id, patch) =>
        setNodes((nds) =>
          nds.map((n) => (n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as CanvasFlowNode) : n)),
        ),
      remove,
      bringForward: (id) => {
        setNodes((nds) => bringForward(nds, id));
        announce("Brought forward");
      },
      moveToSection: (id, sectionId) => {
        setNodes((nds) => orderNodes(reparent(nds, id, sectionId)));
        const s = sections.find((x) => x.id === sectionId);
        announce(s ? `Moved to section ${s.title}` : "Moved out of section");
      },
      resize,
      arrangeSection: (id, layout) => {
        setNodes((nds) => arrangeNodes(nds, layout, { sectionId: id }));
        announce(`Section arranged: ${LAYOUT_LABELS[layout]}`);
      },
      toggleCollapse: (id) => setNodes((nds) => toggleCollapsed(nds, id)),
      menuFor,
      setMenuFor,
      editingId,
      setEditing,
      announce,
      focusNode,
    }),
    [readOnly, loadFonts, sections, remove, resize, menuFor, editingId, announce, focusNode, setNodes],
  );

  const addReference = useCallback(
    (ref: TrayReference, dropPoint?: { x: number; y: number }) => {
      if (readOnly) return;
      const center = dropPoint ?? viewportCenter();
      let node = referenceNode(ref, center);
      if (!dropPoint) node = { ...node, position: cascade(node.position, nodesRef.current) };
      const sec = dropPoint ? sectionAt(center, nodesRef.current) : undefined;
      setNodes((nds) => {
        const out = [...nds, node];
        return sec ? reparent(out, node.id, sec.id) : out;
      });
      const wasLast = trayRef.current.length === 1;
      setTray((t) => t.filter((r) => r.id !== ref.id));
      const name = ref.title || "Reference";
      announce(
        sec && sec.type === "section" ? `${name} added to section ${sec.data.title}` : `${name} added to the canvas`,
      );
      if (wasLast && !dropPoint) focusNode(node.id);
    },
    [announce, focusNode, readOnly, setNodes, viewportCenter],
  );

  const addNote = useCallback(() => {
    const n = noteNode(viewportCenter());
    const node = { ...n, position: cascade(n.position, nodesRef.current) };
    setNodes((nds) => [...nds, node]);
    setEditing(node.id);
    announce("Note added. Type your note, then press Control and Enter to finish.");
  }, [announce, setNodes, viewportCenter]);

  const addSection = useCallback(() => {
    const n = sectionNode(viewportCenter());
    const node = { ...n, position: cascade(n.position, nodesRef.current) };
    setNodes((nds) => orderNodes([...nds, node]));
    setEditing(node.id);
    announce("Section added. Type a title, then press Enter.");
  }, [announce, setNodes, viewportCenter]);

  const arrangeAll = useCallback(
    (layout: LayoutKind) => {
      setNodes((nds) => arrangeNodes(nds, layout));
      announce(`Arranged: ${LAYOUT_LABELS[layout]}`);
      requestAnimationFrame(() => void rf.fitView({ padding: 0.1, duration: 200 }));
    },
    [announce, rf, setNodes],
  );

  // ------------------------------------------------------------------ keyboard
  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (!el.classList?.contains("react-flow__node")) return;
    const id = el.getAttribute("data-id");
    const node = id ? nodesRef.current.find((n) => n.id === id) : undefined;
    if (!id || !node || readOnly || e.altKey || e.ctrlKey || e.metaKey) return;

    const delta = nudgeDelta(e.key, e.shiftKey);
    if (delta) {
      e.preventDefault();
      e.stopPropagation();
      setNodes((nds) => {
        const moved = nds.map((n) =>
          n.id === id
            ? ({ ...n, position: { x: n.position.x + delta.x, y: n.position.y + delta.y } } as CanvasFlowNode)
            : n,
        );
        return settleIntoSection(moved, [id]);
      });
      const r = absoluteRect(node, nodesRef.current);
      announce(`Moved ${directionWord(e.key)} to ${Math.round(r.x + delta.x)}, ${Math.round(r.y + delta.y)}`);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      remove(id);
      return;
    }
    const grow = resizeDirection(e.key);
    if (grow !== 0 && node.type !== "swatch") {
      e.preventDefault();
      e.stopPropagation();
      resize(id, grow);
      return;
    }
    if (e.key === "m" || e.key === "M" || e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      e.preventDefault();
      e.stopPropagation();
      // Select it too, so React Flow raises it and the menu is drawn above its neighbors.
      setNodes((nds) =>
        nds.map((n) =>
          Boolean(n.selected) === (n.id === id) ? n : ({ ...n, selected: n.id === id } as CanvasFlowNode),
        ),
      );
      setMenuFor(id);
      return;
    }
    if (e.key === "F2" && node.type !== "typeSample") {
      e.preventDefault();
      e.stopPropagation();
      setEditing(id);
    }
  };

  const onNodeDragStop: OnNodeDrag<CanvasFlowNode> = useCallback(
    (_e, _node, dragged) => {
      setNodes((nds) =>
        settleIntoSection(
          nds,
          dragged.map((d) => d.id),
        ),
      );
    },
    [setNodes, settleIntoSection],
  );

  // ------------------------------------------------------------------ drag from tray
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (readOnly || !e.dataTransfer.types.includes(TRAY_DND_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dropActive) setDropActive(true);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    setDropActive(false);
    const refId = e.dataTransfer.getData(TRAY_DND_TYPE);
    const ref = refId ? trayRef.current.find((r) => r.id === refId) : undefined;
    if (!ref) return;
    e.preventDefault();
    addReference(ref, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };

  // ------------------------------------------------------------------ render
  const viewNodes = useMemo(() => nodes.map(withLabel), [nodes]);

  const isDefaultViewport = initial.viewport.x === 0 && initial.viewport.y === 0 && initial.viewport.zoom === 1;

  return (
    <CanvasActionsContext.Provider value={actions}>
      <Toolbar
        appName={appName}
        title={title}
        readOnly={readOnly}
        trayOpen={trayOpen}
        trayId={trayId}
        trayCount={tray.length}
        saveStatus={saveStatus}
        onToggleTray={() => setTrayOpen((o) => !o)}
        onAddNote={addNote}
        onAddSection={addSection}
        onArrange={arrangeAll}
        onZoomIn={() => void rf.zoomIn({ duration: 150 })}
        onZoomOut={() => void rf.zoomOut({ duration: 150 })}
        onFit={() => void rf.fitView({ padding: 0.1, duration: 200 })}
        onRetrySave={() => void saver.flush()}
      />
      {initial.removed > 0 && (
        <p className="bn-notice" role="status">
          {initial.removed === 1 ? "1 item is hidden" : `${initial.removed} items are hidden`} because of a takedown
          request.
        </p>
      )}
      <div className="bn-body">
        {trayOpen && <Tray id={trayId} items={tray} onAdd={(r) => addReference(r)} readOnly={readOnly} />}
        <main
          ref={flowRef}
          className="bn-flow"
          tabIndex={-1}
          aria-label="Canvas"
          data-drop-active={dropActive ? "true" : undefined}
          data-canvas-id={canvasId}
          onKeyDownCapture={onKeyDownCapture}
          onDragOver={onDragOver}
          onDragLeave={() => setDropActive(false)}
          onDrop={onDrop}
        >
          <ReactFlow<CanvasFlowNode>
            nodes={viewNodes}
            edges={[]}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onMoveEnd={(_e, vp) => setViewport(vp)}
            defaultViewport={initial.viewport}
            fitView={isDefaultViewport && initial.nodes.length > 0}
            fitViewOptions={{ padding: 0.1 }}
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable={!readOnly}
            nodesConnectable={false}
            nodesFocusable
            edgesFocusable={false}
            elementsSelectable
            deleteKeyCode={null}
            autoPanOnNodeFocus
            colorMode={theme ?? "system"}
            ariaLabelConfig={ARIA_LABELS}
            aria-label={`Moodboard: ${title}`}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--bn-border-subtle)" />
          </ReactFlow>
          {nodes.length === 0 && (
            <div className="bn-empty-hint">
              <p>
                This canvas is empty.
                {!readOnly && " Add search results from the tray, or add a note."}
              </p>
            </div>
          )}
        </main>
      </div>
      <div className="bn-visually-hidden" aria-live="polite" aria-atomic="true">
        {message}
      </div>
    </CanvasActionsContext.Provider>
  );
}
