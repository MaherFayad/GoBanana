/** Shared text blocks for the page scope files (DIRECTION.md, BUILD-PROMPT.md, REVIEW.md, harness rules). */
import type { VisualSpec } from "../direction-detail";
import type { DirectionSummary, KitModel, Reference } from "./model";
import { dimText } from "./model";
import { globsText, pagesText } from "./scope";
import { mdAutolink, mdText } from "./util";

/** The spec axes in reading order, with plain labels. */
export const SPEC_AXES: [keyof VisualSpec, string][] = [
  ["typography", "Typography"],
  ["color", "Color"],
  ["layout", "Layout"],
  ["imagery", "Imagery"],
  ["motion", "Motion"],
  ["texture", "Texture"],
  ["iconography", "Iconography"],
  ["density", "Density"],
  ["signature", "Signature component"],
  ["pattern", "Pattern"],
];

/** The mechanic as one line: the working part of the page where the wild idea lives. */
export function mechanicLine(mechanic: { element: string; how: string }): string {
  const how = mdText(mechanic.how, 400);
  return `Mechanic: build it around the ${mdText(mechanic.element, 40)}. ${/[.!?]$/.test(how) ? how : `${how}.`}`;
}

export function statusText(d: DirectionSummary): string {
  if (d.status === "dropped") return "dropped";
  if (d.status === "kept") return d.detail?.verdict === "keep" ? "kept" : "kept (has references, not rated yet)";
  return "not rated yet";
}

export function refLine(r: Reference): string {
  const link = r.url ? mdAutolink(r.url) : `source link not usable (${mdText(r.rawUrl) || "missing"})`;
  const steal = r.note ? ` What to steal: ${mdText(r.note, 300)}` : "";
  // Art translation: the UI part the image turns into, and what to take from it.
  const parts = [...(r.stealAxis ? [`take its ${r.stealAxis}`] : []), ...(r.becomes ? [`becomes: ${mdText(r.becomes, 80)}`] : [])];
  const becomes = parts.length > 0 ? `${steal && !/[.!?]$/.test(steal) ? ";" : ""} ${parts.join("; ")}` : "";
  return `- ${mdText(r.title)} (${mdText(r.site)}): ${link}${steal}${becomes}`;
}

/** Numbered sources for the references this kit is about. */
export function focusSources(m: KitModel): string {
  if (m.focusRefs.length === 0) return "No references on the board yet.";
  return [
    "Reference images belong to their owners. Only links are kept here; never copy the images into the repo.",
    "",
    ...m.focusRefs.map((r) => {
      const link = r.url ? mdAutolink(r.url) : `source link not usable (${mdText(r.rawUrl) || "missing"})`;
      return `${r.n}. ${mdText(r.title)} (${mdText(r.site)}${r.zone === "art" ? ", art direction" : ""}): ${link}`;
    }),
  ].join("\n");
}

export function typeScaleText(m: KitModel): string {
  return m.typography.map((t) => `${t.name} ${dimText(t.fontSize)}`).join(", ");
}

export function fontsLine(m: KitModel): string {
  const p = m.pairing;
  const f = m.fonts;
  return `${p.display.family} (display, weight ${p.display.weight}) and ${p.body.family} (body), ${p.licence} from Google Fonts: ${mdAutolink(p.url)}; Arabic: ${f.arabicDisplay.family} (display, weight ${f.arabicDisplay.weight}) and ${f.arabicBody.family} (body), all four in one link: ${mdAutolink(m.fontsUrl)}`;
}

export function shipLine(m: KitModel): string {
  return m.ship.length > 0
    ? `Ship colors (passed WCAG 2.2 contrast): ${m.ship.map((c) => `\`${c.name}\` ${c.hex}`).join(", ")}.`
    : "No colors are tagged ship yet: use the project's own colors and run a palette review before adding new ones.";
}

export function exploreLine(m: KitModel): string {
  return m.explore.length > 0
    ? `Explore colors (concept only, never in production without a design review): ${m.explore.map((c) => c.hex).join(", ")}.`
    : "No explore colors on this board.";
}

/** The rules every scoped harness file shares (AGENTS.md, CLAUDE.md, Cursor, Copilot). */
export function scopedRules(m: KitModel): string[] {
  const lead = m.focus.find((d) => d.detail?.spec)?.detail?.spec;
  const rules =
    m.scope === "page"
      ? [
          `Applies only to ${pagesText(m.pages, m.brief)}: ${globsText(m.globs)}. Leave every other file as it is.`,
          `Read \`${m.dir}/DIRECTION.md\` before changing these pages. It has the full visual spec and the references.`,
          "Everything outside these pages follows the project's own design system and its existing DESIGN.md. Do not change them.",
          `Tokens in \`${m.dir}/kit/tokens.json\` and \`${m.dir}/kit/theme.css\` are page level overrides. Scope them to a wrapper on these pages (\`data-wild-page="${m.slug}"\`); never add them to the global theme.`,
          "Reuse the project's components. If one needs a new look here, add a local variant for these pages instead of changing the shared one.",
        ]
      : [
          "Read DESIGN.md before writing any UI. Use only its tokens.",
          `The direction behind it, with references: \`${m.dir}/DIRECTION.md\`.`,
        ];
  rules.push(
    `Platform: ${m.platform.label}. ${m.platform.columns}, ${m.platform.margins}, ${m.platform.targets}.`,
    `Type: ${m.pairing.display.family} and ${m.pairing.body.family}; scale ${typeScaleText(m)}.`,
    shipLine(m),
    exploreLine(m),
  );
  if (lead?.signature) rules.push(`Signature component: ${mdText(lead.signature, 300)}`);
  if (lead && lead.avoid.length > 0) rules.push(`Avoid: ${lead.avoid.map((a) => mdText(a, 200)).join("; ")}.`);
  rules.push(
    "Meet WCAG 2.2 AA: text 4.5:1, large text and UI parts 3:1, visible focus, labels on inputs. Respect prefers-reduced-motion.",
    "Never copy, trace or embed the reference images. Link the sources instead.",
    `When done, check the pages against \`${m.dir}/REVIEW.md\`.`,
  );
  if (m.arabic) rules.push('Arabic: set `dir="rtl"` and `lang="ar"`, use logical CSS properties, and never add letter spacing to Arabic text.');
  return rules;
}

export function bullets(lines: readonly string[]): string {
  return lines.map((l) => `- ${l}`).join("\n");
}

/** Title for a page scope file: the single focus direction, else the canvas title. */
export function kitTitle(m: KitModel): string {
  return m.focus.length === 1 && m.focus[0] ? m.focus[0].direction.title : m.title;
}
