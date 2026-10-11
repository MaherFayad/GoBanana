/**
 * Generative tile art for the site: CSS gradients and inline SVG only, colors from the
 * --st-art-* tokens (styles/studio-tokens.css). No images, so nothing is downloaded or hosted.
 * Purely decorative (aria-hidden): the tile's name is always real text next to it.
 *
 * `uid` keeps SVG filter and pattern ids unique when a kind shows more than once on a page.
 */
import type { ReactNode } from "react";
import type { ArtKind } from "@/lib/site/moves";
import "./art.css";

function Svg({ children, viewBox = "0 0 100 100" }: { children: ReactNode; viewBox?: string }) {
  return (
    <svg className="art-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid slice" focusable="false" aria-hidden="true">
      {children}
    </svg>
  );
}

function Grain({ id }: { id: string }) {
  return (
    <Svg>
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect className="art-grain" width="100" height="100" filter={`url(#${id})`} />
    </Svg>
  );
}

/** A square Kufic spiral on a 9 by 9 grid, drawn as one stroke. */
const KUFIC = "M1.5 8.5 V1.5 H7.5 V7.5 H3.5 V3.5 H5.5 V5.5";

function Art({ kind, uid }: { kind: ArtKind; uid: string }) {
  switch (kind) {
    case "kufic":
      return (
        <Svg viewBox="0 0 9 9">
          <path className="art-kufic-path" d={KUFIC} />
        </Svg>
      );
    case "mashrabiya":
      return (
        <Svg>
          <defs>
            <pattern id={`${uid}-lattice`} width="20" height="20" patternUnits="userSpaceOnUse">
              <path className="art-lattice" d="M10 0 L20 10 L10 20 L0 10 Z" />
              <circle className="art-lattice" cx="10" cy="10" r="6" />
              <circle className="art-lattice" cx="0" cy="0" r="6" />
              <circle className="art-lattice" cx="20" cy="20" r="6" />
              <circle className="art-lattice" cx="20" cy="0" r="6" />
              <circle className="art-lattice" cx="0" cy="20" r="6" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill={`url(#${uid}-lattice)`} />
        </Svg>
      );
    case "grain":
    case "riso":
      return <Grain id={`${uid}-grain`} />;
    case "memphis":
      return (
        <Svg>
          <circle className="art-fill-sun" cx="28" cy="30" r="14" />
          <path className="art-fill-malachite" d="M58 70 L80 30 L96 72 Z" />
          <path className="art-stroke-ink" d="M8 78 q8 -10 16 0 t16 0 t16 0 t16 0" />
          <rect className="art-fill-blue" x="62" y="8" width="18" height="18" transform="rotate(18 71 17)" />
          <circle className="art-dot" cx="20" cy="56" r="2.2" />
          <circle className="art-dot" cx="30" cy="56" r="2.2" />
          <circle className="art-dot" cx="40" cy="56" r="2.2" />
        </Svg>
      );
    case "blueprint":
      return (
        <Svg>
          <path className="art-stroke-glint" d="M20 88 V48 A30 30 0 0 1 80 48 V88" />
          <path className="art-stroke-glint" d="M32 88 V52 A18 18 0 0 1 68 52 V88" />
          <path className="art-stroke-line" d="M8 88 H92 M50 10 V92" />
        </Svg>
      );
    case "numerals":
      return <span className="art-numeral">07</span>;
    default:
      return null;
  }
}

export function TileArt({ kind, uid, className }: { kind: ArtKind; uid: string; className?: string }) {
  return (
    <div className={className ? `art art-${kind} ${className}` : `art art-${kind}`} aria-hidden="true">
      <Art kind={kind} uid={uid} />
    </div>
  );
}
