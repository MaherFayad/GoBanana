/**
 * AuthKit sends the user back here with `code` and `state`. `handleAuth()` checks the state
 * against the PKCE cookie, swaps the code for tokens with WorkOS, stores the session in the
 * encrypted `wos-session` cookie and redirects to the page the user came from.
 *
 * Register `${APP_URL}/auth/callback` as a redirect URI in WorkOS.
 */
import { handleAuth } from "@workos-inc/authkit-nextjs";
import type { NextRequest } from "next/server";
import { DEFAULT_RETURN_PATH, messagePage, signInHref, webAuthConfig } from "@/lib/web-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = webAuthConfig();
  if (!auth) {
    return messagePage("Sign in is not available", "Sign in is not set up on this server yet. Try again later.", 503);
  }
  const handler = handleAuth({
    returnPathname: DEFAULT_RETURN_PATH,
    ...(auth.appUrl ? { baseURL: auth.appUrl } : {}),
    onSuccess: async ({ user }) => {
      // Create the users row now (spec section 12 step 1). A failure here must not block
      // sign-in: getWebUser() tries again on the next request.
      try {
        const { ensureUser } = await import("@/lib/users");
        await ensureUser(user.id, user.email || null);
      } catch {
        console.error("[auth] user row not created at sign in");
      }
    },
    onError: () =>
      messagePage("Sign in did not finish", "Something went wrong while signing you in. Try again.", 400, {
        href: signInHref(DEFAULT_RETURN_PATH),
        label: "Sign in again",
      }),
  });
  return handler(request);
}
