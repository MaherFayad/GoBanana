"use client";

import {
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";

/** Preferred side. "start" and "end" follow the reading direction. */
export type TooltipSide = "top" | "bottom" | "start" | "end";

export type TooltipProps = {
  /** Supplementary text. The trigger must already have its own accessible name. */
  content: ReactNode;
  /** One element that accepts DOM props and a ref (a <button>, an <a>, ...). */
  children: ReactElement;
  side?: TooltipSide;
  /** 280px instead of 240px. */
  wide?: boolean;
  /** Pointer hover delay in ms. Keyboard focus opens at once. Default 400. */
  delay?: number;
  /** Open on keyboard focus too. Default true. */
  openOnFocus?: boolean;
  /** Turn the tooltip off without changing the tree. */
  disabled?: boolean;
};

/** Close grace when the pointer leaves the trigger or the bubble (spec 9.5). */
export const TOOLTIP_CLOSE_GRACE_MS = 100;
const GAP = 8;
const EDGE = 8;

type Placement = {
  x: number;
  y: number;
  side: "top" | "bottom" | "left" | "right";
  arrow: number;
};

/** Placement in logical terms, ready for inset-inline-start and the arrow rules in CSS. */
type LogicalPlacement = {
  inlineStart: number;
  y: number;
  logicalSide: "top" | "bottom" | "inline";
  edge?: "inline-start" | "inline-end";
  arrow: number;
};

export function toLogicalPlacement(p: Placement, bubbleWidth: number, viewportWidth: number, rtl: boolean): LogicalPlacement {
  const inlineStart = rtl ? viewportWidth - p.x - bubbleWidth : p.x;
  if (p.side === "top" || p.side === "bottom") {
    return { inlineStart, y: p.y, logicalSide: p.side, arrow: rtl ? bubbleWidth - p.arrow : p.arrow };
  }
  // The arrow sits on the bubble edge that faces the trigger.
  const faceRight = p.side === "left";
  const edge = faceRight === !rtl ? "inline-end" : "inline-start";
  return { inlineStart, y: p.y, logicalSide: "inline", edge, arrow: p.arrow };
}

type ChildProps = {
  ref?: Ref<HTMLElement>;
  "aria-describedby"?: string;
  "aria-label"?: string;
  onPointerEnter?: (e: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (e: PointerEvent<HTMLElement>) => void;
  onFocus?: (e: FocusEvent<HTMLElement>) => void;
  onBlur?: (e: FocusEvent<HTMLElement>) => void;
};

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref && typeof ref === "object") (ref as { current: T | null }).current = value;
}

/** Where to put the bubble: preferred side, flipped when it does not fit, clamped to the viewport. */
export function placeTooltip(
  trigger: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  bubble: { width: number; height: number },
  viewport: { width: number; height: number },
  side: TooltipSide,
  rtl: boolean,
): Placement {
  const physical = side === "start" ? (rtl ? "right" : "left") : side === "end" ? (rtl ? "left" : "right") : side;
  const fits = {
    top: trigger.top - GAP - bubble.height >= EDGE,
    bottom: trigger.bottom + GAP + bubble.height <= viewport.height - EDGE,
    left: trigger.left - GAP - bubble.width >= EDGE,
    right: trigger.right + GAP + bubble.width <= viewport.width - EDGE,
  };
  const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" } as const;
  const chosen = fits[physical] || !fits[opposite[physical]] ? physical : opposite[physical];
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
  if (chosen === "top" || chosen === "bottom") {
    const x = clamp(trigger.left + trigger.width / 2 - bubble.width / 2, EDGE, viewport.width - EDGE - bubble.width);
    const y = chosen === "top" ? trigger.top - GAP - bubble.height : trigger.bottom + GAP;
    const arrow = clamp(trigger.left + trigger.width / 2 - x, 8, bubble.width - 8);
    return { x, y, side: chosen, arrow };
  }
  const y = clamp(trigger.top + trigger.height / 2 - bubble.height / 2, EDGE, viewport.height - EDGE - bubble.height);
  const x = chosen === "left" ? trigger.left - GAP - bubble.width : trigger.right + GAP;
  const arrow = clamp(trigger.top + trigger.height / 2 - y, 8, bubble.height - 8);
  return { x, y, side: chosen, arrow };
}

/**
 * Tooltip (spec 4.5 and 9.5, SC 1.4.13). Replaces every title= attribute.
 *
 * - Opens on pointer hover (after `delay`) and on keyboard focus; never on touch.
 * - Hoverable: the pointer can move onto the bubble; it closes 100ms after the pointer leaves both.
 * - Dismissible: Escape closes it without moving focus or the pointer (and only the tooltip).
 * - Also closes on scroll, outside pointerdown and blur.
 * - The bubble stays mounted (hidden) so aria-describedby always resolves; role="tooltip".
 * - Portaled to document.body, or into the open <dialog> that holds the trigger so it stays in
 *   the top layer. Theme (data-theme), dir and lang are copied from the trigger's ancestors.
 */
export function Tooltip({ content, children, side = "top", wide, delay = 400, openOnFocus = true, disabled }: TooltipProps) {
  const id = useId();
  const tooltipId = `st-tooltip-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [context, setContext] = useState<{ theme?: string; dir: "ltr" | "rtl"; lang?: string }>({ dir: "ltr" });
  const [placement, setPlacement] = useState<LogicalPlacement | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  const show = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || disabled) return;
    clearTimers();
    const themed = trigger.closest<HTMLElement>("[data-theme]");
    const langEl = trigger.closest<HTMLElement>("[lang]");
    setContext({
      theme: themed?.dataset.theme,
      dir: getComputedStyle(trigger).direction === "rtl" ? "rtl" : "ltr",
      lang: langEl?.lang || undefined,
    });
    setHost(trigger.closest<HTMLElement>("dialog") ?? document.body);
    setOpen(true);
  }, [clearTimers, disabled]);

  const hide = useCallback(() => {
    clearTimers();
    setOpen(false);
    setPlacement(null);
  }, [clearTimers]);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    closeTimer.current = window.setTimeout(hide, TOOLTIP_CLOSE_GRACE_MS);
  }, [hide]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  // Mount the (hidden) bubble after hydration so aria-describedby resolves.
  useEffect(() => {
    setHost((h) => h ?? triggerRef.current?.closest<HTMLElement>("dialog") ?? document.body);
    return clearTimers;
  }, [clearTimers]);

  // Position once the bubble has a size, then show it.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    const t = trigger.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const root = document.documentElement;
    const rtl = context.dir === "rtl";
    const physical = placeTooltip(t, { width: b.width, height: b.height }, { width: root.clientWidth, height: root.clientHeight }, side, rtl);
    setPlacement(toLogicalPlacement(physical, b.width, root.clientWidth, rtl));
  }, [open, side, context.dir, content]);

  // While open: Escape, scroll and outside pointerdown close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape dismisses the tooltip only, not the dialog or menu around it.
      e.preventDefault();
      e.stopPropagation();
      hide();
    };
    const onScroll = (e: Event) => {
      if (bubbleRef.current && e.target instanceof Node && bubbleRef.current.contains(e.target)) return;
      hide();
    };
    const onDown = (e: globalThis.PointerEvent) => {
      const target = e.target as Node | null;
      if (target && (triggerRef.current?.contains(target) || bubbleRef.current?.contains(target))) return;
      hide();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, hide]);

  const visible = open && !disabled;
  if (!isValidElement<ChildProps>(children)) return children;
  const childProps = children.props;

  const Trigger = children.type as ElementType;
  const triggerProps: ChildProps = {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      setRef(childProps.ref, node);
    },
    // A hint that repeats the control's own name is not a description (no double reading).
    "aria-describedby": disabled || (typeof content === "string" && content === childProps["aria-label"])
      ? childProps["aria-describedby"]
      : [childProps["aria-describedby"], tooltipId].filter(Boolean).join(" "),
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      childProps.onPointerEnter?.(e);
      if (e.pointerType === "touch" || disabled) return;
      cancelClose();
      if (open) return;
      if (openTimer.current !== null) window.clearTimeout(openTimer.current);
      openTimer.current = window.setTimeout(show, delay);
    },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      childProps.onPointerLeave?.(e);
      if (triggerRef.current && triggerRef.current === document.activeElement && triggerRef.current.matches(":focus-visible")) {
        if (openTimer.current !== null) window.clearTimeout(openTimer.current);
        openTimer.current = null;
        return;
      }
      scheduleClose();
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      childProps.onFocus?.(e);
      if (!openOnFocus || disabled) return;
      let keyboard = true;
      try {
        keyboard = e.currentTarget.matches(":focus-visible");
      } catch {
        keyboard = true;
      }
      if (keyboard) show();
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      childProps.onBlur?.(e);
      if (bubbleRef.current?.matches(":hover")) return;
      hide();
    },
  };

  const style = placement
    ? ({
        "--st-tt-x": `${placement.inlineStart}px`,
        "--st-tt-y": `${placement.y}px`,
        "--st-tt-arrow": `${placement.arrow}px`,
      } as CSSProperties)
    : undefined;

  return (
    <>
      <Trigger key={children.key ?? undefined} {...childProps} {...triggerProps} />
      {host &&
        createPortal(
          <div
            ref={bubbleRef}
            id={tooltipId}
            role="tooltip"
            className="st-tooltip"
            hidden={!visible}
            data-state={visible && placement ? "open" : "closed"}
            data-side={placement?.logicalSide}
            data-edge={placement?.edge}
            data-wide={wide ? "" : undefined}
            data-theme={context.theme}
            dir={context.dir}
            lang={context.lang}
            style={style}
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
          >
            {content}
            <span className="st-tooltip-arrow" aria-hidden="true" />
          </div>,
          host,
        )}
    </>
  );
}
