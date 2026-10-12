/**
 * One real example board (lib/site/examples.json) as a window (components/window/WindowLayer,
 * kind "finder"): the brief, the direction and its spec, the art direction and UI references
 * (each links to its source) and the Frankenstein page when the example has one. Shared by the
 * direct route (page.tsx: the window over the home page) and the intercepted one
 * (@modal/(.)board/[key]: the window over the page whose card opened it, growing out of the card).
 *
 * The examples go through the takedown list per request (fail closed: no images), like the
 * gallery. An unknown key is a 404.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { WindowLayer } from "@/components/window/WindowLayer";
import { getDict } from "@/lib/site/dict";
import { slug } from "@/lib/site/examples";
import { visibleExamples } from "@/lib/site/examples-load";
import { href, type Locale } from "@/lib/site/i18n";
import { FrameLights } from "../../../../../_components/desktop/FrameLights";
import { Window } from "../../../../../_components/desktop/Window";
import { ExampleBoard } from "../../../../../_components/story/ExampleBoard";
import { StitchView } from "../../../../../_components/story/StitchView";
import "../../../../../_components/story/examples.css";
import "./board.css";

export async function BoardWindow({ locale, exampleKey, mode }: { locale: Locale; exampleKey: string; mode: "overlay" | "home" }) {
  const dict = getDict(locale);
  const x = dict.landing.examples;
  const w = dict.landing.desk.window;
  const { examples, images } = await visibleExamples();
  const ex = examples.find((e) => e.key === exampleKey);
  if (!ex) notFound();

  const en = locale === "ar" ? "en" : undefined;
  const title = `${slug(ex.brief)}.board`;
  const stitchLabels = { modes: x.modes, modesLabel: x.modesLabel, pagesLabel: x.pagesLabel, roles: x.roles, slot: x.slot, parts: x.parts, newTab: x.newTab };

  return (
    <WindowLayer mode={mode} kind="finder" label={ex.direction.title} closeHref={href(locale)} origin={`[data-board="${ex.key}"]`} escapeCloses>
      <Window
        as="div"
        title={title}
        titleNode={<bdi dir="ltr">{title}</bdi>}
        className="is-example board-window"
        bodyClassName="board-window-body"
        lights={<FrameLights title={title} labels={{ close: w.close, minimise: w.minimise, zoom: w.zoom }} />}
      >
        <ExampleBoard ex={ex} t={x} locale={locale} level="h2" idPrefix={`bw-${ex.key}`} eager={6} others />
        {ex.stitch ? (
          <div className="board-window-stitch">
            <StitchView items={[{ key: ex.key, stitch: ex.stitch }]} labels={stitchLabels} en={en} />
          </div>
        ) : null}
        <p className="board-window-foot">
          {images ? <span>{dict.landing.showcase.notice} </span> : <span>{x.noImages} </span>}
          <Link href={href(locale, "gallery")}>{x.all}</Link>
        </p>
      </Window>
    </WindowLayer>
  );
}
