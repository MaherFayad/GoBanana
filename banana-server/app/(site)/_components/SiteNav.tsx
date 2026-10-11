"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { switchLocalePath, type Locale } from "@/lib/site/i18n";

type NavItem = { href: string; label: string; badge?: string };

/**
 * Main navigation. Links are 44px ghost items; the current page gets Studio's Tabs active
 * treatment (brighter, weight 600) and aria-current="page", so the state is not color alone.
 * A badge ("Beta") is a small chip inside the link, so it is part of the link's name.
 */
export function SiteNav({ label, items }: { label: string; items: NavItem[] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label={label} className="site-nav">
      <ul className="nav-list">
        {items.map((item) => (
          <li key={item.href}>
            {/* The docs are a separate static app: a plain link keeps its trailing slash and skips the router. */}
            {item.href.startsWith("/docs/") ? (
              <a className="nav-link" href={item.href}>
                {item.label}
              </a>
            ) : (
              <Link className="nav-link" href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
                {item.label}
                {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Link to the same page in the other language, as a ghost sm button-link. */
export function LanguageSwitch({ to, label, name }: { to: Locale; label: string; name: string }) {
  const pathname = usePathname() ?? `/${to}`;
  return (
    <a
      className="st-btn lang-switch"
      data-variant="ghost"
      data-size="sm"
      href={switchLocalePath(pathname, to)}
      hrefLang={to}
      lang={to}
      dir={to === "ar" ? "rtl" : "ltr"}
    >
      <span className="st-visually-hidden" lang={to === "ar" ? "en" : "ar"}>
        {label}:{" "}
      </span>
      {name}
    </a>
  );
}
