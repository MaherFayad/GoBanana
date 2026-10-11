import type { KitModel } from "./model";
import { colorByName, dimText } from "./model";
import { sourcesMarkdown } from "./design-md";
import { mdText, ratioText } from "./util";

/** AGENTS.md from spec section 10, extended with the ship and explore lists and Sources. */
export function agentsMd(m: KitModel): string {
  const ship: string[] = [];
  if (m.ship.length > 0) ship.push(`- Colors: ${m.ship.map((c) => `\`${c.name}\` ${c.hex}`).join(", ")}.`);
  else ship.push("- Colors: none tagged ship yet. Ask for a palette review before adding color.");
  ship.push(
    `- Typography: ${m.typography.map((t) => `\`${t.name}\` ${t.fontFamily} ${dimText(t.fontSize)} weight ${t.fontWeight}`).join(", ")}.`,
  );
  ship.push(`- Rounded: ${m.rounded.map(([k, d]) => `\`${k}\` ${dimText(d)}`).join(", ")}.`);
  ship.push(`- Spacing: ${m.spacing.map(([k, d]) => `\`${k}\` ${dimText(d)}`).join(", ")}.`);
  for (const c of m.components) {
    const bg = colorByName(m, c.backgroundColor);
    const fg = colorByName(m, c.textColor);
    const pair = bg && fg ? `${fg.name} on ${bg.name}, ${ratioText(c.ratio ?? 0)}` : bg ? `${bg.name} fill only, no text on it` : fg ? `${fg.name} text` : "";
    ship.push(`- Component \`${c.name}\`: ${pair}.`);
  }
  if (m.arabic) {
    ship.push('- Arabic: set `dir="rtl"` and `lang="ar"`, use logical CSS properties, and never add letter spacing to Arabic text.');
  }

  const explore =
    m.explore.length > 0
      ? m.explore.map((c) => `- ${c.hex}${c.oklch ? ` (${mdText(c.oklch)})` : ""}${c.role ? `, ${mdText(c.role)}` : ""}: concept only.`).join("\n")
      : "- None on this board.";

  return [
    "# Design rules for coding agents",
    "",
    "Read DESIGN.md before writing any UI. Use only its tokens.",
    "",
    `Board: ${mdText(m.title)}.${m.brief ? ` Brief: ${mdText(m.brief, 500)}.` : ""}`,
    "",
    "## Ship",
    "",
    "Tokens and components tagged `ship` passed WCAG 2.2 contrast",
    "(SC 1.4.3 at 4.5:1 for text, SC 1.4.11 at 3:1 for UI parts). Use them in production.",
    "",
    ...ship,
    "",
    "## Explore only",
    "",
    "Tokens tagged `explore` are concept material. Never use them in",
    "production screens without a design review.",
    "",
    explore,
    "",
    "## Sources",
    "",
    "Reference images belong to their owners. Never copy them into the repo.",
    "",
    sourcesMarkdown(m),
    "",
  ].join("\n");
}
