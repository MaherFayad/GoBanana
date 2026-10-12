/**
 * A static picture of the GoBanana canvas inside a window frame, for the landing page. Built from
 * the same tokens and shapes as the real canvas (canvas/**: the black shell, the results tray, the
 * rounded board with its glass tool dock at the bottom, sticky notes, a section, a swatch, a link card and source chips),
 * but it is markup only: no React Flow, nothing to focus, one accessible name (role="img").
 *
 * Reference tiles are GoBanana's own generative art (TileArt), never someone else's image.
 * Sizes are in em and the frame sets its font size from its own width, so the picture scales as
 * one piece from a phone to a wide screen.
 */
import {
  ArrangeIcon,
  CheckIcon,
  CursorIcon,
  ExternalIcon,
  FrameIcon,
  HandIcon,
  MinusIcon,
  NoteIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  UploadIcon,
} from "@/components/studio/icons";
import type { Dict } from "@/lib/site/dict";
import { fmt } from "@/lib/site/i18n";
import type { ArtKind } from "@/lib/site/moves";
import { TileArt } from "./TileArt";

function Source({ site }: { site: string }) {
  return (
    <span className="mock-source" dir="ltr">
      <ExternalIcon size={12} />
      {site}
    </span>
  );
}

function Ref({ art, site, className }: { art: ArtKind; site: string; className: string }) {
  return (
    <div className={`mock-item mock-ref ${className}`}>
      <TileArt kind={art} uid={`frame-${className}`} />
      <Source site={site} />
    </div>
  );
}

export function ProductFrame({ t }: { t: Dict["landing"]["frame"] }) {
  const m = t.mock;
  return (
    <div className="frame" role="img" aria-label={fmt(t.label)}>
      <div className="frame-inner" aria-hidden="true">
        <div className="frame-bar">
          <span className="frame-dot" />
          <span className="frame-dot" />
          <span className="frame-dot" />
        </div>
        <div className="mock">
          <div className="mock-top">
            <span className="mock-title">
              <strong>{m.title}</strong> <span>{fmt(m.on)}</span>
            </span>
            <span className="mock-spacer" />
            <span className="mock-icon">
              <MinusIcon size={16} />
            </span>
            <span className="mock-zoom" dir="ltr">
              85%
            </span>
            <span className="mock-icon">
              <PlusIcon size={16} />
            </span>
            <span className="mock-status">
              <span className="mock-status-dot" />
              {m.saved}
            </span>
            <span className="mock-btn">
              <UploadIcon size={16} />
              {m.upload}
            </span>
            <span className="mock-btn">
              <ShareIcon size={16} />
              {t.share}
            </span>
          </div>

          <div className="mock-body">
            <div className="mock-rail">
              <span className="mock-rail-item">
                <SearchIcon size={16} />
                <span className="mock-badge">3</span>
              </span>
            </div>
            <div className="mock-tray">
              <p className="mock-tray-title">{t.results}</p>
              <p className="mock-tray-hint">{m.resultsHint}</p>
              <div className="mock-tray-grid">
                {(
                  [
                    ["iridescent", t.directions[1], "dribbble.com"],
                    ["grain", t.directions[2], "pinterest.com"],
                    ["fluted", t.directions[0], "behance.net"],
                  ] as const
                ).map(([art, title, site]) => (
                  <div key={art} className="mock-tray-tile">
                    <span className="mock-tray-art">
                      <TileArt kind={art} uid={`frame-tray-${art}`} />
                    </span>
                    <span className="mock-tray-name">{title}</span>
                    <Source site={site} />
                  </div>
                ))}
              </div>
            </div>

            <div className="mock-board">
              <div className="mock-notch">
                <span className="mock-icon is-on">
                  <CursorIcon size={16} />
                </span>
                <span className="mock-icon">
                  <HandIcon size={16} />
                </span>
                <span className="mock-sep" />
                <span className="mock-tool">
                  <NoteIcon size={16} />
                  {m.addNote}
                </span>
                <span className="mock-tool">
                  <FrameIcon size={16} />
                  {m.addSection}
                </span>
                <span className="mock-tool">
                  <ArrangeIcon size={16} />
                  {m.arrange}
                </span>
              </div>

              <div className="mock-item mock-note" data-color="yellow">
                {t.note}
              </div>
              <Ref art="sadu" site="pinterest.com" className="mock-ref-1" />

              <Ref art="riso" site="behance.net" className="mock-ref-4" />

              <div className="mock-item mock-swatch">
                <span className="mock-swatch-color" />
                <span className="mock-swatch-role">{m.swatch}</span>
                <span className="mock-swatch-row" dir="ltr">
                  <span className="mock-aa">Aa</span> 5.3:1
                  <span className="mock-pass">
                    <CheckIcon size={12} />
                    AA
                  </span>
                </span>
                <span className="mock-swatch-row" dir="ltr">
                  <span className="mock-aa is-ink">Aa</span> 14.0:1
                  <span className="mock-pass">
                    <CheckIcon size={12} />
                    AA
                  </span>
                </span>
              </div>

              <div className="mock-section">
                <div className="mock-section-head">
                  <span className="mock-section-dot" />
                  <span className="mock-section-title">{t.directions[0]}</span>
                  <span className="mock-section-count">{fmt(m.items, { n: 3 })}</span>
                </div>
                <Ref art="kufic" site="dribbble.com" className="mock-ref-2" />
                <Ref art="dusk" site="pinterest.com" className="mock-ref-3" />
                <div className="mock-item mock-note mock-note-3" data-color="blue">
                  {m.note2}
                </div>
              </div>

              <div className="mock-item mock-type">
                <span className="mock-type-label" dir="ltr">
                  {m.typeLabel}
                </span>
                <span className="mock-type-title">{m.typeTitle}</span>
                <span className="mock-type-body">{m.typeBody}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
