"use server";

import { getSiteUser } from "@/lib/site/session";

export type DeleteAccountResult = { ok: boolean };

/**
 * Deletes the signed-in user's account (spec section 11: all rows and R2 objects).
 *
 * TODO(db, r2): once wired:
 *   1. list `uploads.r2_key` for the user and delete each object from the R2 binding
 *      (getCloudflareContext().env.R2_BUCKET.delete(keys));
 *   2. delete the `users` row (canvases, references, palettes, uploads, usage cascade);
 *   3. forgetUser(workosId) from lib/users.ts and end the web session;
 *   4. optionally delete the WorkOS user through the User Management API.
 * Paddle keeps its own billing records; tell the user to cancel any subscription first.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const user = await getSiteUser();
  if (!user) return { ok: false };
  return { ok: false };
}
