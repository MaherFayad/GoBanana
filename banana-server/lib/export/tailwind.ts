/**
 * Tailwind v4 theme (CSS `@theme` block), built in-process from the kit model.
 * Mirrors `design.md export --format css-tailwind` (v0.4.0); see tokens.ts for why.
 * A comment header with the source links sits above the block.
 */
import type { Dim, KitModel } from "./model";

const dimText = (d: Dim) => `${d.value}${d.unit}`;

function cssString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\n\r\f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)}"`;
}

/** Text that is safe inside a CSS comment. */
function commentText(text: string): string {
  return text.replace(/\*\//g, "*%2F").replace(/[\r\n]+/g, " ");
}

/** Exactly what the design.md CLI emits for css-tailwind. */
export function tailwindThemeBlock(model: KitModel): string {
  const lines: string[] = [];
  for (const c of model.ship) lines.push(`  --color-${c.name}: ${c.hex};`);
  for (const t of model.typography) lines.push(`  --font-${t.name}: ${cssString(t.fontFamily)};`);
  for (const t of model.typography) lines.push(`  --text-${t.name}: ${dimText(t.fontSize)};`);
  for (const t of model.typography) lines.push(`  --leading-${t.name}: ${t.lineHeight};`);
  for (const t of model.typography) if (t.letterSpacing) lines.push(`  --tracking-${t.name}: ${dimText(t.letterSpacing)};`);
  for (const t of model.typography) lines.push(`  --font-weight-${t.name}: ${t.fontWeight};`);
  for (const [k, d] of model.rounded) lines.push(`  --radius-${k}: ${dimText(d)};`);
  for (const [k, d] of model.spacing) lines.push(`  --spacing-${k}: ${dimText(d)};`);
  return lines.length === 0 ? "@theme {\n}\n" : `@theme {\n${lines.join("\n")}\n}\n`;
}

export function tailwindCss(model: KitModel): string {
  const header = [
    `/* ${commentText(model.title)}: Tailwind v4 theme.`,
    ` * Import after @import "tailwindcss";. Only colors tagged ship are here.`,
    ` * Fonts: ${commentText(model.pairing.url)}`,
    ` * Sources (reference images belong to their owners):`,
    ...model.references.map((r) => ` * ${r.n}. ${commentText(r.title)} (${commentText(r.site)}): ${commentText(r.url ?? r.rawUrl)}`),
    ` */`,
  ];
  return `${header.join("\n")}\n${tailwindThemeBlock(model)}`;
}
