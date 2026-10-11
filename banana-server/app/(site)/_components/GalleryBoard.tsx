"use client";

/**
 * One example board in the landing gallery: a 2 by 2 collage of real references (hotlinked,
 * generative art on error), the board's five-color palette, the title and copy, a "4 sources"
 * disclosure with each work's link, and, on hover or focus, the direction's twist and an
 * "Open example" button. The button opens the board larger in a Studio dialog, with every
 * reference captioned and linked (hard rule 3).
 *
 * Without references (takedown list unavailable) the collage shows GoBanana's own art and the
 * sources disclosure is left out.
 */
import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/studio/Dialog";
import { ArrowEndIcon, ExternalIcon } from "@/components/studio/icons";
import type { ArtKind } from "@/lib/site/moves";
import { RefImage } from "./RefImage";
import { TileArt } from "./TileArt";

export type BoardRef = {
  src: string;
  alt: string;
  altLang?: string;
  href: string;
  /** "Creator, Site" (bidi isolated). */
  credit: ReactNode;
  /** The work's title, shown in the source list. */
  title: string;
};

export type BoardLabels = {
  openExample: string;
  exampleEyebrow: string;
  twist: string;
  paletteLabel: string;
  paletteTitle: string;
  sources: string;
  sourcesTitle: string;
  newTab: string;
  close: string;
};

type Props = {
  index: number;
  board: "souq" | "transit" | "loud" | "private";
  title: string;
  body: ReactNode;
  twist: ReactNode;
  tags: string[];
  palette: string[];
  arts: readonly ArtKind[];
  refs: (BoardRef | null)[] | null;
  labels: BoardLabels;
};

function Collage({ arts, refs, uid, large = false }: { arts: readonly ArtKind[]; refs: Props["refs"]; uid: string; large?: boolean }) {
  return (
    <span className={large ? "gallery-art is-large" : "gallery-art"}>
      {arts.map((art, j) => {
        const r = refs?.[j];
        return (
          <span key={`${art}-${j}`} className="gallery-cell">
            {r ? <RefImage src={r.src} alt={r.alt} lang={r.altLang} art={art} uid={`${uid}-${j}`} /> : <TileArt kind={art} uid={`${uid}-${j}`} />}
          </span>
        );
      })}
    </span>
  );
}

function Palette({ board, names, label }: { board: Props["board"]; names: string[]; label: string }) {
  return (
    <span className="board-palette" data-board={board} role="img" aria-label={label}>
      {names.map((n) => (
        <span key={n} className="board-swatch" />
      ))}
    </span>
  );
}

export function GalleryBoard({ index, board, title, body, twist, tags, palette, arts, refs, labels }: Props) {
  const [open, setOpen] = useState(false);
  const shown = refs?.filter((r): r is BoardRef => r !== null) ?? [];
  const paletteLabel = labels.paletteLabel.replace("{names}", palette.join(", "));
  const titleId = `gallery-${index}-title`;

  return (
    <>
      <div className="gallery-media">
        <Collage arts={arts} refs={refs} uid={`gallery-${index}`} />
        {/* Over the collage on hover and on focus within the card; below it on touch screens. */}
        <div className="gallery-reveal">
          <span className="gallery-twist">
            <span className="gallery-twist-label">{labels.twist}:</span> {twist}
          </span>
          <button type="button" className="st-btn" data-variant="secondary" data-size="sm" aria-describedby={titleId} onClick={() => setOpen(true)}>
            {labels.openExample}
            <ArrowEndIcon size={16} />
          </button>
        </div>
      </div>
      <div className="gallery-head">
        <h3 id={titleId}>{title}</h3>
        <Palette board={board} names={palette} label={paletteLabel} />
      </div>
      <p>{body}</p>
      <div className="gallery-tags">
        {tags.map((tag) => (
          <span key={tag} className="st-chip">
            {tag}
          </span>
        ))}
      </div>
      {shown.length > 0 ? (
        <details className="gallery-sources">
          <summary>{labels.sources.replace("{n}", String(shown.length))}</summary>
          <ul>
            {shown.map((r) => (
              <li key={r.href}>
                <a href={r.href} target="_blank" rel="noopener noreferrer">
                  <span className="gallery-source-title" lang={r.altLang}>
                    {r.title}
                  </span>
                  <span className="gallery-source-credit">{r.credit}</span>
                  <span className="st-visually-hidden"> ({labels.newTab})</span>
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <Dialog open={open} onClose={() => setOpen(false)} title={title} eyebrow={labels.exampleEyebrow} size="2xl" closeLabel={labels.close} className="board-dialog">
        {/* Built only while open, so the closed dialogs load no images. */}
        {open ? (
          <div className="board-dialog-body">
            <ul className="board-dialog-grid">
              {arts.map((art, j) => {
                const r = refs?.[j];
                return (
                  <li key={`${art}-${j}`}>
                    <span className="board-dialog-art">
                      {r ? (
                        <RefImage src={r.src} alt={r.alt} lang={r.altLang} art={art} uid={`board-${index}-${j}`} eager />
                      ) : (
                        <TileArt kind={art} uid={`board-${index}-${j}`} />
                      )}
                    </span>
                    {r ? (
                      <a className="board-dialog-credit" href={r.href} target="_blank" rel="noopener noreferrer">
                        <span>{r.credit}</span>
                        <ExternalIcon size={12} />
                        <span className="st-visually-hidden"> ({labels.newTab})</span>
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="board-dialog-side">
              <p>{body}</p>
              <p>
                <strong>{labels.twist}:</strong> {twist}
              </p>
              <h3 className="board-dialog-subtitle">{labels.paletteTitle}</h3>
              <ul className="board-dialog-palette" data-board={board}>
                {palette.map((n) => (
                  <li key={n}>
                    <span className="board-swatch" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
