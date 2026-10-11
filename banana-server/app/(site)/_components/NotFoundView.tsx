/**
 * The 404 page, after pryzm.design's: one inset rounded panel with a big muted "404", a
 * headline, two short lines and two buttons. Studio skin, both languages.
 */
import Link from "next/link";
import { ArrowEndIcon } from "@/components/studio/icons";
import type { Dict } from "@/lib/site/dict";
import { href, type Locale } from "@/lib/site/i18n";

export function NotFoundView({ locale, t }: { locale: Locale; t: Dict["notFound"] }) {
  return (
    <div className="nf">
      <div className="nf-panel">
        <p className="nf-code" dir="ltr" aria-hidden="true">
          {t.code}
        </p>
        <h1 className="nf-title">{t.title}</h1>
        <p className="nf-body">
          {t.body}
          <br />
          {t.body2}
        </p>
        <div className="actions nf-actions">
          <Link className="st-btn" data-variant="primary" data-size="lg" href={href(locale, "canvases")}>
            {t.primary}
            <ArrowEndIcon size={16} />
          </Link>
          <Link className="st-btn" data-variant="secondary" data-size="lg" href={href(locale)}>
            {t.secondary}
          </Link>
        </div>
      </div>
    </div>
  );
}
