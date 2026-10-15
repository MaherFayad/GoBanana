/**
 * GET /api/taste/pinterest/start: sends a signed-in user to Pinterest's consent screen (official
 * API v5, read only scopes). 404 while TASTE_IMPORT_PINTEREST is off (the default). The state value
 * is random, kept in a short lived HttpOnly cookie and checked by the callback.
 */
import { NextResponse } from "next/server";
import { getWebUser } from "@/lib/web-session";
import { pinterestAuthorizeUrl, pinterestImportEnabled } from "@/lib/taste-profile/pinterest";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "pin-taste-state";

export async function GET(request: Request): Promise<Response> {
  if (!pinterestImportEnabled(process.env)) return new Response("Not found", { status: 404 });
  const user = await getWebUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const origin = new URL(request.url).origin;
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(pinterestAuthorizeUrl(process.env, `${origin}/api/taste/pinterest/callback`, state));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/taste/pinterest" });
  return res;
}
