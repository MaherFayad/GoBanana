/**
 * File walker for the design gate tests (plan Step 4). Not a test file itself.
 *
 * Gates scan the real source tree, so a new file is covered the day it is added. Paths are
 * returned relative to the banana-server root with forward slashes, for readable failures
 * and stable allow-list keys.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Build output and dependencies, never source. */
const SKIP_DIRS = new Set(["node_modules", ".next", ".open-next", ".wrangler", "test-results", "playwright-report"]);

/** Every file under `dirs` (relative to ROOT) whose name matches `pattern`, sorted. */
export function sourceFiles(dirs: string[], pattern: RegExp): string[] {
  const out: string[] = [];
  const walk = (abs: string) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(abs, entry.name));
      } else if (pattern.test(entry.name)) {
        out.push(relative(ROOT, join(abs, entry.name)).split(sep).join("/"));
      }
    }
  };
  for (const dir of dirs) walk(join(ROOT, dir));
  return out.sort();
}

export const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

/** CSS with comments blanked out, keeping line numbers. */
export const stripCssComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));

export const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

/** The CSS files Banana owns (everything but dependencies and build output). */
export const OWNED_CSS = () => sourceFiles(["app", "canvas", "components", "styles", "ui"], /\.css$/);

export type CssDecl = { selector: string; property: string; value: string; line: number };

/**
 * Leaf declarations of a stylesheet: the innermost `selector { decls }` blocks, so a rule
 * inside `@media` reports its own selector. Good enough for our hand-written CSS (no
 * nesting, no braces inside strings).
 */
export function cssDeclarations(css: string): CssDecl[] {
  const src = stripCssComments(css);
  const out: CssDecl[] = [];
  for (const block of src.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = (block[1] ?? "").replace(/\s+/g, " ").trim();
    const body = block[2] ?? "";
    const bodyStart = (block.index ?? 0) + (block[1] ?? "").length + 1;
    let offset = 0;
    for (const part of body.split(";")) {
      const colon = part.indexOf(":");
      if (colon > 0) {
        const property = part.slice(0, colon).trim().toLowerCase();
        const value = part.slice(colon + 1).replace(/\s+/g, " ").trim();
        const lead = part.length - part.trimStart().length;
        if (property) out.push({ selector, property, value, line: lineOf(src, bodyStart + offset + lead) });
      }
      offset += part.length + 1;
    }
  }
  return out;
}
