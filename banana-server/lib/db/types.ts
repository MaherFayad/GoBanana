/**
 * Repository ports. Tools and routes depend on these interfaces only, so tests pass
 * in-memory fakes (lib/db/memory.ts) and never touch Neon. The Drizzle versions live
 * next to this file and take the db as their first argument.
 *
 * URLs and metadata only: nothing here ever holds image bytes (hard rule 2).
 */
import type { Plan, UsageStore } from "@/lib/quota";
import type { Reference } from "@/lib/sources/types";
import type { ArmStat } from "@/lib/learning/arms";
import type { DirectionReason, IngredientStat } from "@/lib/learning/directions";
import type { FeedbackReason, FeedbackVerdict } from "@/lib/learning/hints";

export type CanvasRecord = {
  id: string;
  userId: string;
  title: string;
  brief: string | null;
  wildness: number | null;
  lens: string | null;
  /** Raw `canvases.state` JSON. Parse with lib/canvas/store.ts before use. */
  state: unknown;
  shareToken: string | null;
  updatedAt: Date;
};

export type NewCanvas = {
  userId: string;
  title: string;
  brief?: string | null;
  wildness?: number | null;
  lens?: string | null;
  state: unknown;
};

export type SaveOptions = {
  /** Only save when the row still has this `updated_at` (optimistic concurrency). */
  ifUpdatedAt?: Date;
};

export type SaveResult = { ok: true; updatedAt: Date } | { ok: false; reason: "not_found" | "conflict" };

/** A reference on a canvas, as the dashboard collage needs it: URLs only, never bytes. */
export type CanvasPreviewRef = { thumbUrl: string | null; imageUrl: string; sourceUrl: string };

/** One row of the user's canvas list (the /[locale]/canvases dashboard). No full state. */
export type CanvasSummary = {
  id: string;
  title: string;
  brief: string | null;
  shareToken: string | null;
  updatedAt: Date;
  /** Image references on the board. */
  referenceCount: number;
  /** Directions saved for the canvas (bend_brief). */
  directionCount: number;
  /** The first few image references on the board, before the takedown filter. */
  previews: CanvasPreviewRef[];
};

/** Most image references a summary carries, so the collage still has 4 after the takedown filter. */
export const SUMMARY_PREVIEWS = 8;

export interface CanvasRepo {
  create(input: NewCanvas): Promise<CanvasRecord>;
  /** The canvas when it exists and belongs to `userId`, else null. Never tells the two apart. */
  getOwned(userId: string, canvasId: string): Promise<CanvasRecord | null>;
  countOwned(userId: string): Promise<number>;
  /** The user's canvases, most recently updated first, at most `limit` (default 48, max 200). */
  listOwned(userId: string, opts?: { limit?: number }): Promise<CanvasSummary[]>;
  saveState(userId: string, canvasId: string, state: unknown, opts?: SaveOptions): Promise<SaveResult>;
  /** Set title and or brief. Returns false when the canvas is not the user's. */
  update(
    userId: string,
    canvasId: string,
    patch: { title?: string; brief?: string | null; wildness?: number | null; lens?: string | null },
  ): Promise<boolean>;
}

export type NewDirection = { bendId: string; move: string; title: string; searchQuery: string };

export type DirectionRecord = {
  /** Row uuid. */
  id: string;
  /** Stable bend_brief id ("bd-..."), null for rows made another way. */
  bendId: string | null;
  canvasId: string;
  move: string;
  title: string;
  searchQuery: string;
};

export interface DirectionRepo {
  /** Insert or refresh directions for a canvas, keyed by (canvas, bendId). */
  upsertMany(canvasId: string, directions: readonly NewDirection[]): Promise<void>;
  /**
   * A direction on one of the user's canvases. `directionId` may be the row uuid or the
   * bend id. `canvasId` narrows the lookup when given.
   */
  findForUser(userId: string, directionId: string, canvasId?: string): Promise<DirectionRecord | null>;
  listForCanvas(canvasId: string): Promise<DirectionRecord[]>;
  /**
   * Delete directions of a canvas by row uuid; returns how many went. Callers check that the
   * canvas is the user's first. No other table references a direction row.
   */
  deleteMany(canvasId: string, ids: readonly string[]): Promise<number>;
}

export type ReferenceRecord = {
  /** Row uuid (derived from canvas id + search result id, see lib/db/ids.ts). */
  id: string;
  canvasId: string;
  sourceSite: string;
  sourceUrl: string;
  imageUrl: string;
  thumbUrl: string;
  title: string | null;
  width: number | null;
  height: number | null;
  /** Search result id (`ref_...`) the row was saved from; null on rows saved before migration 0003. */
  resultId: string | null;
  /** How the search found it (lib/learning). Null on older rows and plain query searches (lane, termKey, arm). */
  lane: string | null;
  query: string | null;
  termKey: string | null;
  arm: string | null;
};

/** A search result with how it was found, as search_references saves it. */
export type SavedReference = Reference & { termKey?: string; arm?: string };

export interface ReferenceRepo {
  /**
   * Save search results for a canvas (URLs only). An existing row keeps its URLs; its search
   * details (lane, query, term key, arm) are refreshed from the newer search when it has them.
   */
  insertMany(canvasId: string, references: readonly SavedReference[]): Promise<void>;
  /**
   * Look up references saved for a canvas. Each id may be a search result id (`ref_...`)
   * or a row uuid. The map is keyed by the id as passed.
   */
  getByIds(canvasId: string, ids: readonly string[]): Promise<Map<string, ReferenceRecord>>;
  /**
   * References saved on any of the user's canvases, by search result id (`ref_...`) or row uuid,
   * newest first when one result sits on several canvases. Keyed by the id as passed.
   */
  findOwned(userId: string, ids: readonly string[]): Promise<Map<string, ReferenceRecord>>;
}

export type NewFeedback = {
  userId: string;
  itemKey: string;
  sourceSite: string;
  lane: string | null;
  query: string | null;
  termKey: string | null;
  arm: string | null;
  verdict: FeedbackVerdict;
  /** rate_references reasons, or rate_directions reasons on direction rows (lane "direction"). */
  reasons: (FeedbackReason | DirectionReason)[];
  creator: string | null;
};

export type ArmStatRow = ArmStat;
export type IngredientStatRow = IngredientStat;

export interface FeedbackRepo {
  insertMany(rows: readonly NewFeedback[]): Promise<void>;
  /** The user's ratings of results with a known creator, newest first, at most `limit`. */
  listCreatorRatings(
    userId: string,
    limit?: number,
  ): Promise<{ itemKey: string; verdict: FeedbackVerdict; creator: string | null }[]>;
  /**
   * Per term key and arm: users whose net verdict is great or bad (each user once), distinct
   * users, and this user's own raw counts. Never returns user ids.
   */
  armStats(userId: string, termKeys: readonly string[]): Promise<ArmStatRow[]>;
  /**
   * rate_directions ratings per ingredient term key (`direction|...`), every arm (move) pooled,
   * grouped like armStats, in one query. Only rows that may matter: rated by at least `k` users,
   * or by this user. Never returns user ids.
   */
  directionStats(userId: string, k: number): Promise<IngredientStatRow[]>;
}

export interface BlocklistRepo {
  add(userId: string, itemKeys: readonly string[]): Promise<void>;
  /** Every item key the user blocked. */
  list(userId: string): Promise<string[]>;
}

export type PaletteRecord = { id: string; canvasId: string; colors: unknown; contrast: unknown };

export interface PaletteRepo {
  insert(canvasId: string, colors: unknown, contrast: unknown): Promise<string>;
  listForCanvas(canvasId: string): Promise<PaletteRecord[]>;
}

export interface UsageRepo extends UsageStore {
  /** Add `by` to this period's canvas count, creating the row when missing. */
  addCanvases(userId: string, period: string, by: number): Promise<void>;
}

export interface TakedownRepo {
  /** Every `takedowns.url_or_domain` value. */
  list(): Promise<string[]>;
}

export interface UserRepo {
  /** `users.plan`, or "free" when the row is missing. */
  getPlan(userId: string): Promise<Plan>;
}

export interface Repos {
  canvases: CanvasRepo;
  directions: DirectionRepo;
  references: ReferenceRepo;
  palettes: PaletteRepo;
  usage: UsageRepo;
  takedowns: TakedownRepo;
  users: UserRepo;
  feedback: FeedbackRepo;
  blocklist: BlocklistRepo;
}
