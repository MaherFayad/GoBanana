/**
 * Plain data snapshot of a canvas, as consumed by exports (`lib/export/`) and
 * returned by `get_canvas`. No DB or React Flow imports here on purpose: the
 * code that loads a canvas maps rows and nodes into this shape.
 *
 * Coordinates: every `x`, `y`, `w`, `h` is in canvas pixels and absolute
 * (React Flow child positions must be converted from parent-relative first).
 */
import type { Culture } from "@/lib/culture";
import type { DirectionDetail, Zone } from "@/lib/direction-detail";
import type { StyleId } from "@/lib/styles/ids";
import type { Crop, Part, PartRole, PartTheme, StitchMode, StitchPlatform } from "@/lib/stitch/types";

export type { DirectionDetail, Zone } from "@/lib/direction-detail";

/** `ship` passed WCAG 2.2 contrast and may go to production. `explore` is concept only. */
export type Tag = "ship" | "explore";

/** Bend moves from spec section 7. Kept as string so new moves do not break old canvases. */
export type BendMove = "transplant" | "material" | "era" | "constraint" | "scale" | "lens" | (string & {});

export interface CanvasDirection {
  id: string;
  /** One move, or several joined with "+" (for example "transplant+material"). */
  move: BendMove;
  title: string;
  searchQuery: string;
  /**
   * Wild directions v2 detail as saved by bend_brief (`directions.detail`): platform, pages, spec,
   * artQueries, twist, prompt, wildness and verdict ("keep" or "drop" from rate_directions; missing
   * means not rated). Null or missing on directions saved before v2.
   */
  detail?: DirectionDetail | null;
}

export interface CanvasSection {
  id: string;
  title: string;
  /** Direction this section was made for, when it came from `bend_brief`. */
  directionId?: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ItemBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Section the item sits in. When missing, exports place it by geometry. */
  sectionId?: string | null;
}

/** A web reference. URLs and metadata only, never image bytes. */
export interface ImageItem extends ItemBase {
  type: "image";
  imageUrl: string;
  thumbUrl?: string | null;
  sourceUrl: string;
  /** Site the reference came from, for example "pinterest" or "dribbble". */
  sourceSite: string;
  title?: string | null;
  /** The user's or agent's note; for agent placed references, what to steal from it. URLs in it are links. */
  note?: string | null;
  tag?: Tag | null;
  /** Board zone: "art" (art direction, the wild idea as images) or "ui". Missing means "ui". */
  zone?: Zone;
  /** Mobbin screen id from the user's Mobbin connector (screens only), so a refresh finds the same tile. */
  mobbinId?: string;
  /** When the image link was placed or last refreshed (ISO date). Mobbin image links expire after about 30 days. */
  placedAt?: string;
  /** Cultural meaning, credit and care tier (add_to_canvas culture). Shown as the culture chip. */
  culture?: Culture;
  /** "build": a screenshot of the user's own build, placed next to its Frankenstein page for review. */
  kind?: "build";
  /** The Frankenstein page (stitch) a build sits next to. */
  stitchId?: string;
  /** Style tags (docs/styles), main style first, 1 or 2: read from the thumbnail by the agent. */
  styles?: StyleId[];
}

/** The user's own image (stored in R2). `sourceUrl` points at the upload or its origin. */
export interface UploadItem extends Omit<ImageItem, "type"> {
  type: "upload";
}

/**
 * An X post (lib/xpost): the post link, its id, the author and the text from X's oEmbed, plus our
 * own note and tag. Never X media. The web canvas shows X's official embed; inline (MCP Apps)
 * it is a link card. `screenshotUrl` is a screenshot of this one post the user's own Claude
 * captured and attached (attach_screenshot, stored as the user's upload) for Frankenstein parts.
 */
export interface XPostItem extends ItemBase {
  type: "xpost";
  /** Canonical post link, `https://x.com/<handle>/status/<id>`. */
  sourceUrl: string;
  /** Always "x.com". */
  sourceSite: string;
  postId: string;
  authorName: string;
  authorHandle: string;
  /**
   * Not in snapshots: the post text lives only in the canvas state, for the web card. Snapshots
   * feed get_canvas, get_snapshot and the exports, so the text never reaches a model through them.
   */
  text?: never;
  note?: string | null;
  tag?: Tag | null;
  zone?: Zone;
  culture?: Culture;
  /** Same-origin upload path of the attached screenshot (`/api/uploads/<id>`). */
  screenshotUrl?: string;
  screenshotWidth?: number;
  screenshotHeight?: number;
  placedAt?: string;
}

export interface NoteItem extends ItemBase {
  type: "note";
  text: string;
  color?: string | null;
  /** Cultural meaning, credit and care tier (add_to_canvas culture). Shown as the culture chip. */
  culture?: Culture;
}

export interface SwatchItem extends ItemBase {
  type: "swatch";
  hex: string;
  /** CSS oklch() string, for example "oklch(0.62 0.19 35)". */
  oklch?: string | null;
  role?: string | null;
  tag: Tag;
}

export interface TypeSampleItem extends ItemBase {
  type: "typeSample";
  /** Id from `lib/kit/fonts.json`. */
  pairingId: string;
  sample?: string | null;
}

export interface SectionItem extends ItemBase {
  type: "section";
  title: string;
  directionId?: string | null;
}

export type CanvasItem = ImageItem | UploadItem | XPostItem | NoteItem | SwatchItem | TypeSampleItem | SectionItem;
export type CanvasItemType = CanvasItem["type"];
export type ReferenceItem = ImageItem | UploadItem;

export interface PaletteColor {
  hex: string;
  oklch?: string | null;
  role?: string | null;
  /**
   * Optional: `extract_palette` tags contrast pairs, not colors. When missing, exports
   * treat a color as ship if it is in a ship contrast pair. A swatch on the canvas with
   * the same hex overrides this (the user's toggle wins).
   */
  tag?: Tag | null;
}

export interface ContrastResult {
  /** Foreground hex. */
  fg: string;
  /** Background hex. */
  bg: string;
  ratio: number;
  /** At least 4.5:1 (SC 1.4.3). */
  passesText: boolean;
  /** At least 3:1 (SC 1.4.11). */
  passesUi: boolean;
  tag: Tag;
}

export interface CanvasPalette {
  id?: string;
  colors: PaletteColor[];
  contrast: ContrastResult[];
}

/** One slot of a stitch with its part resolved: what it shows and where it came from. */
export interface StitchSlotSnapshot {
  id: string;
  role: PartRole;
  partId: string;
  imageUrl: string;
  thumbUrl?: string;
  sourceUrl: string;
  sourceSite: string;
  title?: string;
  /** The crop shown: the slot's override, else the part's crop. */
  crop: Crop;
  /** The slot's note, else the part's note. */
  note?: string;
  theme?: PartTheme;
  imageWidth?: number;
  imageHeight?: number;
}

export interface StitchRowSnapshot {
  id: string;
  slots: StitchSlotSnapshot[];
  widths?: number[];
}

/** A stitch frame ("Frankenstein page") with absolute geometry and resolved slots. */
export interface StitchSnapshot {
  id: string;
  title: string;
  platform: StitchPlatform;
  mode: StitchMode;
  note?: string;
  directionId?: string;
  variantOf?: string;
  variant?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  sectionId: string | null;
  rows: StitchRowSnapshot[];
}

export interface CanvasSnapshot {
  id?: string;
  title: string;
  brief: string;
  /** 1 to 5 (Fresh, Bold, Weird, Wild, Bananas). */
  wildness: number;
  /** Culture lens preset id, for example "sadu". */
  lens?: string | null;
  directions: CanvasDirection[];
  sections: CanvasSection[];
  items: CanvasItem[];
  palettes: CanvasPalette[];
  /** Parts library cut from references (lib/stitch). Missing on snapshots built before stitches. */
  parts?: Part[];
  /** Stitch frames, in reading order. Missing on snapshots built before stitches. */
  stitches?: StitchSnapshot[];
  /** Link to the canvas on the web. Used as the source of notes and swatches in exports. */
  webUrl?: string | null;
  updatedAt?: string | null;
}

export function isReference(item: CanvasItem): item is ReferenceItem {
  return item.type === "image" || item.type === "upload";
}
