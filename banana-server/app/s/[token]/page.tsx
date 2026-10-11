/**
 * Read-only shared canvas: /s/:token (spec hard rule 6).
 *
 * - Unlisted and view only. Never linked from the site or a sitemap.
 * - noindex twice: the robots meta tag below, and the `X-Robots-Tag: noindex`
 *   response header, which proxy.ts adds for /s/* (pages cannot set headers).
 *   If proxy.ts is ever removed, add the header in next.config `headers()`.
 * - Every reference shows its source link (hard rule 3) and the takedown list is
 *   checked on load (hard rule 5).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { isValidShareToken, noindexMetadata } from "@/lib/share";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...noindexMetadata,
  title: `Shared canvas | ${APP_NAME}`,
};

type Props = { params: Promise<{ token: string }> };

export default async function SharedCanvasPage({ params }: Props) {
  const { token } = await params;
  if (!isValidShareToken(token)) notFound();

  // TODO(db): load the canvas by `canvases.share_token = token` (select title and state only,
  //   never user_id or email); notFound() when missing or when the owner's plan no longer
  //   allows share links.
  // TODO(takedown): drop nodes whose source, image or thumb URL is blocked
  //   (loadTakedownMatcher + filterTakedowns from lib/takedown.ts) before rendering.
  // TODO(canvas): render the React Flow canvas from canvas/ in read-only mode
  //   (no drag, no edit, no tray), with the source link on every tile.

  return (
    <main id="main" style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Shared canvas</h1>
      <p>This view-only canvas is not available yet.</p>
    </main>
  );
}
