/**
 * /en/board/:key opened from an example card (a client navigation, Next intercepting routes): the
 * board opens as a window over that page, growing out of the card, with the page blurred behind.
 * Close, Escape and Back return to that page. A direct load or a refresh renders
 * (pages)/(home)/board/[key]/page.tsx instead: the same window over the home page.
 */
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/site/i18n";
import { BoardWindow } from "../../../(pages)/(home)/board/[key]/BoardWindow";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; key: string }> };

export default async function BoardOverlay({ params }: Props) {
  const { locale, key } = await params;
  if (!isLocale(locale)) notFound();
  return <BoardWindow locale={locale} exampleKey={key} mode="overlay" />;
}
