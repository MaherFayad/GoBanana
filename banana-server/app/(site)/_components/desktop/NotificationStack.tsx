/**
 * Notification stack in the top end corner of the desktop. At rest the cards sit on top of each
 * other with the ones behind peeking out; hover or keyboard focus fans them out (CSS only,
 * desktop.css). Each card is a link, so every card is reachable with Tab and the fan opens as
 * focus enters. On phones the cards stack as plain rows.
 */
import { BrandMark } from "@/components/brand/BrandMark";

export type Notice = { href: string; title: string; body: string; when: string };

export function NotificationStack({ label, from, items }: { label: string; from: string; items: Notice[] }) {
  return (
    <section className="notes" aria-label={label}>
      <ul className="notes-list" style={{ ["--n" as string]: items.length }}>
        {items.map((n, i) => (
          <li key={n.href} className="note-card" style={{ ["--i" as string]: i }}>
            <a href={n.href} className="note-link">
              <span className="note-app">
                <span className="note-icon" aria-hidden="true">
                  <BrandMark />
                </span>
                <span className="note-from">{from}</span>
                <span className="note-when">{n.when}</span>
              </span>
              <span className="note-title">{n.title}</span>
              <span className="note-body">{n.body}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
