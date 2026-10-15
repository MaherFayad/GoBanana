"use client";

/**
 * The inline SVG filter behind the harmonize view (lib/stitch/harmonize.ts): one per Frankenstein
 * page. `feColorMatrix` turns a part to luminance, `feComponentTransfer` maps dark to the ink color
 * and light to the surface color. Without direction colors it uses the neutral ink and surface
 * tokens (`--st-text`, `--st-bg-surface`) of the theme the page sits in, read from the DOM, so the
 * page follows a light or dark board. Decorative: hidden from assistive tech, zero size.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { cssColorToHex, duotoneTables, LUMINANCE_MATRIX } from "@/lib/stitch/harmonize";
import type { HarmonizeColors } from "@/lib/stitch/types";

/** Last resort when the tokens cannot be read (no CSS loaded): plain luminance, dark to light. */
const PLAIN_TABLES = { r: "0 1", g: "0 1", b: "0 1" };

function tokenColors(el: Element | null): HarmonizeColors | null {
  if (!el || typeof getComputedStyle === "undefined") return null;
  const style = getComputedStyle(el);
  const ink = cssColorToHex(style.getPropertyValue("--st-text"));
  const surface = cssColorToHex(style.getPropertyValue("--st-bg-surface"));
  return ink && surface ? { ink, surface } : null;
}

export function HarmonizeFilter({ id, colors }: { id: string; colors?: HarmonizeColors }) {
  const ref = useRef<SVGSVGElement>(null);
  const [neutral, setNeutral] = useState<HarmonizeColors | null>(null);
  useLayoutEffect(() => {
    if (colors) return;
    const read = () => setNeutral(tokenColors(ref.current));
    read();
    // The board can switch themes (system setting or the host's theme attribute).
    const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
    mq?.addEventListener("change", read);
    const mo = typeof MutationObserver === "function" ? new MutationObserver(read) : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    return () => {
      mq?.removeEventListener("change", read);
      mo?.disconnect();
    };
  }, [colors]);
  const pair = colors ?? neutral;
  const t = (pair && duotoneTables(pair)) ?? PLAIN_TABLES;
  return (
    <svg
      ref={ref}
      className="bn-harmonize-defs"
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      // Inline so the site examples (without the canvas stylesheet) also give it no room.
      style={{ position: "absolute", overflow: "hidden" }}
    >
      <filter id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="matrix" values={LUMINANCE_MATRIX} />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={t.r} />
          <feFuncG type="table" tableValues={t.g} />
          <feFuncB type="table" tableValues={t.b} />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}
