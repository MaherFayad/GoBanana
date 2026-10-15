/**
 * /en/library opened from a site page (a client navigation, Next intercepting routes): the swipe
 * file window opens over that page, which stays behind it, blurred. A direct load or a refresh
 * renders (pages)/(home)/library/page.tsx instead: the same window over the home page.
 */
import { notFound } from "next/navigation";
import { WindowLayer } from "@/components/window/WindowLayer";
import { getDict } from "@/lib/site/dict";
import { href, isLocale } from "@/lib/site/i18n";
import { LibraryWindow } from "../../(pages)/(home)/library/LibraryWindow";
import { libraryLights } from "../../(pages)/(home)/library/lights";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LibraryOverlay({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  return (
    <WindowLayer mode="overlay" kind="settings" label={dict.library.windowTitle} closeHref={href(locale)} escapeCloses>
      <LibraryWindow locale={locale} lights={libraryLights(locale)} query={await searchParams} />
    </WindowLayer>
  );
}
