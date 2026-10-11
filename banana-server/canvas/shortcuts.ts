/**
 * One registry of the canvas shortcuts (docs/design-language.md section 6.4). The key
 * handlers in CanvasApp test events with `matches()`, and the shortcut sheet lists the
 * same entries, so the sheet can never drift from what the keys do.
 *
 * `keys` uses the ShortcutKeys grammar ("Mod+A", "Shift+1", "?"): "Mod" is Command on a
 * Mac and Control elsewhere. Gestures (wheel, drag) have no `test`; they are listed so
 * every pointer move shows its key route next to it (SC 2.5.7).
 */

export type ShortcutScope = "canvas" | "board" | "item" | "results";

export interface KeyEventLike {
  key: string;
  code?: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface Shortcut {
  id: string;
  label: string;
  /** Alternatives, each in ShortcutKeys grammar. The first one is used for aria-keyshortcuts. */
  keys: readonly string[];
  /**
   * Where it works: anywhere in the canvas ("canvas"), on the focused board ("board"),
   * on a focused item ("item"), on a focused search result ("results").
   */
  scope: ShortcutScope;
  /** Pointer gesture, listed in the sheet only. */
  gesture?: boolean;
  test?: (e: KeyEventLike) => boolean;
}

const mod = (e: KeyEventLike) => e.ctrlKey || e.metaKey;
const plain = (e: KeyEventLike) => !e.ctrlKey && !e.metaKey && !e.altKey;
const digit = (e: KeyEventLike, n: number) => e.code === `Digit${n}` || e.key === String(n);
const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export const SHORTCUTS = [
  // ---------------------------------------------------------------- anywhere in the canvas
  { id: "sheet", label: "Show keyboard shortcuts", keys: ["?"], scope: "canvas", test: (e) => !mod(e) && !e.altKey && e.key === "?" },
  { id: "zoomFit", label: "Zoom to fit", keys: ["Shift+1"], scope: "canvas", test: (e) => e.shiftKey && !mod(e) && !e.altKey && (digit(e, 1) || e.key === "!") },
  {
    id: "zoomSelection",
    label: "Zoom to selection",
    keys: ["Shift+2"],
    scope: "canvas",
    test: (e) => e.shiftKey && !mod(e) && !e.altKey && (digit(e, 2) || e.key === "@"),
  },
  { id: "selectAll", label: "Select all items", keys: ["Mod+A"], scope: "canvas", test: (e) => mod(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "a" },
  { id: "deselect", label: "Clear the selection (closes a menu first)", keys: ["Escape"], scope: "canvas", test: (e) => e.key === "Escape" },
  { id: "duplicate", label: "Duplicate the selection", keys: ["Mod+D"], scope: "canvas", test: (e) => mod(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "d" },
  { id: "hand", label: "Hand tool: drag to pan", keys: ["H"], scope: "canvas", test: (e) => plain(e) && !e.shiftKey && e.key.toLowerCase() === "h" },
  { id: "select", label: "Select tool: drag to select", keys: ["V"], scope: "canvas", test: (e) => plain(e) && !e.shiftKey && e.key.toLowerCase() === "v" },

  // ---------------------------------------------------------------- focused board
  { id: "zoomIn", label: "Zoom in", keys: ["+"], scope: "board", test: (e) => plain(e) && (e.key === "+" || e.key === "=") },
  { id: "zoomOut", label: "Zoom out", keys: ["-"], scope: "board", test: (e) => plain(e) && (e.key === "-" || e.key === "_") },
  { id: "zoom100", label: "Zoom to 100%", keys: ["Mod+0"], scope: "board", test: (e) => mod(e) && !e.altKey && !e.shiftKey && digit(e, 0) },
  { id: "pan", label: "Move the view", keys: ["Arrows"], scope: "board", test: (e) => plain(e) && ARROWS.has(e.key) },
  { id: "panLarge", label: "Move the view further", keys: ["Shift+Arrows"], scope: "board", test: (e) => e.shiftKey && plain(e) && ARROWS.has(e.key) },
  { id: "panSpace", label: "Pan while held", keys: ["Space+Drag"], scope: "board", gesture: true },
  { id: "wheel", label: "Pan (Shift for sideways)", keys: ["Wheel"], scope: "board", gesture: true },
  { id: "wheelZoom", label: "Zoom toward the pointer", keys: ["Mod+Wheel"], scope: "board", gesture: true },
  { id: "marquee", label: "Select an area (drag on empty board)", keys: ["Drag"], scope: "board", gesture: true },

  // ---------------------------------------------------------------- focused item
  { id: "nudge", label: "Move the item 8 px", keys: ["Arrows"], scope: "item", test: (e) => plain(e) && !e.shiftKey && ARROWS.has(e.key) },
  { id: "nudgeLarge", label: "Move the item 32 px", keys: ["Shift+Arrows"], scope: "item", test: (e) => e.shiftKey && plain(e) && ARROWS.has(e.key) },
  { id: "grow", label: "Make the item bigger", keys: ["+"], scope: "item", test: (e) => plain(e) && (e.key === "+" || e.key === "=") },
  { id: "shrink", label: "Make the item smaller", keys: ["-"], scope: "item", test: (e) => plain(e) && (e.key === "-" || e.key === "_") },
  {
    id: "menu",
    label: "Open the item menu (move to section, bring forward, remove)",
    keys: ["M", "Shift+F10"],
    scope: "item",
    test: (e) => (plain(e) && (e.key === "m" || e.key === "M" || e.key === "ContextMenu")) || (e.shiftKey && plain(e) && e.key === "F10"),
  },
  { id: "edit", label: "Edit a note, title or role", keys: ["F2"], scope: "item", test: (e) => plain(e) && !e.shiftKey && e.key === "F2" },
  { id: "remove", label: "Remove the item", keys: ["Delete", "Backspace"], scope: "item", test: (e) => plain(e) && (e.key === "Delete" || e.key === "Backspace") },
  { id: "toggleSelect", label: "Add to or take out of the selection", keys: ["Shift+Click"], scope: "item", gesture: true },
  { id: "altDrag", label: "Drag a copy", keys: ["Alt+Drag"], scope: "item", gesture: true },
  { id: "freeDrag", label: "Move without snapping", keys: ["Mod+Drag"], scope: "item", gesture: true },

  // ---------------------------------------------------------------- search results
  { id: "addResult", label: "Add the result to the canvas", keys: ["Enter"], scope: "results", gesture: true },
] as const satisfies readonly Shortcut[];

export type ShortcutId = (typeof SHORTCUTS)[number]["id"];

const BY_ID = new Map<string, Shortcut>(SHORTCUTS.map((s) => [s.id, s]));

export function shortcut(id: ShortcutId): Shortcut {
  return BY_ID.get(id) as Shortcut;
}

/** True when the event is this shortcut. Gestures never match. */
export function matches(id: ShortcutId, e: KeyEventLike): boolean {
  return shortcut(id).test?.(e) ?? false;
}

export const SCOPE_TITLES: Record<ShortcutScope, string> = {
  canvas: "Anywhere on the canvas",
  board: "On the board",
  item: "On a focused item",
  results: "In search results",
};
