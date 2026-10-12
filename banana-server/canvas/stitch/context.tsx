"use client";

/** What Frankenstein pages and the Parts tab need from the canvas: the parts library and the crop editor. */
import { createContext, useContext } from "react";
import type { Part } from "@/lib/stitch/types";

/** What the crop editor is opened for. */
export type CropTarget =
  | { kind: "slot"; nodeId: string; slotId: string }
  | { kind: "part"; partId: string }
  | { kind: "cut"; nodeId: string };

export interface StitchActions {
  parts: readonly Part[];
  partsById: ReadonlyMap<string, Part>;
  openCrop(target: CropTarget): void;
}

export const StitchContext = createContext<StitchActions>({
  parts: [],
  partsById: new Map(),
  openCrop: () => {},
});

export function useStitch(): StitchActions {
  return useContext(StitchContext);
}

/** Drag data types: a part from the Parts tab, a slot inside a page ("nodeId slotId"). */
export const PART_DND_TYPE = "application/x-moodboard-part";
export const SLOT_DND_TYPE = "application/x-moodboard-stitch-slot";
