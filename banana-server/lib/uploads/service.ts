/**
 * Upload logic (spec section 12): Pro only, 10 MB per image, 1 GB per user, R2 key
 * `u/<userId>/<uuid>`. Pure apart from the injected repo and bucket, so Vitest covers
 * it with fakes. Never logs keys or file bytes.
 */
import { isUuid } from "@/lib/db/ids";
import { limitsFor, type Plan } from "@/lib/quota";
import { isValidShareToken } from "@/lib/share";
import {
  isAllowedUploadType,
  MAX_UPLOAD_BYTES,
  sniffImageType,
  uploadKey,
  uploadPath,
  type UploadErrorCode,
  type UploadMime,
} from "./rules";
import type { R2Like, UploadRecord, UploadRepo } from "./types";

export type UploadDeps = {
  repo: UploadRepo;
  /** The R2 bucket, or null when the binding is missing (answers storage_unavailable). */
  bucket: () => R2Like | null;
  /** Read from the database on every call (lib/db/users.ts), never from a cache. */
  getPlan: (userId: string) => Promise<Plan>;
  newId?: () => string;
};

export type StoredUpload = {
  id: string;
  url: string;
  mime: UploadMime;
  bytes: number;
  usedBytes: number;
  limitBytes: number;
};

export type UploadOutcome<T> = { ok: true; value: T } | { ok: false; error: UploadErrorCode };

const fail = <T>(error: UploadErrorCode): UploadOutcome<T> => ({ ok: false, error });

export async function createUpload(
  deps: UploadDeps,
  userId: string,
  file: { bytes: Uint8Array<ArrayBuffer>; declaredType?: string | null },
): Promise<UploadOutcome<StoredUpload>> {
  const limits = limitsFor(await deps.getPlan(userId));
  if (!limits.uploads || limits.uploadBytes <= 0) return fail("plan_required");

  const size = file.bytes.byteLength;
  if (size === 0) return fail("empty");
  if (size > MAX_UPLOAD_BYTES) return fail("too_large");
  // A declared type outside the list is refused even if the bytes look like an image.
  const declared = file.declaredType?.split(";")[0]?.trim().toLowerCase();
  if (declared && declared !== "application/octet-stream" && !isAllowedUploadType(declared)) return fail("unsupported_type");
  const mime = sniffImageType(file.bytes);
  if (!mime) return fail("unsupported_type");

  // Two uploads racing at the cap can both pass; the overshoot is at most one file (10 MB).
  const used = await deps.repo.totalBytes(userId);
  if (used + size > limits.uploadBytes) return fail("storage_full");

  const bucket = deps.bucket();
  if (!bucket) return fail("storage_unavailable");

  const id = deps.newId?.() ?? crypto.randomUUID();
  const r2Key = uploadKey(userId, id);
  try {
    await bucket.put(r2Key, file.bytes, { httpMetadata: { contentType: mime } });
  } catch {
    return fail("storage_unavailable");
  }
  try {
    await deps.repo.insert({ id, userId, r2Key, mime, bytes: size });
  } catch (err) {
    // No row means no quota charge, so the object must not stay behind.
    await bucket.delete(r2Key).catch(() => undefined);
    throw err;
  }
  return {
    ok: true,
    value: { id, url: uploadPath(id), mime, bytes: size, usedBytes: used + size, limitBytes: limits.uploadBytes },
  };
}

/**
 * True when a stored canvas state shows this upload: a node's image (or an X post's attached
 * screenshot), or a part cut from it for a Frankenstein page.
 */
export function stateShowsUpload(state: unknown, uploadId: string): boolean {
  const path = uploadPath(uploadId);
  const nodes = (state as { nodes?: unknown } | null)?.nodes;
  const parts = (state as { parts?: unknown } | null)?.parts;
  const inNodes =
    Array.isArray(nodes) &&
    nodes.some((n) => {
      const data = (n as { data?: Record<string, unknown> } | null)?.data;
      return !!data && (data.imageUrl === path || data.thumbUrl === path || data.sourceUrl === path || data.screenshotUrl === path);
    });
  return inNodes || (Array.isArray(parts) && parts.some((p) => (p as { imageUrl?: unknown } | null)?.imageUrl === path));
}

export type Viewer = { userId?: string | null; shareToken?: string | null };

export type ReadableUpload = { body: ReadableStream; mime: string; size: number; etag?: string; owner: boolean };

/**
 * Streams an upload to its owner, or to anyone holding the share token of a canvas
 * of the same owner that shows this upload. Anything else is "not found", so ids
 * cannot be probed.
 */
export async function readUpload(deps: UploadDeps, uploadId: string, viewer: Viewer): Promise<UploadOutcome<ReadableUpload>> {
  if (!isUuid(uploadId)) return fail("not_found");
  const row = await deps.repo.get(uploadId);
  if (!row || !isAllowedUploadType(row.mime)) return fail("not_found");

  const owner = !!viewer.userId && viewer.userId === row.userId;
  if (!owner) {
    if (!isValidShareToken(viewer.shareToken)) return fail("not_found");
    const canvas = await deps.repo.findSharedCanvas(viewer.shareToken);
    if (!canvas || canvas.userId !== row.userId || !stateShowsUpload(canvas.state, row.id)) return fail("not_found");
  }

  const bucket = deps.bucket();
  if (!bucket) return fail("storage_unavailable");
  const obj = await bucket.get(row.r2Key);
  if (!obj) return fail("not_found");
  return { ok: true, value: { body: obj.body, mime: row.mime, size: obj.size, etag: obj.httpEtag, owner } };
}

/** Removes the object first, then the row, so a failed R2 call leaves nothing half deleted. */
export async function deleteUpload(deps: UploadDeps, userId: string, uploadId: string): Promise<UploadOutcome<{ id: string }>> {
  if (!isUuid(uploadId)) return fail("not_found");
  const row: UploadRecord | null = await deps.repo.get(uploadId);
  if (!row || row.userId !== userId) return fail("not_found");
  const bucket = deps.bucket();
  if (!bucket) return fail("storage_unavailable");
  try {
    await bucket.delete(row.r2Key);
  } catch {
    return fail("storage_unavailable");
  }
  await deps.repo.deleteOwned(userId, uploadId);
  return { ok: true, value: { id: uploadId } };
}
