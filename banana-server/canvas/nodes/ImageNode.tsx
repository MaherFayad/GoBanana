"use client";

/**
 * Image tile (web reference) and upload tile (user's own image).
 *
 * Images are plain <img> tags loaded by the browser from the source host
 * (hard rule 2): no fetch of image bytes in JS, no <canvas> drawing, nothing stored.
 * If every URL fails, the tile turns into a LinkCard.
 */
import type { NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useCanvasActions } from "../context";
import { siteName, tagLabel } from "../labels";
import type { ReferenceFlowNode } from "../types";
import { LinkCard, SourceChip, TagChip } from "./chips";
import { NodeMenu, type MenuItem } from "./NodeMenu";
import { Resizer } from "./Resizer";

/** Tiles at most this wide use the thumbnail first; bigger tiles use the full image. */
const THUMB_MAX_WIDTH = 320;

function candidates(thumbUrl: string | null | undefined, imageUrl: string, width: number): string[] {
  const list = width <= THUMB_MAX_WIDTH ? [thumbUrl, imageUrl] : [imageUrl, thumbUrl];
  return [...new Set(list.filter((u): u is string => typeof u === "string" && u.length > 0))];
}

export function ImageNode({ id, type, data, selected, width, parentId }: NodeProps<ReferenceFlowNode>) {
  const actions = useCanvasActions();
  const isUpload = type === "upload";
  const site = isUpload ? "Your upload" : siteName(data.sourceSite, data.sourceUrl);
  const urls = candidates(data.thumbUrl, data.imageUrl, width ?? 280);
  const [attempt, setAttempt] = useState(0);
  const src = urls[attempt];
  const editing = actions.editingId === id;
  const title = data.title || (isUpload ? "Your image" : "Untitled reference");

  // A new URL set (for example after an edit) gets a fresh try.
  const key = urls.join(" ");
  const lastKey = useRef(key);
  useEffect(() => {
    if (lastKey.current !== key) {
      lastKey.current = key;
      setAttempt(0);
    }
  }, [key]);

  const items: MenuItem[] = [
    { label: data.note ? "Edit note" : "Add note", onSelect: () => actions.setEditing(id) },
    {
      label: data.tag === "ship" ? "Mark as Explore" : "Mark as Ship",
      onSelect: () => {
        const tag = data.tag === "ship" ? "explore" : "ship";
        actions.updateData<"image">(id, { tag });
        actions.announce(`Marked as ${tagLabel(tag)}`);
      },
    },
  ];
  if (data.tag) items.push({ label: "Clear Ship or Explore mark", onSelect: () => actions.updateData<"image">(id, { tag: null }) });

  return (
    <div className="bn-node bn-image" data-testid={`tile-${id}`}>
      <Resizer type={type} selected={selected} keepAspectRatio />
      <div className="bn-image-frame">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- third-party image loaded from its source host on purpose
          <img
            key={src}
            src={src}
            alt={title}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setAttempt((a) => a + 1)}
          />
        ) : (
          <LinkCard title={data.title} site={site} url={data.sourceUrl} />
        )}
      </div>
      {editing ? (
        <NoteEditor
          initial={data.note ?? ""}
          label={`Note for ${title}`}
          onDone={(value) => {
            if (value !== null) actions.updateData<"image">(id, { note: value.trim() || null });
            actions.setEditing(null);
            actions.focusNode(id);
          }}
        />
      ) : (
        data.note && <p className="bn-image-note">{data.note}</p>
      )}
      <div className="bn-node-bar bn-node-bar-top">
        {data.tag && <TagChip tag={data.tag} />}
        <span className="bn-grow" />
        <NodeMenu nodeId={id} label={title} parentId={parentId} items={items} sourceUrl={data.sourceUrl} />
      </div>
      <div className="bn-node-bar">
        <SourceChip site={site} url={data.sourceUrl} />
      </div>
    </div>
  );
}

/** Inline text editor. Ctrl or Cmd + Enter saves, Escape cancels, leaving the field saves. */
export function NoteEditor({
  initial,
  label,
  onDone,
  multiline = true,
}: {
  initial: string;
  label: string;
  onDone: (value: string | null) => void;
  multiline?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  const common = {
    autoFocus: true,
    "aria-label": label,
    value,
    className: `${multiline ? "bn-textarea" : "bn-input"} nodrag nopan nowheel`,
    onBlur: () => finish(value),
    onKeyDown: (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        finish(value);
      }
    },
  };
  return multiline ? (
    <textarea {...common} onChange={(e) => setValue(e.target.value)} rows={3} maxLength={2000} />
  ) : (
    <input {...common} type="text" onChange={(e) => setValue(e.target.value)} maxLength={120} />
  );
}
