"use client";

/**
 * In-page links scroll there instead of jumping: the menu bar's "How it works", "Gallery" and
 * "Add to Claude", the hero buttons, and the dock. On the landing page, the Pricing link scrolls
 * to the pricing section instead of leaving the page (the full pricing page stays one click away
 * from that section). Uses the story's smooth scroller when it runs, else native smooth scrolling;
 * under prefers-reduced-motion it jumps. Focus moves to the target (SC 2.4.3), the URL hash
 * updates, and modified clicks (new tab, and so on) are left alone.
 */
import { useEffect } from "react";
import { storyBus } from "./story/story-bus";

/** Paths whose page has a section on the landing page: last path segment to section id. */
const SECTIONS: Record<string, string> = { pricing: "pricing" };

const trim = (p: string) => p.replace(/\/+$/, "") || "/";

function targetFor(a: HTMLAnchorElement): HTMLElement | null {
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return null;
  const here = trim(location.pathname);
  const there = trim(url.pathname);
  if (there === here && url.hash.length > 1) return document.getElementById(decodeURIComponent(url.hash.slice(1)));
  const last = there.split("/").pop() ?? "";
  const id = SECTIONS[last];
  if (id && trim(there.slice(0, -last.length)) === here) return document.getElementById(id);
  return null;
}

export function AnchorScroll() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const target = targetFor(a);
      if (!target) return;
      e.preventDefault();
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      // A section heading can be visually hidden; land on the start of its section instead.
      const to = target.closest<HTMLElement>("section") ?? target;
      if (storyBus.scrollTo && !reduce) storyBus.scrollTo(to);
      else to.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      if (`#${target.id}` !== location.hash) history.pushState(null, "", `#${target.id}`);
      if (!target.hasAttribute("tabindex") && !target.matches("a, button, input, select, textarea")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
    // Capture, so this runs before Next's Link handler.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
