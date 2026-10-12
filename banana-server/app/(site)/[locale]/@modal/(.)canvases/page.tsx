/**
 * /en/canvases opened from a site page (a client navigation, Next intercepting routes): the
 * canvases dashboard opens as a Finder window over that page, growing out of the link or dock
 * icon that opened it, with the page blurred behind. Close, Escape and Back return to that page;
 * yellow minimizes it into the dock. A direct load or a refresh renders
 * (pages)/(home)/canvases/page.tsx instead: the same window over the home page.
 */
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/site/i18n";
import { CanvasesWindow } from "../../(pages)/(home)/canvases/CanvasesWindow";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function CanvasesOverlay({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <CanvasesWindow locale={locale} mode="overlay" />;
}
