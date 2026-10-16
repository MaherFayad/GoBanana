/**
 * X's official embed for X post tiles (web and shared canvas only).
 *
 * Loads `platform.twitter.com/widgets.js` once, the first time a post tile is on screen, and asks
 * it to draw the post (`twttr.widgets.createTweet`, do not track on). X's script draws the post
 * in X's own frame, so videos play inside the post. Nothing is fetched or stored by us. If the
 * script cannot load (blocked, offline) or the post is gone, the tile keeps its link card.
 */
import { X_WIDGETS_SCRIPT } from "@/lib/xpost";

type Widgets = {
  createTweet(id: string, el: HTMLElement, options?: Record<string, unknown>): Promise<HTMLElement | undefined>;
};
type Twttr = { widgets?: Widgets; ready?: (fn: (t: Twttr) => void) => void };

export const WIDGETS_TIMEOUT_MS = 10_000;

let loading: Promise<Widgets | null> | undefined;

/** Tests: forget the loaded script. */
export function resetXWidgets(): void {
  loading = undefined;
}

function current(): Widgets | null {
  const t = (window as unknown as { twttr?: Twttr }).twttr;
  return t?.widgets && typeof t.widgets.createTweet === "function" ? t.widgets : null;
}

/** X's widget script, loaded once per page. Null when it cannot load in time. */
export function loadXWidgets(): Promise<Widgets | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const ready = current();
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<Widgets | null>((resolve) => {
    const timer = window.setTimeout(() => done(null), WIDGETS_TIMEOUT_MS);
    let settled = false;
    function done(value: Widgets | null) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (!value) loading = undefined; // a later tile may try again
      resolve(value);
    }
    const script = document.createElement("script");
    script.src = X_WIDGETS_SCRIPT;
    script.async = true;
    script.charset = "utf-8";
    script.dataset.testid = "x-widgets";
    script.onload = () => {
      const t = (window as unknown as { twttr?: Twttr }).twttr;
      if (t?.ready) t.ready(() => done(current()));
      else done(current());
    };
    script.onerror = () => done(null);
    document.head.appendChild(script);
  });
  return loading;
}

/** Draws one post into `el`. True when X drew it; false when the script or the post is unavailable. */
export async function embedPost(el: HTMLElement, postId: string, theme: "light" | "dark"): Promise<boolean> {
  const widgets = await loadXWidgets();
  if (!widgets) return false;
  try {
    const drawn = await widgets.createTweet(postId, el, { dnt: true, theme, conversation: "none", align: "center" });
    return Boolean(drawn);
  } catch {
    return false;
  }
}
