"use client";

/**
 * A Frankenstein page from the examples (lib/site/examples.json): parts cut from real references
 * and stacked into one page, with the canvas's three views (docs/stitch-spec.md): collage (the
 * parts as they are), wireframe (grey, softened, role labels) and even (dark parts inverted so
 * the page reads as one theme).
 *
 * A part is a crop rectangle over a hotlinked image, cropped with CSS only (the canvas's own
 * math, canvas/stitch/crop.ts); nothing is fetched or cut. Every slot shows its source as a link.
 * Slots in a row get widths in proportion to their aspect, so a row is one height. A slot whose
 * image fails keeps its place as a plain box with its role, never a broken image icon.
 */
import { useState } from "react";
import { ExternalIcon } from "@/components/studio/icons";
import { cropStyles, slotFilter } from "@/canvas/stitch/crop";
import type { ExampleStitch } from "@/lib/site/examples";
import { STITCH_MODES, type StitchMode } from "@/lib/stitch/types";

export type StitchLabels = {
  modes: Record<StitchMode, string>;
  modesLabel: string;
  pagesLabel: string;
  roles: Record<string, string>;
  /** "{role} from {site}" */
  slot: string;
  parts: string;
  newTab: string;
};

type Item = { key: string; stitch: ExampleStitch };

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

function Slot({ part, mode, role, label, newTab }: { part: ExampleStitch["parts"][number]; mode: StitchMode; role: string; label: string; newTab: string }) {
  const [failed, setFailed] = useState(false);
  const aspect = part.ref.w && part.ref.h ? part.ref.w / part.ref.h : 16 / 10;
  const s = cropStyles(part.crop, aspect);
  const boxAspect = Number(s.box.aspectRatio) || 1;
  return (
    <figure className="ex-slot" style={{ flexGrow: boxAspect }} data-theme={part.theme} data-failed={failed ? "" : undefined}>
      <div className="ex-crop" style={{ aspectRatio: s.box.aspectRatio, filter: failed ? undefined : slotFilter(mode, part.theme) }}>
        {failed ? null : (
          // eslint-disable-next-line @next/next/no-img-element -- third-party image hotlinked from its source on purpose (hard rule 2)
          <img
            src={part.ref.src}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            draggable={false}
            style={s.img}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {mode === "wireframe" || failed ? (
        <span className="ex-role" aria-hidden="true">
          {role}
        </span>
      ) : null}
      <figcaption>
        <a className="ex-chip" href={part.ref.href} target="_blank" rel="noopener noreferrer" dir="auto">
          <ExternalIcon size={12} />
          <span>{label}</span>
          <span className="st-visually-hidden"> ({newTab})</span>
        </a>
      </figcaption>
    </figure>
  );
}

export function StitchView({ items, labels, en }: { items: Item[]; labels: StitchLabels; en?: string }) {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<StitchMode>("collage");
  const item = items[index] ?? items[0];
  if (!item) return null;
  const { stitch } = item;
  const roleName = (role: string) => labels.roles[role] ?? labels.roles.other ?? role;

  return (
    <div className="ex-stitch" data-mode={mode}>
      <div className="ex-stitch-bar">
        {items.length > 1 ? (
          <div className="ex-seg" role="group" aria-label={labels.pagesLabel}>
            {items.map((it, i) => (
              <button key={it.key} type="button" aria-pressed={i === index} onClick={() => setIndex(i)} lang={en}>
                {it.stitch.title}
              </button>
            ))}
          </div>
        ) : null}
        <div className="ex-seg" role="group" aria-label={labels.modesLabel}>
          {STITCH_MODES.map((m) => (
            <button key={m} type="button" aria-pressed={m === mode} onClick={() => setMode(m)}>
              {labels.modes[m]}
            </button>
          ))}
        </div>
      </div>
      <p className="ex-stitch-note ex-en" lang={en} dir="auto">
        {stitch.note}
      </p>
      <div className="ex-frame" dir="ltr" data-platform={stitch.platform} key={item.key}>
        {stitch.rows.map((row, ri) => (
          <div key={ri} className="ex-srow">
            {row.parts.map((pi) => {
              const part = stitch.parts[pi];
              if (!part) return null;
              return <Slot key={pi} part={part} mode={mode} role={roleName(part.role)} label={fill(labels.slot, { role: roleName(part.role), site: part.ref.site })} newTab={labels.newTab} />;
            })}
          </div>
        ))}
      </div>
      <details className="ex-parts">
        <summary>{labels.parts}</summary>
        <ol>
          {stitch.parts.map((p, i) => (
            <li key={i}>
              <span className="ex-k">{roleName(p.role)}</span>{" "}
              <a href={p.ref.href} target="_blank" rel="noopener noreferrer">
                <span lang={en} dir="auto">{p.ref.title}</span>, <bdi dir="ltr">{p.ref.site}</bdi>
                <span className="st-visually-hidden"> ({labels.newTab})</span>
              </a>
              {p.note ? (
                <span className="ex-part-note" lang={en} dir="auto">
                  {" "}
                  {p.note}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
