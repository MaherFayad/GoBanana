"use client";

/**
 * The Bend mark in glass, behind the hero window. A static picture (the SVG mark, soft and
 * translucent) is always there; when WebGL works and motion is allowed, glass-scene.ts (OGL) is
 * loaded on demand, after the page is idle, and fades in over it. Decorative (aria-hidden). It
 * stops drawing while off screen or in a hidden tab.
 */
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand/BrandMark";

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function GlassMark() {
  const host = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !hasWebGL()) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    const start = () =>
      import("./glass-scene")
        .then((m) => {
          if (!cancelled) dispose = m.mountGlass(el, () => setLive(true));
        })
        .catch(() => {});
    const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 600);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      dispose?.();
    };
  }, []);

  return (
    <div className="glass-mark" data-live={live ? "" : undefined} aria-hidden="true">
      <div className="glass-mark-still">
        <BrandMark />
      </div>
      <div ref={host} className="glass-mark-gl" />
    </div>
  );
}
