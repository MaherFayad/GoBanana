/**
 * Real examples for the home page and the gallery (lib/site/examples.json).
 *
 * Made by scripts/make-examples.ts with the real engine: `bendBrief` for the directions and their
 * visual spec, and the search_references code path (live Serper image search) for the UI
 * references and the art direction references. The kept references, the steal notes and the
 * Frankenstein crops were picked by eye (scripts/examples.curation.json). Every image URL was
 * checked to answer, to be on the image host allowlist and to be off the takedown list when the
 * file was written.
 *
 * URLs and metadata only (hard rule 2): images are hotlinked from the source with no referrer and
 * every one shows its source link (hard rule 3). The page filters the examples through the
 * takedown list again at render (hard rule 5), with the same one minute cache as the showcase
 * (lib/site/showcase-load.ts); when the list cannot load, every image is left out (fail closed).
 */
import { filterTakedowns, type TakedownMatcher } from "@/lib/takedown";
import type { Platform } from "@/lib/direction-detail";
import type { Crop, PartRole, PartTheme, StitchPlatform } from "@/lib/stitch/types";
import data from "./examples.json";

export type ExampleRef = {
  id: string;
  title: string;
  creator?: string;
  /** "dribbble.com", "siteinspire.com", ... */
  site: string;
  /** The work's page on its source site. */
  href: string;
  /** Image URL on the source CDN (a display size where the CDN has one). */
  src: string;
  w?: number;
  h?: number;
  /** What to take from it, in one line. */
  steal?: string;
};

export type ExamplePart = { role: PartRole; crop: Crop; theme: PartTheme; note?: string; ref: ExampleRef };

export type ExampleStitch = {
  title: string;
  note: string;
  platform: StitchPlatform;
  rows: { parts: number[]; widths?: number[] }[];
  parts: ExamplePart[];
};

export type ExampleSpec = {
  typography: string;
  color: string;
  layout: string;
  motion: string;
  texture: string;
  signature: string;
  pattern: string;
  steal: string[];
  avoid: string[];
  whyItFits: string;
};

export type Example = {
  key: string;
  brief: string;
  platform: Platform;
  wildness: number;
  wildnessLabel: string;
  lens: { en: string; ar: string } | null;
  direction: { id: string; title: string; twist: string; move: string; spec: ExampleSpec };
  /** The other directions the same bend gave. */
  others: { id: string; title: string; twist: string }[];
  /** Search requests the direction search sent. */
  queries: number;
  ui: ExampleRef[];
  art: ExampleRef[];
  stitch: ExampleStitch | null;
};

export type ExamplesFile = { generatedAt: string; serperRequests: number; featured: string; examples: Example[] };

export const EXAMPLES_FILE = data as ExamplesFile;
export const EXAMPLES: readonly Example[] = EXAMPLES_FILE.examples;
export const EXAMPLES_DATE = EXAMPLES_FILE.generatedAt;

/** Platforms the gallery filters by, in order. */
export const EXAMPLE_PLATFORMS = ["mobile", "website", "webapp"] as const satisfies readonly Platform[];
export type ExamplePlatform = (typeof EXAMPLE_PLATFORMS)[number];

export function isExamplePlatform(v: unknown): v is ExamplePlatform {
  return typeof v === "string" && (EXAMPLE_PLATFORMS as readonly string[]).includes(v);
}

const STOP = new Set(["a", "an", "the", "for", "on", "of", "in", "to", "and", "with"]);

/** "launch-page-ai-note-taking" from a brief or a title, for window and file names (Latin). */
export function slug(s: string, words = 5): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .slice(0, words)
    .join("-");
}

/** Display name of a source site ("pinterest.com" to "Pinterest"), for small labels. */
export function siteLabel(site: string): string {
  const name = site.replace(/\.(com|net|club|dev|design|ninja|io|co)$/, "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const asCheckable = (r: ExampleRef) => ({ sourceUrl: r.href, imageUrl: r.src });

/** One example with every reference on the takedown list left out (a blocked stitch part drops its stitch). */
export function filterExample(ex: Example, matcher: TakedownMatcher): Example {
  if (matcher.size === 0) return ex;
  const keep = (list: ExampleRef[]) => filterTakedowns(list.map((r) => ({ ...asCheckable(r), r })), matcher).map((x) => x.r);
  const stitchOk = ex.stitch ? ex.stitch.parts.every((p) => !matcher.isReferenceBlocked(asCheckable(p.ref))) : false;
  return { ...ex, ui: keep(ex.ui), art: keep(ex.art), stitch: stitchOk ? ex.stitch : null };
}

/** The examples with no images at all (fail closed: the takedown list could not be read). */
export function withoutImages(ex: Example): Example {
  return { ...ex, ui: [], art: [], stitch: null };
}

export const EXAMPLES_TAKEDOWN_TTL_MS = 60_000;
let cache: { at: number; matcher: TakedownMatcher } | null = null;

export type ExamplesLoadDeps = { loadMatcher: () => Promise<TakedownMatcher>; now?: () => number; items?: readonly Example[] };

/**
 * The examples as the page may show them: filtered through the takedown list (read at most once a
 * minute per isolate), or with every image left out when the list cannot load. A failed read is
 * not cached.
 */
export async function loadExamples(deps: ExamplesLoadDeps): Promise<{ examples: Example[]; images: boolean }> {
  const items = deps.items ?? EXAMPLES;
  const now = (deps.now ?? Date.now)();
  let matcher = cache && now - cache.at < EXAMPLES_TAKEDOWN_TTL_MS ? cache.matcher : null;
  if (!matcher) {
    try {
      matcher = await deps.loadMatcher();
    } catch {
      return { examples: items.map(withoutImages), images: false };
    }
    cache = { at: now, matcher };
  }
  const m = matcher;
  return { examples: items.map((ex) => filterExample(ex, m)), images: true };
}

/** Tests only: forget the cached list. */
export function resetExamplesCache(): void {
  cache = null;
}

/** The featured example first, then the rest in file order. */
export function featuredFirst(list: readonly Example[]): Example[] {
  const f = list.find((e) => e.key === EXAMPLES_FILE.featured);
  return f ? [f, ...list.filter((e) => e !== f)] : [...list];
}
