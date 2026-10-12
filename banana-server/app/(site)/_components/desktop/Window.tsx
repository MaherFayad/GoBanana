"use client";

/**
 * A window on the GoBanana desktop: glass panel, 1rem radius, a title bar with traffic lights.
 *
 * Plain windows (the default) are pictures of a window: the lights are decoration and nothing
 * moves. With `controls`, the window is a small app (WCAG 2.2):
 * - Drag the title bar with a pointer (SC 2.5.7 alternative: the title is a button, and the arrow
 *   keys move the window 16px per press). Text inside the window stays selectable, since only the
 *   title bar starts a drag.
 * - The red light closes (focus goes to a "Reopen" button left in its place, or to `onClose`),
 *   the yellow one minimises to the title bar (aria-expanded), the green one puts the window back.
 *   Escape anywhere inside closes it.
 * - Motion (components/window/motion.ts): a window opened from a button grows out of it, close
 *   scales down and fades, minimise sends a copy of the window into the dock (genie-like) while
 *   the window folds to its title bar, and the green light glides the window back. Reduced
 *   motion: short fades.
 * - Moving is off under 768px (the phone home screen stacks windows) and under
 *   prefers-reduced-motion. The lights still work there.
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { animateClose, animateMinimize, animateOpen, dockTarget, ghost, recentPress, reducedMotion } from "@/components/window/motion";
import { fmt } from "@/lib/site/i18n";

export type WindowLabels = {
  close: string;
  minimise: string;
  restore: string;
  reset: string;
  move: string;
  moveHint: string;
  reopen: string;
};

type Props = {
  title: string;
  children: ReactNode;
  /** Visible title text when it differs from the accessible title (a Latin file name, say). */
  titleNode?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Extra items at the end of the title bar. */
  toolbar?: ReactNode;
  controls?: boolean;
  labels?: WindowLabels;
  /** Close hands focus back to the caller instead of leaving a Reopen button. */
  onClose?: () => void;
  /** Focus the title (move handle) on mount, for windows opened from a button. */
  autoFocus?: boolean;
  /** Working lights from a WindowLayer (FrameLights), in place of the picture lights. */
  lights?: ReactNode;
  style?: CSSProperties;
  id?: string;
  as?: "div" | "section" | "article";
  "aria-labelledby"?: string;
};

const STEP = 16;
const MOVE_QUERY = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";

type Offset = { x: number; y: number };

/**
 * Keeps part of the window on screen: at least 160px of it stays inside the viewport sideways,
 * and it moves at most 60% of the viewport height up or down from where the page put it.
 */
function clampToView(next: Offset, prev: Offset, el: HTMLElement): Offset {
  const r = el.getBoundingClientRect();
  const left = r.left - prev.x;
  const vw = document.documentElement.clientWidth;
  const keepX = Math.min(r.width, 160);
  const minX = keepX - left - r.width;
  const maxX = vw - left - keepX;
  const maxY = window.innerHeight * 0.6;
  return { x: Math.min(maxX, Math.max(minX, next.x)), y: Math.min(maxY, Math.max(-maxY, next.y)) };
}

export function Window({
  title,
  titleNode,
  children,
  className,
  bodyClassName,
  toolbar,
  controls = false,
  labels,
  onClose,
  autoFocus,
  lights,
  style,
  id,
  as: Tag = "section",
  ...rest
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [minimised, setMinimised] = useState(false);
  const [closed, setClosed] = useState(false);
  const [canMove, setCanMove] = useState(false);
  const [dragging, setDragging] = useState(false);
  const focusAfter = useRef<"reopen" | "handle" | null>(null);

  useEffect(() => {
    if (!controls) return;
    const mq = window.matchMedia(MOVE_QUERY);
    const sync = () => {
      setCanMove(mq.matches);
      if (!mq.matches) setOffset({ x: 0, y: 0 });
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [controls]);

  // Runs again once the move handle replaces the plain title (canMove is known after mount).
  useEffect(() => {
    if (autoFocus) handleRef.current?.focus();
  }, [autoFocus, canMove]);

  // A window opened from a button (Quick Look) grows out of it; a reopened one scales in.
  const reopening = useRef(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || closed) return;
    if (autoFocus || reopening.current) animateOpen(el, recentPress()?.getBoundingClientRect() ?? null);
    reopening.current = false;
  }, [autoFocus, closed]);

  useEffect(() => {
    if (focusAfter.current === "reopen") reopenRef.current?.focus();
    if (focusAfter.current === "handle") handleRef.current?.focus();
    focusAfter.current = null;
  }, [closed]);

  const name = (template: string | undefined) => fmt(template ?? "", { title });

  const leaving = useRef(false);
  async function close() {
    const el = rootRef.current;
    if (leaving.current) return;
    leaving.current = true;
    if (el) await animateClose(el, null);
    leaving.current = false;
    if (onClose) {
      onClose();
      return;
    }
    focusAfter.current = "reopen";
    setClosed(true);
  }

  function toggleMinimised() {
    const el = rootRef.current;
    if (el && !minimised && !reducedMotion()) {
      // A copy flies into the dock while the window folds to its title bar.
      const copy = ghost(el, el.getBoundingClientRect());
      void animateMinimize(copy, dockTarget()).then(() => copy.remove());
    } else if (el) {
      animateOpen(el, null);
    }
    setMinimised((m) => !m);
  }

  function moveTo(next: Offset) {
    const el = rootRef.current;
    setOffset((prev) => (el ? clampToView(next, prev, el) : next));
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (!controls) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      void close();
    }
  }

  function onHandleKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (!canMove) return;
    const d: Record<string, [number, number]> = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] };
    const delta = d[e.key];
    if (!delta) return;
    e.preventDefault();
    moveTo({ x: offset.x + delta[0], y: offset.y + delta[1] });
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!canMove || e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".dwin-light")) return;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    moveTo({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy });
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
  }

  if (closed) {
    return (
      <button
        ref={reopenRef}
        type="button"
        className="dwin-reopen"
        onClick={() => {
          focusAfter.current = "handle";
          reopening.current = true;
          setClosed(false);
        }}
      >
        {name(labels?.reopen)}
      </button>
    );
  }

  const bodyId = id ? `${id}-body` : undefined;
  const moved = offset.x !== 0 || offset.y !== 0;
  const hintId = id ? `${id}-hint` : undefined;

  return (
    <Tag
      ref={rootRef as never}
      id={id}
      className={className ? `dwin ${className}` : "dwin"}
      aria-label={rest["aria-labelledby"] || Tag === "div" ? undefined : title}
      aria-labelledby={rest["aria-labelledby"]}
      data-controls={controls ? "" : undefined}
      data-dragging={dragging ? "" : undefined}
      data-moved={moved ? "" : undefined}
      data-minimised={minimised ? "" : undefined}
      style={moved ? { ...style, translate: `${offset.x}px ${offset.y}px` } : style}
      onKeyDown={onKeyDown}
    >
      <div
        className="dwin-bar"
        data-can-move={canMove ? "" : undefined}
        onPointerDown={controls ? onPointerDown : undefined}
        onPointerMove={controls ? onPointerMove : undefined}
        onPointerUp={controls ? endDrag : undefined}
        onPointerCancel={controls ? endDrag : undefined}
      >
        {controls && labels ? (
          <span className="dwin-lights">
            <button type="button" className="dwin-light" data-light="close" aria-label={name(labels.close)} onClick={() => void close()} />
            <button
              type="button"
              className="dwin-light"
              data-light="min"
              aria-label={name(minimised ? labels.restore : labels.minimise)}
              aria-expanded={!minimised}
              aria-controls={bodyId}
              onClick={toggleMinimised}
            />
            <button
              type="button"
              className="dwin-light"
              data-light="zoom"
              aria-label={name(labels.reset)}
              aria-disabled={!moved}
              onClick={() => moved && setOffset({ x: 0, y: 0 })}
            />
          </span>
        ) : lights ? (
          lights
        ) : (
          <span className="dwin-lights" aria-hidden="true">
            <span className="dwin-light" data-light="close" />
            <span className="dwin-light" data-light="min" />
            <span className="dwin-light" data-light="zoom" />
          </span>
        )}
        {controls && labels && canMove ? (
          <>
            <button
              ref={handleRef}
              type="button"
              className="dwin-title dwin-handle"
              aria-label={name(labels.move)}
              aria-describedby={hintId}
              onKeyDown={onHandleKey}
            >
              <span aria-hidden="true">{titleNode ?? title}</span>
            </button>
            {hintId ? (
              <span id={hintId} className="st-visually-hidden">
                {labels.moveHint}
              </span>
            ) : null}
          </>
        ) : (
          <span ref={handleRef as never} className="dwin-title" aria-hidden="true" tabIndex={autoFocus ? -1 : undefined}>
            {titleNode ?? title}
          </span>
        )}
        <span className="dwin-tools">{toolbar}</span>
      </div>
      <div id={bodyId} className={bodyClassName ? `dwin-body ${bodyClassName}` : "dwin-body"} hidden={minimised}>
        {children}
      </div>
    </Tag>
  );
}
