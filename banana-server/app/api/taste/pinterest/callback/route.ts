/**
 * GET /api/taste/pinterest/callback: Pinterest sends the user back here with a code. We check the
 * state cookie, trade the code for a token, read the user's boards and pins (text only), keep the
 * matched style words and pin page links in user_taste, and drop the token. Then back to the
 * account page. 404 while TASTE_IMPORT_PINTEREST is off. Never logs the code or the token.
 */
import { NextResponse } from "next/server";
import { exchangePinterestCode, pinterestImportEnabled, readPinterestTaste } from "@/lib/taste-profile/pinterest";
import { mergeStyleWords } from "@/lib/taste-profile";
import { createDbTasteStore } from "@/lib/taste-profile/store";
import { getWebUser } from "@/lib/web-session";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "pin-taste-state";

function back(origin: string, status: "done" | "failed"): Response {
  const res = NextResponse.redirect(`${origin}/en/account?taste=${status}`, 303);
  res.cookies.delete({ name: STATE_COOKIE, path: "/api/taste/pinterest" });
  return res;
}

export async function GET(request: Request): Promise<Response> {
  if (!pinterestImportEnabled(process.env)) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const user = await getWebUser();
  if (!user) return new Response("Sign in first", { status: 401 });

  const expected = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${STATE_COOKIE}=([^;]+)`))?.[1];
  const code = url.searchParams.get("code");
  if (!expected || url.searchParams.get("state") !== expected || !code) return back(url.origin, "failed");

  try {
    const token = await exchangePinterestCode(process.env, code, `${url.origin}/api/taste/pinterest/callback`);
    const taste = token ? await readPinterestTaste(token) : null;
    if (!taste) return back(url.origin, "failed");
    const store = createDbTasteStore();
    const current = await store.get(user.userId);
    await store.save(user.userId, {
      likedCardIds: current.likedCardIds,
      styleWords: mergeStyleWords(taste.words, current.styleWords),
      sourceUrls: taste.sourceUrls,
    });
    return back(url.origin, "done");
  } catch {
    console.error("[taste] pinterest import failed");
    return back(url.origin, "failed");
  }
}
