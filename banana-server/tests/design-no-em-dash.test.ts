/**
 * Gate: no em dashes in UI copy (CLAUDE.md hard rule, spec section 8, plan Step 4).
 *
 * Banana writes with commas, colons, periods and parentheses. Scans every source file that
 * can put words on screen: the canvas, the app routes, the inline view, the shared
 * components, the site dictionaries, the legal pages and the MCP tool descriptions (product
 * copy too, per CLAUDE.md). Comments are included: copy is often drafted there first, and a
 * clean tree keeps the rule simple. Catches the character itself, its JS escape and its
 * HTML entities.
 */
import { describe, expect, it } from "vitest";
import { lineOf, read, sourceFiles } from "./design-gate-files";

const DIRS = ["app", "canvas", "components", "ui", "lib/site/dict", "lib/site/legal", "lib/mcp/tools"];
const files = sourceFiles(DIRS, /\.(tsx?|css|html|json)$/);

const EM_DASH = /—|\\u2014|\\u\{2014\}|&mdash;|&#8212;|&#x2014;/gi;

describe("design gate: no em dashes in UI copy", () => {
  it("scans the real copy", () => {
    expect(files).toEqual(
      expect.arrayContaining(["lib/site/dict/en.ts", "lib/site/dict/ar.ts", "lib/site/legal/terms.en.ts", "canvas/CanvasApp.tsx", "ui/canvas/main.tsx"]),
    );
  });

  it.each(files)("%s has no em dash", (file) => {
    const text = read(file);
    const found = [...text.matchAll(EM_DASH)].map((m) => {
      const at = m.index ?? 0;
      return `${file}:${lineOf(text, at)} ...${text.slice(Math.max(0, at - 30), at + 30).replace(/\s+/g, " ")}...`;
    });
    expect(found, "use a comma, colon, period or parentheses").toEqual([]);
  });
});
