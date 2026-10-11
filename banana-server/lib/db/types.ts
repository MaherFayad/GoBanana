/**
 * Repository ports. Tools and routes depend on these interfaces only, so tests pass
 * in-memory fakes (lib/db/memory.ts) and never touch Neon. The Drizzle versions live
 * next to this file and take the db as their first argument.
 *
 * URLs and metadata only: nothing here ever holds image bytes (hard rule 2).
 */
import type { Plan, UsageStore } from "@/lib/quota";
import type { Reference } from "@/lib/sources/types";

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

export interface CanvasRepo {
  create(input: NewCanvas): Promise<CanvasRecord>;
  /** The canvas when it exists and belongs to `userId`, else null. Never tells the two apart. */
  getOwned(userId: string, canvasId: string): Promise<CanvasRecord | null>;
  countOwned(userId: string): Promise<number>;
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
};

export interface ReferenceRepo {
  /** Save search results for a canvas (URLs only). Existing rows are left as they are. */
  insertMany(canvasId: string, references: readonly Reference[]): Promise<void>;
  /**
   * Look up references saved for a canvas. Each id may be a search result id (`ref_...`)
   * or a row uuid. The map is keyed by the id as passed.
   */
  getByIds(canvasId: string, ids: readonly string[]): Promise<Map<string, ReferenceRecord>>;
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
}
