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
}

export interface FitScore { cardId: string; domainId: string; score: 0 | 1 | 2 | 3; reason: string }

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
  key: { lane: "concept" | "component" | "art" | "baseline"; page?: string; platform?: Platform; element?: UiElement; cardId?: string };
  query: string;
  source: string;                               // a SourceId from lib/sources/registry.ts
  precision: number;                            // share of top 8 judged good or great, 0 to 1
  judged: number;                               // results judged
  at: string;                                   // YYYY-MM-DD
}

export interface CC0Item {
  id: string; museum: "met" | "aic" | "cleveland" | string;
  title: string; date?: string; culture?: string;
  imageUrl: string;                             // hotlinked, never copied
  pageUrl: string;
  steal: string[];                              // what UI can take: rhythm, border, palette, layout
  motif: string[]; region?: string; paletteHint?: string[];
}

export interface SlopRule { feature: "font" | "accent-hue" | "radius" | "gradient" | "layout" | "shadow" | "copy"; value: string; share: number }

export interface BenchBrief { id: string; brief: string; platform: Platform; pages: string[]; wildness: 1 | 2 | 3 | 4 | 5; lens?: string }
