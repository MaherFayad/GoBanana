/**
 * A real example board (lib/site/examples.json): the brief and its settings, the direction with
 * its visual spec, the art direction row (the wild idea as images) above the UI references, each
 * with its source chip and a steal note, as the canvas lays a direction section out
 * (docs/wild-directions-v2-spec.md). Server rendered; only the tiles are client components (they
 * hide themselves when an image fails).
 *
 * Engine text (brief, titles, spec lines) is English; on the Arabic page it carries lang="en" and
 * dir="auto" so it reads left to right inside the mirrored layout.
 */
import type { Dict } from "@/lib/site/dict";
import type { Example, ExampleRef } from "@/lib/site/examples";
import { fmt, type Locale } from "@/lib/site/i18n";
import { RefTile } from "./RefTile";

type T = Dict["landing"]["examples"];

const SPEC_KEYS = ["signature", "typography", "color", "layout", "texture", "motion"] as const;
/** The home page board keeps the spec short. */
const SPEC_SHORT = ["signature", "typography", "color", "layout"] as const;

export function exampleTitle(ex: Example): string {
  return ex.direction.title;
}

/** Brief settings as one line of chips: platform, wildness, lens. */
export function ExampleMeta({ ex, t, locale }: { ex: Example; t: T; locale: Locale }) {
  return (
    <ul className="ex-meta">
      <li className="ex-pill">{t.platforms[ex.platform]}</li>
      <li className="ex-pill">{fmt(t.wildness, { n: ex.wildness })}</li>
      {ex.lens ? <li className="ex-pill">{fmt(t.lens, { name: locale === "ar" ? ex.lens.ar : ex.lens.en })}</li> : null}
    </ul>
  );
}

export function RefList({
  refs,
  t,
  en,
  className,
  steal = true,
  eager = 0,
  limit,
}: {
  refs: readonly ExampleRef[];
  t: T;
  en: string | undefined;
  className: string;
  steal?: boolean;
  /** How many of the first tiles load eagerly. */
  eager?: number;
  limit?: number;
}) {
  const shown = limit ? refs.slice(0, limit) : refs;
  return (
    <ul className={className}>
      {shown.map((r, i) => (
        <RefTile
          key={r.href}
          r={r}
          name={fmt(t.openWork, { title: r.creator ? `${r.title} (${r.creator})` : r.title, site: r.site })}
          labels={{ newTab: t.newTab, steal: t.steal }}
          steal={steal}
          eager={i < eager}
          lang={en}
        />
      ))}
    </ul>
  );
}

type Props = {
  ex: Example;
  t: T;
  locale: Locale;
  /** Heading level of the direction title. */
  level?: "h2" | "h3";
  /** Tiles that load eagerly (the featured board on screen first). */
  eager?: number;
  /** Show the other directions of the same bend and the full spec (gallery). */
  others?: boolean;
  idPrefix: string;
};

export function ExampleBoard({ ex, t, locale, level: H = "h3", eager = 0, others = false, idPrefix }: Props) {
  const en = locale === "ar" ? "en" : undefined;
  const d = ex.direction;
  const titleId = `${idPrefix}-title`;
  const Z = H === "h2" ? "h3" : "h4";
  return (
    <div className="ex-board" role="group" aria-labelledby={titleId} data-platform={ex.platform}>
      <div className="ex-side">
        <p className="ex-brief">
          <span className="ex-k">{t.brief}</span>
          <span className="ex-en" lang={en} dir="auto">
            {ex.brief}
          </span>
        </p>
        <ExampleMeta ex={ex} t={t} locale={locale} />
        <div className="ex-direction">
          <p className="ex-k">{t.direction}</p>
          <H id={titleId} className="ex-title ex-en" lang={en} dir="auto">
            {d.title}
          </H>
          {d.twist ? (
            <p className="ex-twist">
              <span className="ex-k">{t.twist}</span>{" "}
              <span className="ex-en" lang={en} dir="auto">
                {d.twist}
              </span>
            </p>
          ) : null}
          <dl className="ex-spec">
            {(others ? SPEC_KEYS : SPEC_SHORT).map((k) => (
              <div key={k}>
                <dt>{t.spec[k]}</dt>
                <dd className="ex-en" lang={en} dir="auto">
                  {d.spec[k]}
                </dd>
              </div>
            ))}
            {others ? (
              <div>
                <dt>{t.avoid}</dt>
                <dd className="ex-en" lang={en} dir="auto">
                  {d.spec.avoid.join(" ")}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        {others && ex.others.length > 0 ? (
          <div className="ex-others">
            <p className="ex-k">{t.others}</p>
            <ul>
              {ex.others.map((o) => (
                <li key={o.id} className="ex-en" lang={en} dir="auto">
                  {o.title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="ex-main">
        {ex.art.length > 0 ? (
          <section className="ex-zone" aria-labelledby={`${idPrefix}-art`}>
            <Z className="ex-zone-title" id={`${idPrefix}-art`}>
              {t.art} <span className="ex-count">{ex.art.length}</span>
            </Z>
            <RefList refs={ex.art} t={t} en={en} className="ex-grid is-art" eager={eager} />
          </section>
        ) : null}
        {ex.ui.length > 0 ? (
          <section className="ex-zone" aria-labelledby={`${idPrefix}-ui`}>
            <Z className="ex-zone-title" id={`${idPrefix}-ui`}>
              {t.ui} <span className="ex-count">{ex.ui.length}</span>
            </Z>
            <RefList refs={ex.ui} t={t} en={en} className="ex-grid is-ui" eager={eager} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
