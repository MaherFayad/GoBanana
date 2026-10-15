/**
 * Refreshes data/google-fonts.json from the public Google Fonts metadata (one fetch). The list
 * keeps only what the font check needs: family, category and subsets. Run: `npm run fonts`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PATHS } from "../config.ts";
import type { FontList } from "./fonts.ts";

const URL = "https://fonts.google.com/metadata/fonts";

type Raw = { familyMetadataList: Array<{ family: string; category?: string; subsets?: string[] }> };

async function main(): Promise<void> {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Google Fonts metadata: HTTP ${res.status}`);
  // The response starts with an anti-JSON-hijacking prefix ")]}'".
  const body = (await res.text()).replace(/^\)\]\}'\s*/, "");
  const raw = JSON.parse(body) as Raw;
  const list: FontList = {
    source: URL,
    fetched: new Date().toISOString().slice(0, 10),
    families: raw.familyMetadataList
      .map((f) => ({ family: f.family, category: f.category ?? "", subsets: (f.subsets ?? []).filter((s) => s !== "menu").sort() }))
      .sort((a, b) => a.family.localeCompare(b.family)),
  };
  mkdirSync(dirname(PATHS.fonts), { recursive: true });
  writeFileSync(PATHS.fonts, JSON.stringify(list) + "\n");
  console.log(`Wrote ${list.families.length} families to ${PATHS.fonts}`);
}

await main();
