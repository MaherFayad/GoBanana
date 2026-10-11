"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { switchLocalePath, type Locale } from "@/lib/site/i18n";

type NavItem = { href: string; label: string };

/** Main navigation; marks the current page with aria-current. */
export function SiteNav({ label, items }: { label: string; items: NavItem[] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label={label}>
      <ul className="nav-list">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Link to the same page in the other language. */
export function LanguageSwitch({ to, label, name }: { to: Locale; label: string; name: string }) {
  const pathname = usePathname() ?? `/${to}`;
  return (
    <p>
      <span className="visually-hidden">{label}: </span>
      <a href={switchLocalePath(pathname, to)} hrefLang={to} lang={to}>
        {name}
      </a>
    </p>
  );
}
