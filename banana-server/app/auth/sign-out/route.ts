/**
 * Signs out: deletes the session cookie, ends the WorkOS session and comes back to the
 * home page. POST only (a form button), so another site cannot sign people out with a
 * link or an image. Answers 303 so the browser follows with GET.
 * Add `${APP_URL}/en` as a sign-out redirect in WorkOS.
 */
import { getWorkOS, withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
import { clearWebSession } from "@/lib/web-session";
import { webAuthConfig } from "@/lib/web-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  const home = new URL("/en", getConfig().appUrl ?? request.nextUrl.origin).toString();
  let target = home;
  if (webAuthConfig()) {
    try {
      // proxy.ts covers this path, so withAuth() sees the session.
      const { sessionId } = await withAuth();
      if (sessionId) target = getWorkOS().userManagement.getLogoutUrl({ sessionId, returnTo: home });
    } catch {
      console.error("[auth] sign out could not read the session");
    }
  }
  await clearWebSession();
  const response = NextResponse.redirect(target, 303);
  response.headers.set("cache-control", "no-store");
  return response;
}
