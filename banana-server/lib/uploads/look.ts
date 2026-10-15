/**
 * "Bend my screen" (VAL-02): lets bend_brief show the agent the user's OWN uploaded screenshot.
 * The file is the user's, in their own R2 prefix, read under the existing upload rules (the same
 * owner check as GET /api/uploads/:id). The bytes are base64 encoded into one tool result and
 * dropped: nothing is cached, logged, copied or served from here.
 */
import { isUuid } from "@/lib/db/ids";
import { toBase64 } from "@/lib/vision/thumbs";
import type { R2Like, UploadRepo } from "./types";

/** Largest screenshot sent back inline. A bigger one is skipped; the user can attach it to the chat instead. */
export const MAX_LOOK_UPLOAD_BYTES = 1536 * 1024;

export type UploadLookDeps = {
  repo: Pick<UploadRepo, "get">;
  bucket: () => R2Like | null;
};

export type UploadLook =
  | { ok: true; mime: string; bytes: number; data: string | null }
  | { ok: false; reason: "not_found" | "unavailable" };

/**
 * The upload must exist and belong to `userId`; anything else answers `not_found` (never says
 * whether another user's id exists). `data` is null when the file is over the inline cap or the
 * bucket is missing: the screenshot still counts as found, the agent just cannot see it here.
 */
export async function lookAtUpload(deps: UploadLookDeps, userId: string, uploadId: string): Promise<UploadLook> {
  if (!isUuid(uploadId)) return { ok: false, reason: "not_found" };
  let row: Awaited<ReturnType<UploadLookDeps["repo"]["get"]>>;
  try {
    row = await deps.repo.get(uploadId);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!row || row.userId !== userId) return { ok: false, reason: "not_found" };
  if (row.bytes > MAX_LOOK_UPLOAD_BYTES) return { ok: true, mime: row.mime, bytes: row.bytes, data: null };
  const bucket = deps.bucket();
  if (!bucket) return { ok: true, mime: row.mime, bytes: row.bytes, data: null };
  try {
    const obj = await bucket.get(row.r2Key);
    if (!obj) return { ok: false, reason: "not_found" };
    const bytes = new Uint8Array(await new Response(obj.body).arrayBuffer());
    if (bytes.byteLength > MAX_LOOK_UPLOAD_BYTES) return { ok: true, mime: row.mime, bytes: row.bytes, data: null };
    return { ok: true, mime: row.mime, bytes: bytes.byteLength, data: toBase64(bytes) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
