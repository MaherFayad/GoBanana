/** The culture part of a lens preset (CULT-02), as bend_brief returns it. Pure. */
import type { LensCulture, LensPreset } from "../bend/types";

const TIER_LINE: Record<LensPreset["tier"], string> = {
  open: "Tier open: a style or movement anyone may draw from. Still credit the source.",
  care: "Tier care: a living tradition of a community. Credit its people, use the grammar not the artifact, and ask a reviewer from the community before you ship.",
  sacred: "Tier sacred: do not use as decoration. Work only with the community and say no to anything else.",
};

export function lensCulture(lens: LensPreset): LensCulture {
  return {
    tier: lens.tier,
    meaning: lens.meaning,
    uiMappings: lens.uiMappings,
    care: [TIER_LINE[lens.tier], ...lens.sacredOrProtected.map((s) => `Never: ${s}`), `Reviewer: ${lens.reviewerHint}`],
    sources: lens.sources,
  };
}

/** Text lines for formatDirections: they apply to every direction below. */
export function lensCultureLines(c: LensCulture): string[] {
  return [
    `Meaning: ${c.meaning}`,
    "UI mappings (apply to every direction below that uses the lens):",
    ...c.uiMappings.map((r) => `- ${r.element}: ${r.grammar}. Becomes: ${r.mechanic}.`),
    ...c.care.map((l) => `Care: ${l}`),
    ...(c.sources.length > 0 ? [`Sources: ${c.sources.map((s) => `${s.title} ${s.url}`).join("; ")}`] : []),
    "Write a note with meaning, steal, credit and care lines for each lens item you place (add_to_canvas culture).",
  ];
}
