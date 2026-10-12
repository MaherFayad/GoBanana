/**
 * /en/board/:key loaded directly (or refreshed): one example board as a window over the home page,
 * which renders behind it, blurred and inert (the landing is this route's layout). Close, Escape
 * and minimize go to the home page. Opened from a card on a site page, the same URL is
 * intercepted (@modal/(.)board/[key]) and the window grows out of that card.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EXAMPLES } from "@/lib/site/examples";
import { isLocale } from "@/lib/site/i18n";
import { BoardWindow } from "./BoardWindow";

// Per request: the examples go through the takedown list on every render (hard rule 5).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const ex = EXAMPLES.find((e) => e.key === key);
  return ex ? { title: ex.direction.title } : {};
}

export default async function BoardPage({ params }: Props) {
  const { locale, key } = await params;
  if (!isLocale(locale)) notFound();
  return <BoardWindow locale={locale} exampleKey={key} mode="home" />;
}
