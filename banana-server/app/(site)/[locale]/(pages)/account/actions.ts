"use server";

import { createDbAccountRepo } from "@/lib/account/db";
import { deleteAccountData } from "@/lib/account/delete";
import { getUploadsBucket } from "@/lib/uploads/bucket";
import { forgetUser } from "@/lib/users";
import { clearWebSession, getWebUser } from "@/lib/web-session";

export type DeleteAccountResult = { ok: boolean };

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
