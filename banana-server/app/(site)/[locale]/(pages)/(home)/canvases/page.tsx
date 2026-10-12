/**
 * Canvases dashboard loaded directly (or refreshed): /en/canvases and /ar/canvases. The Finder
 * window (CanvasesWindow.tsx) sits over the home page, which renders behind it, blurred and inert
 * (the landing is this route's layout, so it is not drawn twice and stays put when the window
 * closes to /en). The window opens in CSS on first paint. Opened from a site page, the same URL
 * is intercepted (@modal/(.)canvases) and the window grows out of the link that opened it.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/site/dict";
import { isLocale } from "@/lib/site/i18n";
import { CanvasesWindow } from "./CanvasesWindow";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).dashboard.title, robots: { index: false, follow: false } } : {};
}

export default async function CanvasesPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <CanvasesWindow locale={locale} mode="home" />;
}
