/**
 * Plain text with its http(s) URLs as links (notes, "what to steal" notes on references).
 * Safe by construction: text stays React text (never HTML), and only URLs that parse as http or
 * https become links, opening in a new tab with no opener and no referrer.
 */
import { Fragment } from "react";

const URL_RE = /https?:\/\/[^\s<>"'`]+/g;
/** Punctuation that usually ends the sentence, not the URL. */
const TRAILING = /[.,;:!?)\]}]+$/;

export type TextPart = { text: string; href?: string };

/** Split text into plain and link parts. Pure, for Vitest. */
export function linkParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0].replace(TRAILING, "");
    const start = m.index ?? 0;
    let href: string | null = null;
    try {
      const u = new URL(raw);
      if (u.protocol === "http:" || u.protocol === "https:") href = u.href;
    } catch {
      href = null;
    }
    if (!href || raw.length === 0) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: raw, href });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** `focusable={false}` for a visual-only copy (aria-hidden), so its links stay out of the tab order. */
export function LinkedText({ text, focusable = true }: { text: string; focusable?: boolean }) {
  const parts = linkParts(text);
  return (
    <>
      {parts.map((p, i) =>
        p.href ? (
          <a
            key={i}
            className="bn-text-link nodrag nopan"
            href={p.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            tabIndex={focusable ? undefined : -1}
          >
            {p.text}
            <span className="st-visually-hidden"> (opens in a new tab)</span>
          </a>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}
