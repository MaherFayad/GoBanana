/**
 * Toast store (spec 4.7, plan Step 0). Framework free, so it can be unit tested and called from
 * anywhere (event handlers, fetch callbacks) without a React context:
 *
 *   pushToast({ kind: "error", title: "Could not save", body: "Check your connection." })
 *
 * - De-duplicates by default: a toast with the same key as one on screen bumps its "×N" count
 *   and restarts its timer instead of stacking a copy. Key: dedupeKey, else kind + title + body.
 *   Pass dedupeKey: false to always add a new toast.
 * - Timing: success and info 4s, warning 6s. Errors stay until closed (spec 12 row 16).
 * - Errors and warnings are announced with role="alert", the rest with role="status"
 *   (see Toast.tsx; this file only says which).
 */

export type ToastKind = "info" | "success" | "warning" | "error";

export type ToastAction = { label: string; onAction: () => void };

export type ToastInput = {
  kind?: ToastKind;
  title: string;
  body?: string;
  /** Same key, same toast: the count goes up. false turns de-duplication off. */
  dedupeKey?: string | false;
  /** Milliseconds before it closes itself; null keeps it until closed. Default by kind. */
  duration?: number | null;
  /** One optional button, for example "Try again". */
  action?: ToastAction;
};

export type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  key: string | null;
  duration: number | null;
  action?: ToastAction;
  /** How many times it was pushed while on screen. */
  count: number;
  /** Bumped on every repeat, so timers and announcements restart. */
  version: number;
};

export const DEFAULT_DURATIONS: Record<ToastKind, number | null> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: null,
};

/** Most toasts on screen at once; the oldest non-error toast leaves first. */
export const MAX_TOASTS = 5;

export function toastRole(kind: ToastKind): "alert" | "status" {
  return kind === "error" || kind === "warning" ? "alert" : "status";
}

export function dedupeKeyOf(input: ToastInput): string | null {
  if (input.dedupeKey === false) return null;
  if (typeof input.dedupeKey === "string") return input.dedupeKey;
  return `${input.kind ?? "info"}\u0000${input.title}\u0000${input.body ?? ""}`;
}

export type ToastBus = {
  push(input: ToastInput): string;
  dismiss(id: string): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): readonly Toast[];
};

export function createToastBus(options: { max?: number } = {}): ToastBus {
  const max = options.max ?? MAX_TOASTS;
  let toasts: readonly Toast[] = [];
  let seq = 0;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const l of [...listeners]) l();
  };

  return {
    push(input) {
      const kind = input.kind ?? "info";
      const key = dedupeKeyOf(input);
      const existing = key === null ? undefined : toasts.find((t) => t.key === key);
      if (existing) {
        const updated: Toast = {
          ...existing,
          count: existing.count + 1,
          version: existing.version + 1,
          action: input.action ?? existing.action,
        };
        // A repeat moves to the newest position, nearest the corner.
        toasts = [...toasts.filter((t) => t.id !== existing.id), updated];
        emit();
        return existing.id;
      }
      seq += 1;
      const toast: Toast = {
        id: `toast-${seq}`,
        kind,
        title: input.title,
        body: input.body,
        key,
        duration: input.duration === undefined ? DEFAULT_DURATIONS[kind] : input.duration,
        action: input.action,
        count: 1,
        version: 1,
      };
      let next = [...toasts, toast];
      while (next.length > max) {
        const drop = next.find((t) => t.kind !== "error" && t.id !== toast.id) ?? next[0];
        next = next.filter((t) => t !== drop);
      }
      toasts = next;
      emit();
      return toast.id;
    },
    dismiss(id) {
      if (!toasts.some((t) => t.id === id)) return;
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    },
    clear() {
      if (toasts.length === 0) return;
      toasts = [];
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return toasts;
    },
  };
}

/** The app-wide bus that ToastProvider renders. */
export const toastBus = createToastBus();

export const pushToast = (input: ToastInput): string => toastBus.push(input);
export const dismissToast = (id: string): void => toastBus.dismiss(id);

export type ToastTimer = {
  pause(): void;
  resume(): void;
  /** Start over with the full duration (a repeat of the same toast). */
  restart(): void;
  cancel(): void;
};

/**
 * Countdown that can pause (hover, focus inside the stack, hidden tab) and keeps the time left.
 * A null duration never expires.
 */
export function createToastTimer(
  duration: number | null,
  onExpire: () => void,
  clock: { now(): number; set(fn: () => void, ms: number): unknown; clear(handle: unknown): void } = {
    now: () => Date.now(),
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  },
): ToastTimer {
  let remaining = duration;
  let startedAt = 0;
  let handle: unknown = null;
  let paused = false;
  let done = false;

  const start = () => {
    if (remaining === null || done || paused) return;
    startedAt = clock.now();
    handle = clock.set(() => {
      handle = null;
      done = true;
      onExpire();
    }, remaining);
  };
  const stop = () => {
    if (handle !== null) {
      clock.clear(handle);
      handle = null;
      if (remaining !== null) remaining = Math.max(0, remaining - (clock.now() - startedAt));
    }
  };

  start();
  return {
    pause() {
      if (paused) return;
      stop();
      paused = true;
    },
    resume() {
      if (!paused) return;
      paused = false;
      start();
    },
    restart() {
      stop();
      remaining = duration;
      done = false;
      start();
    },
    cancel() {
      stop();
      done = true;
    },
  };
}
