"use server";

import { redirect } from "next/navigation";
import { href, isLocale } from "@/lib/site/i18n";
import { getSwipeRepo } from "@/lib/swipe/repo";
import { getWebUser } from "@/lib/web-session";

/**
 * Removes one item from the signed-in user's swipe file, then returns to the library page with the
 * same filters. Only the user's own items can be removed (the repo checks the owner). The return
 * path is rebuilt from a checked locale, never taken from the form, so it cannot send anyone away.
 */
export async function removeSwipeItem(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "en");
  const id = String(formData.get("id") ?? "");
  const back = new URLSearchParams();
  for (const key of ["role", "q", "card"]) {
    const v = String(formData.get(key) ?? "").slice(0, 80);
    if (v) back.set(key, v);
  }
  const safeLocale = isLocale(locale) ? locale : "en";
  try {
    const user = await getWebUser();
    if (user) await getSwipeRepo().remove(user.userId, id);
  } catch {
    console.error("[library] remove failed");
  }
  const qs = back.toString();
  redirect(`${href(safeLocale, "library")}${qs ? `?${qs}` : ""}`);
}
