/**
 * Every docs page the site links to (docsHref(locale, "page/")) exists in the docs source, in
 * English and Arabic. A renamed docs page otherwise leaves a 404 behind a site link.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOCS = join(__dirname, "..", "..", "banana-docs", "src", "content", "docs");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) return [];
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}

function pageExists(root: string, page: string): boolean {
  const slug = page.replace(/\/+$/, "");
  return [".md", ".mdx"].some((ext) => existsSync(join(root, slug + ext)) || existsSync(join(root, slug, "index" + ext)));
}

const pages = new Set<string>();
for (const dir of ["app", "components", "lib"]) {
  for (const f of files(join(__dirname, "..", dir))) {
    for (const m of readFileSync(f, "utf8").matchAll(/docsHref\(\s*\w+\s*,\s*["'`]([^"'`]+)["'`]\s*\)/g)) pages.add(m[1]!);
  }
}

describe.skipIf(!existsSync(DOCS))("site links into the docs", () => {
  it("finds the links", () => {
    expect(pages.size).toBeGreaterThan(0);
  });
  for (const page of pages) {
    it(`${page} exists in English and Arabic`, () => {
      expect(pageExists(DOCS, page)).toBe(true);
      expect(pageExists(join(DOCS, "ar"), page)).toBe(true);
    });
  }
});
