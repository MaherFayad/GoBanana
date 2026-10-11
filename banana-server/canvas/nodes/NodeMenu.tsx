"use client";

/**
 * Menus on the canvas (spec 4.4 and 10, "Node menu").
 *
 * `PopupMenu` is a `.st-menu` list portaled to document.body with `position: fixed` at its
 * trigger or at the pointer, so it works inside React Flow's transformed viewport and is never
 * clipped by the board. It keeps Banana's own keyboard handling: arrows, Home, End, Escape
 * (focus back to the trigger) and Tab. The zoom menu and the notch's Arrange menu use it too.
 *
 * `NodeMenu` is the per-node menu: Move to section, Duplicate, Bring forward, Remove, Open
 * source, plus node specific items. It is the menu alternative to every drag (SC 2.5.7) and
 * opens from its button, the M key on a focused node, or a right click.
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ShortcutKeys } from "@/components/studio/Kbd";
import { Tooltip } from "@/components/studio/Tooltip";
import { useCanvasActions } from "../context";
import { CheckIcon, MoreIcon } from "../icons";
import { prefersReducedMotion } from "../viewport";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  /** Draw a separator above this item. */
  separator?: boolean;
  /** 16px glyph in the start slot. */
  icon?: ReactNode;
  /** Shortcut hint at the end, in ShortcutKeys grammar ("Mod+D", "F2"). */
  keys?: string;
  /** Set for a radio option; true shows the check (state by shape, not color). */
  checked?: boolean;
  /** The item moves focus itself (remove, duplicate, editors): do not return it to the trigger. */
  movesFocus?: boolean;
}

/** How long a closing menu stays mounted for its exit animation (spec 4.4). */
const EXIT_MS = 110;
const EDGE = 8;

export type MenuCloseReason = "escape" | "select" | "outside" | "tab";

export interface PopupMenuProps {
  open: boolean;
  label: string;
  items: readonly MenuItem[];
  triggerRef: RefObject<HTMLElement | null>;
  /** Open at this screen point (right click) instead of under the trigger. */
  point?: { x: number; y: number } | null;
  /** Inline edge of the trigger the menu lines up with. Default "end". */
  align?: "start" | "end";
  onClose: (reason: MenuCloseReason) => void;
  /** Runs after an item's onSelect. */
  afterSelect?: (item: MenuItem) => void;
  id?: string;
}

export function PopupMenu({ open, label, items, triggerRef, point, align = "end", onClose, afterSelect, id }: PopupMenuProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  // Adjust during render (not in an effect): start the exit animation when `open` turns off.
  if (open !== prevOpen) {
    setPrevOpen(open);
    setClosing(!open && !prefersReducedMotion());
  }

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => setClosing(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [closing]);

  const mounted = open || closing;

  // Place it before paint: under (or above) the trigger, or at the pointer, inside the viewport.
  // Theme, direction and language are copied from the trigger, because the list lives in <body>.
  useLayoutEffect(() => {
    const list = listRef.current;
    const trigger = triggerRef.current;
    if (!open || !list || !trigger) return;
    const themed = trigger.closest<HTMLElement>("[data-theme]");
    if (themed?.dataset.theme) list.dataset.theme = themed.dataset.theme;
    else delete list.dataset.theme;
    const rtl = getComputedStyle(trigger).direction === "rtl";
    list.dir = rtl ? "rtl" : "ltr";
    const lang = trigger.closest<HTMLElement>("[lang]")?.lang;
    if (lang) list.lang = lang;

    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const m = list.getBoundingClientRect();
    const t = trigger.getBoundingClientRect();
    let x: number;
    let y: number;
    if (point) {
      x = rtl ? point.x - m.width : point.x;
      y = point.y + m.height > vh - EDGE ? point.y - m.height : point.y;
    } else {
      const atEnd = align === "end";
      x = atEnd !== rtl ? t.right - m.width : t.left;
      const below = vh - t.bottom - EDGE;
      y = below >= m.height || below >= t.top - EDGE ? t.bottom + 4 : t.top - 4 - m.height;
    }
    x = Math.min(Math.max(EDGE, x), Math.max(EDGE, vw - EDGE - m.width));
    y = Math.min(Math.max(EDGE, y), Math.max(EDGE, vh - EDGE - m.height));
    list.style.setProperty("--st-menu-x", `${rtl ? vw - x - m.width : x}px`);
    list.style.setProperty("--st-menu-y", `${y}px`);
  }, [open, point, align, triggerRef]);

  // Focus the first item; a pointer down anywhere else closes the menu.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLButtonElement>("[role^=menuitem]")?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && !listRef.current?.contains(t) && !triggerRef.current?.contains(t)) onClose("outside");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, onClose, triggerRef]);

  if (!mounted || typeof document === "undefined") return null;

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]") ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (i + 1) % buttons.length;
    else if (e.key === "ArrowUp") next = (i - 1 + buttons.length) % buttons.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = buttons.length - 1;
    else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose("escape");
      return;
    } else if (e.key === "Tab") {
      // The list sits at the end of <body>; Tab goes back to the trigger instead.
      e.preventDefault();
      e.stopPropagation();
      onClose("tab");
      return;
    }
    // Keep arrow keys, Delete and the canvas shortcuts inside the menu.
    e.stopPropagation();
    if (next !== null) {
      e.preventDefault();
      buttons[next]?.focus();
    }
  };

  const hasIcons = items.some((it) => it.icon);

  return createPortal(
    <ul
      ref={listRef}
      id={id}
      role="menu"
      aria-label={label}
      className="st-menu bn-menu nowheel"
      data-state={open ? "open" : "closing"}
      inert={!open}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => (
        <li key={item.label} role="none">
          {item.separator && <div className="st-menu-sep" role="separator" />}
          <button
            type="button"
            role={item.checked === undefined ? "menuitem" : "menuitemradio"}
            aria-checked={item.checked}
            tabIndex={-1}
            className="st-menu-item"
            data-tone={item.danger ? "danger" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onClose("select");
              item.onSelect();
              afterSelect?.(item);
            }}
          >
            {hasIcons && <span className="st-menu-item-icon">{item.icon}</span>}
            <span>{item.label}</span>
            {(item.keys || item.checked !== undefined) && (
              <span className="st-menu-item-end">
                {item.keys && <ShortcutKeys keys={item.keys} />}
                {item.checked !== undefined && <CheckIcon size={16} className="st-menu-item-check" />}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  );
}

export interface NodeMenuProps {
  nodeId: string;
  /** Used in the button name: "Options for {label}". */
  label: string;
  parentId?: string;
  items?: MenuItem[];
  /** Source page for references. Adds "Open source". */
  sourceUrl?: string;
  /** False for sections (they cannot go inside sections). */
  movable?: boolean;
  resizable?: boolean;
}

export function NodeMenu({ nodeId, label, parentId, items = [], sourceUrl, movable = true, resizable = true }: NodeMenuProps) {
  const actions = useCanvasActions();
  const [openLocal, setOpen] = useState(false);
  // Also opened by the M key or a right click on the node (CanvasApp sets menuFor).
  const external = actions.menuFor === nodeId;
  const open = openLocal || external;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const { setMenuFor } = actions;
  const close = useCallback(
    (reason: MenuCloseReason) => {
      setOpen(false);
      if (external) setMenuFor(null);
      if (reason === "escape" || reason === "tab") buttonRef.current?.focus();
    },
    [external, setMenuFor],
  );

  if (actions.readOnly) return null;

  // Keep focus on this node unless the item moved it (removed the node or opened an editor).
  const afterSelect = (item: MenuItem) => {
    if (item.movesFocus || item.danger) return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body) buttonRef.current?.focus();
    });
  };

  const all: MenuItem[] = [...items];
  if (sourceUrl) {
    all.push({
      label: "Open source",
      onSelect: () => window.open(sourceUrl, "_blank", "noopener,noreferrer"),
      separator: items.length > 0,
    });
  }
  if (movable) {
    const targets = actions.sections.filter((s) => s.id !== parentId);
    targets.forEach((s, i) =>
      all.push({ label: `Move to section: ${s.title}`, onSelect: () => actions.moveToSection(nodeId, s.id), separator: i === 0 }),
    );
    if (parentId) {
      all.push({ label: "Move out of section", onSelect: () => actions.moveToSection(nodeId, null), separator: targets.length === 0 });
    }
  }
  all.push({ label: "Duplicate", keys: "Mod+D", onSelect: () => actions.duplicate(nodeId), separator: true, movesFocus: true });
  all.push({ label: "Bring forward", onSelect: () => actions.bringForward(nodeId) });
  if (resizable) {
    all.push({ label: "Make bigger", keys: "+", onSelect: () => actions.resize(nodeId, 1) });
    all.push({ label: "Make smaller", keys: "-", onSelect: () => actions.resize(nodeId, -1) });
  }
  all.push({ label: "Remove", keys: "Delete", onSelect: () => actions.remove(nodeId), danger: true, separator: true });

  return (
    <div className="bn-menu-wrap nodrag nopan">
      <Tooltip content={<>Options <ShortcutKeys keys="M" /></>} side="top">
        <button
          ref={buttonRef}
          type="button"
          className="st-btn bn-menu-button"
          data-variant="ghost"
          data-size="xs"
          data-icon-only=""
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={`Options for ${label}`}
          aria-keyshortcuts="M"
          onClick={(e) => {
            e.stopPropagation();
            if (open) close("outside");
            else setOpen(true);
          }}
        >
          <MoreIcon size={16} />
        </button>
      </Tooltip>
      <PopupMenu
        id={menuId}
        open={open}
        label={`Options for ${label}`}
        items={all}
        triggerRef={buttonRef}
        point={external ? actions.menuPoint : null}
        onClose={close}
        afterSelect={afterSelect}
      />
    </div>
  );
}
