/**
 * Delete one canvas for good (owner asked 2026-10-12). Used by the delete_canvas MCP tool and
 * DELETE /api/canvas/:id. Pure apart from the injected repos and bucket, so Vitest covers it
 * with fakes (lib/canvas-delete/memory.ts). Never logs keys.
 *
 * What goes:
 * - The `canvases` row. Its state JSON holds the sections, items, notes and tray, and its
 *   `share_token` column is the view link, so both go with the row. Foreign keys cascade to
 *   `directions`, `references` and `palettes` (db/schema.ts).
 * - The user's own uploads (R2 object, then `uploads` row) that this canvas shows and no other
 *   canvas of theirs still shows. Uploads belong to the user, not the canvas, so one placed on
 *   two boards stays until the last board that shows it is deleted.
 *
 * Order: uploads first, then the row, so a failed R2 call leaves the canvas in place and the
 * user can try again. Owner check on every step: "missing" and "not yours" are the same answer.
 */
import { isUuid } from "@/lib/db/ids";
import type { R2Like, UploadRecord } from "@/lib/uploads/types";

export interface CanvasDeleteRepo {
  /** Title and raw state of the canvas when it exists and belongs to `userId`, else null. */
  findOwned(userId: string, canvasId: string): Promise<{ title: string; state: unknown } | null>;
  /** Of `uploadIds`, the ones another canvas of the same user still shows. */
  uploadsShownElsewhere(userId: string, canvasId: string, uploadIds: readonly string[]): Promise<Set<string>>;
  /** Deletes the canvas row when it belongs to `userId` (cascading). Returns whether a row went. */
  deleteOwned(userId: string, canvasId: string): Promise<boolean>;
}

/** The two upload repo calls this needs (lib/uploads/types.ts UploadRepo). */
export type UploadRowRepo = {
  get(id: string): Promise<UploadRecord | null>;
  deleteOwned(userId: string, id: string): Promise<boolean>;
};

export type CanvasDeleteDeps = {
  canvases: CanvasDeleteRepo;
  uploads: UploadRowRepo;
  /** The R2 bucket, or null when the binding is missing. Only needed when the canvas shows uploads. */
  bucket: () => R2Like | null;
};

export type DeleteCanvasResult =
  | { ok: true; title: string; uploadsDeleted: number }
  | { ok: false; reason: "not_found" | "storage_unavailable" };

const UPLOAD_PATH_RE = /^\/api\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Upload ids a stored canvas state shows (upload nodes keep `/api/uploads/<id>` in their data). */
export function uploadIdsInState(state: unknown): string[] {
  const nodes = (state as { nodes?: unknown } | null)?.nodes;
  if (!Array.isArray(nodes)) return [];
  const ids = new Set<string>();
  for (const n of nodes) {
    const data = (n as { data?: Record<string, unknown> } | null)?.data;
    if (!data || typeof data !== "object") continue;
    for (const field of ["imageUrl", "thumbUrl", "sourceUrl"] as const) {
      const value = data[field];
      const match = typeof value === "string" ? UPLOAD_PATH_RE.exec(value) : null;
      if (match?.[1]) ids.add(match[1].toLowerCase());
    }
  }
  return [...ids];
}

/** R2 deletes at most 1000 keys per call. */
const PAGE = 1000;

export async function deleteCanvas(deps: CanvasDeleteDeps, userId: string, canvasId: string): Promise<DeleteCanvasResult> {
  if (!isUuid(userId) || !isUuid(canvasId)) return { ok: false, reason: "not_found" };
  const canvas = await deps.canvases.findOwned(userId, canvasId);
  if (!canvas) return { ok: false, reason: "not_found" };

  const shown = uploadIdsInState(canvas.state);
  const elsewhere = shown.length > 0 ? await deps.canvases.uploadsShownElsewhere(userId, canvasId, shown) : new Set<string>();
  const rows: UploadRecord[] = [];
  for (const id of shown) {
    if (elsewhere.has(id)) continue;
    const row = await deps.uploads.get(id);
    // Only the user's own uploads; a path to someone else's upload is left alone.
    if (row && row.userId === userId) rows.push(row);
  }

  if (rows.length > 0) {
    const bucket = deps.bucket();
    if (!bucket) return { ok: false, reason: "storage_unavailable" };
    try {
      for (let i = 0; i < rows.length; i += PAGE) await bucket.delete(rows.slice(i, i + PAGE).map((r) => r.r2Key));
    } catch {
      return { ok: false, reason: "storage_unavailable" };
    }
    for (const row of rows) await deps.uploads.deleteOwned(userId, row.id);
  }

  const removed = await deps.canvases.deleteOwned(userId, canvasId);
  if (!removed) return { ok: false, reason: "not_found" };
  return { ok: true, title: canvas.title, uploadsDeleted: rows.length };
}
