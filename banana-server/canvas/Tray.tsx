"use client";

/**
 * Search results: a 42px rail with one "Search results" item, and a panel beside it
 * (spec section 3 "Left sidebar", section 10 "Tray"). The panel is 320px by default and
 * resizable from 260 to 520px by a splitter that also works with the keyboard.
 *
 * Each tile can be dragged onto the canvas, or focused and added with Enter (SC 2.5.7: drag
 * has a single pointer and keyboard alternative). A separate Preview button on the thumbnail
 * opens the image preview, so a click on the tile still only adds it and a drag still only
 * drags it. Thumbnails load from the source host; nothing is fetched in JS. On rtl pages the
 * rail sits at the inline start, the right edge.
 *
 * New results never open the panel: the rail's count badge pulses instead (CanvasApp
 * announces "N new results").
 */
import { useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type PointerEvent } from "react";
import { Tooltip } from "@/components/studio/Tooltip";
import { PreviewIcon } from "@/components/studio/icons";
import { SearchIcon } from "./icons";
import { SourceChip } from "./nodes/chips";
import { siteName } from "./labels";
import type { TrayReference } from "./types";

/** Drag data type for tray tiles. */
export const TRAY_DND_TYPE = "application/x-moodboard-reference";

export const PANEL_MIN = 260;
export const PANEL_MAX = 520;
export const PANEL_DEFAULT = 320;
const PANEL_STEP = 16;

export function clampPanel(w: number): number {
  return Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(w)));
}

function TrayThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="bn-tray-thumb-missing">Preview not available</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- third-party image loaded from its source host on purpose
    <img
      className="bn-tray-thumb"
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

export interface TrayProps {
  id: string;
  items: readonly TrayReference[];
  onAdd: (ref: TrayReference) => void;
  /** Open the image preview on this result. */
  onPreview?: (ref: TrayReference) => void;
  /** Bumped when new results arrive while the panel is closed: the count badge pulses. */
  pulse?: number;
  open: boolean;
  onToggle: () => void;
  /** Show the 42px rail. Off in compact frames, where the top bar has the results button. */
  rail?: boolean;
  readOnly?: boolean;
}

export function Tray({ id, items, onAdd, onPreview, pulse = 0, open, onToggle, rail = true, readOnly = false }: TrayProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [width, setWidth] = useState(PANEL_DEFAULT);
  const drag = useRef<{ x: number; w: number; rtl: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  // The added tile leaves the tray; keep keyboard focus at the same spot in the list.
  const add = (ref: TrayReference, index: number) => {
    onAdd(ref);
    requestAnimationFrame(() => {
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>(".bn-tray-add");
      if (!buttons || buttons.length === 0) return;
      buttons[Math.min(index, buttons.length - 1)]?.focus();
    });
  };

  const onDragStart = (e: DragEvent<HTMLButtonElement>, ref: TrayReference) => {
    e.dataTransfer.setData(TRAY_DND_TYPE, ref.id);
    e.dataTransfer.setData("text/plain", ref.sourceUrl);
    e.dataTransfer.effectAllowed = "copy";
  };

  const isRtl = (el: Element) => getComputedStyle(el).direction === "rtl";

  // Splitter: arrows change the width by 16px toward the pressed side, Home and End jump.
  const onSplitterKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const grow = isRtl(e.currentTarget) ? -1 : 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = width + PANEL_STEP * grow;
    else if (e.key === "ArrowLeft") next = width - PANEL_STEP * grow;
    else if (e.key === "Home") next = PANEL_MIN;
    else if (e.key === "End") next = PANEL_MAX;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    setWidth(clampPanel(next));
  };

  const onSplitterDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: width, rtl: isRtl(e.currentTarget) };
    setDragging(true);
  };
  const onSplitterMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) * (d.rtl ? -1 : 1);
    setWidth(clampPanel(d.w + dx));
  };
  const onSplitterUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const panelId = `${id}-panel`;

  return (
    <aside id={id} className="bn-tray" aria-label="Sidebar">
      {rail && (
      <nav className="bn-rail" aria-label="Panels">
        <Tooltip content="Search results" side="end">
          <button
            type="button"
            className="st-btn bn-rail-item"
            data-variant="ghost"
            data-icon-only=""
            aria-pressed={open}
            aria-controls={open ? panelId : undefined}
            aria-label={`Search results, ${items.length} waiting`}
            onClick={onToggle}
          >
            <SearchIcon size={16} />
            {items.length > 0 && (
              <span key={pulse} className="bn-rail-count" data-pulse={pulse > 0 ? "" : undefined} aria-hidden="true">
                {items.length > 99 ? "99+" : items.length}
              </span>
            )}
          </button>
        </Tooltip>
      </nav>
      )}
      {open && (
        <section id={panelId} className="bn-panel" aria-labelledby={`${id}-title`} style={{ "--bn-tray-w": `${width}px` } as CSSProperties}>
          <div className="bn-panel-header">
            <h2 id={`${id}-title`}>Search results</h2>
            {items.length > 0 && (
              <p>
                {readOnly
                  ? `${items.length} waiting.`
                  : `${items.length} waiting. Drag one onto the canvas, or focus it and press Enter.`}
              </p>
            )}
          </div>
          {items.length === 0 ? (
            <div className="st-empty" data-variant="centered">
              <SearchIcon size={24} />
              <p className="st-empty-title">No results yet.</p>
              <p className="st-empty-body">Ask your agent to search for references. Results show up here.</p>
            </div>
          ) : (
            <ul ref={listRef} className="st-tile-grid bn-tray-list" aria-label="Search results">
              {items.map((ref, index) => {
                const title = ref.title || "Untitled reference";
                const site = siteName(ref.sourceSite, ref.sourceUrl);
                return (
                  <li key={ref.id} className="st-tile bn-tray-item" data-testid={`tray-${ref.id}`}>
                    <button
                      type="button"
                      className="bn-tray-add"
                      draggable={!readOnly}
                      disabled={readOnly}
                      onDragStart={(e) => onDragStart(e, ref)}
                      onClick={() => add(ref, index)}
                      aria-label={`Add to canvas: ${title}, from ${site}`}
                      aria-keyshortcuts="Enter"
                    >
                      <TrayThumb src={ref.thumbUrl || ref.imageUrl} />
                      <span className="bn-tray-title">{title}</span>
                    </button>
                    {onPreview && (
                      <Tooltip content="Preview" side="top">
                        <button
                          type="button"
                          className="st-btn bn-tray-preview"
                          data-variant="ghost"
                          data-size="xs"
                          data-icon-only=""
                          aria-label={`Preview ${title}`}
                          onClick={() => onPreview(ref)}
                        >
                          <PreviewIcon size={16} />
                        </button>
                      </Tooltip>
                    )}
                    <SourceChip site={site} url={ref.sourceUrl} />
                  </li>
                );
              })}
            </ul>
          )}
          <div
            className="bn-splitter"
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label="Resize search results"
            aria-controls={panelId}
            aria-valuenow={width}
            aria-valuemin={PANEL_MIN}
            aria-valuemax={PANEL_MAX}
            data-dragging={dragging ? "" : undefined}
            onKeyDown={onSplitterKey}
            onPointerDown={onSplitterDown}
            onPointerMove={onSplitterMove}
            onPointerUp={onSplitterUp}
            onPointerCancel={onSplitterUp}
          />
        </section>
      )}
    </aside>
  );
}
