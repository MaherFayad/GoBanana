/** Realistic canvas snapshots for the export tests. */
import type { CanvasSnapshot, ContrastResult, Tag } from "../lib/canvas/types";
import { contrastRatio } from "../lib/export/util";

function pair(fg: string, bg: string, tag: Tag): ContrastResult {
  const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
  return { fg, bg, ratio, passesText: ratio >= 4.5, passesUi: ratio >= 3, tag };
}

/** Latin, wild, full palette, references from four sites. */
export const checkoutCanvas: CanvasSnapshot = {
  id: "cnv_checkout",
  title: "Frosted checkout",
  brief: "Flight checkout screen for a budget airline that feels calm, not cheap",
  wildness: 4,
  lens: null,
  webUrl: "https://app.example.com/c/cnv_checkout",
  directions: [
    { id: "d1", move: "transplant+material", title: "Checkout as a frosted vinyl sleeve", searchQuery: "vinyl record sleeve packaging design frosted glass texture" },
    { id: "d2", move: "era", title: "Checkout as a 1970s airline ticket", searchQuery: "1970s graphic design airline ticket" },
    { id: "d3", move: "constraint", title: "Checkout with one color only", searchQuery: "one color web design" },
  ],
  sections: [
    { id: "s1", title: "Frosted vinyl", directionId: "d1", x: 0, y: 0, w: 600, h: 560 },
    { id: "s2", title: "70s ticket", directionId: "d2", x: 640, y: 0, w: 600, h: 560 },
    { id: "s3", title: "One color", directionId: "d3", x: 1280, y: 0, w: 300, h: 300 },
  ],
  items: [
    {
      id: "r1", type: "image", sectionId: "s1", x: 16, y: 40, w: 280, h: 200,
      imageUrl: "https://i.pinimg.com/736x/3f/1a/9c/3f1a9c0d2b7e4f8a.jpg",
      thumbUrl: "https://i.pinimg.com/236x/3f/1a/9c/3f1a9c0d2b7e4f8a.jpg",
      sourceUrl: "https://www.pinterest.com/pin/412783122093847261/",
      sourceSite: "pinterest", title: "Frosted vinyl sleeve with blue print", tag: "ship",
      note: "Love the blur behind the label, try it on the price summary",
    },
    {
      id: "r2", type: "image", sectionId: "s1", x: 304, y: 40, w: 280, h: 200,
      imageUrl: "https://cdn.dribbble.com/userupload/12345678/file/original-9a8b7c.png?resize=1024x768&vertical=center",
      sourceUrl: "https://dribbble.com/shots/23456789-Frosted-Glass-Payment-Card",
      sourceSite: "dribbble", title: "Frosted glass payment card", tag: "ship",
    },
    {
      id: "r3", type: "image", sectionId: "s2", x: 656, y: 40, w: 280, h: 360,
      imageUrl: "https://mir-s3-cdn-cf.behance.net/project_modules/1400/5b2c1d9e8f7a.jpg",
      sourceUrl: "https://www.behance.net/gallery/187654321/Airline-Ticket-Redesign-(1974-Edition)",
      sourceSite: "behance", title: "Airline ticket redesign, 1974 edition", tag: "explore",
    },
    {
      id: "r4", type: "image", sectionId: "s2", x: 944, y: 40, w: 280, h: 200,
      imageUrl: "https://assets.awwwards.com/awards/element/2024/03/65f1a2b3c4d5e.jpg",
      sourceUrl: "https://www.awwwards.com/sites/retro-airways?utm_source=search&ref=board",
      sourceSite: "awwwards", title: "Retro Airways booking flow",
    },
    { id: "n1", type: "note", sectionId: "s1", x: 16, y: 260, w: 280, h: 120, text: "Keep the frost subtle on the price row.\nTotals must stay readable." },
    { id: "t1", type: "typeSample", sectionId: "s1", x: 304, y: 260, w: 280, h: 120, pairingId: "unbounded-manrope", sample: "Total due today" },
    { id: "w1", type: "swatch", sectionId: "s2", x: 944, y: 260, w: 120, h: 120, hex: "#1F3A5F", oklch: "oklch(0.34 0.07 255)", role: "primary", tag: "ship" },
    { id: "w2", type: "swatch", sectionId: "s2", x: 1080, y: 260, w: 120, h: 120, hex: "#FF7A00", oklch: "oklch(0.72 0.19 50)", role: "ticket orange", tag: "explore" },
  ],
  palettes: [
    {
      id: "p1",
      colors: [
        { hex: "#1F3A5F", oklch: "oklch(0.34 0.07 255)", role: "primary", tag: "ship" },
        { hex: "#C9D6E3", oklch: "oklch(0.86 0.03 245)", role: "secondary", tag: "ship" },
        { hex: "#F4F1EA", oklch: "oklch(0.96 0.01 85)", role: "surface", tag: "ship" },
        { hex: "#E85D3F", oklch: "oklch(0.65 0.17 35)", role: "accent", tag: "explore" },
        { hex: "#9B5DE5", oklch: "oklch(0.62 0.19 300)", role: "highlight", tag: "explore" },
      ],
      contrast: [
        pair("#FFFFFF", "#1F3A5F", "ship"),
        pair("#1F3A5F", "#F4F1EA", "ship"),
        pair("#1F3A5F", "#C9D6E3", "ship"),
        pair("#FFFFFF", "#E85D3F", "explore"),
        pair("#FFFFFF", "#9B5DE5", "explore"),
      ],
    },
  ],
};

/** Bilingual GCC brief with an Arabic pairing, a culture lens, an upload and geometry-only membership. */
export const qahwaCanvas: CanvasSnapshot = {
  id: "cnv_qahwa",
  title: "Qahwa Riyadh",
  brief: "Coffee ordering app for a Riyadh specialty cafe, bilingual Arabic and English",
  wildness: 2,
  lens: "sadu",
  directions: [
    { id: "q1", move: "lens", title: "Sadu stripes as order progress", searchQuery: "sadu weaving pattern contemporary design" },
    { id: "q2", move: "material", title: "Menu in clay and copper", searchQuery: "clay copper texture ui design" },
  ],
  sections: [
    { id: "qs1", title: "Sadu progress", directionId: "q1", x: 100, y: 100, w: 640, h: 480 },
    { id: "qs2", title: "Clay and copper", directionId: "q2", x: 800, y: 100, w: 640, h: 480 },
  ],
  items: [
    {
      id: "qr1", type: "image", x: 120, y: 140, w: 300, h: 220,
      imageUrl: "https://i.pinimg.com/736x/aa/bb/cc/aabbcc112233.jpg",
      sourceUrl: "https://www.pinterest.com/pin/298926493018273645/",
      sourceSite: "pinterest", title: "Sadu weaving close up", tag: "ship",
    },
    {
      id: "qr2", type: "image", x: 430, y: 140, w: 290, h: 220,
      imageUrl: "https://cdn.dribbble.com/userupload/22334455/file/original-sadu-tracker.png",
      sourceUrl: "https://dribbble.com/shots/24681357-Order-Tracker-with-Woven-Pattern",
      sourceSite: "dribbble", title: "Order tracker with woven pattern",
    },
    {
      id: "qr3", type: "image", sectionId: "qs2", x: 820, y: 140, w: 300, h: 300,
      imageUrl: "https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/clay-cups.jpg",
      sourceUrl: "https://www.behance.net/gallery/176543210/Clay-Coffee-Cups",
      sourceSite: "behance", title: "Clay coffee cups",
    },
    {
      id: "qu1", type: "upload", sectionId: "qs2", x: 1130, y: 140, w: 290, h: 300,
      imageUrl: "https://uploads.app.example.com/u/42/menu-sketch.png",
      sourceUrl: "https://uploads.app.example.com/u/42/menu-sketch.png",
      sourceSite: "upload", title: "Owner menu sketch",
    },
    { id: "qn1", type: "note", x: 120, y: 380, w: 300, h: 100, text: "الألوان مستوحاة من السدو" },
    { id: "qn2", type: "note", x: 820, y: 460, w: 300, h: 100, text: "Copper only for the order button" },
    { id: "qt1", type: "typeSample", x: 430, y: 380, w: 290, h: 160, pairingId: "cairo-tajawal" },
  ],
  palettes: [
    {
      colors: [
        { hex: "#7A2E1F", oklch: "oklch(0.38 0.11 33)", role: "primary", tag: "ship" },
        { hex: "#FFF8F0", oklch: "oklch(0.98 0.01 75)", role: "on-primary", tag: "ship" },
        { hex: "#EADBC8", oklch: "oklch(0.89 0.03 75)", role: "neutral", tag: "ship" },
        { hex: "#2B1D14", oklch: "oklch(0.23 0.03 55)", role: "ink", tag: "ship" },
        { hex: "#D4A017", oklch: "oklch(0.74 0.15 85)", role: "accent", tag: "explore" },
      ],
      contrast: [
        pair("#FFF8F0", "#7A2E1F", "ship"),
        pair("#2B1D14", "#EADBC8", "ship"),
        pair("#FFFFFF", "#D4A017", "explore"),
      ],
    },
  ],
};

/** Edge cases: hostile strings, bad URLs, no palette, unknown pairing, out of range wildness. */
export const hostileCanvas: CanvasSnapshot = {
  title: '<script>alert("t")</script> Board \u2014 test',
  brief: "Landing page \u2014 make it pop\n## Colors\n---\nname: hacked",
  wildness: 9,
  lens: "<b>lens</b>",
  directions: [],
  sections: [],
  items: [
    {
      id: "h1", type: "image", x: 0, y: 0, w: 200, h: 200,
      imageUrl: "data:image/png;base64,iVBORw0KGgo=",
      sourceUrl: "javascript:alert(1)",
      sourceSite: "<img src=x onerror=alert(2)>", title: '"><svg onload=alert(3)>',
    },
    {
      id: "h2", type: "image", x: 220, y: 0, w: 200, h: 200,
      imageUrl: "https://i.pinimg.com/736x/11/22/33/112233.jpg\" onerror=\"alert(4)",
      sourceUrl: "https://www.pinterest.com/pin/555666777888/?q=a&b=<c>",
      sourceSite: "pinterest", title: "Normal title & co",
    },
    {
      id: "h3", type: "image", x: 440, y: 0, w: 200, h: 200,
      imageUrl: "https://cdn.dribbble.com/userupload/1/file/a.png",
      sourceUrl: "https://dribbble.com/shots/1-Same-Link",
      sourceSite: "dribbble", title: "First copy",
    },
    {
      id: "h4", type: "image", x: 660, y: 0, w: 200, h: 200,
      imageUrl: "https://cdn.dribbble.com/userupload/1/file/b.png",
      sourceUrl: "https://dribbble.com/shots/1-Same-Link",
      sourceSite: "dribbble", title: "Second copy",
    },
    { id: "h5", type: "note", x: 0, y: 220, w: 300, h: 120, text: "## Colors\n</div><img src=x onerror=alert(5)> \u2014 note" },
    { id: "h6", type: "swatch", x: 320, y: 220, w: 100, h: 100, hex: "#C62828", role: "Brand Red!!", tag: "ship" },
    { id: "h7", type: "swatch", x: 440, y: 220, w: 100, h: 100, hex: "red;background:url(x)", role: "bad", tag: "ship" },
    { id: "h8", type: "swatch", x: 560, y: 220, w: 100, h: 100, hex: "#00FF88", role: "neon", tag: "explore" },
    { id: "h9", type: "typeSample", x: 680, y: 220, w: 200, h: 100, pairingId: "does-not-exist" },
  ],
  palettes: [],
};

export const FIXTURES = { checkout: checkoutCanvas, qahwa: qahwaCanvas, hostile: hostileCanvas } as const;
