/**
 * A real example as a card for the home page row ("Made with"): art direction thumbnails over
 * UI reference thumbnails (each a link to its source), the brief and its settings, the direction
 * and a link to the full board on the gallery page.
 */
import Link from "next/link";
import { ArrowEndIcon } from "@/components/studio/icons";
import type { Dict } from "@/lib/site/dict";
import type { Example } from "@/lib/site/examples";
import type { Locale } from "@/lib/site/i18n";
import { ExampleMeta, RefList } from "./ExampleBoard";

type Props = { ex: Example; t: Dict["landing"]["examples"]; locale: Locale; boardHref: string };

export function ExampleCard({ ex, t, locale, boardHref }: Props) {
  const en = locale === "ar" ? "en" : undefined;
  const id = `card-${ex.key}`;
  return (
    <article className="ex-card" aria-labelledby={id}>
      <div className="ex-card-media">
        {ex.art.length > 0 ? <RefList refs={ex.art} t={t} en={en} className="ex-card-art" steal={false} limit={3} /> : null}
        {ex.ui.length > 0 ? <RefList refs={ex.ui} t={t} en={en} className="ex-card-ui" steal={false} limit={4} /> : null}
      </div>
      <div className="ex-card-body">
        <ExampleMeta ex={ex} t={t} locale={locale} />
        <h3 id={id} className="ex-card-title ex-en" lang={en} dir="auto">
          {ex.direction.title}
        </h3>
        <p className="ex-brief">
          <span className="ex-k">{t.brief}</span>
          <span className="ex-en" lang={en} dir="auto">
            {ex.brief}
          </span>
        </p>
        <Link className="ex-more" href={boardHref}>
          {t.openBoard}
          <ArrowEndIcon size={16} />
        </Link>
      </div>
    </article>
  );
}
