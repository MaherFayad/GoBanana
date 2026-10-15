/**
 * Shared prompt parts for every generating job (plan 6.3 prompt rules). Put PROMPT_RULES and the
 * record's interface text in the job's system prompt: that is the cached prefix, so keep it
 * byte-for-byte stable between requests (no dates, ids or counts in it).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../config.ts";

export const PROMPT_RULES = `Rules for every record you write:
- Plain words. Never use em dashes. Invent no facts about real people or brands.
- Arabic strings are in white Saudi dialect, with no tashkeel (no diacritics), and labels use noun forms.
- Traditions: be respectful and credit the tradition and its people. Never use sacred or Quranic text as decoration. Never use tribal marks casually.
- Palettes: propose hex values as #rrggbb. Do not write contrast pairs; the script computes them.
- Fonts: use only families that exist in Google Fonts, spelled exactly as Google Fonts spells them. Arabic slots need a family with Arabic support. Unknown names are rejected.
- Reply with JSON only, inside one \`\`\`json fenced block, matching the TypeScript type given. No comments inside the JSON.`;

let schemaSource: string | null = null;

/**
 * The TypeScript source of named types from schema.ts (section 6.2), for the system prompt, so the
 * model sees exactly the type its records are parsed against.
 */
export function typeText(...names: string[]): string {
  schemaSource ??= readFileSync(join(ROOT, "schema.ts"), "utf8").replace(/\r\n/g, "\n");
  return names
    .map((name) => {
      // An interface ends at the first "}" in column 0 (or on its own line when it is one line);
      // a type alias ends at the first line that ends with ";".
      const iface = new RegExp(`^export interface ${name}\\b(?:[^\\n]*}\\s*$|[\\s\\S]*?^}$)`, "m");
      const alias = new RegExp(`^export type ${name}\\b[\\s\\S]*?;\\s*$`, "m");
      const m = iface.exec(schemaSource!) ?? alias.exec(schemaSource!);
      if (!m) throw new Error(`type ${name} not found in schema.ts`);
      return m[0].trimEnd();
    })
    .join("\n\n");
}
