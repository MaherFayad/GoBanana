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
import { MenuBarMenu } from "./desktop/MenuBarMenu";
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
  const nav = [
    { href: `${href(locale)}#how`, label: c.nav.how },
    { href: href(locale, "gallery"), label: c.nav.gallery },
    { href: docsHref(locale), label: c.nav.docs },
    { href: href(locale, "pricing"), label: c.nav.pricing },
  ];
  const signInHref = `${SIGN_IN_PATH}?returnTo=${encodeURIComponent(canvases)}`;
  return (
    <header className="site-header menubar">
      <div className="menubar-start">
        <Brand locale={locale} withName />
        <SiteNav label={c.navLabel} items={nav} />
      </div>
      <div className="menubar-end">
        <span className="menubar-wide">
          <LanguageSwitch to={other} label={c.language.label} name={c.language.switchTo} />
        </span>
        <MenuClock locale={locale} />
        {signedIn ? (
          <Link className="menubar-link menubar-wide" href={canvases}>
            {c.yourCanvases}
          </Link>
        ) : (
          <a className="menubar-link menubar-wide" href={signInHref}>
            {c.signIn}
          </a>
        )}
        {/* Narrow screens: the nav, "Your canvases" and the language fold into one menu. */}
        <MenuBarMenu
          className="menubar-narrow"
          label={c.menu}
          trigger={c.menu}
          items={[
            ...nav.map((n) => ({ kind: "link" as const, ...n })),
            { kind: "sep" as const },
            signedIn
              ? { kind: "link" as const, href: canvases, label: c.yourCanvases }
              : { kind: "link" as const, href: signInHref, label: c.signIn },
            { kind: "sep" as const },
            { kind: "lang" as const, to: other, label: c.language.label, name: c.language.switchTo, hint: other.toUpperCase() },
          ]}
        />
        <Link className="menubar-pill" href={href(locale, "install")}>
          <RollLabel>{c.addToClaude}</RollLabel>
        </Link>
      </div>
    </header>
  );
}

/**
 * The footer, the same on every page as on the landing page (its section 10): the Bend mark tile
 * and the name, the year, the source note and the language switch, then the link columns. A solid
 * desk-black band that runs to the bottom of the page, with room under it for the fixed dock
 * (desktop.css), so no lighter strip shows below it.
 */
export function SiteFooter({ locale, t }: { locale: Locale; t: Dict }) {
  const f = t.common.footer;
  const c = t.common;
  const home = href(locale);
  const other: Locale = c.language.switchToLang === "ar" ? "ar" : "en";
  const columns = [
    {
      title: f.product,
      links: [
        { href: `${home}#how`, label: f.howItWorks },
        { href: href(locale, "gallery"), label: f.gallery },
        { href: href(locale, "pricing"), label: f.pricing },
        { href: href(locale, "canvases"), label: f.canvases },
      ],
    },
    {
      title: f.help,
      links: [
        { href: docsHref(locale), label: f.docs },
        { href: docsHref(locale, "setup/overview/"), label: f.setup },
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
      <div className="sf-brand">
        <Link className="sf-logo" href={home} dir="ltr">
          <span className="sf-tile" aria-hidden="true">
            <BrandMark />
          </span>
          <span className="sf-name">{APP_NAME}</span>
        </Link>
        {/* Latin in both languages: isolated inline, so the line still sits at the page's start. */}
        <p>
          <bdi dir="ltr">{fmt(f.rights, { year: new Date().getUTCFullYear() })}</bdi>
        </p>
        <p className="sf-note">{bt(f.note)}</p>
        <LanguageSwitch to={other} label={c.language.label} name={c.language.switchTo} />
      </div>
      <nav className="sf-columns" aria-label={c.footerLabel}>
        {columns.map((col) => (
          <div key={col.title} className="sf-col">
            <h2 className="sf-title">{col.title}</h2>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("/docs/") ? <a href={l.href}>{l.label}</a> : <Link href={l.href}>{l.label}</Link>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </footer>
  );
}
