"use client";

/**
 * The Parts tab of the tray: the canvas's parts library, grouped by role.
 *
 * Each part shows its crop (CSS only, hotlinked), its source chip and note. Space or Enter on a
 * part picks it (the pick order is the page order); "Frankenstein it" stacks the picked parts
 * into a new page, one per row. A part can be dragged onto a slot of a page to swap it in; the
 * keyboard route is the slot's "Swap with part..." menu. "Edit crop" opens the crop editor.
 * "Remove part" shows only for parts no page uses.
 */
import { useState, type DragEvent } from "react";
import { MAX_PARTS, type Part } from "@/lib/stitch/types";
import { siteName } from "../labels";
import { SourceChip } from "../nodes/chips";
import { FALLBACK_IMAGE_ASPECT } from "./crop";
import { CroppedImage } from "./CroppedImage";
import { PART_DND_TYPE } from "./context";
import { groupByRole, roleLabel } from "./edit";

export interface PartsPanelProps {
  parts: readonly Part[];
  usage: ReadonlyMap<string, number>;
  readOnly?: boolean;
  onEdit: (part: Part) => void;
  onRemove: (part: Part) => void;
  onStack: (ids: string[]) => void;
}

export function PartsPanel({ parts, usage, readOnly = false, onEdit, onRemove, onStack }: PartsPanelProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const live = picked.filter((id) => parts.some((p) => p.id === id));
  const groups = groupByRole(parts);

  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list.filter((x) => parts.some((p) => p.id === x)), id]));

  const onDragStart = (e: DragEvent<HTMLButtonElement>, part: Part) => {
    e.dataTransfer.setData(PART_DND_TYPE, part.id);
    e.dataTransfer.setData("text/plain", part.sourceUrl);
    e.dataTransfer.effectAllowed = "copy";
  };

  if (parts.length === 0) {
    return (
      <div className="st-empty" data-variant="centered">
        <p className="st-empty-title">No parts yet.</p>
        <p className="st-empty-body">
          Open the menu on an image and choose Cut part, or ask your agent to cut parts from your references.
        </p>
      </div>
    );
  }

  return (
    <div className="bn-parts">
      <div className="bn-parts-bar">
        {live.length > 0 && !readOnly ? (
          <>
            <button
              type="button"
              className="st-btn"
              data-variant="primary"
              data-size="sm"
              onClick={() => {
                onStack(live);
                setPicked([]);
              }}
            >
              Frankenstein it ({live.length})
            </button>
            <button type="button" className="st-btn" data-variant="ghost" data-size="sm" onClick={() => setPicked([])}>
              Clear picks
            </button>
          </>
        ) : (
          <p className="bn-parts-hint">
            {parts.length} of {MAX_PARTS} parts.{readOnly ? "" : " Pick parts with Space, then Frankenstein them into a page. Drag a part onto a page to swap it in."}
          </p>
        )}
      </div>
      {groups.map((g) => (
        <section key={g.role} className="bn-parts-group" aria-labelledby={`bn-parts-${g.role}`}>
          <h3 id={`bn-parts-${g.role}`} className="bn-parts-role">
            {roleLabel(g.role)} <span className="bn-tray-tab-count">{g.parts.length}</span>
          </h3>
          <ul className="bn-parts-list">
            {g.parts.map((part) => {
              const site = siteName(part.sourceSite, part.sourceUrl);
              const order = live.indexOf(part.id);
              const used = usage.get(part.id) ?? 0;
              const name = `${roleLabel(part.role)} from ${site}${part.title ? `, ${part.title}` : ""}`;
              return (
                <li key={part.id} className="bn-parts-item" data-testid={`part-${part.id}`}>
                  <button
                    type="button"
                    className="bn-parts-pick"
                    aria-pressed={order >= 0}
                    aria-label={order >= 0 ? `${name}, picked ${order + 1}` : name}
                    draggable={!readOnly}
                    disabled={readOnly}
                    onDragStart={(e) => onDragStart(e, part)}
                    onClick={() => toggle(part.id)}
                  >
                    <CroppedImage
                      src={part.thumbUrl || part.imageUrl}
                      crop={part.crop}
                      alt=""
                      width={part.imageWidth}
                      height={part.imageHeight}
                      fallbackAspect={FALLBACK_IMAGE_ASPECT.website}
                      className="bn-parts-thumb"
                    />
                    {order >= 0 && (
                      <span className="bn-parts-order" aria-hidden="true">
                        {order + 1}
                      </span>
                    )}
                  </button>
                  <div className="bn-parts-meta">
                    <SourceChip site={site} url={part.sourceUrl} />
                    {part.theme && part.theme !== "unknown" && (
                      <span className="st-chip bn-chip" data-tone="neutral">
                        {part.theme === "dark" ? "Dark" : "Light"}
                      </span>
                    )}
                    {part.guessedCrop && (
                      <span className="st-chip bn-chip" data-tone="neutral">
                        Guessed crop
                      </span>
                    )}
                  </div>
                  {part.note && <p className="bn-parts-note">{part.note}</p>}
                  {!readOnly && (
                    <div className="bn-parts-actions">
                      <button type="button" className="st-btn" data-variant="secondary" data-size="xs" aria-label={`Edit crop: ${name}`} onClick={() => onEdit(part)}>
                        Edit crop
                      </button>
                      {used > 0 ? (
                        <span className="bn-parts-used">
                          In {used} {used === 1 ? "page" : "pages"}
                        </span>
                      ) : (
                        <button type="button" className="st-btn" data-variant="ghost" data-size="xs" aria-label={`Remove part: ${name}`} onClick={() => onRemove(part)}>
                          Remove part
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
