/**
 * Public pages (landing, canvases, account, pricing, takedown, terms, privacy): header, main and footer.
 * The header (the desktop menu bar) shows "Your canvases" when someone is signed in, else
 * "Sign in". The dock sits at the bottom of every public page.
 */
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getDict } from "@/lib/site/dict";
import { isLocale } from "@/lib/site/i18n";
import { isSignedIn } from "@/lib/site/session";
import { AnchorScroll } from "../../_components/AnchorScroll";
import { Dock } from "../../_components/desktop/Dock";
import { GpuProbe } from "../../_components/GpuProbe";
import { SiteFooter, SiteHeader } from "../../_components/SiteChrome";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export default async function PagesLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const signedIn = await isSignedIn();

  return (
    <>
      <SiteHeader locale={locale} t={t} signedIn={signedIn} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter locale={locale} t={t} />
      <Dock locale={locale} t={t} />
      <AnchorScroll />
      <GpuProbe />
    </>
  );
}
