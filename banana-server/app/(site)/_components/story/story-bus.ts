/**
 * The one link between the board row's buttons (BoardRow.tsx) and the scroll motion
 * (story-motion.ts). While the row is pinned to the page scroll, a button press has to move the
 * page, not the row, so the motion module puts its stepper here; null means the row scrolls on
 * its own (phones, reduced motion, before the motion has loaded).
 */
export const storyBus: { rowStep: ((delta: 1 | -1) => void) | null } = { rowStep: null };
