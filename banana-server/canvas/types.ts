/**
 * Node data types for the React Flow canvas.
 *
 * Built from the plain item shapes in `lib/canvas/types.ts` (the CanvasSnapshot
 * types used by exports and `get_canvas`). Geometry (`x`, `y`, `w`, `h`) lives on
 * the React Flow node, not in `data`, and `sectionId` is the node's `parentId`.
 *
 * Type-only imports so these files stay safe for Vitest in a node env.
 */
import type { Node } from "@xyflow/react";
import type {
  ImageItem,
  NoteItem,
  SectionItem,
  SwatchItem,
  Tag,
  TypeSampleItem,
  UploadItem,
} from "@/lib/canvas/types";
import type { Zone } from "@/lib/direction-detail";
import type { Part, StitchData } from "@/lib/stitch/types";

export type { Tag } from "@/lib/canvas/types";

type Geometry = "id" | "type" | "x" | "y" | "w" | "h" | "sectionId";

/** React Flow requires `data` to be a plain object type, so these are `type` aliases, not interfaces. */
export type ImageNodeData = Omit<ImageItem, Geometry> & {
  /** Natural size of the image, used to keep its aspect ratio in layouts. */
  width?: number | null;
  height?: number | null;
};
export type UploadNodeData = Omit<UploadItem, Geometry> & {
  width?: number | null;
  height?: number | null;
};
export type NoteNodeData = Omit<NoteItem, Geometry> & {
  /**
   * The user set this note's height (resize drag, + and -, "Compact"). Missing means auto:
   * the note grows and shrinks to fit its text (canvas/note-layout.ts). A manual height
   * shorter than the text shows the compact presentation instead of a scrollbar.
   */
  manualHeight?: boolean;
};
export type SwatchNodeData = Omit<SwatchItem, Geometry>;
export type TypeSampleNodeData = Omit<TypeSampleItem, Geometry>;
export type SectionNodeData = Omit<SectionItem, Geometry> & {
  collapsed?: boolean;
  /** Height to restore when a collapsed section opens again. */
  expandedHeight?: number | null;
};

/** A stitch frame: rows of slots, each showing a crop of a part from `CanvasState.parts`. */
/** Same fields as StitchData; a mapped type because React Flow needs `data` to be a plain object type. */
export type StitchNodeData = Pick<StitchData, keyof StitchData>;

export type ImageFlowNode = Node<ImageNodeData, "image">;
export type UploadFlowNode = Node<UploadNodeData, "upload">;
export type NoteFlowNode = Node<NoteNodeData, "note">;
export type SwatchFlowNode = Node<SwatchNodeData, "swatch">;
export type TypeSampleFlowNode = Node<TypeSampleNodeData, "typeSample">;
export type SectionFlowNode = Node<SectionNodeData, "section">;
export type StitchFlowNode = Node<StitchNodeData, "stitch">;

export type ReferenceFlowNode = ImageFlowNode | UploadFlowNode;
export type CanvasFlowNode =
  | ImageFlowNode
  | UploadFlowNode
  | NoteFlowNode
  | SwatchFlowNode
  | TypeSampleFlowNode
  | SectionFlowNode
  | StitchFlowNode;

export type CanvasNodeType = CanvasFlowNode["type"];

export interface NodeDataByType {
  image: ImageNodeData;
  upload: UploadNodeData;
  note: NoteNodeData;
  swatch: SwatchNodeData;
  typeSample: TypeSampleNodeData;
  section: SectionNodeData;
  stitch: StitchNodeData;
}

export const NODE_TYPES: readonly CanvasNodeType[] = ["image", "upload", "note", "swatch", "typeSample", "section", "stitch"];

/**
 * A search result waiting in the tray. Same fields as `Reference` in
 * `lib/sources/types.ts`: URLs and metadata only, never image bytes.
 */
export type TrayReference = {
  id: string;
  thumbUrl: string;
  imageUrl: string;
  sourceUrl: string;
  sourceSite: string;
  title?: string;
  width?: number;
  height?: number;
  /** Direction the result came from; dropping it lands in that section when present. */
  directionId?: string;
  /** Board zone from the search ("art" for art direction results). Missing means "ui". */
  zone?: Zone;
};

export interface StoredViewport {
  x: number;
  y: number;
  zoom: number;
}

/** One node in `canvases.state`. Coordinates are relative to the parent section when `parentId` is set. */
export type StoredNode = {
  [K in CanvasNodeType]: {
    id: string;
    type: K;
    x: number;
    y: number;
    w: number;
    h: number;
    parentId?: string;
    z?: number;
    data: NodeDataByType[K];
  };
}[CanvasNodeType];

export const STATE_VERSION = 1;

/**
 * The canvas's baseline search (lib/sources/baseline.ts): the fidelity lane ran once for `key`
 * (platform and page words) at `at` (ISO time) and found `referenceIds`. Set only by the MCP tools.
 */
export type CanvasBaseline = { key: string; referenceIds: string[]; at: string };

/** The JSON saved in `canvases.state` (spec section 11: nodes + viewport, plus the tray). */
export interface CanvasState {
  version: typeof STATE_VERSION;
  viewport: StoredViewport;
  nodes: StoredNode[];
  tray: TrayReference[];
  /**
   * Style words for searches (lib/taste.ts), set by the MCP tools. The canvas UI never edits it;
   * a save without it keeps the stored one (lib/db/canvases.ts saveCanvasState).
   */
  taste?: string[];
  /** Parts library for stitches (lib/stitch/types.ts), up to MAX_PARTS. The UI and the tools both edit it. */
  parts?: Part[];
  /** The baseline search, run once per canvas (search_references). The canvas UI never edits it. */
  baseline?: CanvasBaseline;
}

/** Default sizes for new nodes, in canvas pixels. */
export const DEFAULT_SIZE: Record<CanvasNodeType, { w: number; h: number }> = {
  image: { w: 280, h: 210 },
  upload: { w: 280, h: 210 },
  note: { w: 220, h: 140 },
  swatch: { w: 220, h: 250 },
  typeSample: { w: 320, h: 170 },
  section: { w: 616, h: 420 },
  // Website frame; mobile and tablet frames are narrower (lib/stitch/size.ts stitchSize).
  stitch: { w: 720, h: 900 },
};

/** Smallest size a node can be resized to. Keeps controls inside at least 24x24 px. */
export const MIN_SIZE: Record<CanvasNodeType, { w: number; h: number }> = {
  image: { w: 120, h: 96 },
  upload: { w: 120, h: 96 },
  // One line of note text with room around it (canvas/note-layout.ts NOTE_MIN_HEIGHT). The note's
  // controls sit in the pill above it, not inside, so it can be this short.
  note: { w: 140, h: 64 },
  swatch: { w: 200, h: 230 },
  typeSample: { w: 220, h: 140 },
  section: { w: 296, h: 48 },
  stitch: { w: 200, h: 160 },
};

export const NOTE_COLORS = ["yellow", "blue", "pink", "green", "gray"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export function isTag(value: unknown): value is Tag {
  return value === "ship" || value === "explore";
}
