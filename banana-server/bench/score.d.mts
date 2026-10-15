/** Types for bench/score.mjs (the shapes bench-run.mjs writes and report.html exports). */

export interface BenchReference {
  id: string;
  zone?: "ui" | "art";
  imageUrl: string;
  thumbUrl?: string;
  sourceUrl: string;
  sourceSite?: string;
  title?: string;
  lane?: string;
}

export interface BenchSearch {
  credits: number;
  queries: string[];
  uiQueries: string[];
  references: BenchReference[];
  dropped?: number;
  note?: string;
}

export interface BenchDirection {
  id: string;
  title: string;
  /** checkCoherence problems, or null when the engine has no checkCoherence yet. */
  coherence: string[] | null;
  search: BenchSearch | null;
  [key: string]: unknown;
}

export interface BenchRun {
  run: string;
  dry?: boolean;
  briefs: { id: string; brief: string; directions: BenchDirection[]; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface BenchRatings {
  run?: string;
  directions?: Record<string, { relevance?: number; coherence?: number; wow?: number; note?: string }>;
  references?: Record<string, "great" | "good" | "bad" | undefined>;
}

export interface BenchMetrics {
  run: string;
  dry: boolean;
  rated: { directions: number; of: number; references: number };
  briefRelevance: { onBrief: number; rated: number; percent: number | null; target: number };
  specCoherence: { failures: number | null; checked: number; ownerMedian: number | null; target: number };
  queryOverlap: { sharedQueries: number | null; briefsWithOverlap: number; searchedBriefs: number; target: number };
  referencePrecision: { goodOrGreat: number; rated: number; percent: number | null; target: number };
  wow: { median: number | null; rated: number; target: number };
  cost: { creditsPerBoard: number | null; boards: number; creditsPerSearch: number | null; estimatedPerBoard: number | null; totalCredits: number; target: number };
  notMeasured: Record<string, string>;
}

export const ON_BRIEF_MIN: number;
export const TOP_UI: number;
export function directionKey(briefId: string, directionId: string): string;
export function referenceKey(briefId: string, directionId: string, refId: string): string;
export function computeMetrics(run: BenchRun, ratings?: BenchRatings): BenchMetrics;
export function formatMetrics(m: BenchMetrics): string;
