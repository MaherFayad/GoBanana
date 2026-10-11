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
export type NoteNodeData = Omit<NoteItem, Geometry>;
export type SwatchNodeData = Omit<SwatchItem, Geometry>;
export type TypeSampleNodeData = Omit<TypeSampleItem, Geometry>;
export type SectionNodeData = Omit<SectionItem, Geometry> & {
  collapsed?: boolean;
  /** Height to restore when a collapsed section opens again. */
  expandedHeight?: number | null;
};

export type ImageFlowNode = Node<ImageNodeData, "image">;
export type UploadFlowNode = Node<UploadNodeData, "upload">;
export type NoteFlowNode = Node<NoteNodeData, "note">;
export type SwatchFlowNode = Node<SwatchNodeData, "swatch">;
export type TypeSampleFlowNode = Node<TypeSampleNodeData, "typeSample">;
export type SectionFlowNode = Node<SectionNodeData, "section">;

export type ReferenceFlowNode = ImageFlowNode | UploadFlowNode;
export type CanvasFlowNode =
  | ImageFlowNode
  | UploadFlowNode
  | NoteFlowNode
  | SwatchFlowNode
  | TypeSampleFlowNode
  | SectionFlowNode;

export type CanvasNodeType = CanvasFlowNode["type"];

export interface NodeDataByType {
  image: ImageNodeData;
  upload: UploadNodeData;
  note: NoteNodeData;
  swatch: SwatchNodeData;
  typeSample: TypeSampleNodeData;
  section: SectionNodeData;
}

export const NODE_TYPES: readonly CanvasNodeType[] = ["image", "upload", "note", "swatch", "typeSample", "section"];

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
}

/** Default sizes for new nodes, in canvas pixels. */
export const DEFAULT_SIZE: Record<CanvasNodeType, { w: number; h: number }> = {
  image: { w: 280, h: 210 },
  upload: { w: 280, h: 210 },
  note: { w: 220, h: 140 },
  swatch: { w: 220, h: 250 },
  typeSample: { w: 320, h: 170 },
  section: { w: 616, h: 420 },
};

/** Smallest size a node can be resized to. Keeps controls inside at least 24x24 px. */
export const MIN_SIZE: Record<CanvasNodeType, { w: number; h: number }> = {
  image: { w: 120, h: 96 },
  upload: { w: 120, h: 96 },
  note: { w: 140, h: 96 },
  swatch: { w: 200, h: 230 },
  typeSample: { w: 220, h: 140 },
  section: { w: 296, h: 48 },
};

export const NOTE_COLORS = ["yellow", "blue", "pink", "green", "gray"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export function isTag(value: unknown): value is Tag {
  return value === "ship" || value === "explore";
}
