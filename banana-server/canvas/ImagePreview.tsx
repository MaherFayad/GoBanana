"use client";

/**
 * Image preview dialog (board images, uploads, search results, the shared view).
 *
 * Built on the studio Dialog (native <dialog> with showModal: focus trap, Escape, focus back
 * to the opener, aria-modal, a labelled title). The image loads from its host as a plain
 * <img> (imageUrl, then thumbUrl), never through our server. The source link is always shown
 * (hard rule 3).
 *
 * Zoom: + and - buttons and keys, Fit (0), 100% (1), wheel and pinch around the pointer,
 * drag or arrow keys to pan when zoomed in, double click toggles Fit and 100%. Previous and
 * next: buttons, and the arrow keys at fit size (they pan when zoomed in), swipe on touch.
 * The chrome mirrors in rtl; the image does not.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Dialog } from "@/components/studio/Dialog";
import { ChevronEndIcon, ChevronStartIcon, CopyIcon, ExternalIcon, FitIcon, LinkIcon, MinusIcon, PlusIcon } from "@/components/studio/icons";
import { Tooltip } from "@/components/studio/Tooltip";
import { pushToast } from "@/components/studio/toastBus";
import { absoluteUrl, copyImage, copyText } from "./clipboard";
import {
  canPan,
  fitScale,
  fitView,
  panBy,
  percent,
  PREVIEW_PAN_STEP,
  swipeDirection,
  toggleFit,
  wheelZoom,
  zoomStep,
  zoomTo,
  type Size,
  type View,
} from "./preview-zoom";

export interface PreviewItem {
  key: string;
  title: string;
  imageUrl: string;
  thumbUrl?: string | null;
  sourceUrl: string;
  site: string;
  upload: boolean;
}

export interface ImagePreviewProps {
  items: readonly PreviewItem[];
  /** Index of the open item, or null when closed. */
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
}

export function ImagePreview({ items, index, onIndex, onClose }: ImagePreviewProps) {
  const open = index !== null && Boolean(items[index]);
  const item = open ? items[index] : undefined;
  // Focus starts on the image, where + and - zoom and the arrows browse.
  const stageRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog
      open={open}
      initialFocus={stageRef}
      onClose={onClose}
      title={item?.title ?? "Image"}
      eyebrow={item && items.length > 1 ? `Image ${index! + 1} of ${items.length}` : undefined}
      size="2xl"
      className="bn-preview"
      closeLabel="Close preview"
      footer={item ? <PreviewActions item={item} /> : undefined}
    >
      {item && (
        <PreviewStage
          key={item.key}
          stageRef={stageRef}
          item={item}
          hasPrev={index! > 0}
          hasNext={index! < items.length - 1}
          onPrev={() => onIndex(index! - 1)}
          onNext={() => onIndex(index! + 1)}
        />
      )}
    </Dialog>
  );
}

function PreviewActions({ item }: { item: PreviewItem }) {
  const copyImg = async () => {
    const result = await copyImage(item.imageUrl);
    if (result === "image") pushToast({ kind: "success", title: "Image copied" });
    else if (result === "link")
      pushToast({ kind: "info", title: "This site does not allow copying the image. Copied the image link instead." });
    else pushToast({ kind: "error", title: "Could not copy", body: "Your browser blocked the clipboard." });
  };
  const copyLink = async (url: string, what: string) => {
    if (await copyText(absoluteUrl(url))) pushToast({ kind: "success", title: `${what} copied` });
    else pushToast({ kind: "error", title: "Could not copy", body: "Your browser blocked the clipboard." });
  };
  return (
    <div className="bn-preview-actions">
      <a className="bn-preview-source" href={item.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
        <span>Source: {item.site}</span>
        <span className="st-visually-hidden"> (opens in a new tab)</span>
      </a>
      <span className="bn-grow" />
      <button type="button" className="st-btn" data-variant="secondary" data-size="sm" onClick={() => void copyImg()}>
        <CopyIcon size={16} />
        <span>Copy image</span>
      </button>
      <button type="button" className="st-btn" data-variant="secondary" data-size="sm" onClick={() => void copyLink(item.imageUrl, "Image link")}>
        <LinkIcon size={16} />
        <span>Copy image link</span>
      </button>
      {!item.upload && (
        <button type="button" className="st-btn" data-variant="secondary" data-size="sm" onClick={() => void copyLink(item.sourceUrl, "Source link")}>
          <LinkIcon size={16} />
          <span>Copy source link</span>
        </button>
      )}
      <a className="st-btn" data-variant="primary" data-size="sm" href={item.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
        <ExternalIcon size={16} />
        <span>Open source</span>
        <span className="st-visually-hidden"> (opens in a new tab)</span>
      </a>
    </div>
  );
}

function IconButton({ label, keys, onClick, disabled, children }: { label: string; keys?: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        className="st-btn"
        data-variant="ghost"
        data-size="sm"
        data-icon-only=""
        aria-label={label}
        aria-keyshortcuts={keys}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function PreviewStage({
  stageRef,
  item,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
  item: PreviewItem;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const urls = [...new Set([item.imageUrl, item.thumbUrl].filter((u): u is string => Boolean(u)))];
  const [attempt, setAttempt] = useState(0);
  const src = urls[attempt];
  const [image, setImage] = useState<Size | null>(null);
  const [stage, setStage] = useState<Size | null>(null);
  const [view, setView] = useState<View | null>(null);
  /** Buttons and keys animate the zoom; wheel, pinch and drag follow the pointer directly. */
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const sync = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageRef]);

  // First fit once both sizes are known; keep the image in view when the stage resizes.
  const [fitted, setFitted] = useState<{ image: string; stage: string } | null>(null);
  if (image && stage) {
    const imageKey = `${image.w}x${image.h}`;
    const stageKey = `${stage.w}x${stage.h}`;
    if (fitted?.image !== imageKey || fitted.stage !== stageKey) {
      const fresh = fitted?.image !== imageKey;
      setFitted({ image: imageKey, stage: stageKey });
      setView((v) => (v && !fresh ? zoomTo(v, v.scale, image, stage) : fitView(image, stage)));
    }
  }

  const ready = image && stage && view;
  const apply = useCallback(
    (fn: (v: View, img: Size, st: Size) => View, animated = false) => {
      if (!image || !stage) return;
      setAnimate(animated);
      setView((v) => (v ? fn(v, image, stage) : v));
    },
    [image, stage],
  );

  const zoomIn = () => apply((v, i, s) => zoomStep(v, 1, i, s), true);
  const zoomOut = () => apply((v, i, s) => zoomStep(v, -1, i, s), true);
  const fit = () => apply((_v, i, s) => fitView(i, s), true);
  const actual = () => apply((v, i, s) => zoomTo(v, 1, i, s), true);

  // Wheel and trackpad pinch (ctrl + wheel) zoom around the pointer. Not passive, so the page never scrolls.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const at = { x: e.clientX - r.left, y: e.clientY - r.top };
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      apply((v, i, s) => wheelZoom(v, e.ctrlKey ? delta * 4 : delta, i, s, at));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [apply, stageRef]);

  // Pointers: one drags to pan (or swipes on touch at fit size), two pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; pinch: number | null; touch: boolean } | null>(null);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 1) gesture.current = { startX: e.clientX, startY: e.clientY, pinch: null, touch: e.pointerType === "touch" };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !image || !stage) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const all = [...pointers.current.values()];
    if (all.length >= 2) {
      const [a, b] = all as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const g = gesture.current;
      if (g) {
        if (g.pinch) {
          const k = dist / g.pinch;
          apply((v, i, s) => zoomTo(v, v.scale * k, i, s, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }));
        }
        g.pinch = dist;
      }
      return;
    }
    if (view && canPan(view, image, stage)) apply((v, i, s) => panBy(v, p.x - prev.x, p.y - prev.y, i, s));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (!g || g.pinch || !g.touch || !view || !image || !stage || canPan(view, image, stage)) return;
    const rtl = getComputedStyle(e.currentTarget.closest("dialog") ?? e.currentTarget).direction === "rtl";
    const dir = swipeDirection(e.clientX - g.startX, e.clientY - g.startY, rtl);
    if (dir === 1 && hasNext) onNext();
    if (dir === -1 && hasPrev) onPrev();
  };
  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    const at = local(e);
    apply((v, i, s) => toggleFit(v, i, s, at), true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    if (target.closest(".bn-preview-actions")) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const zoomed = Boolean(view && image && stage && canPan(view, image, stage));
    let handled = true;
    if (e.key === "+" || e.key === "=") zoomIn();
    else if (e.key === "-" || e.key === "_") zoomOut();
    else if (e.key === "0") fit();
    else if (e.key === "1") actual();
    else if (zoomed && e.key.startsWith("Arrow")) {
      const step = e.shiftKey ? PREVIEW_PAN_STEP * 4 : PREVIEW_PAN_STEP;
      const d = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key] ?? [0, 0];
      apply((v, i, s) => panBy(v, d[0]!, d[1]!, i, s), true);
    } else if (e.key === (rtl ? "ArrowLeft" : "ArrowRight") && hasNext) onNext();
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft") && hasPrev) onPrev();
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const scale = view?.scale ?? 1;
  const atFit = Boolean(image && stage && Math.abs(scale - fitScale(image, stage)) < 0.01);

  return (
    <div className="bn-preview-body" onKeyDown={onKeyDown}>
      <div className="bn-preview-toolbar" role="toolbar" aria-label="Zoom and browse">
        <IconButton label="Zoom out" keys="-" onClick={zoomOut} disabled={!ready}>
          <MinusIcon size={16} />
        </IconButton>
        <output className="bn-preview-zoom" aria-live="polite" aria-label={`Zoom ${percent(scale)}`}>
          {percent(scale)}
        </output>
        <IconButton label="Zoom in" keys="+" onClick={zoomIn} disabled={!ready}>
          <PlusIcon size={16} />
        </IconButton>
        <button type="button" className="st-btn" data-variant="ghost" data-size="sm" aria-pressed={atFit} aria-keyshortcuts="0" onClick={fit} disabled={!ready}>
          <FitIcon size={16} />
          <span>Fit</span>
        </button>
        <button
          type="button"
          className="st-btn"
          data-variant="ghost"
          data-size="sm"
          aria-pressed={Math.abs(scale - 1) < 0.01}
          aria-keyshortcuts="1"
          onClick={actual}
          disabled={!ready}
        >
          100%
        </button>
        <span className="bn-grow" />
        {(hasPrev || hasNext) && (
          <>
            <IconButton label="Previous image" onClick={onPrev} disabled={!hasPrev}>
              <ChevronStartIcon size={16} />
            </IconButton>
            <IconButton label="Next image" onClick={onNext} disabled={!hasNext}>
              <ChevronEndIcon size={16} />
            </IconButton>
          </>
        )}
      </div>
      <div
        ref={stageRef}
        className="bn-preview-stage"
        data-animate={animate ? "" : undefined}
        data-pannable={view && image && stage && canPan(view, image, stage) ? "" : undefined}
        tabIndex={0}
        aria-label={`${item.title}. Plus and minus zoom, 0 fits, 1 shows 100%, arrow keys pan when zoomed in.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- third-party image loaded from its source host on purpose
          <img
            key={src}
            className="bn-preview-image"
            src={src}
            alt={item.title}
            referrerPolicy={item.upload ? "same-origin" : "no-referrer"}
            draggable={false}
            style={
              view && image
                ? { inlineSize: `${image.w}px`, blockSize: `${image.h}px`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }
                : { visibility: "hidden" }
            }
            onLoad={(e) => setImage({ w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 })}
            onError={() => {
              setImage(null);
              setAttempt((a) => a + 1);
            }}
          />
        ) : (
          <p className="bn-preview-missing">The image could not load here. Open the source to see it.</p>
        )}
      </div>
    </div>
  );
}
