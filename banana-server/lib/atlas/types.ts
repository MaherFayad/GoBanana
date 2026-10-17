export type Platform = "mobile" | "tablet" | "website" | "webapp";
export type UiElement =
  | "header" | "nav-tabs" | "bottom-nav" | "sidebar" | "hero" | "cta" | "progress" | "stepper"
  | "total" | "price-breakdown" | "card" | "list-row" | "divider" | "section-nav" | "empty-state"
  | "loading" | "success" | "error" | "toast" | "sheet" | "modal" | "form-field" | "toggle"
  | "chip-filter" | "search" | "map" | "chart" | "avatar" | "onboarding-slide" | "paywall-plan";

export interface PageAnatomy {
  id: string;                                   // "checkout", "plan-picker"
  names: { en: string[]; ar: string[] };        // synonyms, Arabic in white Saudi dialect, no tashkeel
  platforms: Platform[];
  sections: Array<{
    role: string;                               // reuse stitch roles from lib/stitch/types.ts
    element: UiElement;
    label: string;
    required: boolean;
    bands: Partial<Record<Platform, { y0: number; y1: number }>>; // fractions of a single screen
  }>;
  baseline: string;                             // what almost every product ships here
  mustKeep: string[];                           // max 6
  wildSpots: Array<{ element: UiElement; why: string }>;
  mobbinTerms: string[];
  queryNouns: string[];
}

export interface DomainEntry {
  id: string;                                   // "travel", "telecom", "fintech"
  names: { en: string[]; ar: string[] };
  productNouns: string[];                       // "eSIM", "fare", "boarding pass"
  audience: string;
  regionNotes?: string;
  fitsFamilies: string[];                       // ingredient families that fit
  clashFamilies: string[];                      // families that clash on purpose (allowed at wildness 4 and 5)
}

export interface IngredientCard {
  id: string;
  kind: "object" | "material" | "era" | "tradition" | "constraint" | "scale" | "element";
  name: string;
  nameAr?: string;
  family: string;                               // reuse lib/bend/families.ts names where they exist
  region?: "gulf" | "mena" | "global" | string;
  idea: string;                                 // one plain sentence
  surprise: string;                             // why it is unexpected in UI
  palette: Array<{ hex: string; role: "surface" | "ink" | "accent" | "support"; name: string }>;
  shipPairs: Array<[string, string]>;           // COMPUTED by the script with lib/palette/contrast.ts, not by the model
  type: {
    voice: string;                              // a TypeVoice from lib/direction-detail.ts
    latin: { display: string; body: string };   // must exist in Google Fonts metadata
    arabic: { display: string; body: string };  // must exist in Google Fonts metadata
  };
  texture: string;
  imagery: string;
  motion: { verb: string; ms: number; reduced: string };
  radius: "none" | "small" | "soft" | "round";
  density: "airy" | "balanced" | "dense";
  avoid: string[];
  artQueries: string[];
  culturalNotes?: string;                       // required for kind "tradition"
  styles?: string[];                            // R2: style ids (lib/styles/ids.ts), main style first, at most 2. Optional.
}

export interface FitScore { cardId: string; domainId: string; score: 0 | 1 | 2 | 3; reason: string }

/** J4b (Gate 2 round 2): how well a card can lead one page of one domain. reason only for 2 and 3. */
export interface PageFitScore { cardId: string; domainId: string; pageId: string; score: 0 | 1 | 2 | 3; reason?: string }

export interface CardElementLine { cardId: string; element: UiElement; how: string; buildability: 1 | 2 | 3 | 4 | 5 }

export interface Mechanic {
  id: string;
  element: UiElement;
  name: string;                                 // 4 words max
  how: string;                                  // one sentence a developer can build from
  buildability: 1 | 2 | 3 | 4 | 5;
  rtl: string;                                  // what mirrors in Arabic
  a11y: string;                                 // the WCAG 2.2 risk and the fix
  pages: string[];                              // PageAnatomy ids where it pays off
  styles?: string[];                            // R2: style ids (lib/styles/ids.ts), main style first, at most 2. Optional.
}

export interface LensPack {
  id: string; name: string; nameAr: string; region: string;
  story: string; credit: string;                // name the tradition and its people
  shapeGrammar: string[]; rhythm: string; motionVerb: string;
  palette: IngredientCard["palette"];
  typePairs: Array<IngredientCard["type"]>;
  motifSvg: string;                             // a static SVG tile using currentColor and CSS variables, no script
  dos: string[]; donts: string[];               // must include "no sacred or Quranic text as decoration"
}

export interface QueryRecipe {
  key: { lane: "concept" | "component" | "art" | "baseline" | "deck" | "brand"; page?: string; platform?: Platform; element?: UiElement; cardId?: string; style?: string }; // style: a web showcase style id (lib/sources/showcase.ts), website baseline keys only
  query: string;
  source: string;                               // a SourceId from lib/sources/registry.ts
  precision: number;                            // share of top 8 judged good or great, 0 to 1
  judged: number;                               // results judged
  at: string;                                   // YYYY-MM-DD
  styles?: string[];                            // R2: style ids (lib/styles/ids.ts), main style first, at most 2. Optional.
}

export interface CC0Item {
  id: string; museum: "met" | "aic" | "cleveland" | string;
  title: string; date?: string; culture?: string;
  imageUrl: string;                             // hotlinked, never copied
  pageUrl: string;
  steal: string[];                              // what UI can take: rhythm, border, palette, layout
  motif: string[]; region?: string; paletteHint?: string[];
  rights: { flag: string; value: string };      // added for J9: the API's own public domain or CC0 flag, as read per item
}

export interface SlopRule { feature: "font" | "accent-hue" | "radius" | "gradient" | "layout" | "shadow" | "copy"; value: string; share: number }

export interface BenchBrief { id: string; brief: string; platform: Platform; pages: string[]; wildness: 1 | 2 | 3 | 4 | 5; lens?: string }

// Added for P1-J12 (not in section 6.2): one bilingual type pair judged from a rendered specimen.
export interface TypePair {
  id: string;
  voice: string;                                // a TypeVoice from lib/direction-detail.ts
  latin: { display: string; body: string };     // must exist in Google Fonts metadata
  arabic: { display: string; body: string };    // must exist in Google Fonts metadata, with the arabic subset
  notes: string;                                // how the pair relates, where it fits, what to watch
  scores: { harmony: 1 | 2 | 3 | 4 | 5; latinBody: 1 | 2 | 3 | 4 | 5; arabicBody: 1 | 2 | 3 | 4 | 5; hierarchy: 1 | 2 | 3 | 4 | 5 };
}

// P1-J13 stunning layer (VAL-14). Mirrors atlas-build/schema.ts ShaderRecipe and MotionRecipe.

export interface ShaderRecipe {
  id: string;                                   // "sadu-band-drift"
  name: string;                                 // 4 words max
  idea: string;                                 // one plain sentence: what it looks like and how it moves
  use: UiElement[];                             // where it belongs: hero, loading, empty-state, success, paywall-plan
  frag: string;                                 // GLSL ES 1.00 fragment shader (WebGL 1 and 2), uniforms u_resolution, u_time, u_c0 to u_c3
  colors: [string, string, string, string];     // default u_c0 (surface), u_c1 (ink), u_c2 (accent), u_c3 (support) as hex
  reduced: { kind: "static" | "fade"; at: number; ms?: number; note: string }; // prefers-reduced-motion: one frame at `at` seconds, shown at once or faded in over ms
  cardIds: string[];                            // J3 cards it fits
  families: string[];                           // card families, computed offline from cardIds
  lensIds: string[];                            // J6 lenses it follows
  culturalNotes?: string;
  styles?: string[];                            // R2: style ids (lib/styles/ids.ts), main style first, at most 2. Optional.
}

export interface MotionKeyframe { offset?: number; easing?: string; transform?: string; opacity?: number; clipPath?: string; filter?: string }

export interface MotionRecipe {
  id: string;                                   // "receipt-line-feed"
  name: string;                                 // 4 words max
  verb: string;                                 // the motion verb it builds ("unspools", "weave in")
  idea: string;                                 // one plain sentence
  use: UiElement[];
  trigger: "enter" | "exit" | "loop" | "hover" | "press" | "change";
  target: "self" | "children";                  // children: every child plays it, delayed by stagger
  stagger: number;                              // ms between children (0 for self)
  origin: string;                               // transform-origin, "50% 100%"
  keyframes: MotionKeyframe[];                  // WAAPI keyframes: element.animate(keyframes, timing)
  timing: { duration: number; delay: number; easing: string; iterations: number | "infinite"; direction: "normal" | "alternate"; fill: "none" | "forwards" | "backwards" | "both" };
  css: string;                                  // @keyframes, the class rule and the reduced-motion rule, computed offline
  reduced: { kind: "static" | "fade"; ms?: number; note: string }; // static: no movement, end state at once; fade: opacity only
  cardIds: string[];
  families: string[];
  lensIds: string[];
  culturalNotes?: string;
  styles?: string[];                            // R2: style ids (lib/styles/ids.ts), main style first, at most 2. Optional.
}
