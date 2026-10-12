"use client";

/**
 * Sticky note. It never scrolls: an auto note grows and shrinks to fit its text; a height the
 * user set (`manualHeight`) stays, and when it is shorter than the text the note shows the
 * compact presentation (smaller type, a fade, "+N lines") with the full text in a popover on
 * hover, focus or selection. Rules and numbers: canvas/note-layout.ts.
 *
 * Text with "WILD:", "SALVAGE:" or another caps label shows each label as a chip above its
 * paragraph. Display only: the stored text is unchanged and the editor shows it raw.
 */
import { NodeToolbar, Position, type NodeProps, type OnResizeEnd } from "@xyflow/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCanvasActions } from "../context";
import { LinkedText } from "../linkify";
import { CheckIcon } from "../icons";
import {
  heightChanged,
  hiddenLines,
  manualAfterResize,
  NOTE_COMPACT_HEIGHT,
  noteSizing,
  parseNoteSegments,
} from "../note-layout";
import { MIN_SIZE, NOTE_COLORS, type NoteColor, type NoteFlowNode } from "../types";
import { NoteEditor } from "./ImageNode";
import { NodeMenu, type MenuItem } from "./NodeMenu";
import { Resizer } from "./Resizer";

const COLOR_NAMES: Record<NoteColor, string> = {
  yellow: "Yellow",
  blue: "Blue",
  pink: "Pink",
  green: "Green",
  gray: "Gray",
};

/** Close delay for the popover, so the pointer can travel from the note onto it (SC 1.4.13). */
const PEEK_CLOSE_MS = 150;

function noteColor(c: string | null | undefined): NoteColor {
  return (NOTE_COLORS as readonly string[]).includes(c ?? "") ? (c as NoteColor) : "yellow";
}

/** The note's text as labeled segments: a chip and a paragraph each, with a rule between. */
export function NoteText({ text, focusable = true }: { text: string; focusable?: boolean }) {
  const segments = useMemo(() => parseNoteSegments(text), [text]);
  if (!text.trim()) return <p className="bn-note-text bn-note-empty">Empty note. Press F2 or double click to write.</p>;
  if (segments.length === 1 && !segments[0]?.label)
    return (
      <p className="bn-note-text">
        <LinkedText text={text} focusable={focusable} />
      </p>
    );
  return (
    <>
      {segments.map((s, i) => (
        <div key={i} className="bn-note-seg">
          {s.label && <span className="bn-note-label">{s.label}</span>}
          {s.text && (
            <p className="bn-note-text">
              <LinkedText text={s.text} focusable={focusable} />
            </p>
          )}
        </div>
      ))}
    </>
  );
}

export function NoteNode({ id, data, selected, parentId, width, height, dragging }: NodeProps<NoteFlowNode>) {
  const actions = useCanvasActions();
  const { setNodeHeight, updateData } = actions;
  const color = noteColor(data.color);
  const editing = actions.editingId === id;
  const manual = Boolean(data.manualHeight);
  const noteRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<number | null>(null);
  const [hidden, setHidden] = useState(0);
  const h = height ?? 0;
  const sizing = natural === null ? null : noteSizing({ manualHeight: manual, height: h, natural, minHeight: MIN_SIZE.note.h });
  const compact = Boolean(sizing?.compact) && !editing;

  // Latest values for the measuring callback, which runs from observers.
  const live = useRef({ manual, h, editing, compact });
  useLayoutEffect(() => {
    live.current = { manual, h, editing, compact };
  });
  const resizing = useRef<{ startH: number } | null>(null);
  const raf = useRef(0);

  /** Read the text's natural height with the compact styles off, then fit or flag compact. */
  const measure = useCallback(() => {
    const note = noteRef.current;
    const body = bodyRef.current;
    if (!note || !body || resizing.current) return;
    note.dataset.measuring = "";
    const full = body.offsetHeight;
    delete note.dataset.measuring;
    setNatural((prev) => (prev !== null && !heightChanged(prev, full) ? prev : full));
    const cur = live.current;
    setHidden(cur.compact ? hiddenLines(body.scrollHeight, body.clientHeight) : 0);
    // A manual note keeps its height, even while its text is edited (the editor overlays).
    if (cur.manual) return;
    const next = noteSizing({ manualHeight: false, height: cur.h, natural: full, minHeight: MIN_SIZE.note.h }).height;
    if (heightChanged(cur.h, next)) setNodeHeight(id, next);
  }, [id, setNodeHeight]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(measure);
  }, [measure]);

  // On load and on every change of text, width, mode or editing state.
  useLayoutEffect(() => {
    schedule();
  }, [schedule, data.text, width, h, manual, editing, compact]);

  // Size changes from layout (the editor growing, width resize) and late web fonts.
  useEffect(() => {
    const note = noteRef.current;
    const body = bodyRef.current;
    if (!note || !body) return;
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    ro?.observe(note);
    ro?.observe(body);
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    fonts?.addEventListener?.("loadingdone", schedule);
    void fonts?.ready?.then(schedule);
    return () => {
      ro?.disconnect();
      fonts?.removeEventListener?.("loadingdone", schedule);
      cancelAnimationFrame(raf.current);
    };
  }, [schedule]);

  // ------------------------------------------------------------------ the compact popover
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const closeTimer = useRef(0);
  const enter = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    setHover(true);
  }, []);
  const leave = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setHover(false);
      setDismissed(false);
    }, PEEK_CLOSE_MS);
  }, []);
  const peek = compact && !dragging && !dismissed && (hover || focused || Boolean(selected));
  const peekRef = useRef(peek);
  useLayoutEffect(() => {
    peekRef.current = peek;
  });

  // Hover, focus and Escape on the node wrapper (React Flow owns it, so native listeners).
  useEffect(() => {
    const wrapper = noteRef.current?.closest<HTMLElement>(".react-flow__node");
    if (!wrapper) return;
    const onIn = () => setFocused(true);
    const onOut = (e: FocusEvent) => {
      if (!wrapper.contains(e.relatedTarget as Node | null)) {
        setFocused(false);
        setDismissed(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      // Escape closes the popover first (SC 1.4.13 dismissible); the next one clears the selection.
      if (e.key === "Escape" && peekRef.current) {
        e.stopPropagation();
        setDismissed(true);
      }
    };
    wrapper.addEventListener("pointerenter", enter);
    wrapper.addEventListener("pointerleave", leave);
    wrapper.addEventListener("focusin", onIn);
    wrapper.addEventListener("focusout", onOut);
    wrapper.addEventListener("keydown", onKey);
    return () => {
      wrapper.removeEventListener("pointerenter", enter);
      wrapper.removeEventListener("pointerleave", leave);
      wrapper.removeEventListener("focusin", onIn);
      wrapper.removeEventListener("focusout", onOut);
      wrapper.removeEventListener("keydown", onKey);
      window.clearTimeout(closeTimer.current);
    };
  }, [enter, leave]);

  // The popover opens below the note, or above it when the note is near the bottom of the window.
  const [peekSide, setPeekSide] = useState<Position>(Position.Bottom);
  useLayoutEffect(() => {
    if (!peek) return;
    const r = noteRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    setPeekSide(below < 240 && r.top > below ? Position.Top : Position.Bottom);
  }, [peek]);

  // ------------------------------------------------------------------ actions
  const setColor = (c: NoteColor) => {
    if (c === color) return;
    updateData<"note">(id, { color: c });
    actions.announce(`Note color is now ${COLOR_NAMES[c]}`);
  };

  const fitToText = () => {
    updateData<"note">(id, { manualHeight: undefined });
    actions.announce("Note fits its text");
  };

  const makeCompact = () => {
    updateData<"note">(id, { manualHeight: true });
    setNodeHeight(id, Math.max(MIN_SIZE.note.h, Math.min(h, NOTE_COMPACT_HEIGHT)));
    actions.announce("Note is compact. Hover or focus it to read all of it.");
  };

  const onResizeStart = () => {
    resizing.current = { startH: h };
  };
  const onResizeEnd: OnResizeEnd = (_e, params) => {
    const start = resizing.current?.startH ?? h;
    resizing.current = null;
    const nextManual = manualAfterResize(start, params.height, manual);
    if (nextManual !== manual) updateData<"note">(id, { manualHeight: nextManual || undefined });
    setNodeHeight(id, params.height);
    schedule();
  };

  const overflows = natural !== null && natural > NOTE_COMPACT_HEIGHT + 1;
  const items: MenuItem[] = [
    { label: "Edit note", keys: "F2", onSelect: () => actions.setEditing(id), movesFocus: true },
    ...(manual ? [{ label: "Fit to text", onSelect: fitToText }] : []),
    ...(!compact && overflows ? [{ label: "Compact", onSelect: makeCompact }] : []),
    ...NOTE_COLORS.filter((c) => c !== color).map((c, i) => ({
      label: `Color: ${COLOR_NAMES[c]}`,
      separator: i === 0,
      onSelect: () => setColor(c),
    })),
  ];

  return (
    <>
      <Resizer type="note" selected={selected} onResizeStart={onResizeStart} onResizeEnd={onResizeEnd} onFit={fitToText} />
      <div
        ref={noteRef}
        className="bn-node bn-note"
        data-color={color}
        data-compact={compact ? "" : undefined}
        data-editing={editing ? "" : undefined}
        onDoubleClick={() => !actions.readOnly && actions.setEditing(id)}
      >
        <div ref={bodyRef} className="bn-note-body">
          {editing ? (
            <NoteEditor
              initial={data.text}
              label="Note text"
              autoGrow
              onDone={(value) => {
                if (value !== null) updateData<"note">(id, { text: value });
                actions.setEditing(null);
                actions.focusNode(id);
              }}
            />
          ) : (
            <NoteText text={data.text} />
          )}
        </div>
        {compact && (
          <span className="bn-note-more" aria-hidden="true">
            {hidden > 0 ? `+${hidden} ${hidden === 1 ? "line" : "lines"}` : "More"}
          </span>
        )}
        {/* Hover, focus and selection chrome above the note: colors and the menu. */}
        {!actions.readOnly && (
          <div className="bn-note-chrome nodrag nopan">
            <div className="bn-note-swatches" role="group" aria-label="Note color">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="bn-swatch-button"
                  data-color={c}
                  aria-pressed={c === color}
                  aria-label={COLOR_NAMES[c]}
                  onClick={(e) => {
                    e.stopPropagation();
                    setColor(c);
                  }}
                >
                  <CheckIcon size={16} />
                </button>
              ))}
            </div>
            <span className="bn-note-chrome-sep" aria-hidden="true" />
            <NodeMenu nodeId={id} label="note" parentId={parentId} items={items} />
          </div>
        )}
      </div>
      {compact && (
        <NodeToolbar isVisible={peek} position={peekSide} align="start" offset={14} className="bn-note-peek-anchor">
          {/* The full text is already in the note for screen readers; this is the visual copy. */}
          <div
            className="bn-note-peek"
            data-color={color}
            data-length={data.text.length > 600 ? "long" : data.text.length > 240 ? "mid" : "short"}
            aria-hidden="true"
            onPointerEnter={enter}
            onPointerLeave={leave}
          >
            <NoteText text={data.text} focusable={false} />
          </div>
        </NodeToolbar>
      )}
    </>
  );
}
