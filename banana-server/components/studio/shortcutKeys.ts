/**
 * Pure helpers for keyboard shortcut labels (Kbd, ShortcutKeys) and aria-keyshortcuts values.
 *
 * Input grammar: keys joined by "+", for example "Mod+Shift+P", "Ctrl+0", "Shift+1", "?",
 * "Alt+ArrowUp", or Mac glyph strings such as "⌘K" and "⌘⇧Z". "Mod" is Command on a Mac and
 * Control elsewhere; "Ctrl" always means the Control key. A literal plus is "Plus" (or a
 * trailing "+", as in "Ctrl++").
 */

export type Platform = "mac" | "other";

export type ShortcutKey = {
  /** What the keycap shows: "⌘", "Ctrl", "⇧", "Shift", "P". */
  label: string;
  /** Spoken name for assistive tech: "Command", "Control", "Shift", "P". */
  name: string;
  /** Value for aria-keyshortcuts (UI Events key names): "Meta", "Control", "Shift", "P". */
  aria: string;
};

type KeyDef = { mac: string; other: string; name: { mac: string; other: string }; aria: { mac: string; other: string } };

const same = (label: string, name = label, aria = label): KeyDef => ({
  mac: label,
  other: label,
  name: { mac: name, other: name },
  aria: { mac: aria, other: aria },
});

const KEYS: Record<string, KeyDef> = {
  mod: { mac: "⌘", other: "Ctrl", name: { mac: "Command", other: "Control" }, aria: { mac: "Meta", other: "Control" } },
  cmd: { mac: "⌘", other: "Win", name: { mac: "Command", other: "Windows" }, aria: { mac: "Meta", other: "Meta" } },
  meta: { mac: "⌘", other: "Win", name: { mac: "Command", other: "Windows" }, aria: { mac: "Meta", other: "Meta" } },
  ctrl: { mac: "⌃", other: "Ctrl", name: { mac: "Control", other: "Control" }, aria: { mac: "Control", other: "Control" } },
  control: { mac: "⌃", other: "Ctrl", name: { mac: "Control", other: "Control" }, aria: { mac: "Control", other: "Control" } },
  alt: { mac: "⌥", other: "Alt", name: { mac: "Option", other: "Alt" }, aria: { mac: "Alt", other: "Alt" } },
  option: { mac: "⌥", other: "Alt", name: { mac: "Option", other: "Alt" }, aria: { mac: "Alt", other: "Alt" } },
  shift: { mac: "⇧", other: "Shift", name: { mac: "Shift", other: "Shift" }, aria: { mac: "Shift", other: "Shift" } },
  enter: { mac: "↵", other: "Enter", name: { mac: "Return", other: "Enter" }, aria: { mac: "Enter", other: "Enter" } },
  return: { mac: "↵", other: "Enter", name: { mac: "Return", other: "Enter" }, aria: { mac: "Enter", other: "Enter" } },
  backspace: { mac: "⌫", other: "Backspace", name: { mac: "Delete", other: "Backspace" }, aria: { mac: "Backspace", other: "Backspace" } },
  delete: { mac: "⌦", other: "Delete", name: { mac: "Forward delete", other: "Delete" }, aria: { mac: "Delete", other: "Delete" } },
  del: { mac: "⌦", other: "Delete", name: { mac: "Forward delete", other: "Delete" }, aria: { mac: "Delete", other: "Delete" } },
  escape: same("Esc", "Escape", "Escape"),
  esc: same("Esc", "Escape", "Escape"),
  tab: same("Tab"),
  space: same("Space", "Space", "Space"),
  arrowup: same("↑", "Up arrow", "ArrowUp"),
  up: same("↑", "Up arrow", "ArrowUp"),
  arrowdown: same("↓", "Down arrow", "ArrowDown"),
  down: same("↓", "Down arrow", "ArrowDown"),
  arrowleft: same("←", "Left arrow", "ArrowLeft"),
  left: same("←", "Left arrow", "ArrowLeft"),
  arrowright: same("→", "Right arrow", "ArrowRight"),
  right: same("→", "Right arrow", "ArrowRight"),
  home: same("Home"),
  end: same("End"),
  pageup: same("PgUp", "Page up", "PageUp"),
  pagedown: same("PgDn", "Page down", "PageDown"),
  plus: same("+", "Plus", "+"),
  minus: same("-", "Minus", "-"),
  "?": same("?", "Question mark", "?"),
};

const MAC_GLYPHS: Record<string, string> = { "⌘": "mod", "⇧": "shift", "⌥": "alt", "⌃": "ctrl" };

/** Split a shortcut string into raw key tokens. */
export function splitShortcut(keys: string): string[] {
  const text = keys.trim();
  if (!text) return [];
  const out: string[] = [];
  // Mac glyph form: leading modifier glyphs, then the key ("⌘⇧Z", "⌘K").
  let rest = text;
  while (rest.length > 1 && MAC_GLYPHS[rest[0] ?? ""] !== undefined) {
    out.push(MAC_GLYPHS[rest[0] ?? ""] as string);
    rest = rest.slice(1).replace(/^\+/, "");
  }
  if (!rest) return out;
  if (rest === "+") return [...out, "plus"];
  const parts = rest.split("+");
  // "Ctrl++" splits into ["Ctrl", "", ""]: the empty tail is a literal plus.
  if (parts.length > 1 && parts[parts.length - 1] === "" && parts[parts.length - 2] === "") {
    parts.splice(parts.length - 2, 2, "plus");
  }
  for (const part of parts) {
    const p = part.trim();
    if (p) out.push(p);
  }
  return out;
}

function describe(token: string, platform: Platform): ShortcutKey {
  const def = KEYS[token.toLowerCase()];
  if (def) return { label: def[platform], name: def.name[platform], aria: def.aria[platform] };
  // Function keys and single characters: show as typed, letters in capitals.
  const label = token.length === 1 ? token.toUpperCase() : token;
  return { label, name: label, aria: label };
}

/** Keycaps for a shortcut on a platform. */
export function parseShortcut(keys: string, platform: Platform): ShortcutKey[] {
  return splitShortcut(keys).map((token) => describe(token, platform));
}

/** aria-keyshortcuts value, for example "Control+Shift+P" or "Meta+K". */
export function toAriaKeyShortcuts(keys: string, platform: Platform): string {
  return parseShortcut(keys, platform)
    .map((k) => k.aria)
    .join("+");
}

/** Spoken form, for example "Control+Shift+P" or "Command+K". */
export function shortcutName(keys: string, platform: Platform): string {
  return parseShortcut(keys, platform)
    .map((k) => k.name)
    .join("+");
}

/** Best guess at the platform in a browser; "other" on the server. */
export function detectPlatform(nav: { platform?: string; userAgent?: string; userAgentData?: { platform?: string } } | undefined): Platform {
  if (!nav) return "other";
  const hint = nav.userAgentData?.platform || nav.platform || nav.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(hint) ? "mac" : "other";
}
