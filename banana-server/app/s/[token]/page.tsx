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
 * - One bar: the canvas window's title bar says "View only" (a chip) and ends with the site's
 *   "Add to Claude" (canvas/SharedCanvas.tsx). The canvas is a read-only app window on the desk,
 *   and a dismissible "Made with {app}" notification card links to the landing page. The slim
 *   brand bar (share.css) is kept only for the page that could not load.
 * - Client review (VAL-04): a "Review" button opens a panel where the viewer keeps or drops each
 *   direction and comments, with no sign in (ReviewPanel.tsx, POST /api/review/:token). English or
 *   Arabic from `?lang=` or the browser language. If the directions cannot load, the page shows
 *   without the panel.
 * - Test-only: under the E2E sign-in bypass (never in a production build) the demo token
 *   renders lib/site/share-demo.ts, so the page can be screenshot without a database.
 */
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SharedCanvas } from "@/canvas/SharedCanvas";
import { loadSharedCanvas, type SharedPageDeps } from "@/canvas/server-load";
import { APP_NAME } from "@/lib/config";
import { getRepos } from "@/lib/db";
import { getShareRepo } from "@/lib/db/shares";
import { memoTakedowns } from "@/lib/db/takedowns";
import { reviewCopy, reviewLocale } from "@/lib/review/copy";
import { liveReviewRepo } from "@/lib/review/live";
import { isValidShareToken, noindexMetadata } from "@/lib/share";
import { getDict } from "@/lib/site/dict";
import { fmt, href } from "@/lib/site/i18n";
import { compileTakedowns } from "@/lib/takedown";
import { e2eAuthBypass } from "@/lib/web-auth";
import { BrandMark } from "@/components/brand/BrandMark";
import { MadeWithCard } from "./MadeWithCard";
import { ReviewPanel } from "./ReviewPanel";
import "@/canvas/overlays.css";
import "./share.css";
import "./review.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...noindexMetadata,
  title: `Shared canvas | ${APP_NAME}`,
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string | string[] }> };

/** The share page is English, like the shared canvas UI. */
const t = getDict("en");

function ShareBar() {
  return (
    // A nav landmark, not a banner: the canvas below already has its own top bar header.
    <nav className="share-bar" aria-label={fmt(t.share.homeLabel)}>
      <a className="share-brand" href={href("en")} dir="ltr">
        <BrandMark />
        {APP_NAME}
      </a>
      <p className="share-made">{fmt(t.share.madeWith)}</p>
      <a className="st-btn" data-variant="primary" data-size="sm" href={href("en", "install")}>
        {t.share.cta}
      </a>
    </nav>
  );
}

async function demoDeps(token: string): Promise<SharedPageDeps | null> {
  if (!e2eAuthBypass()) return null;
  const demo = await import("@/lib/site/share-demo");
  if (token !== demo.DEMO_SHARE_TOKEN) return null;
  return { shares: () => ({ getShared: async () => demo.DEMO_SHARE }), loadMatcher: async () => compileTakedowns([]) };
}

export default async function SharedCanvasPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { lang } = await searchParams;
  if (!isValidShareToken(token)) notFound();

  let shared: Awaited<ReturnType<typeof loadSharedCanvas>>;
  try {
    const deps = (await demoDeps(token)) ?? {
      shares: getShareRepo,
      loadMatcher: () => memoTakedowns(getRepos().takedowns)(),
    };
    shared = await loadSharedCanvas(token, deps);
  } catch {
    // Database or takedown list unavailable: show nothing (fail closed), never the token.
    console.error("[share] shared canvas could not load");
    return (
      <div className="share-shell">
        <ShareBar />
        <main id="main" className="share-down">
          <div className="share-down-panel">
            <h1>{t.share.downTitle}</h1>
            <p>{t.share.downBody}</p>
          </div>
        </main>
      </div>
    );
  }
  if (!shared) notFound();

  // Directions to review. Any failure leaves the page without the panel.
  let reviewDirections: { key: string; title: string }[] = [];
  try {
    reviewDirections = (await liveReviewRepo().target(token))?.directions ?? [];
  } catch {
    console.error("[share] review directions could not load");
  }
  const locale = reviewLocale(Array.isArray(lang) ? lang[0] : lang, (await headers()).get("accept-language"));

  return (
    <div className="share-shell">
      <SharedCanvas
        appName={APP_NAME}
        title={shared.title}
        state={shared.state}
        titleEnd={
          <a className="st-btn share-cta" data-variant="primary" data-size="sm" href={href("en", "install")}>
            {t.share.cta}
          </a>
        }
      >
        {reviewDirections.length > 0 ? (
          <ReviewPanel
            token={token}
            directions={reviewDirections}
            copy={reviewCopy(locale)}
            locale={locale}
            switchHref={`?lang=${locale === "ar" ? "en" : "ar"}`}
          />
        ) : null}
        <MadeWithCard
          appName={APP_NAME}
          label={fmt(t.share.noteLabel)}
          title={fmt(t.share.noteTitle)}
          body={t.share.noteBody}
          link={t.share.noteLink}
          href={href("en")}
          dismiss={t.share.noteDismiss}
        />
      </SharedCanvas>
    </div>
  );
}
