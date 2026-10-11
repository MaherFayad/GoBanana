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
}

/**
 * Web adapter. Contract for `app/api/canvas/[id]/route.ts`:
 * - GET  -> 200 `{ state: <CanvasState JSON> }` (takedown filter already applied on the server)
 * - PUT  body `{ state: CanvasState }` -> 2xx
 */
export function createFetchPersistence(canvasId: string, opts: FetchPersistenceOptions = {}): CanvasPersistence {
  const url = `${opts.baseUrl ?? ""}/api/canvas/${encodeURIComponent(canvasId)}`;
  const doFetch = opts.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  return {
    async load() {
      const res = await doFetch(url, { method: "GET", headers: { accept: "application/json" }, credentials: "same-origin" });
      if (!res.ok) throw new PersistenceError("Could not load this canvas.", res.status);
      const body: unknown = await res.json();
      return body && typeof body === "object" && "state" in body ? (body as { state: unknown }).state : body;
    },
    async save(state) {
      const res = await doFetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        // keepalive lets the last save finish when the tab closes.
        keepalive: true,
        body: JSON.stringify({ state }),
      });
      if (!res.ok) throw new PersistenceError("Could not save this canvas.", res.status);
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
