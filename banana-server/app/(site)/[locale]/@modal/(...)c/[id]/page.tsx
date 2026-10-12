/**
 * /c/:id opened from a site page (a client navigation, Next intercepting routes): the canvas
 * window opens over that page, which stays behind it. A direct load or a refresh renders
 * app/c/[id]/page.tsx instead (the same window on the desk).
 */
import { href, isLocale } from "@/lib/site/i18n";
import { CanvasView } from "@/app/c/[id]/canvas-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function CanvasWindow({ params }: Props) {
  const { locale, id } = await params;
  return <CanvasView id={id} mode="overlay" dashboardHref={href(isLocale(locale) ? locale : "en", "canvases")} />;
}
