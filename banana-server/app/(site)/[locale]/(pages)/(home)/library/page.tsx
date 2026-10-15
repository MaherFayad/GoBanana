/**
 * /en/library and /ar/library loaded directly (or refreshed): the swipe file window
 * (LibraryWindow.tsx) over the home page, like /account. Parts and great references the user saved
 * across boards (VAL-09): links, roles and crops only. Filters are a plain GET form (role, words,
 * card id), so everything works without JavaScript.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WindowLayer } from "@/components/window/WindowLayer";
import { getDict } from "@/lib/site/dict";
import { href, isLocale } from "@/lib/site/i18n";
import { LibraryWindow } from "./LibraryWindow";
import { libraryLights } from "./lights";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).library.title, robots: { index: false } } : {};
}

export default async function LibraryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  return (
    <WindowLayer mode="home" kind="settings" label={dict.library.windowTitle} closeHref={href(locale)} escapeCloses>
      <LibraryWindow locale={locale} lights={libraryLights(locale)} query={await searchParams} />
    </WindowLayer>
  );
}
