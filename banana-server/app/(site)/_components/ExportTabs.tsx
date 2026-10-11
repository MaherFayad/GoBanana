"use client";

/**
 * "Ship a kit, not a moodboard": a row of file cards, each a small picture of the real file,
 * that work as tabs (WAI-ARIA tabs pattern, automatic activation) for the big window below. The
 * window keeps the frame look and shows the file as export_kit writes it (lib/site/export-demo.ts).
 *
 * Keyboard: Tab reaches the selected card, the arrow keys move along the row (they follow the
 * reading direction, so ArrowLeft moves forward on Arabic pages), Home and End jump to the ends,
 * and Tab moves on to the window, which scrolls with the arrow keys. Code reads left to right on
 * both pages; the cards follow the page direction.
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BriefIcon, ChecklistIcon, CodeIcon, FileIcon, StickyIcon, SwatchIcon } from "@/components/studio/icons";
import type { PreviewFormat } from "@/lib/site/export-demo";

export type ExportTab = {
  format: PreviewFormat;
  /** Card label: a file name, or a concept in the page language ("Design tokens"). */
  label: ReactNode;
  body: ReactNode;
  /** File name in the window's tab, always Latin. */
  fileName: string;
  content: string;
  /** Accessible name of the window ("DESIGN.md, as export_kit writes it ..."). */
  windowLabel: string;
};

const ICONS = { design_md: FileIcon, agents_md: ChecklistIcon, tokens: SwatchIcon, tailwind: CodeIcon, figjam_spec: StickyIcon, brief: BriefIcon };

/** A small picture of each file. Decorative: the card's label and line say what it is. */
function Thumb({ format }: { format: PreviewFormat }) {
  switch (format) {
    case "design_md":
      return (
        <span className="xthumb xthumb-doc" aria-hidden="true">
          <span className="x-h1" />
          <span className="x-line" />
          <span className="x-line is-short" />
          <span className="x-table">
            <span className="x-dot" data-c="2" />
            <span className="x-cell" />
            <span className="x-dot" data-c="5" />
            <span className="x-cell" />
            <span className="x-dot" data-c="1" />
            <span className="x-cell" />
          </span>
        </span>
      );
    case "agents_md":
      return (
        <span className="xthumb xthumb-checks" aria-hidden="true">
          <span className="x-h1" />
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="x-check">
              <span className="x-box" data-on={i < 3 ? "" : undefined} />
              <span className="x-line" />
            </span>
          ))}
        </span>
      );
    case "tokens":
      return (
        <span className="xthumb xthumb-tokens" aria-hidden="true">
          <span className="x-strip">
            {[1, 2, 3, 4, 5].map((c) => (
              <span key={c} className="x-swatch" data-c={c} />
            ))}
          </span>
          <span className="x-scale">
            <span className="x-aa is-xl">Aa</span>
            <span className="x-aa is-l">Aa</span>
            <span className="x-aa is-m">Aa</span>
            <span className="x-aa is-s">Aa</span>
          </span>
        </span>
      );
    case "tailwind":
      return (
        <span className="xthumb xthumb-code" aria-hidden="true">
          <span className="x-code is-key" />
          {[2, 5, 1, 3].map((c) => (
            <span key={c} className="x-code-row">
              <span className="x-dot" data-c={c} />
              <span className="x-code" />
            </span>
          ))}
          <span className="x-code is-key" />
        </span>
      );
    case "figjam_spec":
      return (
        <span className="xthumb xthumb-board" aria-hidden="true">
          <span className="x-section">
            <span className="x-sticky" data-tone="yellow" />
            <span className="x-sticky" data-tone="blue" />
          </span>
          <span className="x-section">
            <span className="x-sticky" data-tone="pink" />
            <span className="x-sticky" data-tone="green" />
          </span>
        </span>
      );
    case "brief":
      return (
        <span className="xthumb xthumb-brief" aria-hidden="true">
          <span className="x-h1" />
          <span className="x-quote" />
          {[1, 2, 3].map((n) => (
            <span key={n} className="x-dir">
              <span className="x-num">{n}</span>
              <span className="x-line" />
            </span>
          ))}
        </span>
      );
  }
}

export function ExportTabs({ tabs, label }: { tabs: ExportTab[]; label: string }) {
  const uid = useId();
  const [selected, setSelected] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(i: number) {
    const n = (i + tabs.length) % tabs.length;
    setSelected(n);
    refs.current[n]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === forward) select(selected + 1);
    else if (e.key === back) select(selected - 1);
    else if (e.key === "Home") select(0);
    else if (e.key === "End") select(tabs.length - 1);
    else return;
    e.preventDefault();
  }

  const current = tabs[selected]!;
  return (
    <div className="export-tabs">
      <div className="export-cards" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => {
          const Icon = ICONS[tab.format];
          const on = i === selected;
          return (
            <button
              key={tab.format}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${i}`}
              className="export-card"
              aria-selected={on}
              aria-controls={`${uid}-panel`}
              aria-describedby={`${uid}-body-${i}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setSelected(i)}
            >
              <Thumb format={tab.format} />
              <span className="export-card-name">
                <Icon size={16} />
                <span>{tab.label}</span>
              </span>
              <span className="export-card-body" id={`${uid}-body-${i}`}>
                {tab.body}
              </span>
            </button>
          );
        })}
      </div>
      <figure className="code-window export-window" dir="ltr">
        <figcaption className="st-visually-hidden">{current.windowLabel}</figcaption>
        <div className="code-window-bar" aria-hidden="true">
          <span className="frame-dot" />
          <span className="frame-dot" />
          <span className="frame-dot" />
          <span className="export-window-file">{current.fileName}</span>
        </div>
        <div
          id={`${uid}-panel`}
          className="export-window-body"
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${selected}`}
          tabIndex={0}
        >
          <pre>
            <code>{current.content}</code>
          </pre>
        </div>
      </figure>
    </div>
  );
}
