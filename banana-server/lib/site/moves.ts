/**
 * The generative tiles on the landing page: one per bend move or lens, drawn with CSS and SVG
 * only (components in app/(site)/_components/TileArt.tsx). Words live in the dictionaries
 * (`landing.moves`, same order); this file holds the art and where each tile sits in the hero.
 */
export const ART_KINDS = [
  "sadu",
  "kufic",
  "mashrabiya",
  "halftone",
  "fluted",
  "grain",
  "iridescent",
  "numerals",
  "memphis",
  "swiss",
  "ma",
  "dusk",
  "riso",
  "blueprint",
] as const;
export type ArtKind = (typeof ART_KINDS)[number];

export type TileSize = "s" | "m" | "l";

/**
 * A tile in the hero field. `x` and `y` are the tile's start and top edges in percent of the
 * field's plane (twice the hero's size each way, so 25 to 75 is what shows at first).
 */
export type HeroTile = { art: ArtKind; x: number; y: number; size: TileSize; ratio: "1/1" | "3/4" | "4/3" | "4/5" };

export const HERO_TILES: readonly HeroTile[] = [
  { art: "sadu", x: 27, y: 25, size: "m", ratio: "4/5" },
  { art: "kufic", x: 41, y: 31, size: "s", ratio: "1/1" },
  { art: "iridescent", x: 52, y: 24, size: "l", ratio: "3/4" },
  { art: "fluted", x: 66, y: 27, size: "m", ratio: "4/3" },
  { art: "halftone", x: 30, y: 47, size: "s", ratio: "1/1" },
  { art: "numerals", x: 41, y: 49, size: "s", ratio: "1/1" },
  { art: "dusk", x: 63, y: 45, size: "m", ratio: "3/4" },
  { art: "memphis", x: 79, y: 41, size: "s", ratio: "1/1" },
  { art: "mashrabiya", x: 9, y: 28, size: "m", ratio: "1/1" },
  { art: "grain", x: 82, y: 14, size: "m", ratio: "3/4" },
  { art: "swiss", x: 12, y: 54, size: "s", ratio: "3/4" },
  { art: "ma", x: 84, y: 66, size: "s", ratio: "1/1" },
  { art: "riso", x: 52, y: 70, size: "s", ratio: "1/1" },
  { art: "blueprint", x: 26, y: 72, size: "m", ratio: "4/3" },
];

/** The four example boards in the gallery: four tiles each, as a 2 by 2 collage. */
export const GALLERY_BOARDS: readonly (readonly [ArtKind, ArtKind, ArtKind, ArtKind])[] = [
  ["sadu", "dusk", "kufic", "grain"],
  ["swiss", "numerals", "ma", "blueprint"],
  ["memphis", "riso", "halftone", "iridescent"],
  ["mashrabiya", "fluted", "dusk", "ma"],
];
