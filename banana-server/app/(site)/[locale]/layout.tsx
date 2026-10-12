/**
 * Site shell for /en/... and /ar/...: the `.site` wrapper (Studio tokens, fonts through :lang),
 * the skip link and one toast stack. The public pages add the header and footer in
 * (pages)/layout.tsx. The canvases dashboard and account settings are windows over the landing
 * ((pages)/(home)) or over the page that opened them (@modal).
 * Routes: see lib/site/i18n.ts.
 *
 * `lang` and `dir` are set on the wrapper below and on <html> by app/layout.tsx (from the
 * `x-site-locale` header that proxy.ts sets), so SC 3.1.1 holds and the tokens switch the Arabic
 * font through :lang(ar).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ToastViewport } from "@/components/studio/Toast";
import { APP_NAME } from "@/lib/config";
import { getDict } from "@/lib/site/dict";
import { dirOf, isLocale, LOCALES } from "@/lib/site/i18n";
import "../site.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/** `modal`: the window slot (@modal). The canvas and account settings open there, over the page. */
type Props = { children: ReactNode; modal: ReactNode; params: Promise<{ locale: string }> };

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

export default async function SiteLayout({ children, modal, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);

  return (
    <div className="site" lang={locale} dir={dirOf(locale)}>
      <a className="skip-link" href="#main">
        {t.common.skipLink}
      </a>
      {children}
      {modal}
      <ToastViewport labels={t.common.toast} />
    </div>
  );
}
