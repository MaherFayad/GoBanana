"use client";

/**
 * A menu bar menu, macOS style: a frosted dropdown that drops from under its menu bar item
 * (desktop.css .mb-menu). Used on narrow screens, where the menu bar folds the nav, "Your
 * canvases" and the language switch into one "Menu" item; any other menu bar menu uses it too.
 *
 * A real menu (WAI-ARIA menu button): the trigger has aria-haspopup="menu" and aria-expanded;
 * the panel is role="menu" with role="menuitem" links. Arrow keys, Home and End move the
 * highlight (which also follows the pointer), Enter activates, Escape, Tab and a click outside
 * close it, and focus goes back to the trigger. Opening with the keyboard highlights the first
 * row. Rows may carry a hint at the end (a language code, say); separators split groups.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { switchLocalePath, type Locale } from "@/lib/site/i18n";

export type MenuBarItem =
  | { kind: "link"; href: string; label: string; hint?: string; current?: boolean }
  | { kind: "lang"; to: Locale; label: string; name: string; hint?: string }
  | { kind: "sep" };

export function MenuBarMenu({ label, trigger, items, className }: { label: string; trigger: ReactNode; items: MenuBarItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusFirst = useRef(false);
  const id = useId();
  const pathname = usePathname() ?? "/";

  const rows = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    if (focusFirst.current) rows()[0]?.focus();
    else menuRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      focusFirst.current = true;
      setOpen(true);
    }
  }

  function onMenuKey(e: KeyboardEvent<HTMLDivElement>) {
    const list = rows();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => list[(i + list.length) % list.length]?.focus();
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at < 0 ? list.length - 1 : at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
    else if (e.key === "Escape") close(true);
    else if (e.key === "Tab") {
      setOpen(false);
      return;
    } else if (e.key === " " && at >= 0) list[at]?.click();
    else return;
    e.preventDefault();
  }

  return (
    <div ref={rootRef} className={className ? `mb ${className}` : "mb"}>
      <button
        ref={buttonRef}
        type="button"
        className="mb-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        data-open={open ? "" : undefined}
        onClick={() => {
          focusFirst.current = false;
          setOpen((o) => !o);
        }}
        onKeyDown={onTriggerKey}
      >
        {trigger}
      </button>
      {open ? (
        <div ref={menuRef} id={id} className="mb-menu" role="menu" aria-label={label} tabIndex={-1} onKeyDown={onMenuKey}>
          {items.map((item, i) =>
            item.kind === "sep" ? (
              <div key={`sep-${i}`} className="mb-sep" role="separator" />
            ) : item.kind === "lang" ? (
              <a
                key={`lang-${item.to}`}
                className="mb-item"
                role="menuitem"
                tabIndex={-1}
                href={switchLocalePath(pathname, item.to)}
                hrefLang={item.to}
                lang={item.to}
                onPointerEnter={(e) => e.currentTarget.focus()}
              >
                <span className="st-visually-hidden" lang={item.to === "ar" ? "en" : "ar"}>
                  {item.label}:{" "}
                </span>
                <span className="mb-label">{item.name}</span>
                {item.hint ? (
                  <span className="mb-hint" aria-hidden="true" dir="ltr">
                    {item.hint}
                  </span>
                ) : null}
              </a>
            ) : (
              <MenuLink key={item.href} item={item} onPick={() => setOpen(false)} />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

/** A link row; in-app pages go through the router (so Account opens as a window over the page). */
function MenuLink({ item, onPick }: { item: Extract<MenuBarItem, { kind: "link" }>; onPick: () => void }) {
  const body = (
    <>
      <span className="mb-label">{item.label}</span>
      {item.hint ? (
        <span className="mb-hint" aria-hidden="true">
          {item.hint}
        </span>
      ) : null}
    </>
  );
  const common = {
    className: "mb-item",
    role: "menuitem",
    tabIndex: -1,
    "aria-current": item.current ? ("page" as const) : undefined,
    onPointerEnter: (e: { currentTarget: HTMLElement }) => e.currentTarget.focus(),
    onClick: onPick,
  };
  // Only site pages go through the router; the docs (a separate static app) and sign-in are plain links.
  return !/^\/(en|ar)(\/|#|$)/.test(item.href) ? (
    <a href={item.href} {...common}>
      {body}
    </a>
  ) : (
    <Link href={item.href} {...common}>
      {body}
    </Link>
  );
}
