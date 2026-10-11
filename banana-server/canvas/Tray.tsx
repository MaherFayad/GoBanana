"use client";

/**
 * Search results tray (spec section 9). Each tile can be dragged onto the canvas,
 * or focused and added with Enter (SC 2.5.7: drag has a single pointer and keyboard
 * alternative). Thumbnails load from the source host; nothing is fetched in JS.
 */
import { useRef, useState, type DragEvent } from "react";
import { SourceChip } from "./nodes/chips";
import { siteName } from "./labels";
import type { TrayReference } from "./types";

/** Drag data type for tray tiles. */
export const TRAY_DND_TYPE = "application/x-moodboard-reference";

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
  readOnly?: boolean;
}

export function Tray({ id, items, onAdd, readOnly = false }: TrayProps) {
  const listRef = useRef<HTMLUListElement>(null);

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

  return (
    <aside id={id} className="bn-tray" aria-labelledby={`${id}-title`}>
      <div className="bn-tray-header">
        <h2 id={`${id}-title`}>Search results</h2>
        <p>
          {items.length === 0
            ? "Nothing here yet."
            : readOnly
              ? `${items.length} waiting.`
              : `${items.length} waiting. Drag one onto the canvas, or focus it and press Enter.`}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="bn-tray-empty">Ask your agent to search for references. Results show up here.</p>
      ) : (
        <ul ref={listRef} className="bn-tray-list" aria-label="Search results">
          {items.map((ref, index) => {
            const title = ref.title || "Untitled reference";
            const site = siteName(ref.sourceSite, ref.sourceUrl);
            return (
              <li key={ref.id} className="bn-tray-item" data-testid={`tray-${ref.id}`}>
                <button
                  type="button"
                  className="bn-tray-add"
                  draggable={!readOnly}
                  disabled={readOnly}
                  onDragStart={(e) => onDragStart(e, ref)}
                  onClick={() => add(ref, index)}
                  aria-label={`Add to canvas: ${title}, from ${site}`}
                >
                  <TrayThumb src={ref.thumbUrl || ref.imageUrl} />
                  <span className="bn-tray-title">{title}</span>
                </button>
                <SourceChip site={site} url={ref.sourceUrl} />
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
