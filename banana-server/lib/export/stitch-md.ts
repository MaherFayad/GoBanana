/**
 * FRANKENSTEIN.md (format `stitch_md`): every Frankenstein page (stitch) on the board as a page
 * skeleton, row by row, with each slot's role, note and source link, plus build guidance: take the
 * structure and the moves, not the pixels, and unify to one theme.
 */
import type { StitchSlotSnapshot, StitchSnapshot } from "../canvas/types";
import { STITCH_FRAME_WIDTH, type PartRole } from "../stitch/types";
import type { KitModel } from "./model";
import { pagesText, scopeBlock } from "./scope";
import { bullets, kitTitle } from "./scoped";
import { mdAutolink, mdText, safeUrl } from "./util";

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

/** Type tokens (DESIGN.md typography) a part of this role uses. */
const ROLE_TYPE: Partial<Record<PartRole, string[]>> = {
  hero: ["display", "body"],
  stats: ["display", "label"],
  chart: ["headline", "label"],
  cta: ["headline", "label"],
  form: ["body", "label"],
  nav: ["label"],
  tabbar: ["label"],
  toolbar: ["label"],
  "status-header": ["headline", "label"],
  sidebar: ["label"],
  filters: ["label"],
  logos: ["label"],
  gallery: ["label"],
  table: ["body", "label"],
  footer: ["body", "label"],
};
const DENSE = new Set<PartRole>(["table", "list", "filters", "sidebar", "toolbar", "footer", "nav", "tabbar"]);
const AIRY = new Set<PartRole>(["hero", "cta", "empty", "testimonial", "gallery"]);

/** How a part of this role behaves in Arabic (right to left). */
function rtlText(role: PartRole): string {
  switch (role) {
    case "chart":
      return "Mirrors in Arabic RTL: flip the layout and legend; keep numbers left to right, and mirror a time axis only if the product does elsewhere.";
    case "stats":
      return "Mirrors in Arabic RTL: reverse the order of the figures; the digits themselves stay left to right.";
    case "logos":
    case "gallery":
      return "Mirrors in Arabic RTL: reverse the order and start from the right; never flip the images or logos.";
    case "hero":
      return "Mirrors in Arabic RTL: text and media swap sides; never flip photos, logos or brand marks.";
    default:
      return "Mirrors in Arabic RTL: reverse the order and alignment with logical CSS properties, and flip directional icons (arrows, chevrons, back).";
  }
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** Crop as fractions, plus pixels when the source size is known. */
function cropText(s: StitchSlotSnapshot): string {
  const c = s.crop;
  const frac = `x ${pct(c.x)}, y ${pct(c.y)}, width ${pct(c.w)}, height ${pct(c.h)} of the image`;
  if (!s.imageWidth || !s.imageHeight) return frac;
  const px = (v: number, of: number) => Math.round(v * of);
  return `${frac} (${px(c.x, s.imageWidth)}, ${px(c.y, s.imageHeight)}, ${px(c.w, s.imageWidth)} by ${px(c.h, s.imageHeight)} px of ${s.imageWidth} by ${s.imageHeight})`;
}

/**
 * Short description of one Frankenstein part for a builder: role, main colors, type scale,
 * density, Arabic RTL, the hotlinked source image with its crop, and the source page.
 */
export function partLines(m: KitModel, s: StitchSlotSnapshot): string[] {
  const colors = m.partColors.get(s.partId);
  const typeNames = ROLE_TYPE[s.role] ?? ["headline", "body"];
  const scale = typeNames.flatMap((n) => {
    const t = m.typography.find((x) => x.name === n);
    return t ? [`${t.name} ${t.fontSize.value}${t.fontSize.unit}`] : [];
  });
  const density = DENSE.has(s.role) ? "dense: tight rows, small gaps" : AIRY.has(s.role) ? "airy: big type, wide margins" : "medium";
  const image = safeUrl(s.thumbUrl) ?? safeUrl(s.imageUrl);
  return [
    `Role: ${roleLabel(s.role).toLowerCase()}${s.theme && s.theme !== "unknown" ? ` (${s.theme} in the reference)` : ""}.`,
    `Main colors: ${colors && colors.length > 0 ? colors.join(", ") : "not measured yet (run reconcile_direction, then export again)"}. Map them to the nearest ship token; do not add new colors.`,
    `Type scale: ${scale.join(", ")}.`,
    `Density: ${density}.`,
    rtlText(s.role),
    `See it: ${image ? `${mdAutolink(image)} (hotlinked, open to look, never download it)` : "image link not usable"}, crop ${cropText(s)}.`,
    `Source: ${sourceLink(s)}.`,
  ];
}

function stitchBlock(m: KitModel, st: StitchSnapshot, i: number, all: readonly StitchSnapshot[]): string[] {
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
      for (const l of partLines(m, row.slots[0]!)) out.push(`   - ${l}`);
    } else {
      const widths = row.widths ? ` (widths ${row.widths.join(":")})` : "";
      out.push(`${r + 1}. Side by side${widths}:`);
      for (const s of row.slots) {
        out.push(`   - ${slotText(s)}`);
        for (const l of partLines(m, s)) out.push(`     - ${l}`);
      }
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
    out.push("No Frankenstein pages on this board yet. Cut parts with cut_parts and stack them into pages with frankenstein_page.", "");
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
  m.stitches.forEach((st, i) => out.push(...stitchBlock(m, st, i, m.stitches)));

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
export function stitchSection(m: KitModel, heading = "##", opts: { parts?: boolean } = {}): string[] {
  if (m.stitches.length === 0) return [];
  const lines = m.stitches.map((st) => {
    const roles = st.rows.map((r) => r.slots.map((s) => roleLabel(s.role).toLowerCase()).join(" + ")).join(", ");
    const sites = [...new Set(st.rows.flatMap((r) => r.slots.map((s) => mdText(s.sourceSite, 60))))];
    return `${mdText(st.title, 120)}: ${roles || "no rows yet"}${sites.length ? ` (parts from ${sites.join(", ")})` : ""}.`;
  });
  const out = [
    `${heading} Frankenstein pages`,
    "",
    `The board has ${m.stitches.length} Frankenstein page${m.stitches.length === 1 ? "" : "s"}: new pages stacked from parts of different references. Full skeletons with source links: \`${m.dir}/${STITCH_MD_FILE}\`. Take the structure, not the pixels, and unify to one theme.`,
    "",
    bullets(lines),
    "",
  ];
  if (opts.parts) {
    for (const st of m.stitches) {
      const slots = st.rows.flatMap((r) => r.slots);
      if (slots.length === 0) continue;
      out.push(`Parts of "${mdText(st.title, 120)}", top to bottom:`, "");
      slots.forEach((s, i) => {
        out.push(`${i + 1}. **${roleLabel(s.role)}**${s.note ? `. Steal: ${mdText(s.note, 300)}` : ""}`);
        for (const l of partLines(m, s)) out.push(`   - ${l}`);
      });
      out.push("");
    }
  }
  return out;
}
