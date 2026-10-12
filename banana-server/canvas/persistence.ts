/**
 * Where the canvas loads and saves its state. The same CanvasApp runs on the web
 * (`/c/:id`, fetch to `/api/canvas/:id`) and inline in chat (MCP Apps bridge, M5).
 */
import type { CanvasState } from "./types";

export interface CanvasPersistence {
  /** Raw stored state JSON (validated by `deserializeState`), or null for a new canvas. */
  load(): Promise<unknown>;
  save(state: CanvasState): Promise<void>;
}

/** Browsers cap a keepalive request body at 64 KiB in total; stay under it. */
export const KEEPALIVE_MAX_BYTES = 60_000;

export class PersistenceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PersistenceError";
  }
}

export interface FetchPersistenceOptions {
  /** Defaults to "" (same origin). */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** `updatedAt` of the state the page started with (server-loaded state). */
  baseUpdatedAt?: string | null;
}

/** Shown when a save is refused because the canvas changed somewhere else (HTTP 409). */
export const CONFLICT_MESSAGE = "This canvas changed in another window. Reload to see the latest.";

export function isConflict(error: unknown): boolean {
  return error instanceof PersistenceError && error.status === 409;
}

function updatedAtOf(body: unknown): string | undefined {
  return body && typeof body === "object" && "updatedAt" in body && typeof body.updatedAt === "string"
    ? body.updatedAt
    : undefined;
}

/**
 * Web adapter. Contract for `app/api/canvas/[id]/route.ts`:
 * - GET  -> 200 `{ state: <CanvasState JSON>, updatedAt }` (takedown filter already applied on the server)
 * - PUT  body `{ state: CanvasState, baseUpdatedAt? }` -> 2xx `{ updatedAt }`, or 409 when the
 *   canvas changed since `baseUpdatedAt`. After a 409 every later save fails the same way
 *   without a request, so a stale tab can never overwrite newer work; the user reloads.
 */
export function createFetchPersistence(canvasId: string, opts: FetchPersistenceOptions = {}): CanvasPersistence {
  const url = `${opts.baseUrl ?? ""}/api/canvas/${encodeURIComponent(canvasId)}`;
  const doFetch = opts.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  let base: string | undefined = opts.baseUpdatedAt ?? undefined;
  let conflicted = false;
  return {
    async load() {
      const res = await doFetch(url, { method: "GET", headers: { accept: "application/json" }, credentials: "same-origin" });
      if (!res.ok) throw new PersistenceError("Could not load this canvas.", res.status);
      const body: unknown = await res.json();
      base = updatedAtOf(body) ?? base;
      return body && typeof body === "object" && "state" in body ? (body as { state: unknown }).state : body;
    },
    async save(state) {
      if (conflicted) throw new PersistenceError(CONFLICT_MESSAGE, 409);
      const body = JSON.stringify(base ? { state, baseUpdatedAt: base } : { state });
      let res: Response;
      try {
        res = await doFetch(url, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          // keepalive lets the last save finish when the tab closes, but browsers refuse a
          // keepalive body over 64 KiB (the fetch fails outright), so big boards save without it.
          keepalive: new Blob([body]).size < KEEPALIVE_MAX_BYTES,
          body,
        });
      } catch {
        throw new PersistenceError("Could not reach the server to save this canvas.");
      }
      if (res.status === 409) {
        conflicted = true;
        throw new PersistenceError(CONFLICT_MESSAGE, 409);
      }
      if (!res.ok) {
        const err: unknown = await res.json().catch(() => null);
        const said = err && typeof err === "object" && typeof (err as { error?: unknown }).error === "string" ? (err as { error: string }).error : null;
        throw new PersistenceError(said ?? "Could not save this canvas.", res.status);
      }
      const saved: unknown = await res.json().catch(() => null);
      base = updatedAtOf(saved) ?? base;
    },
  };
}

/** In-memory adapter for tests, previews and shared view-only pages. */
export function createMemoryPersistence(initial: unknown = null): CanvasPersistence & { saved: CanvasState[] } {
  let current = initial;
  const saved: CanvasState[] = [];
  return {
    saved,
    async load() {
      return current;
    },
    async save(state) {
      saved.push(state);
      current = state;
    },
  };
}

/**
 * Toast text for a failed save: the server's own reason when it answered (too large, signed out,
 * not valid), else the connection hint. The changes stay on the board either way.
 */
export function saveErrorText(error: unknown): string {
  const kept = "Your changes are still here.";
  if (error instanceof PersistenceError && error.status !== undefined) {
    if (error.status === 401 || error.status === 403) return `You are signed out. Sign in again in another tab, then try again. ${kept}`;
    return `${error.message} ${kept}`;
  }
  return `${kept} Check your connection, then try again.`;
}
