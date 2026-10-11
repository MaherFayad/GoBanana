/**
 * Read-only shared canvas: /s/:token (spec hard rule 6).
 *
 * - Unlisted and view only. Never linked from the site or a sitemap.
 * - noindex twice: the robots meta tag below, and the `X-Robots-Tag: noindex`
 *   response header, which proxy.ts adds for /s/* (pages cannot set headers).
 *   If proxy.ts is ever removed, add the header in next.config `headers()`.
 * - Loads title and state only (never the owner's id or email), and only while the
 *   owner's plan allows share links (spec section 12).
 * - Every reference shows its source link (hard rule 3) and the takedown list is
 *   checked on load (hard rule 5), failing closed.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedCanvas } from "@/canvas/SharedCanvas";
import { loadSharedCanvas } from "@/canvas/server-load";
import { APP_NAME } from "@/lib/config";
import { getRepos } from "@/lib/db";
import { getShareRepo } from "@/lib/db/shares";
import { memoTakedowns } from "@/lib/db/takedowns";
import { isValidShareToken, noindexMetadata } from "@/lib/share";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...noindexMetadata,
  title: `Shared canvas | ${APP_NAME}`,
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

export default async function SharedCanvasPage({ params }: Props) {
  const { token } = await params;
  if (!isValidShareToken(token)) notFound();

  const shared = await loadSharedCanvas(token, {
    shares: getShareRepo,
    loadMatcher: () => memoTakedowns(getRepos().takedowns)(),
  });
  if (!shared) notFound();

  return <SharedCanvas appName={APP_NAME} title={shared.title} state={shared.state} />;
}
