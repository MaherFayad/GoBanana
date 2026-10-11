/**
 * 404 for every route: unmatched URLs and notFound() calls with no nearer boundary (an unknown
 * /c/:id still answers 404, now with this page). The locale comes from the `x-site-locale`
 * header proxy.ts sets on /en/* and /ar/*; anything else is English.
 *
 * Rendered inside the root layout only, so it brings the site shell itself: header, the inset
 * 404 panel (NotFoundView) and footer.
 */
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ToastViewport } from "@/components/studio/Toast";
import { APP_NAME } from "@/lib/config";
import { getDict } from "@/lib/site/dict";
import { DEFAULT_LOCALE, dirOf, isLocale, LOCALE_HEADER } from "@/lib/site/i18n";
import { isSignedIn } from "@/lib/site/session";
import { NotFoundView } from "./(site)/_components/NotFoundView";
import { SiteFooter, SiteHeader } from "./(site)/_components/SiteChrome";
import "./(site)/site.css";

export async function generateMetadata(): Promise<Metadata> {
  const requested = (await headers()).get(LOCALE_HEADER);
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  return { title: `${getDict(locale).notFound.metaTitle} | ${APP_NAME}`, robots: { index: false } };
}

export default async function NotFound() {
  const requested = (await headers()).get(LOCALE_HEADER);
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const t = getDict(locale);
  const signedIn = await isSignedIn();
  return (
    <div className="site" lang={locale} dir={dirOf(locale)}>
      <a className="skip-link" href="#main">
        {t.common.skipLink}
      </a>
      <SiteHeader locale={locale} t={t} signedIn={signedIn} />
      <main id="main" tabIndex={-1}>
        <NotFoundView locale={locale} t={t.notFound} />
      </main>
      <SiteFooter locale={locale} t={t} />
      <ToastViewport labels={t.common.toast} />
    </div>
  );
}
