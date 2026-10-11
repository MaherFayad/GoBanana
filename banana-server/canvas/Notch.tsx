"use client";

/**
 * The notch (spec section 3): a floating toolbar hanging from the top center of the board.
 * Tools (select and hand), Add note, Add section, a divider, and Arrange (a menu button).
 *
 * `role="toolbar"` with one tab stop and arrow-key roving (Home and End too; arrows follow
 * the reading direction). It floats over the board, so CanvasApp pans a focused item clear
 * of its rect (SC 2.4.11); the parent passes `notchRef` for that.
 *
 * Add note and Add section: a pointer click starts place mode (a ghost follows the pointer, a
 * click drops it, Escape cancels); pressing and dragging from the button drops it where the
 * pointer is let go; Enter or Space (a click with no pointer, `detail` 0) puts it at the
 * nearest free spot in the middle of the view (SC 2.5.7).
 */
import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { ShortcutKeys, usePlatform } from "@/components/studio/Kbd";
import { toAriaKeyShortcuts } from "@/components/studio/shortcutKeys";
import { Tooltip } from "@/components/studio/Tooltip";
import { ArrangeIcon, CursorIcon, FrameIcon, HandIcon, NoteIcon } from "./icons";
import { LAYOUT_LABELS, LAYOUTS, type LayoutKind } from "./layout-adapter";
import { PopupMenu, type MenuCloseReason } from "./nodes/NodeMenu";

export type CanvasTool = "select" | "hand";

export interface NotchProps {
  notchRef: RefObject<HTMLDivElement | null>;
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  /** "keyboard": place at once in the middle of the view. "place": start place mode. */
  onAdd: (kind: "note" | "section", how: "keyboard" | "place") => void;
  /** Pointer down on an Add button: a drag from here drops the item on the board. */
  onPressAdd: (kind: "note" | "section", e: PointerEvent<HTMLButtonElement>) => void;
  /** The kind being placed, shown as a pressed button. */
  placing: "note" | "section" | null;
  onArrange: (layout: LayoutKind) => void;
}

export function Notch({ notchRef, tool, onTool, onAdd, onPressAdd, placing, onArrange }: NotchProps) {
  const platform = usePlatform();
  const [active, setActive] = useState(0);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const arrangeRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const closeArrange = useCallback((reason: MenuCloseReason) => {
    setArrangeOpen(false);
    if (reason === "escape" || reason === "tab") arrangeRef.current?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(notchRef.current?.querySelectorAll<HTMLButtonElement>(":scope > button, :scope > span > button") ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let next: number | null = null;
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (i + 1) % buttons.length;
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (i - 1 + buttons.length) % buttons.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = buttons.length - 1;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    setActive(next);
    buttons[next]?.focus();
  };

  const stop = (index: number) => ({
    tabIndex: index === active ? 0 : -1,
    onFocus: () => setActive(index),
  });

  return (
    <div ref={notchRef} className="bn-notch" role="toolbar" aria-label="Canvas tools" onKeyDown={onKeyDown}>
      <Tooltip content={<>Select <ShortcutKeys keys="V" /></>}>
        <button
          type="button"
          className="st-btn"
          data-variant="ghost"
          data-icon-only=""
          aria-label="Select tool"
          aria-pressed={tool === "select"}
          aria-keyshortcuts={toAriaKeyShortcuts("V", platform)}
          onClick={() => onTool("select")}
          {...stop(0)}
        >
          <CursorIcon size={16} />
        </button>
      </Tooltip>
      <Tooltip content={<>Hand: drag to pan <ShortcutKeys keys="H" /></>}>
        <button
          type="button"
          className="st-btn"
          data-variant="ghost"
          data-icon-only=""
          aria-label="Hand tool"
          aria-pressed={tool === "hand"}
          aria-keyshortcuts={toAriaKeyShortcuts("H", platform)}
          onClick={() => onTool("hand")}
          {...stop(1)}
        >
          <HandIcon size={16} />
        </button>
      </Tooltip>
      <span className="bn-notch-sep" aria-hidden="true" />
      <button
        type="button"
        className="st-btn"
        data-variant="ghost"
        data-active={placing === "note" ? "" : undefined}
        onClick={(e: MouseEvent) => onAdd("note", e.detail === 0 ? "keyboard" : "place")}
        onPointerDown={(e) => onPressAdd("note", e)}
        {...stop(2)}
      >
        <NoteIcon size={16} />
        <span>Add note</span>
      </button>
      <button
        type="button"
        className="st-btn"
        data-variant="ghost"
        data-active={placing === "section" ? "" : undefined}
        onClick={(e: MouseEvent) => onAdd("section", e.detail === 0 ? "keyboard" : "place")}
        onPointerDown={(e) => onPressAdd("section", e)}
        {...stop(3)}
      >
        <FrameIcon size={16} />
        <span>Add section</span>
      </button>
      <span className="bn-notch-sep" aria-hidden="true" />
      <button
        ref={arrangeRef}
        type="button"
        className="st-btn"
        data-variant="ghost"
        aria-haspopup="menu"
        aria-expanded={arrangeOpen}
        aria-controls={arrangeOpen ? menuId : undefined}
        onClick={() => setArrangeOpen((o) => !o)}
        {...stop(4)}
      >
        <ArrangeIcon size={16} />
        <span>Arrange</span>
      </button>
      <PopupMenu
        id={menuId}
        open={arrangeOpen}
        label="Arrange"
        align="start"
        triggerRef={arrangeRef}
        onClose={closeArrange}
        items={LAYOUTS.map((layout) => ({ label: LAYOUT_LABELS[layout], onSelect: () => onArrange(layout) }))}
      />
    </div>
  );
}
