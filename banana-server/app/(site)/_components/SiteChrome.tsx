/**
 * Site header and footer, shared by the public pages ((pages)/layout.tsx) and the 404 page.
 *
 * Structure after pryzm.design (logo at the start, nav links with one "Beta" chip, two compact
 * buttons at the end; a footer with a brand blurb, link columns and a fine print row), in the
 * Studio skin: --st-bg-body, the Bend mark, ghost nav items, the yellow primary button.
 * The header is never sticky, so it can not cover a focused element (SC 2.4.11). On the landing
 * page it sits over the hero field (site.css, `.site:has(.hero)`).
 */
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { APP_NAME } from "@/lib/config";
import type { Dict } from "@/lib/site/dict";
import { fmt, href, type Locale } from "@/lib/site/i18n";
import { SIGN_IN_PATH } from "@/lib/site/session";
import { bt } from "./Bidi";
import { LanguageSwitch, SiteNav } from "./SiteNav";

/**
 * The header shows the mark alone; the footer keeps the name next to it, the one place the
 * wordmark stays. The link's accessible name is the product name either way.
 */
export function Brand({ locale, className = "brand", withName = false }: { locale: Locale; className?: string; withName?: boolean }) {
  return (
    <Link className={className} href={href(locale)} dir="ltr" aria-label={withName ? undefined : APP_NAME}>
      <BrandMark />
      {withName ? <span className="brand-name">{APP_NAME}</span> : null}
    </Link>
  );
}

export function SiteHeader({ locale, t, signedIn }: { locale: Locale; t: Dict; signedIn: boolean }) {
  const c = t.common;
  const other: Locale = c.language.switchToLang === "ar" ? "ar" : "en";
  const canvases = href(locale, "canvases");
  return (
    <header className="site-header">
      <div className="wrap">
        <Brand locale={locale} />
        <SiteNav
          label={c.navLabel}
          items={[
            { href: `${href(locale)}#how`, label: c.nav.how },
            { href: `${href(locale)}#gallery`, label: c.nav.gallery },
            { href: canvases, label: c.nav.canvases, badge: c.beta },
            { href: href(locale, "pricing"), label: c.nav.pricing },
          ]}
        />
        <div className="header-actions">
          <LanguageSwitch to={other} label={c.language.label} name={c.language.switchTo} />
          <a className="st-btn" data-variant="primary" data-size="sm" href={`${href(locale)}#install`}>
            {c.addToClaude}
          </a>
          {signedIn ? (
            <Link className="st-btn" data-variant="secondary" data-size="sm" href={canvases}>
              {c.yourCanvases}
            </Link>
          ) : (
            <a
              className="st-btn"
              data-variant="secondary"
              data-size="sm"
              href={`${SIGN_IN_PATH}?returnTo=${encodeURIComponent(canvases)}`}
            >
              {c.signIn}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ locale, t }: { locale: Locale; t: Dict }) {
  const f = t.common.footer;
  const home = href(locale);
  const columns = [
    {
      title: f.product,
      links: [
        { href: `${home}#how`, label: f.howItWorks },
        { href: `${home}#gallery`, label: f.gallery },
        { href: href(locale, "pricing"), label: f.pricing },
        { href: href(locale, "canvases"), label: f.canvases },
      ],
    },
    {
      title: f.help,
      links: [
        { href: `${home}#install`, label: f.setup },
        { href: href(locale, "account"), label: f.account },
        { href: href(locale, "takedown"), label: f.takedown },
      ],
    },
    {
      title: f.legal,
      links: [
        { href: href(locale, "terms"), label: f.terms },
        { href: href(locale, "privacy"), label: f.privacy },
      ],
    },
  ];
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-top">
          <div className="footer-brand">
            <Brand locale={locale} className="footer-logo" withName />
            <p>{bt(f.blurb)}</p>
          </div>
          <nav className="footer-columns" aria-label={t.common.footerLabel}>
            {columns.map((col) => (
              <div key={col.title} className="footer-col">
                <h2 className="footer-title">{col.title}</h2>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href}>{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="footer-fine">
          <p>{bt(f.note)}</p>
          {/* Latin in both languages: isolated inline, so the line still sits at the page's start. */}
          <p>
            <bdi dir="ltr">{fmt(f.rights, { year: new Date().getUTCFullYear() })}</bdi>
          </p>
        </div>
      </div>
    </footer>
  );
}
