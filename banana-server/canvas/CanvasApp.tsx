"use client";

/**
 * The moodboard canvas (spec section 9), in the Studio design language and interaction model
 * (docs/design-language.md sections 3, 5, 6 and 11). One React Flow app used on the web
 * (`/c/:id`) and inline in chat (MCP Apps). Where state comes from and goes to is decided by
 * the `persistence` adapter.
 *
 * Pointer: wheel pans (Shift for sideways), Ctrl or Cmd + wheel and pinch zoom, drag on the
 * empty board draws a marquee, Space or the hand tool (H) pans, Shift or Ctrl/Cmd + click
 * toggles, Alt + drag drags a copy, items snap to their neighbors with guides (Ctrl/Cmd while
 * dragging moves freely), right click opens the item menu.
 * Keys: one registry (canvas/shortcuts.ts) drives the handlers below and the ? sheet. Every
 * drag has a key or menu route (SC 2.5.7).
 */
import "@xyflow/react/dist/style.css";
import "./canvas.css";

import {
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useNodesState,
  useReactFlow,
  type NodeChange,
  type NodeMouseHandler,
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
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { dismissToast, pushToast } from "@/components/studio/toastBus";
import { InfoIcon } from "@/components/studio/icons";
import { createAutoSaver, type SaveStatus } from "./autosave";
import { CanvasActionsContext, type CanvasActions } from "./context";
import {
  cascade,
  absoluteRect,
  bringForward,
  duplicateNodes,
  nodeSize,
  removeNode,
  reparent,
  sectionAt,
  selectedIds,
  toggleCollapsed,
} from "./geometry";
import { newNodeId, noteNode, referenceNode, sectionNode } from "./factory";
import { directionWord, nudgeDelta, resizeBy } from "./keyboard";
import { arrangeNodes, LAYOUT_LABELS, type LayoutKind } from "./layout-adapter";
import { nodeLabel } from "./labels";
import { Notch, type CanvasTool } from "./Notch";
import { nodeTypes } from "./nodes";
import type { CanvasPersistence } from "./persistence";
import { isConflict } from "./persistence";
import { matches } from "./shortcuts";
import { ShortcutSheet } from "./ShortcutSheet";
import { SnapGuides } from "./SnapGuides";
import { collectPeerRects, computeSnap, guidesEqual, unionRect, type SnapGuide } from "./snapping";
import { deserializeState, orderNodes, serializeState, stateKey, type Deserialized, type IsBlocked } from "./state";
import { Toolbar, type ToolbarProps } from "./Toolbar";
import { Tray, TRAY_DND_TYPE } from "./Tray";
import { MIN_SIZE, type CanvasFlowNode, type CanvasState, type TrayReference } from "./types";
import {
  clearanceBelow,
  FIT_PADDING,
  MAX_ZOOM,
  MIN_ZOOM,
  nextZoomStep,
  PAN_STEP,
  PAN_STEP_LARGE,
  zoomDuration,
} from "./viewport";

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
  /** Force a color scheme; default follows the system (dark when there is no preference). */
  theme?: "light" | "dark";
  /**
   * Narrow frames (inline under 720px): the rail is hidden and the search results panel
   * starts closed; the top bar keeps the title, save status and zoom, plus a results button.
   */
  compact?: boolean;
  /** Called after each successful save. */
  onSaved?: (state: CanvasState) => void;
  /** Web canvas only: shows Upload and Share in the toolbar. Leave unset inline (MCP Apps). */
  web?: Pick<ToolbarProps, "plan" | "shareToken" | "pricingHref">;
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
        <div className="bn-loading" role="status" aria-busy="true">
          Loading canvas…
        </div>
      ) : (
        <div className="bn-error" role="alert">
          <p>Could not load this canvas.</p>
          <button
            type="button"
            className="st-btn"
            data-variant="secondary"
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
    "Press Enter or Space to select. Arrow keys move the item 8 pixels, Shift and arrow keys 32 pixels. Plus and minus resize it. M opens its menu. Delete removes it. Question mark lists every shortcut.",
  "node.a11yDescription.keyboardDisabled": "View only.",
  "node.a11yDescription.ariaLiveMessage": ({ direction, x, y }: { direction: string; x: number; y: number }) =>
    `Moved ${direction} to ${x}, ${y}`,
};

/** Text fields own their keys (typing "a" or "?" never runs a shortcut). */
function isEditable(el: HTMLElement | null): boolean {
  if (!el) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function CanvasEditor({
  canvasId,
  appName,
  title = "Untitled canvas",
  persistence,
  readOnly = false,
  loadFonts = true,
  compact = false,
  onSaved,
  theme,
  web,
  initial,
}: CanvasAppProps & { initial: Deserialized }) {
  const rf = useReactFlow<CanvasFlowNode>();
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<CanvasFlowNode>(initial.nodes);
  const [tray, setTray] = useState<TrayReference[]>(initial.tray);
  const [viewport, setViewport] = useState<Viewport>(initial.viewport);
  const [trayOpen, setTrayOpen] = useState(!readOnly && !compact);
  const [prevCompact, setPrevCompact] = useState(compact);
  if (compact !== prevCompact) {
    setPrevCompact(compact);
    setTrayOpen(!readOnly && !compact);
  }
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [menuFor, setMenuForState] = useState<{ id: string; point: { x: number; y: number } | null } | null>(null);
  const [editingId, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const flowRef = useRef<HTMLElement>(null);
  const notchRef = useRef<HTMLDivElement>(null);
  /** Ctrl or Cmd held during a drag: move freely, no snapping (Studio "free place"). */
  const freeMove = useRef(false);
  /** True from a pointer drag's start until just after it stops. */
  const dragSession = useRef(false);
  // Latest nodes and tray for event handlers (kept in sync after each commit).
  const nodesRef = useRef(nodes);
  const trayRef = useRef(tray);
  useLayoutEffect(() => {
    nodesRef.current = nodes;
    trayRef.current = tray;
  }, [nodes, tray]);
  const uid = useId().replace(/:/g, "");
  const trayId = `bn-tray-${uid}`;
  const boardHintId = `bn-board-hint-${uid}`;

  // ------------------------------------------------------------------ auto-save
  const [saver] = useState(() => {
    let toastId: string | null = null;
    const s = createAutoSaver(
      async (state) => {
        await persistence.save(state);
        onSaved?.(state);
      },
      {
        onStatus: (status, error) => {
          setSaveStatus(status);
          // Operation failures go to a toast that stays until closed; the save chip keeps the
          // lasting state. A conflict has its own banner on the web page.
          if (status === "error" && !isConflict(error)) {
            toastId = pushToast({
              kind: "error",
              title: "Could not save",
              body: "Your changes are still here. Check your connection, then try again.",
              dedupeKey: `canvas-save-${canvasId}`,
              action: { label: "Try again", onAction: () => void s.flush() },
            });
          } else if (status === "saved" && toastId) {
            dismissToast(toastId);
            toastId = null;
          }
        },
        initialKey: stateKey(serializeState(initial.nodes, initial.viewport, initial.tray)),
      },
    );
    return s;
  });

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
    setMessage((prev) => (prev === m ? `${m} ` : m));
  }, []);

  const focusNode = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const el = flowRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
      el?.focus();
    });
  }, []);

  const focusBoard = useCallback(() => requestAnimationFrame(() => flowRef.current?.focus({ preventScroll: true })), []);

  const viewportCenter = useCallback(() => {
    const r = flowRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [rf]);

  const setMenuFor = useCallback((id: string | null, point?: { x: number; y: number }) => {
    setMenuForState(id ? { id, point: point ?? null } : null);
  }, []);

  /** Select exactly these ids (React Flow raises selected items, so menus draw on top). */
  const selectOnly = useCallback(
    (ids: readonly string[]) => {
      const want = new Set(ids);
      setNodes((nds) =>
        nds.map((n) => (Boolean(n.selected) === want.has(n.id) ? n : ({ ...n, selected: want.has(n.id) } as CanvasFlowNode))),
      );
    },
    [setNodes],
  );

  // ------------------------------------------------------------------ snapping during drags
  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      if (readOnly) {
        onNodesChangeBase(changes.filter((c) => c.type === "dimensions" || c.type === "select"));
        return;
      }
      // Removals go through `remove` so sections keep their contents.
      let list = changes.filter((c) => c.type !== "remove");
      // Position changes from a pointer drag, including the last one (dragging: false) that
      // React Flow sends when the drag ends: it carries the unsnapped spot, so snap it too.
      const inDrag = (c: NodeChange<CanvasFlowNode>) =>
        c.type === "position" && !!c.position && (c.dragging === true || (c.dragging === false && dragSession.current));
      const drags = list.filter(inDrag);
      if (drags.length > 0) {
        const current = nodesRef.current;
        const ids = new Set(drags.map((c) => (c as { id: string }).id));
        let snap: { dx: number; dy: number; guides: SnapGuide[] } = { dx: 0, dy: 0, guides: [] };
        if (!freeMove.current) {
          const rects = drags.flatMap((c) => {
            if (c.type !== "position" || !c.position) return [];
            const n = current.find((x) => x.id === c.id);
            if (!n) return [];
            const parent = n.parentId ? current.find((p) => p.id === n.parentId) : undefined;
            const s = nodeSize(n);
            return [{ x: c.position.x + (parent?.position.x ?? 0), y: c.position.y + (parent?.position.y ?? 0), w: s.w, h: s.h }];
          });
          const box = unionRect(rects);
          if (box) {
            const r = computeSnap(box, collectPeerRects(current, ids));
            snap = { dx: r.x - box.x, dy: r.y - box.y, guides: r.guides };
          }
        }
        if (snap.dx || snap.dy) {
          list = list.map((c) =>
            inDrag(c) && c.type === "position" && c.position
              ? { ...c, position: { x: c.position.x + snap.dx, y: c.position.y + snap.dy } }
              : c,
          );
        }
        const live = drags.some((c) => c.type === "position" && c.dragging);
        const next = live ? snap.guides : [];
        setGuides((prev) => (guidesEqual(prev, next) ? prev : next));
      }
      onNodesChangeBase(list);
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
  const removeIds = useCallback(
    (ids: readonly string[]) => {
      if (ids.length === 0) return;
      const list = nodesRef.current.filter((n) => !n.hidden);
      const gone = new Set(ids);
      const i = list.findIndex((n) => gone.has(n.id));
      const next = list.slice(i + 1).find((n) => !gone.has(n.id)) ?? list.slice(0, i).reverse().find((n) => !gone.has(n.id));
      setNodes((nds) => ids.reduce((acc, id) => removeNode(acc, id), nds));
      announce(ids.length === 1 ? "Item removed" : `${ids.length} items removed`);
      if (next) focusNode(next.id);
      else focusBoard();
    },
    [announce, focusBoard, focusNode, setNodes],
  );

  const remove = useCallback((id: string) => removeIds([id]), [removeIds]);

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

  /** Mod+D and the menu's Duplicate: copies 16 px down and right, selected. */
  const duplicateIds = useCallback(
    (ids: readonly string[]) => {
      if (ids.length === 0) return;
      const { nodes: next, copies } = duplicateNodes(nodesRef.current, ids, (n) => newNodeId(n.type), { offset: 16, select: true });
      setNodes(next);
      announce(copies.length === 1 ? "Copy made and selected" : `${copies.length} copies made and selected`);
      if (copies.length === 1 && copies[0]) focusNode(copies[0]);
    },
    [announce, focusNode, setNodes],
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
      menuFor: menuFor?.id ?? null,
      menuPoint: menuFor?.point ?? null,
      setMenuFor,
      duplicate: (id) => duplicateIds([id]),
      editingId,
      setEditing,
      announce,
      focusNode,
    }),
    [readOnly, loadFonts, sections, remove, resize, menuFor, setMenuFor, duplicateIds, editingId, announce, focusNode, setNodes],
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

  // ------------------------------------------------------------------ viewport
  // While a discrete zoom animates, the next step counts from where it is going, not from
  // the frame in between (pressing - twice goes 125% to 100% to 75%).
  const zoomTarget = useRef<{ zoom: number; until: number } | null>(null);
  const zoom = useMemo(() => {
    const stepTo = (z: number) => {
      const duration = zoomDuration();
      zoomTarget.current = { zoom: z, until: performance.now() + duration + 50 };
      void rf.zoomTo(z, { duration });
    };
    const base = () => {
      const t = zoomTarget.current;
      return t && performance.now() < t.until ? t.zoom : rf.getZoom();
    };
    return {
      zoomIn: () => stepTo(nextZoomStep(base(), 1)),
      zoomOut: () => stepTo(nextZoomStep(base(), -1)),
      zoomTo100: () => stepTo(1),
      zoomToFit: () => void rf.fitView({ padding: FIT_PADDING, duration: zoomDuration() }),
      zoomToSelection: () => {
        const sel = selectedIds(nodesRef.current);
        if (sel.length === 0) {
          announce("Nothing is selected. Showing everything.");
          void rf.fitView({ padding: FIT_PADDING, duration: zoomDuration() });
          return;
        }
        void rf.fitView({ nodes: sel.map((id) => ({ id })), padding: FIT_PADDING, duration: zoomDuration() });
      },
    };
  }, [announce, rf]);

  const arrangeAll = useCallback(
    (layout: LayoutKind) => {
      setNodes((nds) => arrangeNodes(nds, layout));
      announce(`Arranged: ${LAYOUT_LABELS[layout]}`);
      requestAnimationFrame(() => void rf.fitView({ padding: FIT_PADDING, duration: zoomDuration() }));
    },
    [announce, rf, setNodes],
  );

  const chooseTool = useCallback(
    (t: CanvasTool) => {
      setTool(t);
      announce(t === "hand" ? "Hand tool. Drag to pan." : "Select tool. Drag to select.");
    },
    [announce],
  );

  // ------------------------------------------------------------------ keyboard: focused item
  const onKeyDownCapture = (e: KeyboardEvent<HTMLElement>) => {
    const el = e.target as HTMLElement;
    if (!el.classList?.contains("react-flow__node")) return;
    const id = el.getAttribute("data-id");
    const node = id ? nodesRef.current.find((n) => n.id === id) : undefined;
    if (!id || !node || readOnly) return;

    // With a selection that includes this item, moves and removals act on the whole selection.
    const group = () => {
      if (!node.selected) return [id];
      const sel = selectedIds(nodesRef.current);
      const set = new Set(sel);
      // Children of a selected section move with it already.
      return sel.filter((x) => {
        const n = nodesRef.current.find((m) => m.id === x);
        return !(n?.parentId && set.has(n.parentId));
      });
    };

    if (matches("nudge", e) || matches("nudgeLarge", e)) {
      const delta = nudgeDelta(e.key, e.shiftKey);
      if (!delta) return;
      e.preventDefault();
      e.stopPropagation();
      const ids = group();
      const set = new Set(ids);
      setNodes((nds) =>
        settleIntoSection(
          nds.map((n) =>
            set.has(n.id) ? ({ ...n, position: { x: n.position.x + delta.x, y: n.position.y + delta.y } } as CanvasFlowNode) : n,
          ),
          ids,
        ),
      );
      const r = absoluteRect(node, nodesRef.current);
      const where = `${Math.round(r.x + delta.x)}, ${Math.round(r.y + delta.y)}`;
      announce(ids.length > 1 ? `Moved ${ids.length} items ${directionWord(e.key)}` : `Moved ${directionWord(e.key)} to ${where}`);
      return;
    }
    if (matches("remove", e)) {
      e.preventDefault();
      e.stopPropagation();
      removeIds(group());
      return;
    }
    if ((matches("grow", e) || matches("shrink", e)) && node.type !== "swatch") {
      e.preventDefault();
      e.stopPropagation();
      resize(id, matches("grow", e) ? 1 : -1);
      return;
    }
    if (matches("menu", e)) {
      e.preventDefault();
      e.stopPropagation();
      // Select it too, so React Flow raises it and the menu is drawn above its neighbors.
      selectOnly([id]);
      setMenuFor(id);
      return;
    }
    if (matches("edit", e) && node.type !== "typeSample") {
      e.preventDefault();
      e.stopPropagation();
      setEditing(id);
    }
  };

  // ------------------------------------------------------------------ keyboard: canvas and board
  const onShellKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (e.defaultPrevented || isEditable(target) || target.closest("[role=menu], dialog")) return;

    if (matches("sheet", e)) {
      e.preventDefault();
      setSheetOpen(true);
      return;
    }
    if (matches("zoomFit", e)) {
      e.preventDefault();
      zoom.zoomToFit();
      return;
    }
    if (matches("zoomSelection", e)) {
      e.preventDefault();
      zoom.zoomToSelection();
      return;
    }
    if (matches("selectAll", e)) {
      e.preventDefault();
      const ids = nodesRef.current.filter((n) => !n.hidden).map((n) => n.id);
      selectOnly(ids);
      announce(`${ids.length} ${plural(ids.length, "item", "items")} selected`);
      return;
    }
    if (matches("deselect", e)) {
      if (selectedIds(nodesRef.current).length === 0) return;
      e.preventDefault();
      selectOnly([]);
      announce("Selection cleared");
      return;
    }
    if (matches("duplicate", e)) {
      e.preventDefault();
      if (readOnly) return;
      const sel = selectedIds(nodesRef.current);
      const focused = target.closest<HTMLElement>(".react-flow__node")?.dataset.id;
      duplicateIds(sel.length > 0 ? sel : focused ? [focused] : []);
      return;
    }
    if (matches("hand", e)) {
      e.preventDefault();
      chooseTool(tool === "hand" ? "select" : "hand");
      return;
    }
    if (matches("select", e)) {
      e.preventDefault();
      chooseTool("select");
      return;
    }

    // Board scope: the focused board itself, not an item or a control on it.
    const flow = flowRef.current;
    const onBoard = !!flow && (target === flow || target.classList.contains("react-flow") || target.classList.contains("react-flow__pane"));
    if (!onBoard) return;
    if (matches("zoomIn", e)) {
      e.preventDefault();
      zoom.zoomIn();
    } else if (matches("zoomOut", e)) {
      e.preventDefault();
      zoom.zoomOut();
    } else if (matches("zoom100", e)) {
      // Only on the board: elsewhere Ctrl/Cmd + 0 stays the browser's page zoom reset.
      e.preventDefault();
      zoom.zoomTo100();
    } else if (matches("pan", e) || matches("panLarge", e)) {
      const d = nudgeDelta(e.key, false);
      if (!d) return;
      e.preventDefault();
      const step = e.shiftKey ? PAN_STEP_LARGE : PAN_STEP;
      const vp = rf.getViewport();
      void rf.setViewport({ x: vp.x - d.x * (step / 8), y: vp.y - d.y * (step / 8), zoom: vp.zoom });
    } else if (matches("remove", e) && !readOnly) {
      const sel = selectedIds(nodesRef.current);
      if (sel.length === 0) return;
      e.preventDefault();
      removeIds(sel);
    }
  };

  // A pointer down on the empty board focuses it, so the board keys work after a click.
  const onBoardPointerDown = (e: PointerEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (!t.closest(".react-flow__pane")) return;
    const flow = flowRef.current;
    if (flow && !flow.contains(document.activeElement)) flow.focus({ preventScroll: true });
    freeMove.current = e.ctrlKey || e.metaKey;
  };

  // Focus not obscured (SC 2.4.11): pan a focused item clear of the notch.
  const onBoardFocus = (e: FocusEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (!t.classList.contains("react-flow__node")) return;
    requestAnimationFrame(() => {
      const bar = notchRef.current?.getBoundingClientRect();
      if (!bar || document.activeElement !== t) return;
      const d = clearanceBelow(t.getBoundingClientRect(), bar);
      if (d > 0) {
        const vp = rf.getViewport();
        void rf.setViewport({ ...vp, y: vp.y + d }, { duration: zoomDuration() });
      }
    });
  };

  // ------------------------------------------------------------------ drags
  const onNodeDragStart: OnNodeDrag<CanvasFlowNode> = useCallback(
    (e, _node, dragged) => {
      freeMove.current = e.ctrlKey || e.metaKey;
      dragSession.current = true;
      if (readOnly || !e.altKey) return;
      // Alt + drag: a copy stays where the items were, the originals move.
      const ids = dragged.map((d) => d.id);
      const { nodes: next, copies } = duplicateNodes(nodesRef.current, ids, (n) => newNodeId(n.type), { offset: 0 });
      setNodes(next);
      announce(copies.length === 1 ? "Copy made" : `${copies.length} copies made`);
    },
    [announce, readOnly, setNodes],
  );

  const onNodeDrag: OnNodeDrag<CanvasFlowNode> = useCallback((e) => {
    freeMove.current = e.ctrlKey || e.metaKey;
  }, []);

  const onNodeDragStop: OnNodeDrag<CanvasFlowNode> = useCallback(
    (_e, _node, dragged) => {
      setGuides([]);
      // The final position change may come right after this callback; end the session after it.
      requestAnimationFrame(() => {
        dragSession.current = false;
        freeMove.current = false;
      });
      setNodes((nds) =>
        settleIntoSection(
          nds,
          dragged.map((d) => d.id),
        ),
      );
    },
    [setNodes, settleIntoSection],
  );

  const onNodeContextMenu: NodeMouseHandler<CanvasFlowNode> = useCallback(
    (e, node) => {
      if (readOnly) return;
      e.preventDefault();
      selectOnly([node.id]);
      setMenuFor(node.id, { x: e.clientX, y: e.clientY });
    },
    [readOnly, selectOnly, setMenuFor],
  );

  // ------------------------------------------------------------------ drag from tray
  const onDragOver = (e: DragEvent<HTMLElement>) => {
    if (readOnly || !e.dataTransfer.types.includes(TRAY_DND_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dropActive) setDropActive(true);
  };
  const onDrop = (e: DragEvent<HTMLElement>) => {
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
  const hand = tool === "hand";

  return (
    <CanvasActionsContext.Provider value={actions}>
      <div className="bn-shell" onKeyDown={onShellKeyDown}>
        <Toolbar
          appName={appName}
          title={title}
          readOnly={readOnly}
          saveStatus={saveStatus}
          onRetrySave={() => void saver.flush()}
          zoom={zoom}
          onHelp={() => setSheetOpen(true)}
          results={
            compact && !readOnly
              ? { open: trayOpen, count: tray.length, controls: trayId, onToggle: () => setTrayOpen((o) => !o) }
              : undefined
          }
          {...(web && !readOnly ? { canvasId, ...web } : {})}
        />
        {initial.removed > 0 && (
          <div className="bn-notice">
            <p className="st-alert" data-tone="info" role="status">
              <span className="st-alert-icon">
                <InfoIcon size={16} />
              </span>
              <span className="st-alert-content">
                {initial.removed === 1 ? "1 item is hidden" : `${initial.removed} items are hidden`} because of a takedown
                request.
              </span>
            </p>
          </div>
        )}
        <div className="bn-body">
          {!readOnly && (!compact || trayOpen) && (
            <Tray
              id={trayId}
              items={tray}
              onAdd={(r) => addReference(r)}
              open={trayOpen}
              onToggle={() => setTrayOpen((o) => !o)}
              rail={!compact}
              readOnly={readOnly}
            />
          )}
          <main
            ref={flowRef}
            className="bn-flow"
            tabIndex={0}
            aria-label="Canvas"
            aria-describedby={boardHintId}
            data-tool={tool}
            data-drop-active={dropActive ? "true" : undefined}
            data-canvas-id={canvasId}
            onKeyDownCapture={onKeyDownCapture}
            onPointerDownCapture={onBoardPointerDown}
            onFocus={onBoardFocus}
            onDragOver={onDragOver}
            onDragLeave={() => setDropActive(false)}
            onDrop={onDrop}
          >
            <p id={boardHintId} hidden>
              Arrow keys move the view, plus and minus zoom. Tab moves to the items. Question mark lists every shortcut.
            </p>
            <ReactFlow<CanvasFlowNode>
              nodes={viewNodes}
              edges={[]}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onNodeDragStart={onNodeDragStart}
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              onNodeContextMenu={onNodeContextMenu}
              onMoveEnd={(_e, vp) => setViewport(vp)}
              defaultViewport={initial.viewport}
              fitView={isDefaultViewport && initial.nodes.length > 0}
              fitViewOptions={{ padding: FIT_PADDING, maxZoom: 1 }}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              // Studio's model: wheel pans, Ctrl/Cmd + wheel and pinch zoom.
              panOnScroll
              panOnScrollMode={PanOnScrollMode.Free}
              zoomOnScroll={false}
              zoomOnPinch
              zoomActivationKeyCode={["Meta", "Control"]}
              zoomOnDoubleClick={false}
              // Drag on the empty board draws a marquee; middle button, Space or the hand tool pan.
              selectionOnDrag={!hand}
              panOnDrag={hand ? true : [1]}
              selectionMode={SelectionMode.Partial}
              multiSelectionKeyCode={["Meta", "Control", "Shift"]}
              nodeDragThreshold={3}
              paneClickDistance={3}
              nodesDraggable={!readOnly && !hand}
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
              <SnapGuides guides={guides} />
            </ReactFlow>
            {!readOnly && (
              <Notch
                notchRef={notchRef}
                tool={tool}
                onTool={chooseTool}
                onAddNote={addNote}
                onAddSection={addSection}
                onArrange={arrangeAll}
              />
            )}
            {dropActive && <p className="bn-drop-caption">Drop to add to the canvas</p>}
            {nodes.length === 0 && (
              <div className="bn-empty-hint">
                <p>
                  This canvas is empty.
                  {!readOnly && " Add search results from the panel, or add a note."}
                </p>
              </div>
            )}
          </main>
        </div>
        <div className="bn-visually-hidden" aria-live="polite" aria-atomic="true">
          {message}
        </div>
        <ShortcutSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </div>
    </CanvasActionsContext.Provider>
  );
}
