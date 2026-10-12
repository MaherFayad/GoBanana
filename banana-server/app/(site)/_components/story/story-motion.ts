/**
 * Scroll motion for the landing story (docs/landing-motion-spec.md), loaded on demand by
 * StoryMotion.tsx and never under prefers-reduced-motion:
 * - Lenis smooth scroll (lerp 0.1), driving GSAP ScrollTrigger.
 * - `[data-reveal]`: every word blurs in (blur 8px to 0, opacity 0 to 1, y 12px to 0), scrubbed.
 * - `[data-parallax]`: windows drift a little against the scroll.
 * - `[data-row]` (768px and up): the board row is pinned and the page scroll moves it sideways;
 *   focus inside it scrolls the page so the focused card is in view, and the prev / next buttons
 *   step the page by one card (story-bus.ts).
 * - `[data-fan]` (768px and up): the export windows fan out of the mark as the section scrolls.
 * - `[data-pile]`: file icons drop onto the pile one by one.
 *
 * Without this module everything is simply visible: the row scrolls on its own and the fan is
 * open (story.css).
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { storyBus } from "./story-bus";

/** Wraps each word of an element's text in a span (once), keeping bdi and other inline parents. */
function splitWords(el: HTMLElement): HTMLElement[] {
  if (!el.hasAttribute("data-split")) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const parts = (node.nodeValue ?? "").split(/(\s+)/);
      if (parts.length === 1 && !parts[0]!.trim()) continue;
      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
        else {
          const w = document.createElement("span");
          w.className = "w";
          w.textContent = part;
          frag.appendChild(w);
        }
      }
      node.replaceWith(frag);
    }
    el.setAttribute("data-split", "");
  }
  return Array.from(el.querySelectorAll<HTMLElement>(".w"));
}

export function mountMotion(root: HTMLElement): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const rtl = getComputedStyle(root).direction === "rtl";
  const sign = rtl ? -1 : 1;

  const lenis = new Lenis({ lerp: 0.1, autoRaf: false });
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (t: number) => lenis.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  root.setAttribute("data-motion", "");

  const ctx = gsap.context(() => {
    for (const el of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
      const words = splitWords(el);
      if (!words.length) continue;
      gsap.fromTo(
        words,
        { opacity: 0, filter: "blur(8px)", y: 12 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          ease: "none",
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: "top 92%", end: "top 58%", scrub: 0.6 },
        },
      );
    }

    for (const el of root.querySelectorAll<HTMLElement>("[data-parallax]")) {
      gsap.fromTo(el, { y: 48 }, { y: -48, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
    }

    const pile = root.querySelector<HTMLElement>("[data-pile]");
    if (pile) {
      gsap.fromTo(
        pile.querySelectorAll("li"),
        { y: -36, opacity: 0 },
        { y: 0, opacity: 1, ease: "power2.out", stagger: 0.06, scrollTrigger: { trigger: pile, start: "top 85%", end: "bottom 70%", scrub: 0.5 } },
      );
    }
  }, root);

  const mm = gsap.matchMedia(root);
  mm.add("(min-width: 768px)", () => {
    // ---------------------------------------------------------------- board row, pinned
    const row = root.querySelector<HTMLElement>("[data-row]");
    const track = row?.querySelector<HTMLElement>(".row-track");
    const sticky = row?.querySelector<HTMLElement>(".row-sticky");
    let rowTrigger: ScrollTrigger | undefined;
    const onFocus = (e: FocusEvent) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>(".row-card");
      if (!card || !track || !sticky || !rowTrigger) return;
      const dist = rowTrigger.end - rowTrigger.start;
      const start = rtl ? track.scrollWidth - card.offsetLeft - card.offsetWidth : card.offsetLeft;
      const gutter = parseFloat(getComputedStyle(track).paddingInlineStart) || 0;
      const view = sticky.clientWidth;
      const now = lenis.scroll - rowTrigger.start;
      if (start - now >= 0 && start + card.offsetWidth - now <= view) return;
      const want = Math.min(dist, Math.max(0, start - gutter));
      lenis.scrollTo(rowTrigger.start + want, { immediate: true, force: true });
      ScrollTrigger.update();
    };
    if (row && track && sticky) {
      row.setAttribute("data-pinned", "");
      const distance = () => Math.max(0, track.scrollWidth - sticky.clientWidth);
      const setHeight = () => {
        row.style.blockSize = `${sticky.offsetHeight + distance()}px`;
      };
      setHeight();
      ScrollTrigger.addEventListener("refreshInit", setHeight);
      const tween = gsap.to(track, {
        x: () => -sign * distance(),
        ease: "none",
        scrollTrigger: { trigger: row, start: "top top", end: () => `+=${distance()}`, scrub: true, invalidateOnRefresh: true },
      });
      rowTrigger = tween.scrollTrigger;
      track.addEventListener("focusin", onFocus);
      storyBus.rowStep = (delta) => {
        if (!rowTrigger) return;
        const card = track.querySelector<HTMLElement>(".row-card");
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        const step = (card?.offsetWidth ?? 400) + gap;
        const now = lenis.scroll - rowTrigger.start;
        const next = Math.min(rowTrigger.end - rowTrigger.start, Math.max(0, Math.round(now / step + delta) * step));
        lenis.scrollTo(rowTrigger.start + next, { duration: 0.9 });
      };
    }

    // ---------------------------------------------------------------- export windows fan out
    const fan = root.querySelector<HTMLElement>("[data-fan]");
    const pin = fan?.closest<HTMLElement>(".kit-pin");
    if (fan && pin) {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const wins = Array.from(fan.querySelectorAll<HTMLElement>(".fan-win"));
      const tl = gsap.timeline({ scrollTrigger: { trigger: pin, start: "top top", end: "bottom bottom", scrub: 0.6 } });
      wins.forEach((w, i) => {
        const cs = getComputedStyle(w);
        const x = parseFloat(cs.getPropertyValue("--x")) * rem * sign || 0;
        const y = parseFloat(cs.getPropertyValue("--y")) * rem || 0;
        // The li keeps its fan position in CSS (translate); GSAP moves the window inside it.
        tl.fromTo(w.firstElementChild, { x: -x, y: -y + 4 * rem, scale: 0.18, opacity: 0 }, { x: 0, y: 0, scale: 1, opacity: 1, ease: "power2.out", duration: 1 }, i * 0.45);
      });
      const files = fan.parentElement?.querySelectorAll(".kit-file");
      if (files?.length) tl.fromTo(files, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, stagger: 0.2, duration: 0.4 }, wins.length * 0.45);
    }

    return () => {
      track?.removeEventListener("focusin", onFocus);
      row?.removeAttribute("data-pinned");
      if (row) row.style.blockSize = "";
      storyBus.rowStep = null;
    };
  });

  // Fonts and images change heights; measure again once they are in.
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener("load", refresh);
  void document.fonts?.ready.then(refresh);

  return () => {
    window.removeEventListener("load", refresh);
    mm.revert();
    ctx.revert();
    gsap.ticker.remove(tick);
    lenis.destroy();
    root.removeAttribute("data-motion");
    storyBus.rowStep = null;
  };
}
