/**
 * Tailwind v4 theme (CSS `@theme` block), built in-process from the kit model.
 * Mirrors `design.md export --format css-tailwind` (v0.4.0); see tokens.ts for why.
 * A comment header with the source links sits above the block.
 */
import type { Dim, KitModel } from "./model";
import { scopeSentence } from "./scope";

const dimText = (d: Dim) => `${d.value}${d.unit}`;

function cssString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\n\r\f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)}"`;
}

/** Text that is safe inside a CSS comment. */
function commentText(text: string): string {
  return text.replace(/\*\//g, "*%2F").replace(/[\r\n]+/g, " ");
}

/** Exactly what the design.md CLI emits for css-tailwind (system scope). */
export function tailwindThemeBlock(model: KitModel): string {
  const lines = themeLines(model);
  return lines.length === 0 ? "@theme {\n}\n" : `@theme {\n${lines.join("\n")}\n}\n`;
}

/** Fluid type sizes for websites, as `--text-*` declarations. */
function fluidLines(model: KitModel, indent: string): string[] {
  const f = model.platform.fluid;
  return f ? [`${indent}--text-display: ${f.display};`, `${indent}--text-headline: ${f.headline};`] : [];
}

/**
 * Page scope: the same variables, set on a wrapper of the wild page only, so Tailwind
 * utilities pick them up there and the project's theme stays as it is everywhere else.
 */
export function tailwindPageBlock(model: KitModel): string {
  const fluid = new Map(fluidLines(model, "  ").map((l) => [l.split(":")[0]!, l]));
  const lines = themeLines(model).map((l) => fluid.get(l.split(":")[0]!) ?? l);
  return `[data-wild-page="${model.slug}"] {\n${lines.join("\n")}\n}\n`;
}

function themeLines(model: KitModel): string[] {
  const lines: string[] = [];
  for (const c of model.ship) lines.push(`  --color-${c.name}: ${c.hex};`);
  for (const t of model.typography) lines.push(`  --font-${t.name}: ${cssString(t.fontFamily)};`);
  for (const t of model.typography) lines.push(`  --text-${t.name}: ${dimText(t.fontSize)};`);
  for (const t of model.typography) lines.push(`  --leading-${t.name}: ${t.lineHeight};`);
  for (const t of model.typography) if (t.letterSpacing) lines.push(`  --tracking-${t.name}: ${dimText(t.letterSpacing)};`);
  for (const t of model.typography) lines.push(`  --font-weight-${t.name}: ${t.fontWeight};`);
  for (const [k, d] of model.rounded) lines.push(`  --radius-${k}: ${dimText(d)};`);
  for (const [k, d] of model.spacing) lines.push(`  --spacing-${k}: ${dimText(d)};`);
  return lines;
}

export function tailwindCss(model: KitModel): string {
  const page = model.scope === "page";
  const header = [
    `/* ${commentText(model.title)}: Tailwind v4 ${page ? "page level overrides" : "theme"}.`,
    ...(page
      ? [
          ` * ${commentText(scopeSentence(model))}`,
          ` * Applies to: ${commentText(model.globs.join(", ") || "the screen in the brief")}.`,
          ` * Wrap only the wild page in <div data-wild-page="${model.slug}">. Never add these to the global theme.`,
        ]
      : [` * Import after @import "tailwindcss";.`]),
    ` * Platform: ${commentText(model.platform.label)}. Only colors tagged ship are here.`,
    ` * Fonts: ${commentText(model.pairing.url)}`,
    ` * Sources (reference images belong to their owners):`,
    ...model.references.map((r) => ` * ${r.n}. ${commentText(r.title)} (${commentText(r.site)}): ${commentText(r.url ?? "source link not usable")}`),
    ` */`,
  ];
  if (page) return `${header.join("\n")}\n${tailwindPageBlock(model)}`;
  // Fluid website type: an unlayered :root beats the theme layer, so clamp() wins over the px token.
  const fluid = fluidLines(model, "  ");
  const fluidBlock = fluid.length > 0 ? `/* Fluid type for the web: the px tokens below are the largest size. */\n:root {\n${fluid.join("\n")}\n}\n` : "";
  return `${header.join("\n")}\n${fluidBlock}${tailwindThemeBlock(model)}`;
}
