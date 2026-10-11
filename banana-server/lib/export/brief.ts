import type { KitModel } from "./model";
import { sourcesMarkdown } from "./design-md";
import { mdAutolink, mdText, wildnessLabel } from "./util";

/** Markdown record of the brief, the bend directions tried, what was kept and the notes. */
export function briefMd(m: KitModel): string {
  const out: string[] = [`# ${mdText(m.title)}: brief`, ""];

  out.push("## Brief", "");
  out.push(m.brief ? `> ${mdText(m.brief, 500)}` : "No brief was written for this board.", "");
  out.push(`Wildness: ${wildnessLabel(m.wildness)}.${m.lens ? ` Culture lens: ${mdText(m.lens)}.` : ""}`);
  if (m.webUrl) out.push("", `Board: ${mdAutolink(m.webUrl)}`);
  out.push("");

  out.push("## Directions tried", "");
  if (m.directions.length === 0) out.push("No bend directions were run for this board.");
  m.directions.forEach((d, i) => {
    const status = d.kept
      ? `Kept: ${d.referenceCount} reference${d.referenceCount === 1 ? "" : "s"} in "${mdText(d.sectionTitle)}".`
      : d.sectionTitle
        ? `Not kept: its section "${mdText(d.sectionTitle)}" has no references.`
        : "Not kept.";
    out.push(`${i + 1}. **${mdText(d.direction.title)}** (${mdText(d.direction.move)}). Search: "${mdText(d.direction.searchQuery)}". ${status}`);
  });
  out.push("");

  out.push("## What was kept", "");
  const groups = [
    ...m.sections.map((s) => ({ title: s.title, id: s.id as string | null })),
    { title: "Outside any section", id: null },
  ];
  let any = false;
  for (const g of groups) {
    const refs = m.references.filter((r) => r.sectionId === g.id);
    if (refs.length === 0) continue;
    any = true;
    out.push(`### ${mdText(g.title)}`, "");
    for (const r of refs) {
      out.push(`- Reference ${r.n}: ${mdText(r.title)} (${mdText(r.site)}${r.tag ? `, ${r.tag}` : ""}): ${r.url ? mdAutolink(r.url) : `source link not usable (${mdText(r.rawUrl) || "missing"})`}`);
    }
    out.push("");
  }
  if (!any) out.push("No references were kept.", "");
  out.push(
    `- Colors tagged ship: ${m.ship.length > 0 ? m.ship.map((c) => `${c.name} ${c.hex}`).join(", ") : "none"}.`,
    `- Colors to explore (concept only): ${m.explore.length > 0 ? m.explore.map((c) => c.hex).join(", ") : "none"}.`,
    `- Type: ${m.pairing.name} (${m.pairing.licence})${m.pairingFromCanvas ? "" : ", default pairing"}.`,
    "",
  );

  out.push("## Notes", "");
  if (m.notes.length === 0) out.push("No notes on the board.");
  for (const n of m.notes) {
    const where = n.referenceN ? ` (on reference ${n.referenceN})` : n.sectionTitle ? ` (in ${mdText(n.sectionTitle)})` : "";
    out.push(`- ${mdText(n.text, 1000)}${where}`);
  }
  out.push("");

  out.push("## Sources", "", sourcesMarkdown(m), "");
  return out.join("\n");
}
