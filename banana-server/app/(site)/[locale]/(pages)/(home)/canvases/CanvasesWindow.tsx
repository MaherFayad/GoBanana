/**
 * The canvases dashboard as a window (components/window/WindowLayer, kind "finder"): the signed-in
 * user's canvases in the Finder window (Dashboard.tsx). Shared by the direct route (page.tsx: the
 * window over the home page) and the intercepted one (@modal/(.)canvases: the window over the site
 * page that opened it).
 *
 * - Auth like /account and /c/:id: WorkOS AuthKit through getWebUser(); signed out goes to
 *   sign-in and comes back to /canvases (returnTo). The test-only E2E bypass shows demo cards.
 * - Data: lib/site/dashboard.ts (CanvasRepo.listOwned, takedown list checked on every load,
 *   collage images are the references' own thumbnail URLs, never proxied or stored).
 * - `?view=shared` lists only canvases with a view link on; Dashboard.tsx reads it from the URL.
 */
import { redirect } from "next/navigation";
import { WindowLayer } from "@/components/window/WindowLayer";
import { APP_NAME } from "@/lib/config";
import { getRepos } from "@/lib/db";
import { collageSites, demoCards, loadDashboard, longDate, relativeTime, type DashboardLoad } from "@/lib/site/dashboard";
import { getDict } from "@/lib/site/dict";
import { fmt, href, type Locale } from "@/lib/site/i18n";
import { e2eAuthBypass, SIGN_OUT_PATH, signInHref } from "@/lib/web-auth";
import { getWebUser, type WebUser } from "@/lib/web-session";
import { docsHref } from "../../../../_components/desktop/Dock";
import { FrameLights } from "../../../../_components/desktop/FrameLights";
import { Dashboard, type DashCard } from "./Dashboard";
import "./dashboard.css";

/** Where "Give feedback" writes to, or null to leave the link out (no dead links). */
function feedbackAddress(): string | null {
  const v = process.env.FEEDBACK_EMAIL?.trim() || process.env.LEGAL_CONTACT_EMAIL?.trim();
  return v && /^[^\s@]+@[^\s@]+$/.test(v) ? v : null;
}

export async function CanvasesWindow({ locale, mode }: { locale: Locale; mode: "overlay" | "home" }) {
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

  const now = new Date();
  const cards: DashCard[] = load.ok
    ? load.cards.map((c) => ({
        ...c,
        updatedRelative: relativeTime(c.updatedAt, now, locale),
        updatedLong: longDate(c.updatedAt, locale),
        sites: collageSites(c),
      }))
    : [];
  const title = fmt(t.windowTitle, { app: APP_NAME });
  const w = dict.landing.desk.window;

  return (
    <WindowLayer mode={mode} kind="finder" label={title} closeHref={href(locale)} dock="/canvases" escapeCloses>
      <Dashboard
        locale={locale}
        appName={APP_NAME}
        cards={cards}
        failed={!load.ok}
        email={user?.email ?? null}
        lights={<FrameLights title={title} labels={{ close: w.close, minimise: w.minimise, zoom: w.zoom }} />}
        links={{
          home: href(locale),
          all: self,
          shared: `${self}?view=shared`,
          docs: docsHref(locale, "setup/overview/"),
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
    </WindowLayer>
  );
}
