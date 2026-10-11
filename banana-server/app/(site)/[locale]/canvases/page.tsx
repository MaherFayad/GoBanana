/**
 * Canvases dashboard: /en/canvases and /ar/canvases. The signed-in user's canvases as a Finder
 * window on the GoBanana desktop (docs/site-redesign-spec.md): the menu bar on top, then one
 * glass window with a sidebar, a toolbar, the canvases and an Inspector (Dashboard.tsx).
 *
 * - Auth like /account and /c/:id: WorkOS AuthKit through getWebUser(); signed out goes to
 *   sign-in and comes back here (returnTo). The test-only E2E bypass shows demo cards.
 * - Data: lib/site/dashboard.ts (CanvasRepo.listOwned, takedown list checked on every load,
 *   collage images are the references' own thumbnail URLs, never proxied or stored).
 * - `?view=shared` lists only canvases with a view link on; the sidebar offers it only when
 *   at least one exists.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { getRepos } from "@/lib/db";
import { collageSites, demoCards, loadDashboard, longDate, relativeTime, type DashboardLoad } from "@/lib/site/dashboard";
import { getDict } from "@/lib/site/dict";
import { fmt, href, isLocale } from "@/lib/site/i18n";
import { e2eAuthBypass, SIGN_OUT_PATH, signInHref } from "@/lib/web-auth";
import { getWebUser, type WebUser } from "@/lib/web-session";
import { docsHref } from "../../_components/desktop/Dock";
import { SiteHeader } from "../../_components/SiteChrome";
import { Dashboard, type DashCard } from "./Dashboard";
import "./dashboard.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).dashboard.title, robots: { index: false, follow: false } } : {};
}

/** Where "Give feedback" writes to, or null to leave the link out (no dead links). */
function feedbackAddress(): string | null {
  const v = process.env.FEEDBACK_EMAIL?.trim() || process.env.LEGAL_CONTACT_EMAIL?.trim();
  return v && /^[^\s@]+@[^\s@]+$/.test(v) ? v : null;
}

export default async function CanvasesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  const t = dict.dashboard;
  const self = href(locale, "canvases");

  // A database failure is not "signed out" (lib/web-session.ts): show the error state, not a sign-in loop.
  let user: WebUser | null | undefined;
  try {
    user = await getWebUser();
  } catch {
    console.error("[dashboard] session could not load");
    user = undefined;
  }
  if (user === null) redirect(signInHref(self));

  let load: DashboardLoad = { ok: false };
  if (user) load = e2eAuthBypass() ? { ok: true, cards: demoCards() } : await loadDashboard(user.userId, { repos: getRepos });

  const view = (await searchParams).view === "shared" ? "shared" : "all";
  const now = new Date();
  const all: DashCard[] = load.ok
    ? load.cards.map((c) => ({
        ...c,
        updatedRelative: relativeTime(c.updatedAt, now, locale),
        updatedLong: longDate(c.updatedAt, locale),
        sites: collageSites(c),
      }))
    : [];
  const sharedCount = all.filter((c) => c.shared).length;
  const cards = view === "shared" ? all.filter((c) => c.shared) : all;

  return (
    <>
      <SiteHeader locale={locale} t={dict} signedIn={user !== undefined} />
      <main id="main" tabIndex={-1} className="dash-desk">
        <Dashboard
          locale={locale}
          appName={APP_NAME}
          view={view === "shared" && sharedCount > 0 ? "shared" : "all"}
          cards={view === "shared" && sharedCount === 0 ? all : cards}
          total={all.length}
          sharedCount={sharedCount}
          failed={!load.ok}
          email={user?.email ?? null}
          links={{
            home: href(locale),
            all: self,
            shared: `${self}?view=shared`,
            docs: docsHref(locale, "start/install/"),
            account: href(locale, "account"),
            signOut: SIGN_OUT_PATH,
            feedback: feedbackAddress(),
          }}
          t={{
            ...t,
            home: fmt(t.home),
            emptyBody: fmt(t.emptyBody),
            newCta: fmt(t.newCta),
            signOut: dict.common.signOut,
            close: dict.common.close,
          }}
        />
      </main>
    </>
  );
}
