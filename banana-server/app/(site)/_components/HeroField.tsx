"use client";

/**
 * The landing page's draggable field: a plane twice the hero's size each way, holding the
 * generative move tiles (TileArt). Structure and behavior after pryzm.design's hero; the art,
 * copy and code are GoBanana's own.
 *
 * - Pointer: drag anywhere to pan, with light inertia on release. Nothing moves on its own.
 *   Touch keeps vertical page scrolling (touch-action: pan-y); a horizontal drag pans.
 * - Keyboard (SC 2.1.1, 2.5.7): the field is one focusable region; arrow keys pan (Shift for
 *   bigger steps) and Home goes back to the middle. Each tile is a button: Tab reaches it, the
 *   field pans it into view (SC 2.4.11), and Enter or a click opens its sample idea.
 * - prefers-reduced-motion: no inertia, and the CSS entrance is off.
 * - The pan writes one transform per frame on a ref; React state only holds the open tile.
 * Geometry is pure and tested: lib/site/pan.ts.
 */
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { CloseIcon } from "@/components/studio/icons";
import type { HeroTile } from "@/lib/site/moves";
import { centerOffset, clampOffset, DRAG_THRESHOLD, inertiaStep, keyDelta, revealOffset, type Vec } from "@/lib/site/pan";
import { TileArt } from "./TileArt";

export type FieldTile = HeroTile & { name: string; color: string; move: string; title: string; twist: string; caption: string };

export type FieldLabels = {
  label: string;
  hint: string;
  sample: string;
  twist: string;
  close: string;
  moveLabel: string;
};

type Drag = { id: number; start: Vec; from: Vec; last: Vec; lastT: number; v: Vec; moved: boolean };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function HeroField({ tiles, labels }: { tiles: FieldTile[]; labels: FieldLabels }) {
  const uid = useId();
  const hintId = `${uid}-hint`;
  const viewRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const offset = useRef<Vec>({ x: 0, y: 0 });
  const drag = useRef<Drag | null>(null);
  const frame = useRef(0);
  const suppressClick = useRef(false);
  const [open, setOpen] = useState<number | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const sizes = useCallback(() => {
    const view = viewRef.current;
    const plane = planeRef.current;
    if (!view || !plane) return null;
    return { view: { w: view.clientWidth, h: view.clientHeight }, plane: { w: plane.offsetWidth, h: plane.offsetHeight } };
  }, []);

  const apply = useCallback(
    (next: Vec) => {
      const s = sizes();
      const plane = planeRef.current;
      if (!s || !plane) return;
      offset.current = clampOffset(next, s.view, s.plane);
      plane.style.translate = "none";
      plane.style.transform = `translate3d(${offset.current.x}px, ${offset.current.y}px, 0)`;
    },
    [sizes],
  );

  const stopInertia = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  };

  const recenter = useCallback(() => {
    const s = sizes();
    if (s) apply(centerOffset(s.view, s.plane));
  }, [apply, sizes]);

  // Start in the middle (the CSS start position already shows it), and keep the plane
  // covering the view when the window changes size.
  useEffect(() => {
    recenter();
    const view = viewRef.current;
    if (!view || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => apply(offset.current));
    ro.observe(view);
    return () => {
      ro.disconnect();
      stopInertia();
    };
  }, [apply, recenter]);

  /** Pans so a rectangle on screen (a tile, the open card) is inside the view. */
  const reveal = useCallback(
    (el: Element | null) => {
      const s = sizes();
      const view = viewRef.current;
      if (!s || !view || !el) return;
      const v = view.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const rect = { x: r.left - v.left - offset.current.x, y: r.top - v.top - offset.current.y, w: r.width, h: r.height };
      // The headline block covers the bottom of the field: only the part above it counts as in view.
      const copy = view.parentElement?.querySelector(".hero-copy")?.getBoundingClientRect();
      const visible = copy && copy.top > v.top ? { w: s.view.w, h: Math.min(s.view.h, copy.top - v.top) } : s.view;
      apply(revealOffset(offset.current, rect, visible));
    },
    [apply, sizes],
  );

  // ---------------------------------------------------------------- pointer

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as Element).closest(".hero-card")) return;
    stopInertia();
    const now = performance.now();
    const p = { x: e.clientX, y: e.clientY };
    drag.current = { id: e.pointerId, start: p, from: { ...offset.current }, last: p, lastT: now, v: { x: 0, y: 0 }, moved: false };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.start.x;
    const dy = e.clientY - d.start.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      // Capture only once it is a drag, so a plain click still lands on the tile under it.
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.dragging = "";
    }
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    const inst = { x: (e.clientX - d.last.x) / dt, y: (e.clientY - d.last.y) / dt };
    d.v = { x: d.v.x * 0.6 + inst.x * 0.4, y: d.v.y * 0.6 + inst.y * 0.4 };
    d.last = { x: e.clientX, y: e.clientY };
    d.lastT = now;
    apply({ x: d.from.x + dx, y: d.from.y + dy });
  }

  function endDrag(e: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    delete e.currentTarget.dataset.dragging;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 0);
    // A pause before release means no fling.
    const idle = performance.now() - d.lastT > 80;
    if (cancelled || idle || reducedMotion()) return;
    let v = d.v;
    let last = performance.now();
    const step = (t: number) => {
      const r = inertiaStep(offset.current, v, Math.min(48, t - last));
      last = t;
      v = r.velocity;
      apply(r.offset);
      frame.current = r.done ? 0 : requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------- keyboard

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.target as Element).closest(".hero-card")) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Home") {
      e.preventDefault();
      stopInertia();
      recenter();
      return;
    }
    const delta = keyDelta(e.key, e.shiftKey);
    if (!delta) return;
    e.preventDefault();
    stopInertia();
    apply({ x: offset.current.x + delta.x, y: offset.current.y + delta.y });
  }

  // ---------------------------------------------------------------- tiles and the sample card

  function toggle(i: number, button: HTMLButtonElement) {
    if (suppressClick.current) return;
    openerRef.current = button;
    setOpen((cur) => (cur === i ? null : i));
  }

  const close = useCallback((returnFocus: boolean) => {
    setOpen(null);
    if (returnFocus) openerRef.current?.focus();
  }, []);

  // Open card: move focus into it, pan it into view, close on Escape or a press outside.
  useEffect(() => {
    if (open === null) return;
    const card = document.getElementById(`${uid}-card-${open}`);
    card?.focus({ preventScroll: true });
    reveal(card);
    const onDown = (ev: globalThis.PointerEvent) => {
      const t = ev.target as Element;
      if (!t.closest(".hero-card") && !t.closest(".hero-tile-btn")) setOpen(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, reveal, uid]);

  return (
    <div
      ref={viewRef}
      className="hero-field"
      role="region"
      aria-label={labels.label}
      aria-describedby={hintId}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e, false)}
      onPointerCancel={(e) => endDrag(e, true)}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        if (e.target !== e.currentTarget && (e.target as Element).classList.contains("hero-tile-btn")) reveal(e.target.parentElement);
      }}
    >
      <p id={hintId} className="st-visually-hidden">
        {labels.hint}
      </p>
      {/* The plane is a picture space: it never mirrors. Captions keep the page direction. */}
      <div ref={planeRef} className="hero-plane" dir="ltr">
        {tiles.map((t, i) => {
          const isOpen = open === i;
          const cardId = `${uid}-card-${i}`;
          const titleId = `${cardId}-title`;
          return (
            <div
              key={t.art}
              className="hero-tile"
              data-size={t.size}
              style={{ "--x": `${t.x}%`, "--y": `${t.y}%`, "--ratio": t.ratio, "--i": i } as CSSProperties}
            >
              <button
                type="button"
                className="hero-tile-btn"
                aria-expanded={isOpen}
                aria-controls={isOpen ? cardId : undefined}
                onClick={(e) => toggle(i, e.currentTarget)}
              >
                <span className="hero-art">
                  <TileArt kind={t.art} uid={`${uid}-${t.art}`} />
                </span>
                <span className="hero-caption" dir="auto">
                  <span className="hero-caption-name">{t.caption}</span>
                  <span className="hero-caption-move">{t.move}</span>
                </span>
              </button>
              {isOpen ? (
                <div
                  id={cardId}
                  className="hero-card"
                  role="dialog"
                  aria-labelledby={titleId}
                  tabIndex={-1}
                  dir="auto"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      close(true);
                    }
                  }}
                >
                  <div className="hero-card-head">
                    <span className="st-chip">
                      <span className="st-visually-hidden">{labels.moveLabel}: </span>
                      {t.move}
                    </span>
                    <button type="button" className="st-btn" data-variant="ghost" data-icon-only="" aria-label={labels.close} onClick={() => close(true)}>
                      <CloseIcon size={16} />
                    </button>
                  </div>
                  <p className="hero-card-eyebrow">{labels.sample}</p>
                  <p className="hero-card-title" id={titleId}>
                    {t.title}
                  </p>
                  <p className="hero-card-twist">
                    <span className="hero-card-label">{labels.twist}:</span> {t.twist}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
