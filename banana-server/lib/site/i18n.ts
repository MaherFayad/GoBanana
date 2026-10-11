/**
 * Site locales. Routes are `/{locale}/...` under `app/(site)/[locale]/`:
 * `/en`, `/ar`, `/en/pricing`, `/ar/pricing`, and so on. "/" belongs to app/page.tsx
 * and can redirect to `/en` or `/ar` (for example from Accept-Language).
 */
import { APP_NAME } from "@/lib/config";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Request header set by proxy.ts for /en/* and /ar/*, read by the root layout for `<html lang dir>`. */
export const LOCALE_HEADER = "x-site-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** `/ar/pricing` -> "ar"; anything else -> null. */
export function localeFromPath(pathname: string): Locale | null {
  const first = pathname.split("/")[1] ?? "";
  return isLocale(first) ? first : null;
}

/** Same page in another locale: `/en/pricing` -> `/ar/pricing`. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split("/");
  if (isLocale(parts[1])) {
    parts[1] = to;
    return parts.join("/") || `/${to}`;
  }
  return `/${to}`;
}

export function href(locale: Locale, path = ""): string {
  const clean = path.replace(/^\/+/, "");
  return clean ? `/${locale}/${clean}` : `/${locale}`;
}

/** Replaces `{app}` with APP_NAME and `{key}` with values. */
export function fmt(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (key === "app") return APP_NAME;
    const v = values[key];
    return v === undefined ? match : String(v);
  });
}
