/**
 * Account deletion (spec section 11 and M7): every R2 object under `u/<userId>/`, then
 * the `users` row, which cascades to canvases, directions, references, palettes,
 * uploads and usage. Pure apart from the injected bucket and repo, so tests prove
 * that nothing is left behind. Never logs keys.
 *
 * Order: objects first, so a failure leaves the account in place and the user can try
 * again. A second sweep after the row is gone catches an upload that raced the first.
 */
import { isUuid } from "@/lib/db/ids";
import { uploadKeyPrefix } from "@/lib/uploads/rules";
import type { R2Like } from "@/lib/uploads/types";

export interface AccountRepo {
  /** Deletes the users row (cascading). Returns the WorkOS id of the removed row, or null when none. */
  deleteUser(userId: string): Promise<{ workosId: string } | null>;
}

export type DeleteAccountDeps = {
  bucket: R2Like | null;
  repo: AccountRepo;
};

export type DeleteAccountResult =
  | { ok: true; objectsDeleted: number; workosId: string | null }
  | { ok: false; reason: "invalid_user" | "storage_unavailable" };

/** R2 accepts at most 1000 keys per delete and returns at most 1000 per list page. */
const PAGE = 1000;

/** Deletes every object under a prefix, following list cursors. Returns how many keys were deleted. */
export async function deleteR2Prefix(bucket: R2Like, prefix: string): Promise<number> {
  if (!prefix) throw new Error("refusing to delete an empty prefix");
  let deleted = 0;
  let cursor: string | undefined;
  // Delete each page, then continue from its cursor. The cursor marks a position in key
  // order, so deleting keys before it skips nothing; the caller's second sweep is a backstop.
  for (;;) {
    const page = await bucket.list({ prefix, cursor, limit: PAGE });
    const keys = page.objects.map((o) => o.key).filter((k) => k.startsWith(prefix));
    for (let i = 0; i < keys.length; i += PAGE) {
      const batch = keys.slice(i, i + PAGE);
      await bucket.delete(batch);
      deleted += batch.length;
    }
    if (!page.truncated || !page.cursor) break;
    cursor = page.cursor;
  }
  return deleted;
}

export async function deleteAccountData(deps: DeleteAccountDeps, userId: string): Promise<DeleteAccountResult> {
  if (!isUuid(userId)) return { ok: false, reason: "invalid_user" };
  if (!deps.bucket) return { ok: false, reason: "storage_unavailable" };
  const prefix = uploadKeyPrefix(userId);
  let objectsDeleted = await deleteR2Prefix(deps.bucket, prefix);
  const removed = await deps.repo.deleteUser(userId);
  objectsDeleted += await deleteR2Prefix(deps.bucket, prefix);
  return { ok: true, objectsDeleted, workosId: removed?.workosId ?? null };
}
