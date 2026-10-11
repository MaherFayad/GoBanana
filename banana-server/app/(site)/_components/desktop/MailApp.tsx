"use client";

/**
 * The FAQ drawn as a Mail app: a message list and a reading pane. One structure serves both
 * layouts: each list item holds its row (a disclosure button with aria-expanded) and its message.
 * On wide screens desktop.css lays the rows out as a column and puts the open message in the
 * reading pane beside them (CSS grid, `display: contents` on the items); under 768px the same
 * markup reads as an accordion, and a second press on the open row closes it.
 */
import { useId, useState, type ReactNode } from "react";
import { FeedbackIcon } from "@/components/studio/icons";

type Item = { q: ReactNode; a: ReactNode };
type Labels = { inbox: string; listLabel: string; from: string; to: string; count: string };

const NARROW = "(max-width: 767.98px)";

export function MailApp({ items, labels }: { items: Item[]; labels: Labels }) {
  const [open, setOpen] = useState(0);
  const uid = useId();

  function choose(i: number) {
    const narrow = typeof window !== "undefined" && window.matchMedia(NARROW).matches;
    setOpen((cur) => (cur === i && narrow ? -1 : i));
  }

  return (
    <div className="mail">
      <div className="mail-head">
        <span className="mail-inbox">
          <FeedbackIcon size={16} />
          {labels.inbox}
        </span>
        <span className="mail-count">{labels.count}</span>
      </div>
      <ul className="mail-list" aria-label={labels.listLabel} style={{ ["--rows" as string]: items.length }}>
        {items.map((item, i) => {
          const qid = `${uid}-q-${i}`;
          const aid = `${uid}-a-${i}`;
          const isOpen = open === i;
          return (
            <li key={i} className="mail-item">
              <button
                id={qid}
                type="button"
                className="mail-row"
                aria-expanded={isOpen}
                aria-controls={aid}
                data-open={isOpen ? "" : undefined}
                onClick={() => choose(i)}
              >
                <span className="mail-from">{labels.from}</span>
                <span className="mail-subject">{item.q}</span>
                <span className="mail-preview" aria-hidden="true">
                  {item.a}
                </span>
              </button>
              <div id={aid} className="mail-read" role="region" aria-labelledby={qid} hidden={!isOpen}>
                <h3 className="mail-read-subject">{item.q}</h3>
                <p className="mail-read-meta">
                  <span className="mail-avatar" aria-hidden="true" />
                  <span>{labels.from}</span>
                  <span className="mail-to">{labels.to}</span>
                </p>
                <p className="mail-read-body">{item.a}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
