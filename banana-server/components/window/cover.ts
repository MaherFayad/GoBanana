/**
 * Whether an app window (WindowLayer.tsx, as a dialog over a site page) covers the page. The page
 * behind is then dimmed, blurred and inert, so its own motion (the landing's WebGL stage, glyph
 * trail and smooth scroll) only costs frames: every repaint behind the window also redraws the
 * blurred backdrop. Those loops pause while this is true and pick up again when it ends.
 */
import { modalStack } from "@/components/studio/modalStack";

export function pageCovered(): boolean {
  return typeof document !== "undefined" && document.querySelector(".wl:not([data-mode='page'])") !== null;
}

/** Calls `fn` with the covered state now and whenever a window opens or closes; returns the undo. */
export function watchPageCover(fn: (covered: boolean) => void): () => void {
  let last = pageCovered();
  fn(last);
  let off = false;
  const unsubscribe = modalStack.subscribe(() => {
    // A closing window leaves the stack before React removes its layer: check after the commit.
    queueMicrotask(() => {
      const now = pageCovered();
      if (off || now === last) return;
      last = now;
      fn(now);
    });
  });
  return () => {
    off = true;
    unsubscribe();
  };
}
