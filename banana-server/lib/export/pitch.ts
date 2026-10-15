/**
 * PITCH.md (VAL-06): the kept directions as a short deck in Markdown, for a stakeholder.
 * One slide per section (idea, mechanic, references, palette, type), slides split by `---`.
 * Images stay hotlinked and every reference carries its source link; nothing is embedded.
 */
import type { DirectionSummary, KitModel, Reference } from "./model";
import { directionRefs } from "./model";
import { scopeBlock } from "./scope";
import { focusSources, kitTitle, refLine } from "./scoped";
import { mdAutolink, mdText } from "./util";

/** Top references shown per direction, so a slide stays one screen. */
const MAX_REFS = 4;

function mechanicLine(d: DirectionSummary): string {
  const det = d.detail;
  const mech = (det as { mechanic?: { element?: string; how?: string } } | null)?.mechanic;
  if (mech?.how) return mdText(mech.how, 300);
  const spec = det?.spec;
  return mdText(spec?.signature || spec?.pattern || "Not written yet. Name the one working part this idea becomes before presenting.", 300);
}

function refSlide(m: KitModel, d: DirectionSummary): string[] {
  const { art, ui } = directionRefs(m, d.direction.id);
  const pick: Reference[] = [...art.slice(0, 2), ...ui].slice(0, MAX_REFS);
  if (pick.length === 0) return ["No references placed yet."];
  const lines = pick.map((r) => {
    const base = refLine(r);
    // Hotlink the image beside its source link; never embed bytes.
    return r.imageUrl && r.url ? `${base} Image: ${mdAutolink(r.imageUrl)}` : base;
  });
  return [...lines, "", "Images belong to their owners and stay hotlinked. Credit the source links when you present."];
}

function paletteSlide(m: KitModel, d: DirectionSummary): string[] {
  const rec = d.detail?.reconciled;
  if (rec && rec.palette.length > 0) {
    return [
      ...rec.palette.map((c) => `- \`${c.hex}\`${c.role ? ` ${mdText(c.role, 40)}` : ""}`),
      ...(rec.mood ? ["", `Mood: ${mdText(rec.mood, 200)}`] : []),
    ];
  }
  if (m.ship.length > 0) return m.ship.map((c) => `- \`${c.hex}\` ${mdText(c.name, 40)}`);
  return ["No palette on the board yet. Run extract_palette on the best references."];
}

export function pitchMd(m: KitModel): string {
  const dirs = m.focus.filter((d) => d.status !== "dropped");
  const out: string[] = [
    `# ${mdText(kitTitle(m))}`,
    "",
    ...scopeBlock(m),
    ...(scopeBlock(m).length > 0 ? [""] : []),
    `${dirs.length === 1 ? "One wild direction" : `${dirs.length} wild directions`} for ${m.brief ? `"${mdText(m.brief, 300)}"` : "this product"}.`,
    ...(m.webUrl ? ["", `Board: <${m.webUrl}>`] : []),
    "",
    "One slide per section. Slides are split by a line with three dashes.",
  ];
  if (dirs.length === 0) out.push("", "---", "", "## No kept directions", "", "Rate at least one direction keep with rate_directions, then export again.");
  dirs.forEach((d, i) => {
    const spec = d.detail?.spec;
    const n = dirs.length > 1 ? `${i + 1}. ` : "";
    out.push("", "---", "", `## ${n}Idea: ${mdText(d.direction.title)}`, "");
    out.push(mdText(d.detail?.twist || spec?.whyItFits || d.direction.move, 300));
    if (spec?.whyItFits && d.detail?.twist) out.push("", `Why it fits: ${mdText(spec.whyItFits, 300)}`);
    out.push("", "---", "", `## ${n}Mechanic`, "", mechanicLine(d));
    if (spec?.density) out.push("", `Density: ${mdText(spec.density, 200)}`);
    out.push("", "---", "", `## ${n}References`, "", ...refSlide(m, d));
    out.push("", "---", "", `## ${n}Palette`, "", ...paletteSlide(m, d));
    out.push("", "---", "", `## ${n}Type`, "");
    out.push(spec?.typography ? mdText(spec.typography, 300) : `${m.pairing.display.family} for display and ${m.pairing.body.family} for body.`);
    out.push("", `Open fonts: ${m.pairing.display.family} and ${m.pairing.body.family}, ${mdAutolink(m.pairing.url)}`);
  });
  out.push("", "---", "", "## Next step", "", "Pick one direction, then ask for a build prompt or a prototype. Each direction can ship as a flagged variant for a test.");
  out.push("", "---", "", "## Sources", "", focusSources(m));
  return out.join("\n");
}
