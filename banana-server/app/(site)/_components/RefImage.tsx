"use client";

/**
 * A showcase reference image, hotlinked from its source CDN (hard rule 2: never re-hosted, never
 * through the Next image optimizer) with no referrer. When the image does not load, the slot shows
 * GoBanana's own generative art instead (TileArt), so a tile never turns into a hole.
 *
 * A failure before hydration fires no React onError, so the mount effect also checks for an image
 * that already finished without pixels.
 */
import { useEffect, useRef, useState } from "react";
import type { ArtKind } from "@/lib/site/moves";
import { TileArt } from "./TileArt";

type Props = {
  src: string;
  /** The work's title; "" when a caption next to it already names the work. */
  alt: string;
  /** Language of the alt text (source titles are English). */
  lang?: string;
  /** Fallback art and its SVG id prefix. */
  art: ArtKind;
  uid: string;
  /** Load now (the first tiles on screen); others load lazily. */
  eager?: boolean;
  className?: string;
};

export function RefImage({ src, alt, lang, art, uid, eager = false, className }: Props) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    // Checked once on mount: an image that already failed before hydration fired no onError.
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return <TileArt kind={art} uid={uid} className={className ? `ref-fallback ${className}` : "ref-fallback"} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- third-party image hotlinked from its source on purpose (hard rule 2)
    <img
      ref={ref}
      className={className ? `ref-img ${className}` : "ref-img"}
      src={src}
      alt={alt}
      lang={alt ? lang : undefined}
      referrerPolicy="no-referrer"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
