"use client";

/**
 * Loads the landing scroll motion (story-motion.ts: GSAP ScrollTrigger) after hydration,
 * on the landing page only, and never under prefers-reduced-motion. Renders nothing.
 */
import { useEffect } from "react";

// Next replaces `typeof window` with "undefined" in the server build, so the server build drops
// this import and GSAP never reaches the Worker (docs/worker-size.md).
const loadMotion = typeof window === "undefined" ? null : () => import("./story-motion");

export function StoryMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".story");
    if (!root || !loadMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    loadMotion()
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
