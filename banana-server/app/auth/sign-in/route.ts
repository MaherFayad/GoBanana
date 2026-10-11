/**
 * Starts web sign-in: redirects to AuthKit with PKCE (the verifier is kept in a short-lived
 * sealed cookie). `?returnTo=/path` brings the user back to that page afterwards; only paths
 * on this site are accepted. Also usable as the "Initiate login URI" in WorkOS.
 */
import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { DEFAULT_RETURN_PATH, e2eAuthBypass, messagePage, safeReturnTo, webAuthConfig } from "@/lib/web-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo")) ?? DEFAULT_RETURN_PATH;
  if (e2eAuthBypass()) redirect(returnTo);
  const auth = webAuthConfig();
  if (!auth) {
    return messagePage("Sign in is not available", "Sign in is not set up on this server yet. Try again later.", 503);
  }
  let url: string;
  try {
    url = await getSignInUrl({ returnTo, redirectUri: auth.redirectUri });
  } catch {
    console.error("[auth] could not start sign in");
    return messagePage("Sign in is not available", "We could not start sign in. Try again in a minute.", 503);
  }
  redirect(url);
}
