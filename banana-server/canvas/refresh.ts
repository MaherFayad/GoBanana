/**
 * Live refresh for the inline canvas (MCP Apps). The host only sends the view the result of
 * the tool call that opened it (`open_canvas`); later agent calls (search_references,
 * add_to_canvas, arrange_canvas) reach the view as nothing at all. So the view polls the
 * app-only `load_canvas_state` tool while it is visible, and refreshes at once when it
 * becomes visible or focused again, or when the host sends a tool result or a context change.
 *
 * Framework free so Vitest can drive it with fake timers.
 *
 * The poll asks by version (`sinceUpdatedAt`, `takedownHash`): an unchanged board costs one
 * small row read and the takedown hash on the server, never the state blob or the full list.
 */
import { compileTakedowns } from "@/lib/takedown";
import type { BridgePersistence } from "./persistence-bridge";

/** Poll interval while the frame is visible and the window has focus. */
export const POLL_FOCUSED_MS = 4_000;
/** Poll interval while visible but not focused (another app or the chat input has focus). */
export const POLL_BLURRED_MS = 15_000;
/** Longest wait after repeated errors. */
export const POLL_MAX_MS = 60_000;

export interface RefreshEnv {
  isVisible(): boolean;
  isFocused(): boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface RefreshScheduler {
  /** Start polling (no immediate tick: the view just loaded). */
  start(): void;
  stop(): void;
  /** Refresh now (visible again, focus, a host notification), then keep the cadence. */
  poke(): void;
  /** Call on visibilitychange, focus and blur: reschedules, and pokes when it became visible. */
  update(): void;
  /** Delay of the timer now set, or null when none is (hidden or stopped). For tests. */
  readonly nextDelay: number | null;
  readonly failures: number;
}

/** Delay before the next poll: by visibility and focus, doubled per failure up to the cap. */
export function pollDelay(visible: boolean, focused: boolean, failures: number): number | null {
  if (!visible) return null;
  const base = focused ? POLL_FOCUSED_MS : POLL_BLURRED_MS;
  return Math.min(POLL_MAX_MS, base * 2 ** Math.max(0, failures));
}

/** `tick` loads and applies the latest state; a rejected promise counts as a failure. */
export function createRefreshScheduler(tick: () => Promise<unknown>, env: RefreshEnv): RefreshScheduler {
  const setTimer = env.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = env.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let delay: number | null = null;
  let running = false;
  let inFlight = false;
  let failures = 0;
  let wasVisible = env.isVisible();

  const clear = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
    delay = null;
  };

  const plan = () => {
    clear();
    if (!running) return;
    const d = pollDelay(env.isVisible(), env.isFocused(), failures);
    if (d === null) return;
    delay = d;
    timer = setTimer(() => void run(), d);
  };

  async function run(): Promise<void> {
    clear();
    if (!running || inFlight || !env.isVisible()) {
      plan();
      return;
    }
    inFlight = true;
    try {
      await tick();
      failures = 0;
    } catch {
      failures += 1;
    } finally {
      inFlight = false;
    }
    plan();
  }

  return {
    start() {
      if (running) return;
      running = true;
      wasVisible = env.isVisible();
      plan();
    },
    stop() {
      running = false;
      clear();
    },
    poke() {
      if (!running) return;
      void run();
    },
    update() {
      if (!running) return;
      const visible = env.isVisible();
      const becameVisible = visible && !wasVisible;
      wasVisible = visible;
      if (becameVisible) void run();
      else plan();
    },
    get nextDelay() {
      return delay;
    },
    get failures() {
      return failures;
    },
  };
}

/** True when `server` is a later save than `base` (ISO times). A missing base takes anything. */
export function isNewer(server: string | undefined, base: string | undefined): boolean {
  if (!server) return false;
  if (!base) return true;
  const a = Date.parse(server);
  const b = Date.parse(base);
  if (Number.isNaN(a) || Number.isNaN(b)) return server !== base;
  return a > b;
}

export type RefreshDecision =
  /** Nothing new on the server. */
  | "skip"
  /** Replace the board with the server state, keeping the viewport and selection. */
  | "apply"
  /** The user is mid-drag, mid-resize or mid-edit: try again on the next poll. */
  | "defer"
  /** Local changes are not saved yet: save them first (a conflict then takes the existing path). */
  | "flush"
  /** A conflict is open; the user chooses in the banner. */
  | "conflict";

export interface RefreshInput {
  newer: boolean;
  /** Unsaved local changes (auto-save pending, saving, or failed). */
  dirty: boolean;
  /** Dragging, resizing or editing text. */
  busy: boolean;
  conflict: boolean;
}

/** The merge rule for a newer server state. Never overwrites the user's unsaved work. */
export function decideRefresh({ newer, dirty, busy, conflict }: RefreshInput): RefreshDecision {
  if (conflict) return "conflict";
  if (!newer) return "skip";
  if (busy) return "defer";
  if (dirty) return "flush";
  return "apply";
}

// ---------------------------------------------------------------------------------- one poll

/** The part of the bridge persistence one poll uses (canvas/persistence-bridge.ts). */
export type PollPersistence = Pick<BridgePersistence, "conflict" | "baseUpdatedAt" | "fetchLatest" | "adopt" | "adoptTakedowns">;

/** The part of the board one poll uses (CanvasApp `refreshRef`). */
export interface PollView {
  offer(remote: { state: unknown; updatedAt: string }, opts: { conflict: boolean }): RefreshDecision;
  prune(isBlocked: (url: string) => boolean): number | null;
}

/**
 * One poll: ask by version. Unchanged with a newer takedown list: hide the newly blocked items
 * from the board the view shows. A newer save: offer it to the board.
 */
export async function pollOnce(persistence: PollPersistence, view: PollView | null): Promise<void> {
  if (persistence.conflict) return;
  const latest = await persistence.fetchLatest();
  if (latest.unchanged) {
    if (!latest.takedowns || !view) return;
    const matcher = compileTakedowns(latest.takedowns.entries);
    if (view.prune((url) => matcher.isBlocked(url)) !== null) persistence.adoptTakedowns(latest.takedowns.hash);
    return;
  }
  if (!isNewer(latest.updatedAt, persistence.baseUpdatedAt)) return;
  const decision = view?.offer(latest, { conflict: persistence.conflict !== null });
  if (decision === "apply") persistence.adopt(latest.updatedAt, latest.takedownHash);
}

// ---------------------------------------------------------------------------------- tray

/** Where the results panel remembers being opened or closed, per session. */
export const TRAY_OPEN_KEY = "bn-tray-open";
let memoryTrayOpen: boolean | null = null;

/** Session preference, or null when the user never toggled it. Storage may throw in a sandbox. */
export function readTrayPreference(storage?: Pick<Storage, "getItem"> | null): boolean | null {
  try {
    const v = storage?.getItem(TRAY_OPEN_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // Opaque-origin frames throw on storage access; the in-memory value stands in.
  }
  return memoryTrayOpen;
}

export function writeTrayPreference(open: boolean, storage?: Pick<Storage, "setItem"> | null): void {
  memoryTrayOpen = open;
  try {
    storage?.setItem(TRAY_OPEN_KEY, open ? "1" : "0");
  } catch {
    // Kept in memory only.
  }
}

/** For tests. */
export function resetTrayPreference(): void {
  memoryTrayOpen = null;
}

/**
 * Whether the results panel starts open. The web canvas opens it on wide screens; the inline
 * canvas in chat starts collapsed (`collapsedByDefault`); a toggle wins (this session on the web,
 * this view in chat).
 */
export function initialTrayOpen(opts: { readOnly: boolean; compact: boolean; collapsedByDefault: boolean; preference: boolean | null }): boolean {
  if (opts.readOnly) return false;
  if (opts.preference !== null && !opts.compact) return opts.preference;
  if (opts.collapsedByDefault) return false;
  return !opts.compact;
}
