/**
 * Gallery: /en/gallery and /ar/gallery. Every real example (lib/site/examples.json) as a full
 * board: the brief and its settings, the direction with its visual spec and the other directions
 * of the same bend, the art direction row above the UI references (each with its source link and
 * a steal note), and the Frankenstein page when the example has one.
 *
 * Filter by platform with plain links (`?platform=mobile`), so it works without JavaScript; the
 * current filter carries aria-current. Every board is in the page and CSS hides the others, so
 * with JavaScript a click filters at once (GalleryFilter). The examples go through the takedown list per request
 * (fail closed: no images), like the home page.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { GalleryFilter } from "./GalleryFilter";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/site/dict";
import { EXAMPLE_PLATFORMS, EXAMPLES_FILE, featuredFirst, isExamplePlatform, slug } from "@/lib/site/examples";
import { visibleExamples } from "@/lib/site/examples-load";
import { fmt, href, isLocale, type Locale } from "@/lib/site/i18n";
import { bidi } from "../../../_components/Bidi";
import { TwoToneHeading } from "../../../_components/desktop/TwoToneHeading";
import { Window } from "../../../_components/desktop/Window";
import { ExampleBoard } from "../../../_components/story/ExampleBoard";
import { StitchView } from "../../../_components/story/StitchView";
import "../../../_components/story/examples.css";
import "./gallery.css";

// Per request: the examples go through the takedown list on every render (hard rule 5).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).landing.examples.gallery.title } : {};
}

export default async function GalleryPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDict(locale);
  const x = dict.landing.examples;
  const g = x.gallery;
  const d = dict.landing.desk;
  const q = (await searchParams).platform;
  const platform = isExamplePlatform(q) ? q : null;

  const { examples, images } = await visibleExamples();
  const list = featuredFirst(examples);
  const en = locale === "ar" ? "en" : undefined;
  const base = href(locale, "gallery");
  const filters = [
    { key: null, label: g.all, href: base, count: list.length },
    ...EXAMPLE_PLATFORMS.map((p) => ({ key: p, label: x.platforms[p], href: `${base}?platform=${p}`, count: list.filter((ex) => ex.platform === p).length })),
  ].filter((f) => f.count > 0);
  const stitchLabels = { modes: x.modes, modesLabel: x.modesLabel, pagesLabel: x.pagesLabel, roles: x.roles, slot: x.slot, parts: x.parts, newTab: x.newTab };

  return (
    <div className="gx" data-filter={platform ?? undefined}>
      <header className="gx-head">
        <TwoToneHeading as="h1" className="gx-title" dim={bidi(g.dim)} bright={bidi(g.bright)} />
        <p className="gx-lead">{bidi(g.lead)}</p>
        <p className="gx-made">{images ? fmt(x.made, { date: EXAMPLES_FILE.generatedAt, n: EXAMPLES_FILE.serperRequests }) : x.noImages}</p>
      </header>

      <GalleryFilter label={g.filter} filters={filters} initial={platform} countLabel={g.count} />

      <ol className="gx-list">
        {list.map((ex) => (
          <li key={ex.key} id={ex.key} className="gx-item" data-platform={ex.platform}>
            <Window as="article" title={`${slug(ex.brief)}.board`} titleNode={<bdi dir="ltr">{`${slug(ex.brief)}.board`}</bdi>} className="is-example gx-window" labels={d.window}>
              <ExampleBoard ex={ex} t={x} locale={locale} level="h2" idPrefix={`gx-${ex.key}`} others />
              {ex.stitch ? (
                <div className="gx-stitch">
                  <StitchView items={[{ key: ex.key, stitch: ex.stitch }]} labels={stitchLabels} en={en} />
                </div>
              ) : null}
            </Window>
          </li>
        ))}
      </ol>

      {images ? (
        <p className="gx-notice">
          {dict.landing.showcase.notice} <Link href={href(locale, "takedown")}>{dict.landing.showcase.noticeLink}</Link>
        </p>
      ) : null}
    </div>
  );
}
