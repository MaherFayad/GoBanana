"use client";

/**
 * Scroll reveal: the element fades in and rises 24px the first time it enters the viewport;
 * headings (`blur`) also go from blurred to sharp. One IntersectionObserver serves the page.
 *
 * Content is never hidden without JS or under reduced motion:
 * - The hidden start state only applies under `html.reveal-on`, which this module sets after
 *   hydration. Server HTML, a failed script and a crawler all see the content.
 * - Each element arms itself (data-reveal-armed) only when it is off screen as it hydrates;
 *   elements on screen are marked revealed instead. React can hydrate parts of the page in
 *   separate passes, so a page-wide hidden state would blink content that hydrates later.
 * - site.css drops the hidden state under prefers-reduced-motion, and the motion tokens are 0ms.
 * - Revealed is final: scrolling back up never hides anything again.
 */
import { useLayoutEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

let observer: IntersectionObserver | null = null;

function reveal(el: Element) {
  el.setAttribute("data-revealed", "");
  observer?.unobserve(el);
}

function getObserver(): IntersectionObserver | null {
  if (observer || typeof IntersectionObserver === "undefined") return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) reveal(entry.target);
    },
    // Reveal a little before the element is fully in view, and never wait for most of it.
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );
  return observer;
}

function inView(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.top < window.innerHeight && r.bottom > 0;
}

type Props = {
  children: ReactNode;
  /** Element to render. Default div. */
  as?: ElementType;
  /** Stagger position: waits this many --st-delay-reveal-step steps. */
  index?: number;
  /** Blur to sharp as well (headings). */
  blur?: boolean;
  className?: string;
  id?: string;
  "aria-labelledby"?: string;
};

export function Reveal({ children, as: Tag = "div", index = 0, blur = false, className, ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);

  // Layout effect: runs before paint, so an element on screen is marked before the class can hide it.
  useLayoutEffect(() => {
    const el = ref.current;
    const io = getObserver();
    if (!el || !io) return;
    if (inView(el)) reveal(el);
    else {
      // Only an element that is off screen when it hydrates is ever hidden (data-reveal-armed),
      // so content that hydrates in a later pass never blinks out.
      el.setAttribute("data-reveal-armed", "");
      io.observe(el);
    }
    document.documentElement.classList.add("reveal-on");
    return () => io.unobserve(el);
  }, []);

  const style = index ? ({ "--reveal-i": index } as CSSProperties) : undefined;
  return (
    <Tag ref={ref} className={className} data-reveal={blur ? "blur" : ""} style={style} {...rest}>
      {children}
    </Tag>
  );
}
