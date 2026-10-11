"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, CloseIcon, ErrorIcon, InfoIcon, WarningIcon } from "./icons";
import { modalStack } from "./modalStack";
import {
  createToastTimer,
  toastBus,
  toastRole,
  type Toast,
  type ToastBus,
  type ToastKind,
  type ToastTimer,
} from "./toastBus";

export { dismissToast, pushToast } from "./toastBus";
export type { ToastInput, ToastKind } from "./toastBus";

export type ToastLabels = {
  /** Name of the notifications landmark. */
  region: string;
  /** Accessible name of each toast's close button. */
  close: string;
};

const DEFAULT_LABELS: ToastLabels = { region: "Notifications", close: "Close notification" };

const KIND_ICON: Record<ToastKind, typeof InfoIcon> = {
  info: InfoIcon,
  success: CheckIcon,
  warning: WarningIcon,
  error: ErrorIcon,
};

const EMPTY: readonly Toast[] = [];

/**
 * Mount once near the root of a surface (web canvas, inline canvas, site). Renders children and
 * the toast stack at the block end and inline end corner (bottom right in English, bottom left
 * in Arabic). Toasts are pushed from anywhere with pushToast().
 */
export function ToastProvider({ children, labels, bus }: { children?: ReactNode; labels?: Partial<ToastLabels>; bus?: ToastBus }) {
  return (
    <>
      {children}
      <ToastViewport labels={labels} bus={bus} />
    </>
  );
}

/**
 * The stack itself. Two live regions are always mounted (screen readers ignore regions that
 * appear together with their text): errors and warnings go to role="alert", the rest to
 * role="status". Timers pause while the pointer is over the stack, while focus is inside it,
 * and while the tab is hidden.
 *
 * While a modal Dialog is open the stack and both regions render inside it: the rest of the
 * page is inert and under the backdrop then, so toasts outside would be neither seen nor read.
 */
export function ToastViewport({ labels, bus = toastBus }: { labels?: Partial<ToastLabels>; bus?: ToastBus }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const toasts = useSyncExternalStore(bus.subscribe, bus.getSnapshot, () => EMPTY);
  const modal = useSyncExternalStore(modalStack.subscribe, modalStack.top, () => null);
  const [hovered, setHovered] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const announced = useRef(new Map<string, number>());
  const stackRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // Announce new toasts and repeats. The region is emptied first so a repeat of the same text
  // is read again.
  useEffect(() => {
    const seen = announced.current;
    const fresh = toasts.filter((t) => seen.get(t.id) !== t.version);
    for (const id of [...seen.keys()]) if (!toasts.some((t) => t.id === id)) seen.delete(id);
    if (fresh.length === 0) return;
    for (const t of fresh) seen.set(t.id, t.version);
    const say = (list: Toast[]) => list.map((t) => [t.title, t.body].filter(Boolean).join(". ")).join(". ");
    const urgent = fresh.filter((t) => toastRole(t.kind) === "alert");
    const calm = fresh.filter((t) => toastRole(t.kind) === "status");
    if (urgent.length) setAssertive("");
    if (calm.length) setPolite("");
    const timer = window.setTimeout(() => {
      if (urgent.length) setAssertive(say(urgent));
      if (calm.length) setPolite(say(calm));
    }, 60);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  // An emptied stack unmounts without pointerleave or blur, so reset those flags here.
  useEffect(
    () =>
      bus.subscribe(() => {
        if (bus.getSnapshot().length === 0) {
          setHovered(false);
          setFocusInside(false);
        }
      }),
    [bus],
  );

  const paused = hovered || focusInside || hidden;

  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false);
  };

  const dismiss = (id: string) => {
    const stack = stackRef.current;
    const hadFocus = !!stack && stack.contains(document.activeElement);
    bus.dismiss(id);
    if (hadFocus && stack) {
      // Keep keyboard users in the stack while other toasts remain.
      requestAnimationFrame(() => {
        const next = stack.querySelector<HTMLElement>(".st-toast [data-toast-close]");
        next?.focus();
      });
    }
  };

  const view = (
    <>
      <div className="st-visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="st-visually-hidden" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
      {toasts.length > 0 && (
        <section
          ref={stackRef}
          className="st-toast-stack"
          aria-label={text.region}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onFocus={() => setFocusInside(true)}
          onBlur={onBlur}
        >
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} paused={paused} closeLabel={text.close} onDismiss={dismiss} />
          ))}
        </section>
      )}
    </>
  );
  return modal ? createPortal(view, modal) : view;
}

function ToastCard({
  toast,
  paused,
  closeLabel,
  onDismiss,
}: {
  toast: Toast;
  paused: boolean;
  closeLabel: string;
  onDismiss: (id: string) => void;
}) {
  const timer = useRef<ToastTimer | null>(null);
  const dismissRef = useRef(onDismiss);
  const pausedRef = useRef(paused);

  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    const t = createToastTimer(toast.duration, () => dismissRef.current(toast.id));
    if (pausedRef.current) t.pause();
    timer.current = t;
    return () => t.cancel();
  }, [toast.id, toast.duration]);

  useEffect(() => {
    if (toast.version > 1) timer.current?.restart();
  }, [toast.version]);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) timer.current?.pause();
    else timer.current?.resume();
  }, [paused]);

  const Icon = KIND_ICON[toast.kind];
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      // Inside an open dialog, Escape closes the toast only, not the dialog.
      e.preventDefault();
      e.stopPropagation();
      onDismiss(toast.id);
    }
  };

  return (
    <div className="st-toast" data-kind={toast.kind} data-toast-id={toast.id} onKeyDown={onKeyDown}>
      <span className="st-toast-icon">
        <Icon size={16} />
      </span>
      <div className="st-toast-content">
        <p className="st-toast-title">
          {toast.title}
          {toast.count > 1 && <span className="st-toast-count">×{toast.count}</span>}
        </p>
        {toast.body && <p className="st-toast-body">{toast.body}</p>}
        {toast.action && (
          <div className="st-toast-actions">
            <button
              type="button"
              className="st-btn"
              data-variant="secondary"
              data-size="xs"
              onClick={() => {
                toast.action?.onAction();
                onDismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        className="st-btn"
        data-variant="ghost"
        data-size="xs"
        data-icon-only=""
        data-toast-close=""
        aria-label={closeLabel}
        onClick={() => onDismiss(toast.id)}
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
}
