"use client";

/**
 * Desktop icons: a few published references, each a button with its thumbnail and credit. A press
 * opens a Quick Look window (a movable Window with the picture, what the move is, and the link to
 * the work on its source site). Escape or the red light closes it and focus goes back to the icon.
 * Images are hotlinked from their source (RefImage), never copied.
 */
import { useRef, useState, type ReactNode } from "react";
import { ExternalIcon } from "@/components/studio/icons";
import type { ArtKind } from "@/lib/site/moves";
import { RefImage } from "../RefImage";
import { Window, type WindowLabels } from "./Window";

export type DeskIcon = { id: string; src: string; title: string; altLang?: string; art: ArtKind; href: string; credit: ReactNode; what: ReactNode };
type Labels = { label: string; quickLook: string; openSource: string; newTab: string; window: WindowLabels };

export function DesktopIcons({ icons, labels }: { icons: DeskIcon[]; labels: Labels }) {
  const [open, setOpen] = useState<number | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const item = open === null ? null : icons[open];

  function close() {
    const at = open;
    setOpen(null);
    if (at !== null) requestAnimationFrame(() => buttons.current[at]?.focus());
  }

  return (
    <div className="desk-icons-wrap">
      <ul className="desk-icons" aria-label={labels.label}>
        {icons.map((icon, i) => (
          <li key={icon.id}>
            <button
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              className="desk-icon"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className="desk-icon-art">
                <RefImage src={icon.src} alt="" art={icon.art} uid={`desk-${icon.id}`} />
              </span>
              <span className="desk-icon-name">
                <span className="st-visually-hidden">{labels.quickLook}: </span>
                {icon.credit}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {item ? (
        <Window
          key={item.id}
          id={`quicklook-${item.id}`}
          title={`${labels.quickLook}: ${item.title}`}
          titleNode={labels.quickLook}
          className="quicklook"
          controls
          autoFocus
          labels={labels.window}
          onClose={close}
        >
          <div className="quicklook-art">
            <RefImage src={item.src} alt={item.title} lang={item.altLang} art={item.art} uid={`ql-${item.id}`} eager />
          </div>
          <p className="quicklook-credit">{item.credit}</p>
          <p className="quicklook-what">{item.what}</p>
          <a className="st-btn" data-variant="secondary" data-size="md" href={item.href} target="_blank" rel="noopener noreferrer">
            <ExternalIcon size={16} />
            {labels.openSource}
            <span className="st-visually-hidden"> ({labels.newTab})</span>
          </a>
        </Window>
      ) : null}
    </div>
  );
}
