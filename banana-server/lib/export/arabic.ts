/**
 * The Arabic-first pack (VAL-08) in DIRECTION.md and BUILD-PROMPT.md: sample copy in white Saudi
 * dialect, an Arabic type pair from the type atlas, and RTL mirroring notes per part. No new
 * format: it rides in files the free plan already has (lib/quota.ts), so plan gating is unchanged.
 */
import { RTL_GLOBAL, arabicPackLines } from "../arabic";
import type { DirectionSummary, KitModel } from "./model";
import { bullets } from "./scoped";
import { mdText, oneLine } from "./util";

/** The pack lines of one direction (a bullet list), or none when the model holds no pack for it. */
export function directionArabicLines(m: KitModel, d: DirectionSummary): string[] {
  const pack = m.arabicPacks.get(d.direction.id);
  return pack ? arabicPackLines(pack, mdText) : [];
}

/** The rules that hold for every part, once per file. */
export function arabicRulesSection(heading: string): string[] {
  return [`${heading} RTL rules for every part`, "", bullets(RTL_GLOBAL.map((r) => oneLine(r, 400))), ""];
}

/** "### Arabic-first pack" for BUILD-PROMPT.md: each focus direction's copy, type pair and RTL notes, then the shared rules. */
export function arabicBuildSection(m: KitModel, heading: string): string[] {
  if (m.focus.length === 0) return [];
  const out: string[] = [
    `${heading} Arabic-first pack`,
    "",
    "Build the Arabic version with the page: use this sample copy as placeholder text, set the Arabic type pair below, and mirror each part as noted. Replace the copy with the product's own words before shipping.",
    "",
  ];
  for (const d of m.focus) {
    const lines = directionArabicLines(m, d);
    if (lines.length === 0) continue;
    if (m.focus.length > 1) out.push(`${oneLine(d.direction.title, 120)}:`, "");
    out.push(...lines, "");
  }
  out.push(...arabicRulesSection(heading));
  return out;
}
