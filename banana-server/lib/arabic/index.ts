/**
 * The Arabic-first pack of a direction (VAL-08): sample Arabic copy for the page's key strings, RTL
 * mirroring notes per part, and an Arabic type pair from the J12 type atlas picked by the
 * direction's type voice. Pure and deterministic (the same direction gives the same pack), no
 * model call. The type pairs are loaded by the caller (lib/atlas/wiring.ts loadTypePairs); with
 * none, the voice's own Arabic fonts (lib/kit/voice-fonts.ts) are used and the pack says so.
 */
import { cyrb53 } from "@/lib/bend/prng";
import type { TypePair } from "@/lib/atlas/types";
import { isTypeVoice, type ArabicPack, type ArabicTypePair, type DirectionDetail, type TypeVoice } from "@/lib/direction-detail";
import { DEFAULT_VOICE, voiceFonts } from "@/lib/kit/voice-fonts";
import { copyKindOf, sampleCopy } from "./copy";
import { rtlNotes } from "./rtl";

export { RTL_GLOBAL, RTL_BY_ELEMENT, rtlNotes } from "./rtl";
export { KINDS as COPY_KINDS, GENERIC as GENERIC_COPY, copyKindOf, sampleCopy } from "./copy";

const total = (p: TypePair) => p.scores.harmony + p.scores.arabicBody + p.scores.hierarchy + p.scores.latinBody;

/** How many of the best pairs of a voice a direction may land on, so directions of one voice differ. */
export const PAIR_CHOICES = 3;

/** The voice's own fonts as a type pair (no Atlas): the same four families exports already use. */
export function voicePair(voice: TypeVoice): ArabicTypePair {
  const f = voiceFonts(voice);
  return {
    source: "voice",
    voice: f.voice,
    latin: { display: f.latinDisplay.family, body: f.latinBody.family },
    arabic: { display: f.arabicDisplay.family, body: f.arabicBody.family },
  };
}

/**
 * One of the three best J12 pairs of this voice (harmony, Arabic body, hierarchy and Latin body
 * scores added, id as the tie break), chosen by `seed`. No pair of the voice: the voice's fonts.
 */
export function pickTypePair(pairs: readonly TypePair[] | null | undefined, voice: TypeVoice, seed: string): ArabicTypePair {
  const ranked = (pairs ?? [])
    .filter((p) => p && p.voice === voice && p.arabic?.display && p.arabic?.body && p.latin?.display && p.latin?.body)
    .sort((a, b) => total(b) - total(a) || a.id.localeCompare(b.id))
    .slice(0, PAIR_CHOICES);
  if (ranked.length === 0) return voicePair(voice);
  const p = ranked[cyrb53(`${seed}|${voice}`) % ranked.length]!;
  return { source: "atlas", id: p.id, voice, latin: { ...p.latin }, arabic: { ...p.arabic }, ...(p.notes ? { notes: p.notes } : {}) };
}

export interface ArabicInput {
  /** Stable seed, normally the direction id. */
  seed: string;
  detail?: DirectionDetail | null;
  brief?: string | null;
  /** J12 pairs for the voice (all voices are fine). */
  pairs?: readonly TypePair[] | null;
}

/** The type voice a direction asks for. */
export function voiceOf(detail: DirectionDetail | null | undefined): TypeVoice {
  const v = detail?.spec?.typeVoice;
  return isTypeVoice(v) ? v : DEFAULT_VOICE;
}

/** The Arabic pack of one direction. */
export function buildArabicPack(input: ArabicInput): ArabicPack {
  const { detail } = input;
  const kind = copyKindOf({ pageId: detail?.atlas?.pageId, pages: detail?.pages, brief: input.brief ?? detail?.brief });
  const parts = [...(detail?.mechanic?.element ? [detail.mechanic.element] : []), ...kind.parts];
  return {
    page: kind.id,
    copy: sampleCopy(kind, input.seed),
    rtl: rtlNotes(parts),
    type: pickTypePair(input.pairs, voiceOf(detail), input.seed),
  };
}

/** Lines of Markdown for DIRECTION.md (a bullet list; no heading). */
export function arabicPackLines(pack: ArabicPack, md: (s: string, max?: number) => string): string[] {
  const c = pack.copy;
  const t = pack.type;
  const pair =
    t.source === "atlas"
      ? `Arabic type pair (J12 type atlas, ${md(t.id ?? "", 120)}): ${t.arabic.display} for display and ${t.arabic.body} for body, with ${t.latin.display} and ${t.latin.body} for Latin.${t.notes ? ` ${md(t.notes, 400)}` : ""}`
      : `Arabic type pair (the ${t.voice.replace(/-/g, " ")} voice's own fonts, the type atlas had no pair for it): ${t.arabic.display} for display and ${t.arabic.body} for body, with ${t.latin.display} and ${t.latin.body} for Latin.`;
  return [
    `- Sample copy for a ${pack.page} page (white Saudi dialect, no tashkeel):`,
    `  - Headline: ${md(c.headline.ar, 120)} (${md(c.headline.en, 120)})`,
    `  - Main action: ${md(c.action.ar, 80)} (${md(c.action.en, 80)})`,
    `  - Supporting line: ${md(c.support.ar, 200)} (${md(c.support.en, 200)})`,
    `- ${pair}`,
    "- RTL, part by part:",
    ...pack.rtl.flatMap((n) => [`  - ${md(n.part, 60)}. Flips: ${md(n.flips, 300)} Keeps: ${md(n.keeps, 300)}`]),
  ];
}

/** One compact line for get_canvas: the headline and the type pair. */
export function arabicSummaryLine(pack: ArabicPack): string {
  const t = pack.type;
  return `arabic: "${pack.copy.headline.ar}" | ${t.arabic.display} + ${t.arabic.body}${t.source === "atlas" ? " (type atlas)" : " (voice fonts)"}`;
}
