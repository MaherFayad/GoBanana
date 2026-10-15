"use server";

import { createDbAccountRepo } from "@/lib/account/db";
import { deleteAccountData } from "@/lib/account/delete";
import { importTasteFromUploads, TASTE_IMPORT_MESSAGES } from "@/lib/taste-profile/import";
import { createDbTasteStore } from "@/lib/taste-profile/store";
import { getUploadsBucket } from "@/lib/uploads/bucket";
import { createDbUploadRepo } from "@/lib/uploads/db";
import { forgetUser } from "@/lib/users";
import { clearWebSession, getWebUser } from "@/lib/web-session";

export type DeleteAccountResult = { ok: boolean };

/** Clears the signed-in user's taste profile (P2-02). */
export async function clearTaste(): Promise<{ ok: boolean }> {
  const user = await getWebUser();
  if (!user) return { ok: false };
  try {
    await createDbTasteStore().clear(user.userId);
    return { ok: true };
  } catch {
    console.warn("[account] taste clear failed");
    return { ok: false };
  }
}

/** Reads the palettes of 5 to 20 of the user's own uploads and keeps style words only (VAL-03). */
export async function importTaste(uploadIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const user = await getWebUser();
  if (!user) return { ok: false };
  try {
    const result = await importTasteFromUploads(
      { uploads: createDbUploadRepo(), bucket: getUploadsBucket(), store: createDbTasteStore() },
      user.userId,
      Array.isArray(uploadIds) ? uploadIds.filter((id) => typeof id === "string") : [],
    );
    return result.ok ? { ok: true } : { ok: false, error: TASTE_IMPORT_MESSAGES[result.error] };
  } catch {
    console.warn("[account] taste import failed");
    return { ok: false };
  }
}

/**
 * Deletes the signed-in user's account (spec section 11: all rows and R2 objects),
 * then signs them out by dropping the web session cookie (clearWebSession).
 * Paddle keeps its own billing records; the page tells the user to cancel any
 * subscription first. The WorkOS user itself is not deleted (signing in again starts
 * a fresh, empty account).
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const user = await getWebUser();
  if (!user) return { ok: false };
  try {
    const result = await deleteAccountData({ bucket: getUploadsBucket(), repo: createDbAccountRepo() }, user.userId);
    if (!result.ok) {
      console.warn(`[account] delete failed: ${result.reason}`);
      return { ok: false };
    }
    forgetUser(user.workosId);
  } catch (err) {
    console.warn(`[account] delete failed: ${err instanceof Error ? err.name : "Error"}`);
    return { ok: false };
  }
  await clearWebSession();
  return { ok: true };
}
