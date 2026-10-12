"use client";

/**
 * One app window over the site, shared by the canvas editor and account settings
 * (DECISIONS 2026-10-12, "windows open over the site").
 *
 * - `overlay`: the route was opened from a site page (Next intercepting routes,
 *   app/(site)/[locale]/@modal). The page stays mounted behind a dimmed, softly blurred
 *   backdrop; the window is a modal dialog (the rest of the page is inert, page scroll is held).
 *   Close and minimize animate, then go back in history, so Back and close land on the same
 *   page. The browser's Back button closes it too: the window then leaves through a ghost copy.
 * - `home`: a direct load (or refresh) of a window that sits on the home page (the canvases
 *   dashboard, account settings): the landing renders behind it, blurred and inert, as in
 *   `overlay`, but the window is drawn on the server and opens in CSS on first paint. Close goes
 *   to `closeHref` (the home page), which keeps the landing mounted (it is their layout).
 * - `page`: a direct load of the same URL. The window stands on the desk; close goes to
 *   `closeHref`.
 *
 * Motion (components/window/motion.ts): open grows out of the element that opened the window
 * (a dashboard card) or from 92%; close goes back into it; zoom fills the screen with a FLIP;
 * minimize shrinks toward the dock. Reduced motion: short fades only.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { flushSync, createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { modalStack } from "@/components/studio/modalStack";
import { WindowFrameContext, type WindowFrame } from "./frame";
import "./window-layer.css";
import { animateClose, animateMinimize, animateOpen, animateResize, dockTarget, ghostClose, recentPress } from "./motion";

type Props = {
  mode: "overlay" | "home" | "page";
  /** Sizing: a large app window (canvas), a Finder window under the menu bar (canvases), or a centred settings window. */
  kind: "canvas" | "finder" | "settings";
  /** Accessible name of the dialog. */
  label: string;
  /** Where close goes on a direct load. */
  closeHref: string;
  /** Selector of the element the window grows out of and closes back into, when it is on the page. */
  origin?: string;
  /** Dock link the window minimizes into (an href suffix, for example "/canvases"). */
  dock?: string;
  /** Render under <body> instead of in place (the canvas, so site styles never reach the board). */
  portal?: boolean;
  /** Escape closes the window (not for the canvas, where Escape belongs to the board). */
  escapeCloses?: boolean;
  children: ReactNode;
};

const noop = () => () => {};

function findOrigin(selector: string | undefined): HTMLElement | null {
  const named = selector ? document.querySelector<HTMLElement>(selector) : null;
  if (named) return named;
  return recentPress();
}

/** Elements outside `keep` that become inert while the window is open; returns the undo. */
function isolate(keep: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  let node: HTMLElement | null = keep;
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    for (const sib of Array.from(parent.children)) {
      if (sib === node || !(sib instanceof HTMLElement) || sib.inert) continue;
      if (/^(SCRIPT|STYLE|LINK|NEXT-ROUTE-ANNOUNCER|NEXTJS-PORTAL)$/.test(sib.tagName)) continue;
      if (sib.hasAttribute("data-window-ghost")) continue;
      sib.inert = true;
      changed.push(sib);
    }
    node = parent;
  }
  return () => {
    for (const el of changed) el.inert = false;
  };
}

export function WindowLayer({ mode, kind, label, closeHref, origin, dock, portal = false, escapeCloses = false, children }: Props) {
  const router = useRouter();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const layerRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const live = useRef<{ leaving: boolean; origin: HTMLElement | null }>({ leaving: false, origin: null });
  const overlay = mode === "overlay";
  // A dialog over a page (inert behind it, scroll held), whether it opened in place or loaded so.
  const modal = mode !== "page";

  useLayoutEffect(() => {
    const win = winRef.current;
    const layer = layerRef.current;
    if (!win || !layer) return;
    const state = live.current;
    state.leaving = false;
    win.style.visibility = "";
    state.origin = overlay ? findOrigin(origin) : null;
    // A direct load animates in CSS (it paints before hydration); an overlay animates here.
    if (overlay) animateOpen(win, state.origin?.getBoundingClientRect() ?? null, backRef.current);

    const before = document.activeElement as HTMLElement | null;
    const scope = layer.closest(".site") ?? document.body;
    win.focus({ preventScroll: true });
    if (!modal) return;

    // A sheet or confirm (a modal <dialog>, in the top layer) that led here would cover the
    // window: close it (its own close handler keeps its state in step).
    for (const d of Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]"))) {
      if (!layer.contains(d)) d.close();
    }
    const root = document.documentElement;
    const scroll = root.style.overflow;
    root.style.overflow = "hidden";
    const undoInert = isolate(layer);
    modalStack.push(win);
    // An overlay names the tab after the window and gives the page its title back; a direct
    // load already has the window's title from its route metadata.
    const title = overlay ? document.title : null;
    // Back (or any history move) while the window is up: the router drops the window on its
    // next render, so a copy of it animates out from where it is now.
    const path = location.pathname;
    const onPop = () => {
      // A hash move inside the window (the settings list) keeps the window.
      if (state.leaving || location.pathname === path) return;
      state.leaving = true;
      const target = state.origin?.isConnected ? state.origin.getBoundingClientRect() : null;
      const back = backRef.current;
      ghostClose(win, win.getBoundingClientRect(), target, back, back?.getBoundingClientRect(), scope);
      win.style.visibility = "hidden";
      if (back) back.style.visibility = "hidden";
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      modalStack.remove(win);
      undoInert();
      root.style.overflow = scroll;
      if (title !== null) document.title = title;
      const focusBack = state.origin?.isConnected ? state.origin.querySelector<HTMLElement>("button, a") ?? state.origin : before;
      if (focusBack?.isConnected) requestAnimationFrame(() => focusBack.focus({ preventScroll: true }));
    };
    // The origin is read once per open; a new origin only matters for a new window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay, modal, mounted]);

  useLayoutEffect(() => {
    if (overlay && mounted) document.title = label;
  }, [overlay, mounted, label]);

  const leave = useCallback(
    async (how: "close" | "minimize") => {
      const win = winRef.current;
      const state = live.current;
      if (!win || state.leaving) return;
      state.leaving = true;
      const target = state.origin?.isConnected ? state.origin.getBoundingClientRect() : null;
      if (how === "minimize") await animateMinimize(win, dockTarget(dock), backRef.current);
      else await animateClose(win, target, backRef.current);
      if (overlay) router.back();
      else router.push(closeHref);
    },
    [overlay, router, closeHref, dock],
  );

  const toggleZoom = useCallback(() => {
    const win = winRef.current;
    if (!win) return;
    const before = win.getBoundingClientRect();
    flushSync(() => setZoomed((z) => !z));
    animateResize(win, before);
  }, []);

  const frame = useMemo<WindowFrame>(
    () => ({ close: () => void leave("close"), minimize: () => void leave("minimize"), toggleZoom, zoomed, closeHref }),
    [leave, toggleZoom, zoomed, closeHref],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // A dialog opened inside the window (a confirm) handles its own Escape.
    // A search field with text clears itself on Escape first.
    const field = e.target as HTMLInputElement;
    if (field.type === "search" && field.value) return;
    if (escapeCloses && e.key === "Escape" && !e.defaultPrevented && !(e.target as Element).closest("dialog[open]")) {
      e.stopPropagation();
      frame.close();
    }
  };

  const layer = (
    <div ref={layerRef} className="wl" data-mode={mode} data-kind={kind} data-zoomed={zoomed ? "" : undefined} data-lenis-prevent="">
      <div ref={backRef} className="wl-backdrop" aria-hidden="true" />
      <div
        ref={winRef}
        className="wl-window"
        role={modal ? "dialog" : undefined}
        aria-modal={modal ? true : undefined}
        aria-label={modal ? label : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <WindowFrameContext.Provider value={frame}>{children}</WindowFrameContext.Provider>
      </div>
    </div>
  );

  // An overlay only ever mounts on a client navigation; the portal needs <body>.
  if (overlay && !mounted) return null;
  return portal && mounted ? createPortal(layer, document.body) : layer;
}
