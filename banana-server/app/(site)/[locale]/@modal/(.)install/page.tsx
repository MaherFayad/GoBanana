/**
 * /en/install opened from a site page (a client navigation, Next intercepting routes): the Add to
 * Claude window opens over that page. A direct load renders (pages)/(home)/install/page.tsx.
 */
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/site/i18n";
import { InstallWindow } from "../../(pages)/(home)/install/InstallWindow";

type Props = { params: Promise<{ locale: string }> };

export default async function InstallOverlay({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <InstallWindow locale={locale} mode="overlay" />;
}
