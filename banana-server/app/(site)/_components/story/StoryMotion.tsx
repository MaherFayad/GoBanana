"use client";

/**
 * Loads the landing scroll motion (story-motion.ts: Lenis, GSAP ScrollTrigger) after hydration,
 * on the landing page only, and never under prefers-reduced-motion. Renders nothing.
 */
import { useEffect } from "react";

export function StoryMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".story");
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    import("./story-motion")
      .then((m) => {
        if (!cancelled) dispose = m.mountMotion(root);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);
  return null;
}
