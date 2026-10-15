/**
 * Banana Atlas record schemas (docs/next-step-plan.md section 6.2).
 *
 * The TypeScript interfaces below are the section 6.2 types, copied word for word; banana-server
 * mirrors them in lib/atlas/types.ts. Each zod schema parses exactly that shape (the type checks at
 * the end of this file fail to compile if a schema and its interface drift apart), plus the rules
 * the plan states in words: hex colors, at most 6 must keeps, 4 word mechanic names, cultural
 * notes on traditions, the sacred text rule on lens packs, static motif SVG, known stitch roles,
 * type voices and source ids.
 *
 * Rules that need data outside one record (Google Fonts names, computed shipPairs) run in the job
 * runner after zod: see lib/fonts.ts and lib/contrast.ts.
 */
import { z } from "zod";
import { TYPE_VOICES } from "../banana-server/lib/direction-detail.ts";
import { PART_ROLES } from "../banana-server/lib/stitch/types.ts";
import { SOURCE_REGISTRY } from "../banana-server/lib/sources/registry.ts";

// ---------------------------------------------------------------------------------------------
// Section 6.2 types, verbatim.

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

// ---------------------------------------------------------------------------------------------
// zod schemas.

export const PLATFORMS = ["mobile", "tablet", "website", "webapp"] as const;
export const UI_ELEMENTS = [
  "header", "nav-tabs", "bottom-nav", "sidebar", "hero", "cta", "progress", "stepper",
  "total", "price-breakdown", "card", "list-row", "divider", "section-nav", "empty-state",
  "loading", "success", "error", "toast", "sheet", "modal", "form-field", "toggle",
  "chip-filter", "search", "map", "chart", "avatar", "onboarding-slide", "paywall-plan",
] as const;
export const SOURCE_IDS: readonly string[] = SOURCE_REGISTRY.map((s) => s.id);
/** The line every lens pack's donts must carry (plan 6.2). */
export const SACRED_RULE = "no sacred or Quranic text as decoration";

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ids are lowercase words joined by hyphens");
const text = z.string().trim().min(1);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "colors are #rrggbb hex");
const words = (max: number) => text.refine((s) => s.split(/\s+/).length <= max, `at most ${max} words`);
const fraction = z.number().min(0).max(1);

export const PlatformSchema = z.enum(PLATFORMS);
export const UiElementSchema = z.enum(UI_ELEMENTS);
const names = z.object({ en: z.array(text).min(1), ar: z.array(text).min(1) });
const band = z.object({ y0: fraction, y1: fraction }).refine((b) => b.y0 < b.y1, "y0 must be above y1");
const buildability = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const PageAnatomySchema = z.object({
  id,
  names,
  platforms: z.array(PlatformSchema).min(1),
  sections: z
    .array(
      z.object({
        role: z.string().refine((r) => (PART_ROLES as readonly string[]).includes(r), "role must be a stitch role from lib/stitch/types.ts"),
        element: UiElementSchema,
        label: text,
        required: z.boolean(),
        bands: z.partialRecord(PlatformSchema, band),
      }),
    )
    .min(1),
  baseline: text,
  mustKeep: z.array(text).max(6),
  wildSpots: z.array(z.object({ element: UiElementSchema, why: text })),
  mobbinTerms: z.array(text),
  queryNouns: z.array(text),
});

export const DomainEntrySchema = z.object({
  id,
  names,
  productNouns: z.array(text).min(1),
  audience: text,
  regionNotes: text.optional(),
  fitsFamilies: z.array(text),
  clashFamilies: z.array(text),
});

const paletteEntry = z.object({ hex, role: z.enum(["surface", "ink", "accent", "support"]), name: text });
const fontPair = z.object({ display: text, body: text });
const typeSpec = z.object({
  voice: z.string().refine((v) => (TYPE_VOICES as readonly string[]).includes(v), "voice must be a TypeVoice from lib/direction-detail.ts"),
  latin: fontPair,
  arabic: fontPair,
});

export const IngredientCardSchema = z
  .object({
    id,
    kind: z.enum(["object", "material", "era", "tradition", "constraint", "scale", "element"]),
    name: text,
    nameAr: text.optional(),
    family: text,
    region: text.optional(),
    idea: text,
    surprise: text,
    palette: z.array(paletteEntry).min(2),
    shipPairs: z.array(z.tuple([hex, hex])),
    type: typeSpec,
    texture: text,
    imagery: text,
    motion: z.object({ verb: text, ms: z.number().int().min(0).max(10_000), reduced: text }),
    radius: z.enum(["none", "small", "soft", "round"]),
    density: z.enum(["airy", "balanced", "dense"]),
    avoid: z.array(text),
    artQueries: z.array(text).min(1),
    culturalNotes: text.optional(),
  })
  .refine((c) => c.kind !== "tradition" || !!c.culturalNotes, { message: "culturalNotes is required for kind tradition", path: ["culturalNotes"] });

export const FitScoreSchema = z.object({
  cardId: id,
  domainId: id,
  score: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  reason: text,
});

export const CardElementLineSchema = z.object({ cardId: id, element: UiElementSchema, how: text, buildability });

export const MechanicSchema = z.object({
  id,
  element: UiElementSchema,
  name: words(4),
  how: text,
  buildability,
  rtl: text,
  a11y: text,
  pages: z.array(id),
});

export const LensPackSchema = z.object({
  id,
  name: text,
  nameAr: text,
  region: text,
  story: text,
  credit: text,
  shapeGrammar: z.array(text).min(1),
  rhythm: text,
  motionVerb: text,
  palette: z.array(paletteEntry).min(2),
  typePairs: z.array(typeSpec).min(1),
  motifSvg: z
    .string()
    .refine((s) => /^\s*<svg[\s>]/i.test(s) && /<\/svg>\s*$/i.test(s), "motifSvg must be one <svg> element")
    .refine((s) => !/<script|\son[a-z]+\s*=|javascript:|<foreignObject|href\s*=\s*["'](?!#)/i.test(s), "motifSvg must be static: no script, event handlers, foreignObject or outside links"),
  dos: z.array(text).min(1),
  donts: z
    .array(text)
    .refine((d) => d.some((x) => x.toLowerCase().includes(SACRED_RULE.toLowerCase())), `donts must include "${SACRED_RULE}"`),
});

export const QueryRecipeSchema = z.object({
  key: z.object({
    lane: z.enum(["concept", "component", "art", "baseline"]),
    page: id.optional(),
    platform: PlatformSchema.optional(),
    element: UiElementSchema.optional(),
    cardId: id.optional(),
  }),
  query: text,
  source: z.string().refine((s) => SOURCE_IDS.includes(s), "source must be a SourceId from lib/sources/registry.ts"),
  precision: fraction,
  judged: z.number().int().min(0),
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const httpsUrl = z.string().refine((u) => /^https:\/\/[^\s]+$/.test(u), "https URL");

export const CC0ItemSchema = z.object({
  id: text,
  museum: text,
  title: text,
  date: text.optional(),
  culture: text.optional(),
  imageUrl: httpsUrl,
  pageUrl: httpsUrl,
  steal: z.array(text).min(1),
  motif: z.array(text),
  region: text.optional(),
  paletteHint: z.array(hex).optional(),
});

export const SlopRuleSchema = z.object({
  feature: z.enum(["font", "accent-hue", "radius", "gradient", "layout", "shadow", "copy"]),
  value: text,
  share: fraction,
});

export const BenchBriefSchema = z.object({
  id,
  brief: text,
  platform: PlatformSchema,
  pages: z.array(id).min(1),
  wildness: buildability,
  lens: id.optional(),
});

/** Every Atlas kind by name, for jobs and the runner. The name is the out/v1/<kind>/ folder. */
export const SCHEMAS = {
  anatomy: PageAnatomySchema,
  domains: DomainEntrySchema,
  cards: IngredientCardSchema,
  fit: FitScoreSchema,
  "card-elements": CardElementLineSchema,
  mechanics: MechanicSchema,
  lenses: LensPackSchema,
  recipes: QueryRecipeSchema,
  cc0: CC0ItemSchema,
  slop: SlopRuleSchema,
  bench: BenchBriefSchema,
} as const;
export type AtlasKind = keyof typeof SCHEMAS;

// ---------------------------------------------------------------------------------------------
// Compile-time proof that each schema parses exactly its section 6.2 type.

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type _SchemaChecks = [
  Assert<Same<z.infer<typeof PageAnatomySchema>, PageAnatomy>>,
  Assert<Same<z.infer<typeof DomainEntrySchema>, DomainEntry>>,
  Assert<Same<z.infer<typeof IngredientCardSchema>, IngredientCard>>,
  Assert<Same<z.infer<typeof FitScoreSchema>, FitScore>>,
  Assert<Same<z.infer<typeof CardElementLineSchema>, CardElementLine>>,
  Assert<Same<z.infer<typeof MechanicSchema>, Mechanic>>,
  Assert<Same<z.infer<typeof LensPackSchema>, LensPack>>,
  Assert<Same<z.infer<typeof QueryRecipeSchema>, QueryRecipe>>,
  Assert<Same<z.infer<typeof CC0ItemSchema>, CC0Item>>,
  Assert<Same<z.infer<typeof SlopRuleSchema>, SlopRule>>,
  Assert<Same<z.infer<typeof BenchBriefSchema>, BenchBrief>>,
  Assert<Equals<z.infer<typeof PlatformSchema>, Platform>>,
  Assert<Equals<z.infer<typeof UiElementSchema>, UiElement>>,
];
