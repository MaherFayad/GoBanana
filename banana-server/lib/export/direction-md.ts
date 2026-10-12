/** DIRECTION.md: the full visual spec of the direction(s) this kit is about, with references. */
import type { DirectionSummary, KitModel } from "./model";
import { dimText, directionRefs } from "./model";
import { pairingSource } from "./design-md";
import { globsText, pagesText, scopeBlock } from "./scope";
import { SPEC_AXES, bullets, exploreLine, focusSources, fontsLine, kitTitle, refLine, shipLine, statusText } from "./scoped";
import { stitchSection } from "./stitch-md";
import { mdText, wildnessLabel } from "./util";

function directionBlock(m: KitModel, d: DirectionSummary, i: number): string[] {
  const out: string[] = [`## ${i + 1}. ${mdText(d.direction.title)}`, ""];
  const det = d.detail;
  const facts = [
    `Move: ${mdText(d.direction.move)}. Status: ${statusText(d)}.`,
    ...(det?.twist ? [`Twist: ${mdText(det.twist, 300)}`] : []),
    ...(det?.pages?.length ? [`Pages saved with it: ${det.pages.map((p) => mdText(p, 80)).join(", ")}.`] : []),
    ...(det?.wildness ? [`Wildness: ${wildnessLabel(det.wildness)}.`] : []),
    `Search used: "${mdText(d.direction.searchQuery)}".`,
  ];
  out.push(bullets(facts), "");

  const spec = det?.spec;
  if (spec) {
    out.push("### Visual spec", "");
    const axes = SPEC_AXES.filter(([k]) => typeof spec[k] === "string" && spec[k]).map(([k, label]) => `**${label}:** ${mdText(spec[k] as string, 300)}`);
    axes.push(`**Type voice:** ${spec.typeVoice.replace(/-/g, " ")}. ${fontsLine(m)}.`);
    if (spec.styleWords.length > 0) axes.push(`**Style words:** ${spec.styleWords.map((w) => mdText(w, 40)).join(", ")}.`);
    out.push(bullets(axes), "");
    out.push("### Steal", "", spec.steal.length > 0 ? bullets(spec.steal.map((s) => mdText(s, 200))) : "Nothing listed yet.", "");
    out.push("### Avoid", "", spec.avoid.length > 0 ? bullets(spec.avoid.map((s) => mdText(s, 200))) : "Nothing listed yet.", "");
    out.push("### Why it fits", "", spec.whyItFits ? mdText(spec.whyItFits, 300) : "Not written yet.", "");
  } else {
    out.push(
      "No visual spec was saved for this direction. Run bend_brief again with this canvasId to save one, or fill in type, color, layout, imagery, motion, texture, icons and density by hand before building.",
      "",
    );
  }

  const { art, ui } = directionRefs(m, d.direction.id);
  out.push("### Art direction references", "");
  if (art.length > 0) out.push(art.map(refLine).join("\n"));
  else out.push(`None placed yet.${det?.artQueries?.length ? ` Art direction searches: ${det.artQueries.map((q) => `"${mdText(q, 200)}"`).join(", ")}.` : ""}`);
  out.push("", "### UI references", "");
  out.push(ui.length > 0 ? ui.map(refLine).join("\n") : "None placed yet.");
  out.push("");
  return out;
}

export function directionMd(m: KitModel): string {
  const out: string[] = [`# Wild direction: ${mdText(kitTitle(m))}`, ""];
  const scope = scopeBlock(m);
  if (scope.length > 0) out.push(...scope, "");
  const platformNote =
    m.platformFrom === "direction" ? "set on the direction" : m.platformFrom === "brief" ? "guessed from the brief" : "not set, so responsive defaults";
  out.push(
    bullets([
      `Brief: ${m.brief ? `"${mdText(m.brief, 500)}"` : "none written"}.`,
      `Pages: ${pagesText(m.pages, m.brief)}. Files: ${globsText(m.globs)}.`,
      `Platform: ${m.platform.label} (${platformNote}).`,
      `Board wildness: ${wildnessLabel(m.wildness)}${m.lens ? `. Culture lens: ${mdText(m.lens)}` : ""}.`,
      ...(m.webUrl ? [`Board: ${`<${m.webUrl}>`}`] : []),
    ]),
    "",
  );
  if (m.focus.length > 1) {
    out.push(`This file holds ${m.focus.length} directions. Build each as its own variant of the page so they can be compared, or export one with directionId.`, "");
  }
  if (m.focus.length === 0) out.push("No bend directions were run for this board. The references below are the whole direction.", "");
  m.focus.forEach((d, i) => out.push(...directionBlock(m, d, i)));

  out.push(...stitchSection(m));
  const p = m.platform;
  out.push("## Platform defaults", "");
  out.push(
    bullets([
      `Grid: ${p.columns}, ${p.margins}.`,
      `Targets: ${p.targets}.`,
      `Type scale: ${m.typography.map((t) => `${t.name} ${dimText(t.fontSize)}`).join(", ")}${p.fluid ? `; fluid display ${p.fluid.display}, headline ${p.fluid.headline}` : ""}.`,
      `Spacing: ${m.spacing.map(([k, d]) => `${k} ${dimText(d)}`).join(", ")}.`,
      ...p.constraints,
    ]),
    "",
  );
  out.push("## Type", "", `${fontsLine(m)}. ${pairingSource(m)}`, "");
  out.push("## Colors: ship vs explore", "", bullets([shipLine(m), exploreLine(m)]), "");
  out.push("## Sources", "", focusSources(m), "");
  return out.join("\n");
}
