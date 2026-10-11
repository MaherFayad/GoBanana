"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { detectPlatform, parseShortcut, type Platform } from "./shortcutKeys";

/** One keycap (spec 4.12). Text only; for a full shortcut use ShortcutKeys. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={className ? `st-kbd ${className}` : "st-kbd"}>{children}</kbd>;
}

const noopSubscribe = () => () => {};

/**
 * The viewer's platform. The server and the first client render say "other" (so hydration
 * matches), then Mac browsers re-render with ⌘ glyphs.
 */
export function usePlatform(): Platform {
  return useSyncExternalStore(
    noopSubscribe,
    () => detectPlatform(typeof navigator === "undefined" ? undefined : navigator),
    () => "other",
  );
}

export type ShortcutKeysProps = {
  /** "Mod+Shift+P", "Ctrl+0", "Shift+1", "?", "⌘K". "Mod" is ⌘ on a Mac and Ctrl elsewhere. */
  keys: string;
  /** Force a platform (tests, docs). Default: detect. */
  platform?: Platform;
  className?: string;
};

/**
 * A shortcut as keycaps: "Mod+Shift+P" renders ⌘ ⇧ P on a Mac and Ctrl Shift P elsewhere.
 * Each cap carries its spoken name in visually hidden text, so "⌘" is read as "Command".
 * Put the same shortcut on the control as aria-keyshortcuts (toAriaKeyShortcuts).
 */
export function ShortcutKeys({ keys, platform, className }: ShortcutKeysProps) {
  const detected = usePlatform();
  const caps = parseShortcut(keys, platform ?? detected);
  return (
    <span className={className ? `st-shortcut ${className}` : "st-shortcut"}>
      {caps.map((cap, i) => (
        <kbd key={`${i}-${cap.label}`} className="st-kbd">
          {cap.label === cap.name ? (
            cap.label
          ) : (
            <>
              <span aria-hidden="true">{cap.label}</span>
              <span className="st-visually-hidden">{cap.name}</span>
            </>
          )}
        </kbd>
      ))}
    </span>
  );
}
