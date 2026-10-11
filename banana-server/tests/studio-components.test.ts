/**
 * Pure logic behind the Studio primitives: the toast store and timer, shortcut labels, and
 * tooltip placement. DOM behavior is covered by e2e/studio-primitives.spec.ts.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DURATIONS,
  MAX_TOASTS,
  createToastBus,
  createToastTimer,
  dedupeKeyOf,
  toastRole,
} from "@/components/studio/toastBus";
import { detectPlatform, parseShortcut, shortcutName, splitShortcut, toAriaKeyShortcuts } from "@/components/studio/shortcutKeys";
import { placeTooltip, toLogicalPlacement } from "@/components/studio/Tooltip";

describe("toast bus", () => {
  it("adds a toast with the default duration for its kind", () => {
    const bus = createToastBus();
    const id = bus.push({ kind: "success", title: "Link copied" });
    const [t] = bus.getSnapshot();
    expect(t).toMatchObject({ id, kind: "success", title: "Link copied", count: 1, version: 1, duration: 4000 });
  });

  it("uses 4s for success and info, 6s for warning, and keeps errors until closed", () => {
    expect(DEFAULT_DURATIONS).toEqual({ success: 4000, info: 4000, warning: 6000, error: null });
    const bus = createToastBus();
    bus.push({ kind: "error", title: "Could not save" });
    expect(bus.getSnapshot()[0]?.duration).toBeNull();
  });

  it("defaults to info", () => {
    const bus = createToastBus();
    bus.push({ title: "Saved" });
    expect(bus.getSnapshot()[0]?.kind).toBe("info");
  });

  it("de-duplicates the same toast into a count and moves it to the newest place", () => {
    const bus = createToastBus();
    const a = bus.push({ kind: "error", title: "Could not save", body: "Offline." });
    bus.push({ kind: "info", title: "Other" });
    const b = bus.push({ kind: "error", title: "Could not save", body: "Offline." });
    expect(b).toBe(a);
    const list = bus.getSnapshot();
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ id: a, count: 2, version: 2 });
  });

  it("de-duplicates by dedupeKey even when the text differs", () => {
    const bus = createToastBus();
    bus.push({ kind: "info", title: "Saving 1 item", dedupeKey: "save" });
    bus.push({ kind: "info", title: "Saving 2 items", dedupeKey: "save" });
    expect(bus.getSnapshot()).toHaveLength(1);
    expect(bus.getSnapshot()[0]?.count).toBe(2);
  });

  it("does not de-duplicate when dedupeKey is false", () => {
    const bus = createToastBus();
    bus.push({ title: "Same", dedupeKey: false });
    bus.push({ title: "Same", dedupeKey: false });
    expect(bus.getSnapshot()).toHaveLength(2);
  });

  it("treats different kinds or bodies as different toasts", () => {
    expect(dedupeKeyOf({ kind: "error", title: "A" })).not.toBe(dedupeKeyOf({ kind: "warning", title: "A" }));
    expect(dedupeKeyOf({ title: "A", body: "x" })).not.toBe(dedupeKeyOf({ title: "A", body: "y" }));
  });

  it("caps the stack, dropping the oldest non-error toast first", () => {
    const bus = createToastBus();
    bus.push({ kind: "error", title: "E1" });
    for (let i = 0; i < MAX_TOASTS; i++) bus.push({ kind: "info", title: `I${i}` });
    const titles = bus.getSnapshot().map((t) => t.title);
    expect(titles).toHaveLength(MAX_TOASTS);
    expect(titles[0]).toBe("E1");
    expect(titles).not.toContain("I0");
  });

  it("dismisses, clears and notifies subscribers, with a stable snapshot between changes", () => {
    const bus = createToastBus();
    const listener = vi.fn();
    const off = bus.subscribe(listener);
    const id = bus.push({ title: "A" });
    const snap = bus.getSnapshot();
    expect(bus.getSnapshot()).toBe(snap);
    bus.dismiss("nope");
    expect(listener).toHaveBeenCalledTimes(1);
    bus.dismiss(id);
    expect(bus.getSnapshot()).toEqual([]);
    bus.push({ title: "B" });
    bus.clear();
    expect(listener).toHaveBeenCalledTimes(4);
    off();
    bus.push({ title: "C" });
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("announces errors and warnings as alerts, the rest as status", () => {
    expect(toastRole("error")).toBe("alert");
    expect(toastRole("warning")).toBe("alert");
    expect(toastRole("success")).toBe("status");
    expect(toastRole("info")).toBe("status");
  });
});

describe("toast timer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("expires after its duration", () => {
    const done = vi.fn();
    createToastTimer(4000, done);
    vi.advanceTimersByTime(3999);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("never expires with a null duration (errors)", () => {
    const done = vi.fn();
    createToastTimer(null, done);
    vi.advanceTimersByTime(60_000);
    expect(done).not.toHaveBeenCalled();
  });

  it("pauses and resumes with the time that was left", () => {
    const done = vi.fn();
    const t = createToastTimer(4000, done);
    vi.advanceTimersByTime(3000);
    t.pause();
    vi.advanceTimersByTime(10_000);
    expect(done).not.toHaveBeenCalled();
    t.resume();
    vi.advanceTimersByTime(999);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("restarts with the full duration on a repeat, and stays paused if paused", () => {
    const done = vi.fn();
    const t = createToastTimer(4000, done);
    vi.advanceTimersByTime(3500);
    t.restart();
    vi.advanceTimersByTime(3999);
    expect(done).not.toHaveBeenCalled();
    t.pause();
    t.restart();
    vi.advanceTimersByTime(10_000);
    expect(done).not.toHaveBeenCalled();
    t.resume();
    vi.advanceTimersByTime(4000);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("does nothing after cancel", () => {
    const done = vi.fn();
    const t = createToastTimer(1000, done);
    t.cancel();
    t.resume();
    vi.advanceTimersByTime(5000);
    expect(done).not.toHaveBeenCalled();
  });
});

describe("shortcut keys", () => {
  it("splits on plus, keeps a literal plus, and reads Mac glyph strings", () => {
    expect(splitShortcut("Ctrl+Shift+P")).toEqual(["Ctrl", "Shift", "P"]);
    expect(splitShortcut("Ctrl++")).toEqual(["Ctrl", "plus"]);
    expect(splitShortcut("+")).toEqual(["plus"]);
    expect(splitShortcut("⌘⇧Z")).toEqual(["mod", "shift", "Z"]);
    expect(splitShortcut("⌘K")).toEqual(["mod", "K"]);
    expect(splitShortcut("?")).toEqual(["?"]);
    expect(splitShortcut("")).toEqual([]);
  });

  it("shows Mod as ⌘ on a Mac and Ctrl elsewhere", () => {
    expect(parseShortcut("Mod+Shift+p", "mac").map((k) => k.label)).toEqual(["⌘", "⇧", "P"]);
    expect(parseShortcut("Mod+Shift+p", "other").map((k) => k.label)).toEqual(["Ctrl", "Shift", "P"]);
    expect(parseShortcut("Ctrl+0", "mac").map((k) => k.label)).toEqual(["⌃", "0"]);
    expect(parseShortcut("Alt+ArrowUp", "other").map((k) => k.label)).toEqual(["Alt", "↑"]);
  });

  it("gives spoken names and aria-keyshortcuts values", () => {
    expect(shortcutName("Mod+K", "mac")).toBe("Command+K");
    expect(shortcutName("Shift+1", "other")).toBe("Shift+1");
    expect(toAriaKeyShortcuts("Mod+Shift+P", "mac")).toBe("Meta+Shift+P");
    expect(toAriaKeyShortcuts("Mod+Shift+P", "other")).toBe("Control+Shift+P");
    expect(toAriaKeyShortcuts("Escape", "other")).toBe("Escape");
    expect(toAriaKeyShortcuts("?", "mac")).toBe("?");
  });

  it("detects the platform", () => {
    expect(detectPlatform(undefined)).toBe("other");
    expect(detectPlatform({ platform: "MacIntel" })).toBe("mac");
    expect(detectPlatform({ userAgentData: { platform: "macOS" } })).toBe("mac");
    expect(detectPlatform({ platform: "Win32" })).toBe("other");
  });
});

describe("tooltip placement", () => {
  const vp = { width: 1000, height: 800 };
  const rect = (left: number, top: number, width = 28, height = 28) => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  });

  it("centers above the trigger by default", () => {
    const p = placeTooltip(rect(486, 400), { width: 100, height: 30 }, vp, "top", false);
    expect(p).toEqual({ x: 450, y: 362, side: "top", arrow: 50 });
  });

  it("flips below when there is no room above", () => {
    expect(placeTooltip(rect(486, 10), { width: 100, height: 30 }, vp, "top", false).side).toBe("bottom");
  });

  it("clamps to the viewport and keeps the arrow on the trigger", () => {
    const p = placeTooltip(rect(0, 400), { width: 200, height: 30 }, vp, "top", false);
    expect(p.x).toBe(8);
    expect(p.arrow).toBe(8);
  });

  it("maps start and end to the reading direction", () => {
    expect(placeTooltip(rect(486, 400), { width: 100, height: 30 }, vp, "start", false).side).toBe("left");
    expect(placeTooltip(rect(486, 400), { width: 100, height: 30 }, vp, "start", true).side).toBe("right");
  });

  it("converts to logical offsets for right-to-left pages", () => {
    const physical = { x: 450, y: 362, side: "top" as const, arrow: 30 };
    expect(toLogicalPlacement(physical, 100, 1000, true)).toEqual({ inlineStart: 450, y: 362, logicalSide: "top", arrow: 70 });
    const side = { x: 100, y: 10, side: "left" as const, arrow: 15 };
    expect(toLogicalPlacement(side, 100, 1000, false).edge).toBe("inline-end");
    expect(toLogicalPlacement(side, 100, 1000, true).edge).toBe("inline-start");
  });
});

describe("studio-components.css", () => {
  const source = readFileSync(fileURLToPath(new URL("../styles/studio-components.css", import.meta.url)), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  it("holds no raw color literals (tokens only)", () => {
    expect(source.match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi)).toBeNull();
  });

  it("uses logical properties only", () => {
    const physical = source.match(/(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)/gm);
    expect(physical).toBeNull();
  });

  it("never sets a fixed duration outside the motion tokens", () => {
    expect(source.match(/\b\d+(\.\d+)?m?s\b/g)).toBeNull();
  });
});
