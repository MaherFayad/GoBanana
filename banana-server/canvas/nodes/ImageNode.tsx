"use client";

/**
 * Image tile (web reference) and upload tile (user's own image).
 *
 * Images are plain <img> tags loaded by the browser from the source host (hard rule 2):
 * nothing is stored or proxied. The tile shows the thumbnail and swaps in the full image once
 * the tile on screen is bigger than the thumbnail's pixels (zoomed in, or a big tile); the
 * thumbnail stays until the full image has loaded, and stays for good if it fails. If every
 * URL fails, the tile turns into a LinkCard.
 *
 * A plain click (under 4 px of movement, no modifier keys, not on a control) opens the image
 * preview; so do the Preview button, Space on the focused tile and the menu. Drags still move
 * the tile; Shift, Ctrl or Cmd click still select.
 */
import { useStore, type NodeProps } from "@xyflow/react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ShortcutKeys } from "@/components/studio/Kbd";
import { Tooltip } from "@/components/studio/Tooltip";
import { PreviewIcon } from "@/components/studio/icons";
import { useCanvasActions } from "../context";
import { siteName, tagLabel } from "../labels";
import type { ReferenceFlowNode } from "../types";
import { chromeMode, isClick, isPlainClick, wantFullImage } from "../zoom-chrome";
import { LinkCard, SourceChip, TagChip } from "./chips";
import { NodeMenu, type MenuItem } from "./NodeMenu";
import { Resizer } from "./Resizer";

/** Controls a click on the tile should not turn into a preview. */
const CONTROLS = "a, button, input, textarea, .react-flow__resize-control, .bn-node-bar, .st-input";

function candidates(thumbUrl: string | null | undefined, imageUrl: string): string[] {
  return [...new Set([thumbUrl, imageUrl].filter((u): u is string => typeof u === "string" && u.length > 0))];
}

export function ImageNode({ id, type, data, selected, width, parentId }: NodeProps<ReferenceFlowNode>) {
  const actions = useCanvasActions();
  const isUpload = type === "upload";
  const site = isUpload ? "Your upload" : siteName(data.sourceSite, data.sourceUrl);
  const urls = candidates(data.thumbUrl, data.imageUrl);
  const [attempt, setAttempt] = useState(0);
  const src = urls[attempt];
  const editing = actions.editingId === id;
  const title = data.title || (isUpload ? "Your image" : "Untitled reference");
  const w = width ?? 280;

  // A new URL set (for example after an edit) gets a fresh try.
  const key = urls.join(" ");
  const lastKey = useRef(key);
  const [thumbNatural, setThumbNatural] = useState<number | null>(null);
  const [full, setFull] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  useEffect(() => {
    if (lastKey.current !== key) {
      lastKey.current = key;
      setAttempt(0);
      setThumbNatural(null);
      setFull("idle");
    }
  }, [key]);

  // Re-render only when the chrome bucket or the "want the full image" answer flips, never per zoom tick.
  const mode = useStore((s) => chromeMode(w, s.transform[2]));
  const sharp = useStore((s) => wantFullImage({ nodeWidth: w, zoom: s.transform[2], thumbNaturalWidth: thumbNatural }));
  const onThumb = attempt === 0 && urls.length > 1;
  // Once wanted, the full image stays (zooming back out keeps the sharp copy).
  if (onThumb && sharp && full === "idle") setFull("loading");
  const upgrade = onThumb && (full === "loading" || full === "ready");

  const canPreview = Boolean(src);
  const preview = () => actions.openPreview(id);

  // Click versus drag: React Flow starts a drag after 3 px; a preview needs under 4 px.
  const down = useRef<{ x: number; y: number; ok: boolean } | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const onControl = Boolean((e.target as HTMLElement).closest(CONTROLS));
    down.current = { x: e.clientX, y: e.clientY, ok: isPlainClick(e) && !onControl && !editing && canPreview };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = down.current;
    down.current = null;
    if (!d?.ok || !isPlainClick(e)) return;
    if (!isClick(d, { x: e.clientX, y: e.clientY })) return;
    // Focus the tile first, so closing the preview returns focus to it.
    e.currentTarget.closest<HTMLElement>(".react-flow__node")?.focus({ preventScroll: true });
    preview();
  };

  const items: MenuItem[] = [
    ...(canPreview ? [{ label: "Preview", keys: "Space", onSelect: preview, movesFocus: true }] : []),
    { label: data.note ? "Edit note" : "Add note", keys: "F2", onSelect: () => actions.setEditing(id) },
    {
      label: data.tag === "ship" ? "Mark as Explore" : "Mark as Ship",
      onSelect: () => {
        const tag = data.tag === "ship" ? "explore" : "ship";
        actions.updateData<"image">(id, { tag });
        actions.announce(`Marked as ${tagLabel(tag)}`);
      },
    },
  ];
  if (data.tag)
    items.push({ label: "Clear Ship or Explore mark", onSelect: () => actions.updateData<"image">(id, { tag: null }) });

  return (
    <>
      <Resizer type={type} selected={selected} keepAspectRatio />
      <div
        className="bn-node bn-image"
        data-testid={`tile-${id}`}
        data-chrome={mode}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div className="bn-image-frame">
          {src ? (
            <>
              {full !== "ready" || !upgrade ? (
                // eslint-disable-next-line @next/next/no-img-element -- third-party image loaded from its source host on purpose
                <img
                  key={src}
                  src={src}
                  alt={title}
                  // Third-party images get no referrer. Uploads are same-origin and send it, so a
                  // share page (/s/<token>) can show them (lib/uploads/http.ts shareTokenFrom).
                  referrerPolicy={isUpload ? "same-origin" : "no-referrer"}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  onLoad={(e) => onThumb && setThumbNatural(e.currentTarget.naturalWidth || null)}
                  onError={() => setAttempt((a) => a + 1)}
                />
              ) : null}
              {upgrade && (
                // eslint-disable-next-line @next/next/no-img-element -- third-party image loaded from its source host on purpose
                <img
                  key={data.imageUrl}
                  className="bn-image-full"
                  data-ready={full === "ready" ? "" : undefined}
                  src={data.imageUrl}
                  alt={full === "ready" ? title : ""}
                  referrerPolicy={isUpload ? "same-origin" : "no-referrer"}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  onLoad={() => setFull("ready")}
                  onError={() => setFull("failed")}
                />
              )}
            </>
          ) : (
            <LinkCard title={data.title} site={site} url={data.sourceUrl} />
          )}
          {/* Source chip sits on the image itself so it is always visible (hard rule 3). */}
          <div className="bn-node-bar bn-node-bar-source">
            <SourceChip site={site} url={data.sourceUrl} upload={isUpload} />
          </div>
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
          {canPreview && (
            <Tooltip content={<>Preview <ShortcutKeys keys="Space" /></>} side="top">
              <button
                type="button"
                className="st-btn bn-menu-button bn-preview-button nodrag nopan"
                data-variant="ghost"
                data-size="xs"
                data-icon-only=""
                aria-label={`Preview ${title}`}
                aria-keyshortcuts="Space"
                onClick={(e) => {
                  e.stopPropagation();
                  preview();
                }}
              >
                <PreviewIcon size={16} />
              </button>
            </Tooltip>
          )}
          <NodeMenu nodeId={id} label={title} parentId={parentId} items={items} sourceUrl={data.sourceUrl} />
        </div>
      </div>
    </>
  );
}

/**
 * Inline text editor. Ctrl or Cmd + Enter saves, Escape cancels, leaving the field saves.
 * `autoGrow` makes a textarea as tall as its text (sticky notes never scroll).
 */
export function NoteEditor({
  initial,
  label,
  onDone,
  multiline = true,
  autoGrow = false,
}: {
  initial: string;
  label: string;
  onDone: (value: string | null) => void;
  multiline?: boolean;
  autoGrow?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!autoGrow || !el) return;
    el.style.blockSize = "auto";
    // scrollHeight leaves out the borders; the field is border-box.
    el.style.blockSize = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [autoGrow, value]);
  // The caret goes to the end of the text, ready to type.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const common = {
    autoFocus: true,
    "aria-label": label,
    value,
    className: "st-input nodrag nopan nowheel",
    "data-size": multiline ? undefined : "xs",
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
    <textarea ref={areaRef} {...common} onChange={(e) => setValue(e.target.value)} rows={autoGrow ? 1 : 3} maxLength={2000} />
  ) : (
    <input {...common} type="text" onChange={(e) => setValue(e.target.value)} maxLength={120} />
  );
}
