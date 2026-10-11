import type { SVGProps } from "react";

/**
 * Glyphs Banana needs that the free Pixelarticons set does not have. Each is derived from a
 * Pixelarticons glyph (MIT) on the same 24 by 24 grid with 2px pixel steps.
 */

/** "image" with a staircase slash, for media that could not load. Derived from Pixelarticons "image". */
export const ImageOffGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M0 0h2v2h-2zM2 2h18v2h-18zM2 4h4v2h-4zM20 4h2v2h-2zM2 6h2v2h-2zM6 6h2v2h-2zM14 6h4v2h-4zM20 6h2v2h-2zM2 8h2v2h-2zM8 8h2v2h-2zM14 8h4v2h-4zM20 8h2v2h-2zM2 10h2v2h-2zM10 10h2v2h-2zM20 10h2v2h-2zM2 12h2v2h-2zM12 12h2v2h-2zM20 12h2v2h-2zM2 14h2v2h-2zM6 14h2v2h-2zM14 14h2v2h-2zM20 14h2v2h-2zM2 16h4v2h-4zM8 16h2v2h-2zM16 16h2v2h-2zM20 16h2v2h-2zM2 18h2v2h-2zM10 18h2v2h-2zM18 18h4v2h-4zM4 20h18v2h-18zM22 22h2v2h-2z" />
  </svg>
);
