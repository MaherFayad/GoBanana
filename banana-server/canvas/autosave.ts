/**
 * Debounced auto-save (spec section 9: debounce 1 s).
 *
 * Framework free so it can be tested with fake timers. Each `schedule()` call
 * restarts the timer; only the last state is saved. A state equal to the last
 * saved one is skipped. Saves never overlap: a change made while a save is in
 * flight is saved right after it finishes.
 */
import type { CanvasState } from "./types";
import { stateKey } from "./state";

export const SAVE_DELAY_MS = 1000;

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface AutoSaverOptions {
  delayMs?: number;
  onStatus?: (status: SaveStatus, error?: unknown) => void;
  /** Key of the state already on the server, so loading does not trigger a save. */
  initialKey?: string;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface AutoSaver {
  schedule(state: CanvasState): void;
  /** Save now if something is waiting. Resolves when that save ends. */
  flush(): Promise<void>;
  cancel(): void;
  /** Mark a state as already saved (for example after a reload from the server). */
  markSaved(state: CanvasState): void;
  readonly status: SaveStatus;
}

export function createAutoSaver(save: (state: CanvasState) => Promise<void>, opts: AutoSaverOptions = {}): AutoSaver {
  const delay = opts.delayMs ?? SAVE_DELAY_MS;
  const setTimer = opts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let timer: unknown = null;
  let pending: CanvasState | null = null;
  let lastSavedKey = opts.initialKey ?? "";
  let inFlight: Promise<void> | null = null;
  let status: SaveStatus = "idle";

  const setStatus = (s: SaveStatus, error?: unknown) => {
    status = s;
    opts.onStatus?.(s, error);
  };

  async function run(): Promise<void> {
    timer = null;
    if (inFlight) {
      // A save is running; it will pick up `pending` when it ends.
      return inFlight;
    }
    const state = pending;
    pending = null;
    if (!state) return;
    const key = stateKey(state);
    if (key === lastSavedKey) {
      setStatus("saved");
      return;
    }
    setStatus("saving");
    inFlight = (async () => {
      try {
        await save(state);
        lastSavedKey = key;
        setStatus(pending ? "pending" : "saved");
      } catch (error) {
        // Keep the failed state so the next change or flush retries it.
        if (!pending) pending = state;
        setStatus("error", error);
      } finally {
        inFlight = null;
      }
    })();
    await inFlight;
    if (pending && status !== "error") await run();
  }

  return {
    schedule(state) {
      if (stateKey(state) === lastSavedKey && !inFlight) {
        pending = null;
        if (timer !== null) clearTimer(timer);
        timer = null;
        return;
      }
      pending = state;
      if (timer !== null) clearTimer(timer);
      timer = setTimer(() => void run(), delay);
      if (status !== "saving") setStatus("pending");
    },
    async flush() {
      if (timer !== null) clearTimer(timer);
      timer = null;
      if (inFlight) await inFlight;
      if (pending) await run();
    },
    cancel() {
      if (timer !== null) clearTimer(timer);
      timer = null;
      pending = null;
    },
    markSaved(state) {
      lastSavedKey = stateKey(state);
    },
    get status() {
      return status;
    },
  };
}
