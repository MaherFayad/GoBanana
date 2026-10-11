"use client";

/**
 * Per-node menu (spec section 9): Move to section, Bring forward, Remove, Open source,
 * plus node specific items. It is the menu alternative to every drag (SC 2.5.7).
 * Opens from its button or with the M key on a focused node.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useCanvasActions } from "../context";
import { IconMore } from "../icons";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  /** Draw a separator above this item. */
  separator?: boolean;
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
  // Also opened by the M key on the focused node (CanvasApp sets menuFor).
  const open = openLocal || actions.menuFor === nodeId;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const menuId = useId();

  const { menuFor, setMenuFor } = actions;
  const close = useCallback(
    (refocus: boolean) => {
      setOpen(false);
      if (menuFor === nodeId) setMenuFor(null);
      if (refocus) buttonRef.current?.focus();
    },
    [menuFor, nodeId, setMenuFor],
  );

  useEffect(() => {
    if (!open) return;
    const first = listRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]");
    first?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && !listRef.current?.contains(t) && !buttonRef.current?.contains(t)) close(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, close]);

  if (actions.readOnly) {
    return null;
  }

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
  all.push({ label: "Bring forward", onSelect: () => actions.bringForward(nodeId), separator: true });
  if (resizable) {
    all.push({ label: "Make bigger", onSelect: () => actions.resize(nodeId, 1) });
    all.push({ label: "Make smaller", onSelect: () => actions.resize(nodeId, -1) });
  }
  all.push({ label: "Remove", onSelect: () => actions.remove(nodeId), danger: true, separator: true });

  const onMenuKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (i + 1) % buttons.length;
    else if (e.key === "ArrowUp") next = (i - 1 + buttons.length) % buttons.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = buttons.length - 1;
    else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    } else if (e.key === "Tab") {
      close(false);
      return;
    }
    // Keep arrow keys and Delete inside the menu from reaching the canvas.
    e.stopPropagation();
    if (next !== null) {
      e.preventDefault();
      buttons[next]?.focus();
    }
  };

  return (
    <div className="bn-menu-wrap nodrag nopan">
      <button
        ref={buttonRef}
        type="button"
        className="bn-btn bn-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Options for ${label}`}
        title="Options (M)"
        onClick={(e) => {
          e.stopPropagation();
          if (open) close(false);
          else setOpen(true);
        }}
      >
        <IconMore />
      </button>
      {open && (
        <ul ref={listRef} id={menuId} role="menu" aria-label={`Options for ${label}`} className="bn-menu nowheel" onKeyDown={onMenuKey}>
          {all.map((item) => (
            <li key={item.label} role="none">
              {item.separator && <div className="bn-menu-sep" role="separator" />}
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="bn-menu-item"
                data-danger={item.danger ? "true" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  close(false);
                  item.onSelect();
                  // Keep focus on this node unless the item removed it or opened an editor.
                  if (!item.danger) {
                    requestAnimationFrame(() => {
                      const active = document.activeElement;
                      if (!active || active === document.body) buttonRef.current?.focus();
                    });
                  }
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
