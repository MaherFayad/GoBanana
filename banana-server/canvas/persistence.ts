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
      const res = await doFetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        // keepalive lets the last save finish when the tab closes.
        keepalive: true,
        body: JSON.stringify(base ? { state, baseUpdatedAt: base } : { state }),
      });
      if (res.status === 409) {
        conflicted = true;
        throw new PersistenceError(CONFLICT_MESSAGE, 409);
      }
      if (!res.ok) throw new PersistenceError("Could not save this canvas.", res.status);
      const body: unknown = await res.json().catch(() => null);
      base = updatedAtOf(body) ?? base;
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
