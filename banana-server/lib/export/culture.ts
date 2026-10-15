/**
 * CULTURE.md and the "Cultural brief" block at the top of DIRECTION.md (CULT-02).
 * The brief shows whenever the focus directions have items with culture data or the board has a lens.
 */
import { getLens } from "../bend/lists";
import { TIER_LABEL } from "../culture";
import type { CultureEntry, KitModel } from "./model";
import { scopeBlock } from "./scope";
import { bullets, focusSources, kitTitle } from "./scoped";
import { mdAutolink, mdText } from "./util";

export const CULTURE_FILE = "CULTURE.md";

/** True when a Cultural brief belongs in the kit. */
export function hasCulture(m: KitModel): boolean {
  return m.cultureEntries.length > 0 || Boolean(m.lens);
}

function uniq(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))];
}

function entryLines(e: CultureEntry): string {
  const c = e.culture;
  const where = e.kind === "note" ? `Note "${mdText(e.label, 60)}"` : mdText(e.label, 100);
  const parts = [
    `**${where}** (${mdText(c.tradition, 80)}, ${mdText(c.region, 80)}${c.community ? `, ${mdText(c.community, 80)}` : ""}). Tier: ${TIER_LABEL[c.tier].en}.`,
    `  - meaning: ${mdText(c.meaning, 600)}`,
    `  - credit: ${mdText(c.credit, 300)}${c.sourceUrl ? ` ${mdAutolink(c.sourceUrl)}` : ""}`,
  ];
  if (e.url) parts.push(`  - item source: ${mdAutolink(e.url)}`);
  return parts.join("\n");
}

/** The block itself, without a top heading level of its own: used inside DIRECTION.md and CULTURE.md. */
export function culturalBrief(m: KitModel): string[] {
  const lens = m.lens ? getLens(m.lens) : undefined;
  const entries = m.cultureEntries;
  const traditions = uniq([...(lens ? [lens.name.en] : []), ...entries.map((e) => e.culture.tradition)]);
  const tiers = uniq([...(lens ? [lens.tier] : []), ...entries.map((e) => e.culture.tier)]);
  const order = ["sacred", "care", "open"] as const;
  const top = order.find((t) => tiers.includes(t)) ?? "open";

  const use = uniq([
    ...(lens ? lens.uiMappings.map((r) => `${r.element}: ${r.grammar}, as ${r.mechanic}`) : []),
    ...entries.map((e) => `${e.culture.tradition} (${e.kind === "note" ? "note" : e.label}): the grammar only, credited`),
  ]);
  const avoid = uniq([...(lens?.sacredOrProtected ?? []), "No sacred text, flags or emblems as decoration.", "No clichés (camels, dunes, lamps) unless the brief asks for them."]);
  const credit = uniq([...entries.map((e) => e.culture.credit), ...(lens ? [`${lens.name.en}: credit the people and the source named below.`] : [])]);
  const sources = uniq([
    ...entries.flatMap((e) => (e.culture.sourceUrl ? [mdAutolink(e.culture.sourceUrl)] : [])),
    ...(lens?.sources.map((s) => `${mdText(s.title, 160)} ${mdAutolink(s.url)}`) ?? []),
  ]);
  const reviewer = lens?.reviewerHint ?? "A person from the community the tradition belongs to.";

  const out: string[] = [
    bullets([
      `Tradition: ${traditions.length > 0 ? traditions.map((t) => mdText(t, 80)).join(", ") : "not named yet"}.`,
      `Tier: ${TIER_LABEL[top].en}${tiers.length > 1 ? ` (highest of ${tiers.join(", ")})` : ""}.${top === "care" || top === "sacred" ? " A reviewer from the community is needed before shipping." : ""}`,
      ...(lens ? [`Meaning: ${mdText(lens.meaning, 600)}`] : []),
      `What we use: ${use.length > 0 ? use.map((u) => mdText(u, 300)).join("; ") : "nothing set yet"}.`,
      `What we avoid: ${avoid.map((a) => mdText(a, 300)).join(" ")}`,
      `Credit: ${credit.length > 0 ? credit.map((c) => mdText(c, 300)).join("; ") : "not written yet. Add credit to every cultural item."}`,
      `Sources: ${sources.length > 0 ? sources.join(", ") : "none verified yet. Find a museum, UNESCO or national institution page and add it."}`,
      `Suggested reviewer: ${mdText(reviewer, 300)}`,
    ]),
  ];
  return out;
}

/** The Cultural brief section for the top of DIRECTION.md, or no lines when the kit has no culture. */
export function culturalBriefSection(m: KitModel): string[] {
  if (!hasCulture(m)) return [];
  return ["## Cultural brief", "", ...culturalBrief(m), ""];
}

/** CULTURE.md: the brief, then the items with their meaning and credit, then reviewer questions. */
export function cultureMd(m: KitModel): string {
  const out: string[] = [`# Culture: ${mdText(kitTitle(m))}`, ""];
  const scope = scopeBlock(m);
  if (scope.length > 0) out.push(...scope, "");
  out.push("## Cultural brief", "", ...culturalBrief(m), "");
  const lens = m.lens ? getLens(m.lens) : undefined;
  if (lens) {
    out.push(`## Lens: ${mdText(lens.name.en, 80)}`, "");
    out.push(lens.uiMappings.length > 0 ? ["| Element | Grammar | UI mechanic |", "| --- | --- | --- |", ...lens.uiMappings.map((r) => `| ${mdText(r.element, 80)} | ${mdText(r.grammar, 160)} | ${mdText(r.mechanic, 160)} |`)].join("\n") : "No UI mappings.", "");
  }
  out.push("## Cultural items", "");
  out.push(m.cultureEntries.length > 0 ? m.cultureEntries.map((e) => `- ${entryLines(e)}`).join("\n") : "No item on the board carries culture data yet. Add it with add_to_canvas (culture).");
  out.push("", "## Questions for the reviewer", "");
  out.push(bullets(["Is the meaning right?", "Is anything used in a way that would offend?", "Is the credit right?"]), "");
  out.push("## Sources", "", focusSources(m), "");
  return out.join("\n");
}
