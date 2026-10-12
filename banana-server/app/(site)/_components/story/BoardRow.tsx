"use client";

/**
 * The edge-to-edge row of example boards ("Made with GoBanana"). On its own it is a horizontal
 * scroller with snap points (touch swipe, Shift+wheel, Tab through the cards). On wide screens
 * with motion, story-motion.ts pins it and the page scroll moves it sideways. Either way the
 * Previous and Next buttons move it by one card (SC 2.5.7: no drag needed).
 */
import type { ReactNode } from "react";
import { useRef } from "react";
import { ChevronEndIcon, ChevronStartIcon } from "@/components/studio/icons";
import { storyBus } from "./story-bus";

type Props = { label: string; prev: string; next: string; children: ReactNode };

export function BoardRow({ label, prev, next, children }: Props) {
  const scroller = useRef<HTMLDivElement>(null);

  function step(delta: 1 | -1) {
    if (storyBus.rowStep) {
      storyBus.rowStep(delta);
      return;
    }
    const el = scroller.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".row-card");
    const gap = parseFloat(getComputedStyle(el.firstElementChild ?? el).columnGap) || 0;
    const rtl = getComputedStyle(el).direction === "rtl";
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: delta * ((card?.offsetWidth ?? 320) + gap) * (rtl ? -1 : 1), behavior: still ? "auto" : "smooth" });
  }

  return (
    <div className="row" data-row="">
      <div className="row-sticky">
        <div ref={scroller} className="row-scroller">
          <ul className="row-track" aria-label={label}>
            {children}
          </ul>
        </div>
        <div className="row-controls">
          <button type="button" className="row-btn" aria-label={prev} onClick={() => step(-1)}>
            <ChevronStartIcon size={16} />
          </button>
          <button type="button" className="row-btn" aria-label={next} onClick={() => step(1)}>
            <ChevronEndIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
