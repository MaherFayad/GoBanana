"use client";

/**
 * A small "Made with {app}" notification card in the bottom end corner of the shared canvas,
 * in the site desktop's notification style (glass card, app row, title, body). It links to the
 * landing page and can be dismissed (focus then moves to the board, so it is never lost).
 *
 * It floats over the board, so it hides while a board item has focus (SC 2.4.11) and sits
 * above the React Flow attribution. Copy comes from lib/site/dict (`share.note*`).
 */
import { useState } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { CloseIcon } from "@/components/studio/icons";

export interface MadeWithCardProps {
  appName: string;
  label: string;
  title: string;
  body: string;
  link: string;
  href: string;
  dismiss: string;
}

export function MadeWithCard({ appName, label, title, body, link, href, dismiss }: MadeWithCardProps) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <aside className="share-note" aria-label={label} data-testid="made-with">
      <p className="share-note-app">
        <span className="share-note-icon" aria-hidden="true">
          <BrandMark />
        </span>
        <span dir="ltr">{appName}</span>
      </p>
      <p className="share-note-title">{title}</p>
      <p className="share-note-body">{body}</p>
      <a className="share-note-link" href={href}>
        {link}
      </a>
      <button
        type="button"
        className="st-btn share-note-close"
        data-variant="ghost"
        data-icon-only=""
        data-size="xs"
        aria-label={dismiss}
        onClick={() => {
          setOpen(false);
          document.querySelector<HTMLElement>(".bn-flow")?.focus();
        }}
      >
        <CloseIcon size={16} />
      </button>
    </aside>
  );
}
