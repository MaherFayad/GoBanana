/**
 * Next.js 16 Proxy (the renamed `middleware` convention; runs on the Node.js runtime,
 * which OpenNext Cloudflare bundles as Node middleware).
 *
 * 1. Hard rule 6: shared canvases (/s/*) and the canvas editor (/c/*) send
 *    `X-Robots-Tag: noindex`. App Router pages cannot set response headers
 *    themselves, so this is the place (next.config `headers()` would also work).
 * 2. Site pages (/en/*, /ar/*) get an `x-site-locale` request header so the root
 *    layout can set `<html lang dir>` without knowing the route params.
 * 3. Web sign-in: on /c/*, /api/canvas/* and site pages, AuthKit's `authkit()` reads the
 *    session cookie, refreshes it when it is about to expire and passes it on to
 *    `withAuth()` (lib/web-session.ts). Signed-out visitors to /c/* go straight to
 *    AuthKit. Skipped when sign-in is not configured, for bearer-token API calls, and
 *    under the test-only E2E bypass.
 *
 * Keep this file small: it runs before every matched request. Other features
 * that need a proxy should add their logic here rather than a second file.
 */
import { authkit, handleAuthkitHeaders } from "@workos-inc/authkit-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { applyNoindex, needsNoindex } from "@/lib/share";
import { localeFromPath, LOCALE_HEADER } from "@/lib/site/i18n";
import { e2eAuthBypass, needsWebSession, requiresSignIn, webAuthConfig } from "@/lib/web-auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const locale = localeFromPath(pathname);
  let forwarded = request;
  if (locale) {
    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, locale);
    // Only url, method, headers and cookies are read below; the original request (body
    // included) continues with these headers.
    forwarded = new NextRequest(request.url, { method: request.method, headers });
  }

  let response: NextResponse | undefined;
  const auth = needsWebSession(pathname) && !request.headers.has("authorization") && !e2eAuthBypass() ? webAuthConfig() : null;
  if (auth) {
    try {
      const { session, headers, authorizationUrl } = await authkit(forwarded, { redirectUri: auth.redirectUri });
      response =
        !session.user && authorizationUrl && requiresSignIn(pathname)
          ? handleAuthkitHeaders(forwarded, headers, { redirect: authorizationUrl })
          : handleAuthkitHeaders(forwarded, headers);
    } catch {
      // Never log the error object: it can carry session data. Pages then act signed out.
      console.error("[auth] web session check failed");
    }
  }
  response ??= locale ? NextResponse.next({ request: { headers: forwarded.headers } }) : NextResponse.next();

  if (needsNoindex(pathname)) applyNoindex(response.headers);
  return response;
}

export const config = {
  matcher: ["/s/:path*", "/c/:path*", "/en/:path*", "/ar/:path*", "/api/canvas/:path*", "/auth/sign-out"],
};
