"use client";

/**
 * The persistent layer behind the landing page: a fixed stage with the Bend tile and the desk
 * background (stage-scene.ts, WebGL), and the mouse glyph trail (trail.ts) over it. Both load on
 * demand after the page is idle, so the hero text stays the first paint.
 *
 * The static fallback is always in the markup: the tile drawn in CSS with the mark (story.css).
 * It stays when WebGL is missing and under prefers-reduced-motion (a still mark, no trail); the
 * grey export section then gets its color from CSS instead of the wipe (`data-stage` on the root).
 * Decorative: aria-hidden.
 */
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand/BrandMark";

// Next replaces `typeof window` with "undefined" in the server build, so the server build drops
// these imports and ogl and the trail never reach the Worker (docs/worker-size.md).
const loadTrail = typeof window === "undefined" ? null : () => import("./trail");
const loadScene = typeof window === "undefined" ? null : () => import("./stage-scene");

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function StoryStage() {
  const glHost = useRef<HTMLDivElement>(null);
  const trail = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!loadTrail || !loadScene || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = glHost.current?.closest<HTMLElement>(".story");
    let cancelled = false;
    const disposers: (() => void)[] = [];
    const start = () => {
      if (trail.current && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        loadTrail().then((m) => !cancelled && trail.current && disposers.push(m.mountTrail(trail.current))).catch(() => {});
      }
      if (!glHost.current || !hasWebGL()) return;
      loadScene()
        .then((m) => {
          if (cancelled || !glHost.current) return;
          disposers.push(
            m.mountStage(glHost.current, () => {
              setLive(true);
              root?.setAttribute("data-stage", "gl");
            }),
          );
        })
        .catch(() => {});
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 1200 }) : window.setTimeout(start, 400);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      disposers.forEach((d) => d());
      root?.removeAttribute("data-stage");
    };
  }, []);

  return (
    <div className="stage" data-live={live ? "" : undefined} aria-hidden="true">
      <div className="stage-still">
        <span className="stage-tile">
          <BrandMark />
        </span>
      </div>
      <div ref={glHost} className="stage-gl" />
      <canvas ref={trail} className="stage-trail" />
    </div>
  );
}
