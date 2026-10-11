"use client";

/**
 * Zoom group for the top bar (spec section 3): zoom out, a percentage button that opens the
 * zoom menu, zoom in. Every entry shows its shortcut, and the buttons carry
 * aria-keyshortcuts (one registry: canvas/shortcuts.ts).
 */
import { useStore } from "@xyflow/react";
import { useCallback, useId, useRef, useState } from "react";
import { ShortcutKeys, usePlatform } from "@/components/studio/Kbd";
import { toAriaKeyShortcuts } from "@/components/studio/shortcutKeys";
import { Tooltip } from "@/components/studio/Tooltip";
import { FitIcon, MinusIcon, PlusIcon } from "./icons";
import { PopupMenu, type MenuCloseReason, type MenuItem } from "./nodes/NodeMenu";
import { shortcut, type ShortcutId } from "./shortcuts";
import { zoomPercent } from "./viewport";

export interface ZoomActions {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo100: () => void;
  zoomToFit: () => void;
  zoomToSelection: () => void;
}

const keysOf = (id: ShortcutId) => shortcut(id).keys[0] ?? "";

export function ZoomMenu(p: ZoomActions) {
  const percent = useStore((s) => zoomPercent(s.transform[2]));
  const platform = usePlatform();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const close = useCallback((reason: MenuCloseReason) => {
    setOpen(false);
    if (reason === "escape" || reason === "tab") buttonRef.current?.focus();
  }, []);

  const items: MenuItem[] = [
    { label: "Zoom in", keys: keysOf("zoomIn"), onSelect: p.zoomIn },
    { label: "Zoom out", keys: keysOf("zoomOut"), onSelect: p.zoomOut },
    { label: "Zoom to 100%", keys: keysOf("zoom100"), onSelect: p.zoomTo100, separator: true },
    { label: "Zoom to fit", keys: keysOf("zoomFit"), onSelect: p.zoomToFit },
    { label: "Zoom to selection", keys: keysOf("zoomSelection"), onSelect: p.zoomToSelection },
  ];

  const aria = (id: ShortcutId) => toAriaKeyShortcuts(keysOf(id), platform);

  return (
    <div className="bn-toolbar-group bn-toolbar-zoom" role="group" aria-label="Zoom">
      <Tooltip content={<>Zoom out <ShortcutKeys keys={keysOf("zoomOut")} /></>}>
        <button
          type="button"
          className="st-btn"
          data-variant="ghost"
          data-icon-only=""
          aria-label="Zoom out"
          aria-keyshortcuts={aria("zoomOut")}
          onClick={p.zoomOut}
        >
          <MinusIcon size={16} />
        </button>
      </Tooltip>
      <Tooltip content="Zoom options">
        <button
          ref={buttonRef}
          type="button"
          className="st-btn bn-zoom-value"
          data-variant="ghost"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={`Zoom ${percent}`}
          data-testid="zoom-value"
          onClick={() => setOpen((o) => !o)}
        >
          {percent}
        </button>
      </Tooltip>
      <Tooltip content={<>Zoom in <ShortcutKeys keys={keysOf("zoomIn")} /></>}>
        <button
          type="button"
          className="st-btn"
          data-variant="ghost"
          data-icon-only=""
          aria-label="Zoom in"
          aria-keyshortcuts={aria("zoomIn")}
          onClick={p.zoomIn}
        >
          <PlusIcon size={16} />
        </button>
      </Tooltip>
      <Tooltip content={<>Zoom to fit <ShortcutKeys keys={keysOf("zoomFit")} /></>}>
        <button
          type="button"
          className="st-btn"
          data-variant="ghost"
          data-icon-only=""
          aria-label="Zoom to fit"
          aria-keyshortcuts={aria("zoomFit")}
          onClick={p.zoomToFit}
        >
          <FitIcon size={16} />
        </button>
      </Tooltip>
      <PopupMenu id={menuId} open={open} label="Zoom" items={items} triggerRef={buttonRef} align="start" onClose={close} />
    </div>
  );
}
