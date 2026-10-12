/**
 * Coding agent harness files for one wild page: a Cursor rule (.mdc), a Copilot path instruction
 * and a CLAUDE.md section. Formats checked against the Cursor and GitHub docs on 2026-10-12:
 * Cursor .mdc frontmatter has description, globs (string) and alwaysApply; Copilot
 * .github/instructions/NAME.instructions.md has applyTo (comma separated globs).
 */
import { stringify } from "yaml";
import { APP_NAME } from "../config";
import type { KitModel } from "./model";
import { pagesText, scopeBlock } from "./scope";
import { bullets, focusSources, kitTitle, scopedRules } from "./scoped";
import { mdText, oneLine } from "./util";

function frontMatter(fields: Record<string, unknown>): string {
  return `---\n${stringify(fields, { lineWidth: 0, defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN" }).trimEnd()}\n---\n`;
}

function ruleDescription(m: KitModel): string {
  if (m.scope === "system") return oneLine(`${APP_NAME} design system "${kitTitle(m)}": tokens and rules for all UI. Apply when writing UI.`, 300);
  const pages = m.pages.length > 0 ? m.pages.map((p) => oneLine(p, 80)).join(", ") : "the screen in the brief";
  return oneLine(`${APP_NAME} wild page "${kitTitle(m)}": visual direction for ${pages} only. Apply when editing these files; the rest of the product keeps its design system.`, 300);
}

export function harnessHeading(m: KitModel): string {
  return `${m.scope === "page" ? "Wild page" : "Design system"}: ${mdText(kitTitle(m))}`;
}

function body(m: KitModel, importLine: string | null): string {
  const out: string[] = [`# ${harnessHeading(m)}`, ""];
  const scope = scopeBlock(m);
  if (scope.length > 0) out.push(...scope, "");
  if (importLine) out.push(importLine, "");
  out.push("## Rules", "", bullets(scopedRules(m)), "", "## Sources", "", focusSources(m), "");
  return out.join("\n");
}

export function cursorRule(m: KitModel): string {
  const fm: Record<string, unknown> = { description: ruleDescription(m) };
  if (m.globs.length > 0) fm.globs = m.globs.join(",");
  fm.alwaysApply = false;
  return `${frontMatter(fm)}\n${body(m, `Full spec: @${m.dir}/DIRECTION.md`)}`;
}

export function copilotInstructions(m: KitModel): string {
  const applyTo = m.globs.length > 0 ? m.globs.join(",") : m.scope === "system" ? "**" : `${m.dir}/**`;
  const fm = { applyTo, description: ruleDescription(m) };
  const note =
    m.globs.length === 0 && m.scope === "page"
      ? `No page files were named, so applyTo points at \`${m.dir}/\`. Change it to the files of ${pagesText(m.pages, m.brief)}.`
      : `Full spec: \`${m.dir}/DIRECTION.md\`.`;
  return `${frontMatter(fm)}\n${body(m, note)}`;
}

/** A section to append to CLAUDE.md. Claude Code expands @path imports relative to the file. */
export function claudeMdSection(m: KitModel): string {
  const out: string[] = [`## ${harnessHeading(m)}`, ""];
  const scope = scopeBlock(m);
  if (scope.length > 0) out.push(...scope, "");
  out.push(`@${m.dir}/DIRECTION.md`, "");
  out.push(bullets(scopedRules(m)), "", "### Sources", "", focusSources(m), "");
  return out.join("\n");
}
