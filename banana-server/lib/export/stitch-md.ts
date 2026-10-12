/**
 * FRANKENSTEIN.md (format `stitch_md`): every Frankenstein page (stitch) on the board as a page
 * skeleton, row by row, with each slot's role, note and source link, plus build guidance: take the
 * structure and the moves, not the pixels, and unify to one theme.
 */
import type { StitchSlotSnapshot, StitchSnapshot } from "../canvas/types";
import { STITCH_FRAME_WIDTH } from "../stitch/types";
import type { KitModel } from "./model";
import { pagesText, scopeBlock } from "./scope";
import { bullets, kitTitle } from "./scoped";
import { mdText, safeUrl } from "./util";

export const STITCH_MD_FILE = "FRANKENSTEIN.md";
export const WIREFRAME_FILE = "frankenstein-wireframe.html";

const PLATFORM_LABEL: Record<StitchSnapshot["platform"], string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  website: "Website",
  webapp: "Web app",
};

function roleLabel(role: string): string {
  const r = role.replace(/-/g, " ");
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/** "[Title](url) (site)", or the raw value as text when the link is not usable. */
export function sourceLink(s: Pick<StitchSlotSnapshot, "sourceUrl" | "sourceSite" | "title">): string {
  const site = mdText(s.sourceSite, 80) || "web";
  const title = mdText(s.title, 120) || `Page on ${site}`;
  const url = safeUrl(s.sourceUrl);
  if (!url) return `${title} (${site}, source link not usable: ${mdText(s.sourceUrl, 200) || "missing"})`;
  const href = url.replace(/[()\s<>]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
  return `[${title}](${href}) (${site})`;
}

function slotText(s: StitchSlotSnapshot): string {
  return `**${roleLabel(s.role)}** from ${sourceLink(s)}${s.note ? `. Steal: ${mdText(s.note, 300)}` : ""}`;
}

function stitchBlock(st: StitchSnapshot, i: number, all: readonly StitchSnapshot[]): string[] {
  const out = [`## ${i + 1}. ${mdText(st.title, 120)}`, ""];
  const origin = st.variantOf ? all.find((o) => o.id === st.variantOf) : undefined;
  out.push(
    bullets([
      `Platform: ${PLATFORM_LABEL[st.platform]} (${STITCH_FRAME_WIDTH[st.platform]} px frame).`,
      ...(st.note ? [`Idea: ${mdText(st.note, 300)}`] : []),
      ...(st.variantOf ? [`Remix${st.variant ? ` ${st.variant}` : ""} of ${origin ? `"${mdText(origin.title, 120)}"` : "another page"}.`] : []),
    ]),
    "",
  );
  if (st.rows.length === 0) {
    out.push("No rows yet.", "");
    return out;
  }
  out.push("Page skeleton, top to bottom:", "");
  st.rows.forEach((row, r) => {
    if (row.slots.length === 1) {
      out.push(`${r + 1}. ${slotText(row.slots[0]!)}`);
    } else {
      const widths = row.widths ? ` (widths ${row.widths.join(":")})` : "";
      out.push(`${r + 1}. Side by side${widths}:`);
      for (const s of row.slots) out.push(`   - ${slotText(s)}`);
    }
  });
  out.push("");
  return out;
}

export function stitchMd(m: KitModel): string {
  const out: string[] = [`# Frankenstein pages: ${mdText(kitTitle(m))}`, ""];
  const scope = scopeBlock(m);
  if (scope.length > 0) out.push(...scope, "");
  if (m.stitches.length === 0) {
    out.push("No Frankenstein pages on this board yet. Cut parts with cut_parts and stack them into pages with stitch_page.", "");
    return out.join("\n");
  }
  out.push(
    `Each page below is stacked from parts cut out of different references: the nav from one, the hero from another, the cards from a third. They are for ideas, not finished designs. ${m.stitches.length === 1 ? "There is 1 page." : `There are ${m.stitches.length} pages.`}`,
    "",
    "## How to build from these",
    "",
    bullets([
      "Take the structure and the moves, not the pixels: the order of the rows, how each part is laid out, and the one idea named in each slot's steal note.",
      "Unify to one theme. Use one type pairing, one set of colors and one spacing scale for every row. A light part next to a dark one is how the collage was made, not a design decision.",
      "Never copy, trace or embed the reference images. Rebuild each part with your own components and link the source when you mention one.",
      m.scope === "page"
        ? `Build only ${pagesText(m.pages, m.brief)}. Everything else keeps the project's own design system.`
        : "Use only the tokens in DESIGN.md.",
      `A low fi wireframe of every page is in \`${m.dir}/${WIREFRAME_FILE}\` when exported.`,
      "Meet WCAG 2.2 AA in the build: text contrast 4.5:1, visible focus, labels on inputs.",
    ]),
    "",
  );
  m.stitches.forEach((st, i) => out.push(...stitchBlock(st, i, m.stitches)));

  const seen = new Set<string>();
  const sources: string[] = [];
  for (const st of m.stitches) {
    for (const row of st.rows) {
      for (const s of row.slots) {
        if (seen.has(s.sourceUrl)) continue;
        seen.add(s.sourceUrl);
        sources.push(`${sources.length + 1}. ${sourceLink(s)}`);
      }
    }
  }
  out.push("## Sources", "", "Reference images belong to their owners. Only links are kept here.", "", ...sources, "");
  return out.join("\n");
}

/** Short "Frankenstein pages" section for BUILD-PROMPT.md and DIRECTION.md. Empty when there are none. */
export function stitchSection(m: KitModel, heading = "##"): string[] {
  if (m.stitches.length === 0) return [];
  const lines = m.stitches.map((st) => {
    const roles = st.rows.map((r) => r.slots.map((s) => roleLabel(s.role).toLowerCase()).join(" + ")).join(", ");
    const sites = [...new Set(st.rows.flatMap((r) => r.slots.map((s) => mdText(s.sourceSite, 60))))];
    return `${mdText(st.title, 120)}: ${roles || "no rows yet"}${sites.length ? ` (parts from ${sites.join(", ")})` : ""}.`;
  });
  return [
    `${heading} Frankenstein pages`,
    "",
    `The board has ${m.stitches.length} Frankenstein page${m.stitches.length === 1 ? "" : "s"}: new pages stacked from parts of different references. Full skeletons with source links: \`${m.dir}/${STITCH_MD_FILE}\`. Take the structure, not the pixels, and unify to one theme.`,
    "",
    bullets(lines),
    "",
  ];
}
