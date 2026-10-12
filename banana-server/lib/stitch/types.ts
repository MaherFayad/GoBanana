/**
 * Stitch ("Frankenstein wireframe") contract: cut parts out of reference images and stack them
 * into a new page. Spec: docs/stitch-spec.md. Types and tiny pure helpers only, no imports, so
 * the canvas UI bundle, the MCP tools and the exports can all read it.
 *
 * Hard rules hold: a part is a crop rectangle over a hotlinked image URL. Nothing is downloaded,
 * cut or stored as bytes; the browser shows the crop with CSS. Every part keeps its source link.
 */

/** What a part is on a page. Platform specific roles are fine on any platform. */
export const PART_ROLES = [
  // web and shared
  "nav",
  "hero",
  "logos",
  "features",
  "cards",
  "gallery",
  "stats",
  "testimonial",
  "pricing",
  "cta",
  "form",
  "faq",
  "content",
  "footer",
  // web app
  "sidebar",
  "toolbar",
  "table",
  "chart",
  "filters",
  // mobile
  "status-header",
  "tabbar",
  "list",
  "detail",
  "sheet",
  "empty",
  // anything else
  "other",
] as const;
export type PartRole = (typeof PART_ROLES)[number];

export function isPartRole(value: unknown): value is PartRole {
  return typeof value === "string" && (PART_ROLES as readonly string[]).includes(value);
}

/** Crop rectangle as fractions (0 to 1) of the source image: x and y from the top left. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Light or dark, as the agent judged it by looking. Used by the "even" view to unify a stitch. */
export type PartTheme = "light" | "dark" | "unknown";

/** One part in the canvas parts library (CanvasState.parts). */
export interface Part {
  /** "pt-" + short id. */
  id: string;
  role: PartRole;
  imageUrl: string;
  thumbUrl?: string;
  sourceUrl: string;
  sourceSite: string;
  title?: string;
  crop: Crop;
  /** Source image size in px when known (search metadata or measured in the browser). */
  imageWidth?: number;
  imageHeight?: number;
  theme?: PartTheme;
  /** What to take from this part ("steal: the split nav with the search pill in the middle"). Up to 280 chars. */
  note?: string;
  /** Board image item or search reference it was cut from, when known. */
  fromItemId?: string;
  fromReferenceId?: string;
  /** True when the server picked the crop by role (agent did not pass one). */
  guessedCrop?: boolean;
}

/** One cell of a stitch row. */
export interface StitchSlot {
  /** "sl-" + short id, stable across edits. */
  id: string;
  role: PartRole;
  /** Part from the library; the slot shows its crop unless `crop` overrides it. */
  partId: string;
  /** Per slot crop override (the same part reused with a tighter crop). */
  crop?: Crop;
  note?: string;
  /**
   * True when the user wrote `note` in the canvas. A swap or remix keeps such a note; any other
   * note described the old part, so it goes and the label falls back to the new part's note.
   */
  userNote?: true;
}

/**
 * The slot after its part changes to `partId`: the crop override goes (it was for the old part),
 * and so does the note unless the user wrote it (it described the old part: field report,
 * 2026-10-12, a cart rows part still said "Track list fare breakdown" after a remix).
 */
export function slotWithPart(slot: StitchSlot, partId: string, role?: PartRole): StitchSlot {
  const { crop: _crop, note, userNote, ...rest } = slot;
  return { ...rest, partId, ...(role ? { role } : {}), ...(userNote && note ? { note, userNote } : {}) };
}

/** A horizontal band of the page: 1 slot (full width) or 2 to 3 side by side (sidebar + content, card rows). */
export interface StitchRow {
  id: string;
  slots: StitchSlot[];
  /** Relative widths of the slots, same length as slots (for example [1, 3] for a sidebar). Default equal. */
  widths?: number[];
}

export const STITCH_MODES = ["collage", "wireframe", "even"] as const;
/**
 * collage: the parts as they are (light next to dark is fine, it is for ideas).
 * wireframe: grayscale, softened, with role labels: reads as a low fi wireframe.
 * even: dark parts are inverted and everything desaturated a little so the page reads as one theme.
 */
export type StitchMode = (typeof STITCH_MODES)[number];

export type StitchPlatform = "mobile" | "tablet" | "website" | "webapp";

/** Frame width in px per platform. */
export const STITCH_FRAME_WIDTH: Record<StitchPlatform, number> = {
  mobile: 390,
  tablet: 834,
  website: 1440,
  webapp: 1440,
};

/** Node data of a stitch frame on the canvas (StoredNode type "stitch"). */
export interface StitchData {
  title: string;
  platform: StitchPlatform;
  mode: StitchMode;
  rows: StitchRow[];
  /** Stitch this one was remixed from, and the variant number in that family (1 based). */
  variantOf?: string;
  variant?: number;
  /** Direction it serves, when stitched for one. */
  directionId?: string;
  /** The idea in one line ("Editorial nav over a dashboard hero, cards from a game store"). */
  note?: string;
}

/** Most parts kept in one canvas's library. */
export const MAX_PARTS = 80;
/** Most rows in one stitch, and slots per row. */
export const MAX_STITCH_ROWS = 14;
export const MAX_SLOTS_PER_ROW = 3;
/** Most variants one frankenstein_page or remix_frankenstein call makes. */
export const MAX_VARIANTS = 6;

export function clampCrop(c: Crop): Crop {
  const clamp = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
  const x = clamp(c.x);
  const y = clamp(c.y);
  const w = Math.max(0.02, Math.min(1 - x, clamp(c.w)));
  const h = Math.max(0.02, Math.min(1 - y, clamp(c.h)));
  return { x, y, w, h };
}
