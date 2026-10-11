/**
 * Public site layout (landing, pricing, account, takedown, terms, privacy).
 * Routes: /en/... and /ar/... (see lib/site/i18n.ts).
 *
 * `lang` and `dir` are set on the wrapper below. The root <html> element is
 * owned by app/layout.tsx; for WCAG SC 3.1.1 it must also carry the page
 * language: read the `x-site-locale` request header (set by proxy.ts) there and
 * render <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/config";
import { getDict } from "@/lib/site/dict";
import { dirOf, fmt, href, isLocale, LOCALES } from "@/lib/site/i18n";
import { LanguageSwitch, SiteNav } from "../_components/SiteNav";
import "../site.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale);
  return {
    title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
    description: t.meta.siteDescription,
    alternates: { languages: { en: "/en", ar: "/ar" } },
  };
}

export default async function SiteLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const other = t.common.language.switchToLang === "ar" ? "ar" : "en";

  return (
    <div className="site" lang={locale} dir={dirOf(locale)}>
      <a className="skip-link" href="#main">
        {t.common.skipLink}
      </a>
      <header className="site-header">
        <div className="wrap">
          <Link className="brand" href={href(locale)}>
            {APP_NAME}
          </Link>
          <SiteNav
            label={t.common.navLabel}
            items={[
              { href: href(locale, "pricing"), label: t.common.nav.pricing },
              { href: href(locale, "account"), label: t.common.nav.account },
              { href: href(locale, "takedown"), label: t.common.nav.takedown },
            ]}
          />
          <LanguageSwitch to={other} label={t.common.language.label} name={t.common.language.switchTo} />
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <div className="wrap">{children}</div>
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <p>{fmt(t.common.footer.note)}</p>
          <nav aria-label={t.common.footerLabel}>
            <ul className="nav-list">
              <li>
                <Link href={href(locale, "terms")}>{t.common.footer.terms}</Link>
              </li>
              <li>
                <Link href={href(locale, "privacy")}>{t.common.footer.privacy}</Link>
              </li>
              <li>
                <Link href={href(locale, "takedown")}>{t.common.footer.takedown}</Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
