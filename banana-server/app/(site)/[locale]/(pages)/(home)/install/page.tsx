/**
 * /en/install and /ar/install loaded directly (or refreshed): the Add to Claude window over the
 * home page, which renders behind it (the landing is this route's layout). Opened from a link on a
 * site page, the same URL is intercepted (@modal/(.)install) and the window opens over that page.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/site/dict";
import { isLocale } from "@/lib/site/i18n";
import { InstallWindow } from "./InstallWindow";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).install.title } : {};
}

export default async function InstallPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <InstallWindow locale={locale} mode="home" />;
}
