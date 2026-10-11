/**
 * Two-tone heading for the GoBanana desktop: the first line grey, the second white, set tight
 * (line-height 0.9, tracking -0.04em in Latin; Arabic keeps normal tracking and a taller line).
 * Both lines are one heading, so a screen reader reads it as one sentence.
 */
import type { ReactNode } from "react";

type Props = {
  as?: "h1" | "h2" | "h3";
  id?: string;
  dim: ReactNode;
  bright: ReactNode;
  className?: string;
  tabIndex?: number;
};

export function TwoToneHeading({ as: Tag = "h2", id, dim, bright, className, tabIndex }: Props) {
  return (
    <Tag id={id} tabIndex={tabIndex} className={className ? `tt ${className}` : "tt"}>
      <span className="tt-dim">{dim}</span> <span className="tt-bright">{bright}</span>
    </Tag>
  );
}

/** Words a second line reads well starting with (English and Arabic). */
const BREAK_BEFORE = new Set(["into", "with", "for", "to", "as", "in", "on", "not", "إلى", "في", "مع", "على", "لم", "من"]);

/**
 * Splits a one-line title into the two tones: before a preposition nearest the middle when there
 * is one, else at the middle word.
 */
export function splitTitle(title: string): [string, string] {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return ["", title];
  const mid = words.length / 2;
  let best = -1;
  for (let i = 1; i < words.length; i++) {
    if (BREAK_BEFORE.has(words[i]!.toLowerCase()) && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  const at = best > 0 && Math.abs(best - mid) <= words.length / 3 ? best : Math.ceil(mid);
  return [words.slice(0, at).join(" "), words.slice(at).join(" ")];
}
