/**
 * Next.js 16 Proxy (the renamed `middleware` convention; runs on the Node.js runtime,
 * which OpenNext Cloudflare bundles as Node middleware).
 *
 * 1. Hard rule 6: shared canvases (/s/*) and the canvas editor (/c/*) send
 *    `X-Robots-Tag: noindex`. App Router pages cannot set response headers
 *    themselves, so this is the place (next.config `headers()` would also work).
 * 2. Site pages (/en/*, /ar/*) get an `x-site-locale` request header so the root
 *    layout can set `<html lang dir>` without knowing the route params.
 *
 * Keep this file small: it runs before every matched request. Other features
 * that need a proxy should add their logic here rather than a second file.
 */
import { NextResponse, type NextRequest } from "next/server";
import { applyNoindex, needsNoindex } from "@/lib/share";
import { localeFromPath, LOCALE_HEADER } from "@/lib/site/i18n";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const locale = localeFromPath(pathname);
  let response: NextResponse;
  if (locale) {
    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, locale);
    response = NextResponse.next({ request: { headers } });
  } else {
    response = NextResponse.next();
  }

  if (needsNoindex(pathname)) applyNoindex(response.headers);
  return response;
}

export const config = {
  matcher: ["/s/:path*", "/c/:path*", "/en/:path*", "/ar/:path*"],
};
