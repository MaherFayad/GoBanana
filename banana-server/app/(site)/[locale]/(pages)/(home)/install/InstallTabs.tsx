"use client";

/**
 * Tabs of the Add to Claude window (WAI-ARIA tabs: arrow keys, Home and End move between them;
 * the selected panel is the only one shown). Panels come from the server already rendered.
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type Tab = { id: string; label: string; panel: ReactNode };

export function InstallTabs({ label, tabs }: { label: string; tabs: Tab[] }) {
  const [current, setCurrent] = useState(tabs[0]?.id ?? "");
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const at = tabs.findIndex((t) => t.id === current);
    let next: number | null = null;
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (at + 1) % tabs.length;
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (at - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    const id = tabs[next]!.id;
    setCurrent(id);
    refs.current[id]?.focus();
  };
  return (
    <div className="inst-tabs">
      <div className="inst-tablist" role="tablist" aria-label={label} onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-${t.id}-tab`}
            className="inst-tab"
            aria-selected={t.id === current}
            aria-controls={`${base}-${t.id}`}
            tabIndex={t.id === current ? 0 : -1}
            onClick={() => setCurrent(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`${base}-${t.id}`} role="tabpanel" aria-labelledby={`${base}-${t.id}-tab`} className="inst-panel" hidden={t.id !== current}>
          {t.panel}
        </div>
      ))}
    </div>
  );
}
