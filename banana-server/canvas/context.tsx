"use client";

/** Actions the custom nodes call. Node `data` stays plain JSON; behavior comes from here. */
import { createContext, useContext } from "react";
import type { LayoutKind } from "./layout-adapter";
import type { NodeDataByType } from "./types";

export interface SectionChoice {
  id: string;
  title: string;
}

export interface CanvasActions {
  readOnly: boolean;
  /** Load web fonts for type samples (off inline when the host CSP blocks them). */
  loadFonts: boolean;
  sections: readonly SectionChoice[];
  updateData<K extends keyof NodeDataByType>(id: string, patch: Partial<NodeDataByType[K]>): void;
  remove(id: string): void;
  bringForward(id: string): void;
  moveToSection(id: string, sectionId: string | null): void;
  resize(id: string, direction: -1 | 1): void;
  arrangeSection(id: string, layout: LayoutKind): void;
  toggleCollapse(id: string): void;
  /** Node whose menu should open (set by the M key or a right click). */
  menuFor: string | null;
  /** Screen point for a menu opened by a right click; null opens it at its button. */
  menuPoint: { x: number; y: number } | null;
  setMenuFor(id: string | null, point?: { x: number; y: number }): void;
  /** Copy an item 16 px down and right, select the copy (menu route for Mod+D and Alt+drag). */
  duplicate(id: string): void;
  /** Node in edit mode (note text, section title, swatch role, image note). */
  editingId: string | null;
  setEditing(id: string | null): void;
  announce(message: string): void;
  /** Return focus to the node wrapper (after a menu or editor closes). */
  focusNode(id: string): void;
}

const noop = () => {};

export const CanvasActionsContext = createContext<CanvasActions>({
  readOnly: true,
  loadFonts: false,
  sections: [],
  updateData: noop,
  remove: noop,
  bringForward: noop,
  moveToSection: noop,
  resize: noop,
  arrangeSection: noop,
  toggleCollapse: noop,
  menuFor: null,
  menuPoint: null,
  setMenuFor: noop,
  duplicate: noop,
  editingId: null,
  setEditing: noop,
  announce: noop,
  focusNode: noop,
});

export function useCanvasActions(): CanvasActions {
  return useContext(CanvasActionsContext);
}
