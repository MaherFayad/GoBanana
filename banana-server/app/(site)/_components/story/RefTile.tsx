"use client";

/**
 * One reference on an example board: the image hotlinked from its source (hard rule 2, no
 * referrer, never through the Next image optimizer), a source chip, and the whole tile links to
 * the work on its site (hard rule 3). An optional steal note sits under it.
 *
 * The box has a fixed aspect ratio, so nothing moves when the image arrives (lazy unless `eager`).
 * When the image fails, the tile hides itself: no broken image icon, no hole in the grid. A
 * failure before hydration fires no React onError, so the mount effect checks for an image that
 * already finished without pixels.
 */
import { useEffect, useRef, useState } from "react";
import { ExternalIcon } from "@/components/studio/icons";
import type { ExampleRef } from "@/lib/site/examples";

export type RefTileLabels = { newTab: string; steal: string };

type Props = {
  r: ExampleRef;
  /** "{title}, on {site}" already filled. */
  name: string;
  labels: RefTileLabels;
  eager?: boolean;
  /** Show the steal note under the tile. */
  steal?: boolean;
  /** Language of the work's title (titles are English). */
  lang?: string;
};

export function RefTile({ r, name, labels, eager = false, steal = false, lang }: Props) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;
  return (
    <li className="ex-tile">
      <a className="ex-tile-link" href={r.href} target="_blank" rel="noopener noreferrer">
        <span className="ex-tile-img">
          {/* eslint-disable-next-line @next/next/no-img-element -- third-party image hotlinked from its source on purpose (hard rule 2) */}
          <img
            ref={img}
            src={r.src}
            alt=""
            referrerPolicy="no-referrer"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
          />
        </span>
        <span className="ex-chip" aria-hidden="true" dir="ltr">
          <ExternalIcon size={12} />
          {r.site}
        </span>
        <span className="st-visually-hidden">
          {name} ({labels.newTab})
        </span>
      </a>
      {steal && r.steal ? (
        <p className="ex-steal">
          <span className="ex-steal-k">{labels.steal}</span> <span lang={lang} dir="auto">{r.steal}</span>
        </p>
      ) : null}
    </li>
  );
}
