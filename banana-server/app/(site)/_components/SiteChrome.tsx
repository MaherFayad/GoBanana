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
import { docsHref } from "./desktop/Dock";
import { MenuClock } from "./desktop/MenuClock";
import { RollLabel } from "./desktop/RollButton";
import { LanguageSwitch, SiteNav } from "./SiteNav";
import "./desktop/desktop.css";

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

/**
 * The menu bar of the GoBanana desktop (docs/site-redesign-spec.md): the Bend mark and the nav at
 * the start; the language switch, a live clock, Sign in and the "Add to Claude" pill at the end.
 * Sticky at the top as one slim glass bar (html gets scroll-padding for it in desktop.css, so it
 * never hides a focused element, SC 2.4.11). Under 768px the nav moves to the dock.
 */
export function SiteHeader({ locale, t, signedIn }: { locale: Locale; t: Dict; signedIn: boolean }) {
  const c = t.common;
  const other: Locale = c.language.switchToLang === "ar" ? "ar" : "en";
  const canvases = href(locale, "canvases");
  return (
    <header className="site-header menubar">
      <div className="menubar-start">
        <Brand locale={locale} />
        <SiteNav
          label={c.navLabel}
          items={[
            { href: `${href(locale)}#how`, label: c.nav.how },
            { href: `${href(locale)}#gallery`, label: c.nav.gallery },
            { href: docsHref(locale), label: c.nav.docs },
            { href: href(locale, "pricing"), label: c.nav.pricing },
          ]}
        />
      </div>
      <div className="menubar-end">
        <LanguageSwitch to={other} label={c.language.label} name={c.language.switchTo} />
        <MenuClock locale={locale} />
        {signedIn ? (
          <Link className="menubar-link" href={canvases}>
            {c.yourCanvases}
          </Link>
        ) : (
          <a className="menubar-link" href={`${SIGN_IN_PATH}?returnTo=${encodeURIComponent(canvases)}`}>
            {c.signIn}
          </a>
        )}
        <a className="menubar-pill" href={`${href(locale)}#install`}>
          <RollLabel>{c.addToClaude}</RollLabel>
        </a>
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
        { href: docsHref(locale), label: f.docs },
        { href: docsHref(locale, "start/install/"), label: f.setup },
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
                    <li key={l.label}>
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
