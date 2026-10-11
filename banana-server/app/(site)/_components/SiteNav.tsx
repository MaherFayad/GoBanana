"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { switchLocalePath, type Locale } from "@/lib/site/i18n";

type NavItem = { href: string; label: string };

/**
 * Main navigation. Links are 44px ghost items; the current page gets Studio's Tabs active
 * treatment (2px underline, weight 600) and aria-current="page", so the state is not color alone.
 */
export function SiteNav({ label, items }: { label: string; items: NavItem[] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label={label} className="site-nav">
      <ul className="nav-list">
        {items.map((item) => (
          <li key={item.href}>
            <Link className="nav-link" href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Link to the same page in the other language, as a secondary sm button-link. */
export function LanguageSwitch({ to, label, name }: { to: Locale; label: string; name: string }) {
  const pathname = usePathname() ?? `/${to}`;
  return (
    <div className="lang-switch">
      <a
        className="st-btn"
        data-variant="secondary"
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
    </div>
  );
}
