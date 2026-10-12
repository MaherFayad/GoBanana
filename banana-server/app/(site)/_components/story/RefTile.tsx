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
  /** False on a preview that opens something else as a whole (a home page card): a picture with its source chip, no link. */
  link?: boolean;
};

export function RefTile({ r, name, labels, eager = false, steal = false, lang, link = true }: Props) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;
  const Box = link ? "a" : "span";
  const boxProps = link ? { href: r.href, target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <li className="ex-tile">
      <Box className="ex-tile-link" {...boxProps}>
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
        <span className="ex-chip" aria-hidden={link ? true : undefined} dir="ltr">
          {link ? <ExternalIcon size={12} /> : null}
          {r.site}
        </span>
        {link ? (
          <span className="st-visually-hidden">
            {name} ({labels.newTab})
          </span>
        ) : null}
      </Box>
      {steal && r.steal ? (
        <p className="ex-steal">
          <span className="ex-steal-k">{labels.steal}</span> <span lang={lang} dir="auto">{r.steal}</span>
        </p>
      ) : null}
    </li>
  );
}
