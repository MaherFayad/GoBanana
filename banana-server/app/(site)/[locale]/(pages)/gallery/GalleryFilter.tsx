"use client";

/**
 * Platform filter for the gallery. Every board is in the page; the filter only sets
 * `data-filter` on the gallery root and CSS hides the other boards (gallery.css), so a click
 * answers at once with no server round trip. The links are real (`?platform=mobile`), so the
 * filter works without JavaScript and the URL can be shared; with JavaScript a click updates the
 * URL with history.pushState and Back steps through the filters.
 */
import { useEffect, useState } from "react";

type Filter = { key: string | null; label: string; href: string; count: number };

type Props = { label: string; filters: Filter[]; initial: string | null; countLabel: string };

export function GalleryFilter({ label, filters, initial, countLabel }: Props) {
  const [current, setCurrent] = useState<string | null>(initial);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".gx");
    if (!root) return;
    if (current) root.setAttribute("data-filter", current);
    else root.removeAttribute("data-filter");
  }, [current]);

  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search).get("platform");
      setCurrent(filters.some((f) => f.key === p) ? p : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [filters]);

  const shown = filters.find((f) => f.key === current) ?? filters[0];

  return (
    <nav className="gx-filter" aria-label={label}>
      <ul className="ex-seg">
        {filters.map((f) => (
          <li key={f.key ?? "all"}>
            <a
              href={f.href}
              aria-current={f.key === current ? "page" : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                setCurrent(f.key);
                window.history.pushState(null, "", f.href);
              }}
            >
              {f.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="gx-count" role="status">
        {countLabel.replace("{n}", String(shown?.count ?? 0))}
      </p>
    </nav>
  );
}
