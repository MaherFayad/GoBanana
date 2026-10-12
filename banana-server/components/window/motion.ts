/**
 * macOS style window motion, in small hand code on the Web Animations API (no animation
 * library: docs/worker-size.md). Only transform and opacity move; the one blurred layer is the
 * backdrop, which only fades.
 *
 * - open: from the element that opened the window (a dashboard card, say) when there is one,
 *   else from 92% scale, fading in;
 * - close: back into that element, else down to 92% and out;
 * - zoom: a FLIP from the old frame to the new one;
 * - minimize: a genie-like shrink toward the dock icon (or the bottom centre).
 *
 * Under prefers-reduced-motion every move is a short fade. Durations and easing match the
 * --st-window-* tokens in styles/studio-tokens.css.
 */

export const OPEN_MS = 300;
export const CLOSE_MS = 220;
export const ZOOM_MS = 280;
export const MIN_MS = 320;
export const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const FADE_MS = 120;

/**
 * The control the user last pressed (a link or button), so a window can grow out of it when the
 * page names no origin of its own. Recorded in the capture phase, before any navigation starts.
 */
let lastPress: { el: HTMLElement; at: number } | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("a, button");
      if (el) lastPress = { el, at: Date.now() };
    },
    true,
  );
}

/** The control pressed in the last few seconds, if it is still on the page. */
export function recentPress(): HTMLElement | null {
  return lastPress && Date.now() - lastPress.at < 4000 && lastPress.el.isConnected ? lastPress.el : null;
}

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Transform (with transform-origin 0 0) that draws a box sitting at `to` over `from`. */
function between(from: DOMRect, to: DOMRect): string {
  const sx = to.width ? from.width / to.width : 1;
  const sy = to.height ? from.height / to.height : 1;
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`;
}

const usable = (r: DOMRect | null | undefined): r is DOMRect => Boolean(r && r.width > 4 && r.height > 4);

async function done(a: Animation | undefined): Promise<void> {
  if (!a) return;
  try {
    await a.finished;
  } catch {
    // Cancelled (the element left the page): nothing to wait for.
  }
}

function fade(el: HTMLElement | null | undefined, inward: boolean, ms: number, fill: FillMode = "both"): Animation | undefined {
  return el?.animate([{ opacity: inward ? 0 : 1 }, { opacity: inward ? 1 : 0 }], { duration: ms, easing: "ease", fill });
}

/** Drop running window animations, so the next one measures the element's real frame. */
function settle(...els: (HTMLElement | null | undefined)[]): void {
  for (const el of els) for (const a of el?.getAnimations() ?? []) a.cancel();
}

/** Open: grow out of `origin` (or from 92%), with the backdrop fading in under it. */
export function animateOpen(win: HTMLElement, origin: DOMRect | null, backdrop?: HTMLElement | null): void {
  settle(win, backdrop);
  if (reducedMotion()) {
    fade(win, true, FADE_MS, "none");
    fade(backdrop, true, FADE_MS, "none");
    return;
  }
  fade(backdrop, true, OPEN_MS, "none");
  const end = win.getBoundingClientRect();
  if (usable(origin) && usable(end)) {
    win.animate(
      [
        { transformOrigin: "0 0", transform: between(origin, end), opacity: 0.35 },
        // Opacity settles early; the transform runs the whole way (no transform at this offset).
        { transformOrigin: "0 0", opacity: 1, offset: 0.35 },
        { transformOrigin: "0 0", transform: "none", opacity: 1 },
      ],
      { duration: OPEN_MS, easing: EASE },
    );
    return;
  }
  win.animate([{ transform: "scale(0.92)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: OPEN_MS, easing: EASE });
}

/** Close: shrink back into `target` (or down to 92%) and fade; the backdrop fades with it. */
export async function animateClose(win: HTMLElement, target: DOMRect | null, backdrop?: HTMLElement | null): Promise<void> {
  settle(win, backdrop);
  if (reducedMotion()) {
    fade(backdrop, false, FADE_MS, "forwards");
    await done(fade(win, false, FADE_MS, "forwards"));
    return;
  }
  fade(backdrop, false, CLOSE_MS, "forwards");
  const start = win.getBoundingClientRect();
  const a =
    usable(target) && usable(start)
      ? win.animate(
          [
            { transformOrigin: "0 0", transform: "none", opacity: 1 },
            { transformOrigin: "0 0", transform: between(target, start), opacity: 0 },
          ],
          { duration: CLOSE_MS + 60, easing: EASE, fill: "forwards" },
        )
      : win.animate([{ transform: "none", opacity: 1 }, { transform: "scale(0.92)", opacity: 0 }], {
          duration: CLOSE_MS,
          easing: "cubic-bezier(0.4, 0, 1, 1)",
          fill: "forwards",
        });
  await done(a);
}

/** Zoom: call after the frame changed; animates from the frame it had (`before`). */
export function animateResize(win: HTMLElement, before: DOMRect): void {
  if (reducedMotion()) return;
  const after = win.getBoundingClientRect();
  if (!usable(before) || !usable(after)) return;
  win.animate(
    [
      { transformOrigin: "0 0", transform: between(before, after) },
      { transformOrigin: "0 0", transform: "none" },
    ],
    { duration: ZOOM_MS, easing: EASE },
  );
}

/** Where a minimized window goes: the dock's matching icon, the dock, or the bottom centre. */
export function dockTarget(match?: string): DOMRect {
  const icon = (match && document.querySelector<HTMLElement>(`.dock a[href$="${match}"]`)) || document.querySelector<HTMLElement>(".dock");
  if (icon) return icon.getBoundingClientRect();
  const w = document.documentElement.clientWidth;
  return new DOMRect(w / 2 - 24, window.innerHeight - 56, 48, 48);
}

/** Minimize: a genie-like shrink toward `target`, narrowing first, then falling into it. */
export async function animateMinimize(win: HTMLElement, target: DOMRect, backdrop?: HTMLElement | null): Promise<void> {
  settle(win, backdrop);
  if (reducedMotion()) {
    fade(backdrop, false, FADE_MS, "forwards");
    await done(fade(win, false, FADE_MS, "forwards"));
    return;
  }
  const r = win.getBoundingClientRect();
  if (!usable(r)) return;
  // Bottom centre of the window travels to the centre of the target.
  const dx = target.left + target.width / 2 - (r.left + r.width / 2);
  const dy = target.top + target.height / 2 - r.bottom;
  const s = Math.max(0.04, Math.min(target.width / r.width, target.height / r.height));
  fade(backdrop, false, MIN_MS, "forwards");
  const a = win.animate(
    [
      { transformOrigin: "50% 100%", transform: "none", opacity: 1 },
      { transformOrigin: "50% 100%", transform: `translate(${dx * 0.25}px, ${dy * 0.15}px) scale(0.55, 0.7)`, opacity: 0.9, offset: 0.4 },
      { transformOrigin: "50% 100%", transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0 },
    ],
    { duration: MIN_MS, easing: "cubic-bezier(0.5, 0, 0.3, 1)", fill: "forwards" },
  );
  await done(a);
}

/**
 * A copy of an element that has to leave the page right away (the browser's Back button
 * unmounts the window at once, a minimised window folds in place): fixed where the element was,
 * in the same styled scope (.site, else <body>), removed by the caller when its animation ends.
 */
export function ghost(el: HTMLElement, rect: DOMRect, scope?: Element | null): HTMLElement {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.removeAttribute("id");
  for (const node of Array.from(copy.querySelectorAll("[id]"))) node.removeAttribute("id");
  copy.setAttribute("aria-hidden", "true");
  copy.setAttribute("inert", "");
  Object.assign(copy.style, {
    // Physical on purpose: the copy sits on the viewport box the browser measured.
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    zIndex: "9001",
    pointerEvents: "none",
    translate: "none",
  });
  copy.setAttribute("data-window-ghost", "");
  // Next to the page's styles: site windows are only styled inside .site.
  (scope ?? el.closest(".site") ?? document.body).appendChild(copy);
  return copy;
}

/** Close a window that is already leaving the DOM: animate a ghost copy, then drop it. */
export function ghostClose(
  win: HTMLElement,
  rect: DOMRect,
  target: DOMRect | null,
  backdrop?: HTMLElement | null,
  backdropRect?: DOMRect,
  scope?: Element | null,
): void {
  if (!usable(rect)) return;
  const g = ghost(win, rect, scope);
  const gb = backdrop && backdropRect ? ghost(backdrop, backdropRect, scope) : null;
  if (gb) gb.style.zIndex = "9000";
  void animateClose(g, target, gb).then(() => {
    g.remove();
    gb?.remove();
  });
}
