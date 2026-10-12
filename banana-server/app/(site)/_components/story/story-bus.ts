/**
 * The one link between the board row's buttons (BoardRow.tsx) and the scroll motion
 * (story-motion.ts). While the row is pinned to the page scroll, a button press has to move the
 * page, not the row, so the motion module puts its stepper here; null means the row scrolls on
 * its own (phones, reduced motion, before the motion has loaded).
 *
 * `scrollTo` is the smooth scroller (Lenis) while it runs, so in-page links glide with the same
 * easing as the wheel. AnchorScroll.tsx falls back to native smooth scrolling when it is null.
 */
export const storyBus: {
  rowStep: ((delta: 1 | -1) => void) | null;
  scrollTo: ((target: HTMLElement) => void) | null;
} = { rowStep: null, scrollTo: null };
