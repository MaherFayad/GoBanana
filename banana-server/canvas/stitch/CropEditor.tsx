"use client";

/**
 * Crop editor dialog: recrop a slot, edit a part in the Parts tab, or cut a new part from an image.
 *
 * Shows the full image (hotlinked from its source, no referrer) with a crop rectangle: drag it
 * to move, drag a handle to resize. The keyboard route is the four number fields (percent of the
 * image) and the presets row (SC 2.5.7). Native <dialog> through Studio's Dialog: focus is
 * trapped, Escape closes, focus goes back to the opener. Loaded on demand (CanvasApp lazy import)
 * so the canvas bundle stays lean.
 */
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { Dialog } from "@/components/studio/Dialog";
import { clampCrop, PART_ROLES, type Crop, type PartRole, type PartTheme } from "@/lib/stitch/types";
import { CROP_PRESETS, dragCrop, fromPercentField, imageAspectOf, toPercent, type CropHandle } from "./crop";
import { CroppedImage } from "./CroppedImage";
import { roleLabel } from "./edit";

export interface CropEditorValue {
  crop: Crop;
  role: PartRole;
  theme: PartTheme;
  note: string;
  /** Natural size measured on load (numbers only), for a new part. */
  imageWidth?: number;
  imageHeight?: number;
}

export interface CropEditorProps {
  /** Dialog title ("Cut part", "Recrop Hero", "Edit part"). */
  heading: string;
  imageUrl: string;
  /** Image title and source site, for the alt text and the source line. */
  imageTitle?: string;
  site: string;
  sourceUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  initial: { crop: Crop; role: PartRole; theme?: PartTheme; note?: string };
  /** Show the theme and note fields (parts, not slot recrops). */
  partFields: boolean;
  saveLabel?: string;
  onSave: (value: CropEditorValue) => void;
  onClose: () => void;
}

const HANDLES: readonly Exclude<CropHandle, "move">[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const FIELDS: readonly { key: keyof Crop; label: string }[] = [
  { key: "x", label: "From left" },
  { key: "y", label: "From top" },
  { key: "w", label: "Width" },
  { key: "h", label: "Height" },
];
const THEMES: readonly { value: PartTheme; label: string }[] = [
  { value: "unknown", label: "Not sure" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function CropEditor(props: CropEditorProps) {
  const { heading, imageUrl, imageTitle, site, sourceUrl, initial, partFields, onSave, onClose } = props;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [crop, setCrop] = useState<Crop>(() => clampCrop(initial.crop));
  const [role, setRole] = useState<PartRole>(initial.role);
  const [theme, setTheme] = useState<PartTheme>(initial.theme ?? "unknown");
  const [note, setNote] = useState(initial.note ?? "");
  const [drafts, setDrafts] = useState<Partial<Record<keyof Crop, string>>>({});
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const firstPreset = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ handle: CropHandle; x: number; y: number; start: Crop } | null>(null);
  // Mounted closed, opened a frame later: Studio's Dialog opens on an open change, and a dialog
  // mounted already open is closed again by React's dev double effects.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const pct = toPercent(crop);
  const aspect = imageAspectOf(props.imageWidth, props.imageHeight) ?? (natural ? natural.w / natural.h : null) ?? 1440 / 900;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const handle = ((e.target as HTMLElement).dataset.handle as CropHandle | undefined) ?? null;
    if (!handle) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { handle, x: e.clientX, y: e.clientY, start: crop };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const r = stageRef.current?.getBoundingClientRect();
    if (!d || !r || r.width === 0 || r.height === 0) return;
    setCrop(dragCrop(d.start, d.handle, (e.clientX - d.x) / r.width, (e.clientY - d.y) / r.height));
    setDrafts({});
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const save = () =>
    onSave({
      crop: clampCrop(crop),
      role,
      theme,
      note: note.trim().slice(0, 280),
      ...(natural ? { imageWidth: natural.w, imageHeight: natural.h } : {}),
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      eyebrow="Frankenstein it"
      title={heading}
      className="bn-crop-dialog"
      initialFocus={firstPreset}
      footer={
        <>
          <button type="button" className="st-btn" data-variant="secondary" data-size="lg" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="st-btn" data-variant="primary" data-size="lg" onClick={save}>
            {props.saveLabel ?? "Save"}
          </button>
        </>
      }
    >
      <div className="bn-crop-editor">
        <div className="bn-crop-stage-wrap">
          <div
            ref={stageRef}
            className="bn-crop-stage"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {failed ? (
              <p className="bn-crop-missing">The image could not load here. The number fields still set the crop.</p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- third-party image loaded from its source host on purpose
              <img
                src={imageUrl}
                alt={imageTitle ? `Full image: ${imageTitle}` : "Full image"}
                referrerPolicy="no-referrer"
                decoding="async"
                draggable={false}
                onLoad={(e) => {
                  const w = e.currentTarget.naturalWidth;
                  const h = e.currentTarget.naturalHeight;
                  if (w > 0 && h > 0) setNatural({ w, h });
                }}
                onError={() => setFailed(true)}
              />
            )}
            <div
              className="bn-crop-rect"
              data-handle="move"
              aria-hidden="true"
              style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
            >
              {HANDLES.map((h) => (
                <span key={h} className="bn-crop-handle" data-handle={h} data-pos={h} />
              ))}
            </div>
          </div>
          <p className="bn-crop-source">
            From{" "}
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              {site}
              <span className="st-visually-hidden"> (opens in a new tab)</span>
            </a>
            . Drag the box to move it, drag a corner or edge to resize it, or type the numbers.
          </p>
        </div>
        <div className="bn-crop-fields">
          <fieldset className="bn-crop-presets">
            <legend>Presets</legend>
            <div className="bn-crop-preset-row">
              {CROP_PRESETS.map((p, i) => (
                <button
                  key={p.id}
                  ref={i === 0 ? firstPreset : undefined}
                  type="button"
                  className="st-btn"
                  data-variant="secondary"
                  data-size="sm"
                  onClick={() => {
                    setCrop(p.crop);
                    setDrafts({});
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="bn-crop-numbers">
            <legend>Crop, in percent of the image</legend>
            {FIELDS.map((f) => (
              <label key={f.key} className="bn-crop-field" htmlFor={`${uid}-${f.key}`}>
                <span>{f.label}</span>
                <input
                  id={`${uid}-${f.key}`}
                  className="st-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={1}
                  value={drafts[f.key] ?? String(pct[f.key])}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setDrafts((d) => ({ ...d, [f.key]: raw }));
                    const n = Number.parseFloat(raw);
                    if (raw.trim() !== "" && Number.isFinite(n)) setCrop((c) => fromPercentField(c, f.key, n));
                  }}
                  onBlur={() => setDrafts((d) => ({ ...d, [f.key]: undefined }))}
                />
              </label>
            ))}
          </fieldset>
          <label className="bn-crop-field" htmlFor={`${uid}-role`}>
            <span>Role</span>
            <select id={`${uid}-role`} className="st-input" value={role} onChange={(e) => setRole(e.target.value as PartRole)}>
              {PART_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>
          {partFields && (
            <>
              <label className="bn-crop-field" htmlFor={`${uid}-theme`}>
                <span>Theme</span>
                <select id={`${uid}-theme`} className="st-input" value={theme} onChange={(e) => setTheme(e.target.value as PartTheme)}>
                  {THEMES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="bn-crop-field" htmlFor={`${uid}-note`}>
                <span>What to take from it</span>
                <textarea
                  id={`${uid}-note`}
                  className="st-input"
                  rows={2}
                  maxLength={280}
                  value={note}
                  placeholder="The split nav with the search pill in the middle"
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </>
          )}
          <div className="bn-crop-preview">
            <p className="bn-crop-preview-label" id={`${uid}-preview`}>
              Preview
            </p>
            <CroppedImage src={imageUrl} crop={crop} alt={`Preview of the ${roleLabel(role)} crop`} width={natural?.w ?? props.imageWidth} height={natural?.h ?? props.imageHeight} fallbackAspect={aspect} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
