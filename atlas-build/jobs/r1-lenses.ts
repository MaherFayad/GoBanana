/**
 * R1 lens culture check (refinement round 1, budget r1): the 16 J6 lens packs are the most cultural
 * text the product shows (bend_brief returns a lens's meaning and care lines). Opus, at high effort,
 * reads each lens against the gobanana-culture rules and either passes it or returns corrected text
 * fields only: name, nameAr, story, credit, shapeGrammar, rhythm, dos, donts. The motif SVG, palette
 * and type pairs stay as J6 render-checked them, so no new render is needed.
 * Output: the whole lenses kind with corrected lenses merged in. Problems found are listed in
 * review/r1-lenses-problems.json.
 *
 *   needs out/v1/lenses (J6)
 *   npx tsx run.ts r1-lenses --dry
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OPUS, PATHS } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES } from "../lib/prompt.ts";
import { mergeByKey } from "../lib/refine.ts";
import { extractJson } from "../lib/validate.ts";
import { LensPackSchema, type LensPack } from "../schema.ts";
import j6 from "./j6-lenses.ts";

type Input = { lens: LensPack };

const TEXT_FIELDS = ["name", "nameAr", "story", "credit", "shapeGrammar", "rhythm", "dos", "donts"] as const;

const SYSTEM = `You are the cultural reviewer for GoBanana's lens packs. A lens is a cultural or design tradition a designer can bend a page through; GoBanana shows its story, credit, grammar, dos and don'ts to users, many of them from the Gulf. Review one lens at a time against these rules and fix only what breaks them.

${PROMPT_RULES}

The culture rules (gobanana-culture skill):
1. Meaning before motif: the story says what the tradition is and what it stands for, from documented sources.
2. Name it exactly: the tradition, the region, the people who make it, the medium, English and Arabic names. Never "Arabic pattern", "Islamic art" or "tribal".
3. Tiers: open (everyday crafts and forms), care (marks of a living community or family, regional dress, a named maker), sacred or protected (religious text and symbols, flags, national emblems). Sacred or protected things are never decoration, texture or pattern.
4. Grammar, not artifact: rhythm, repeat, proportion, color ratio, construction logic. Never trace or copy a real piece.
5. No tourist cliches (camels, dunes, oil, lanterns, "Arabian Nights" lettering, generic arabesque, and every culture's own).
6. Real script only: Arabic is real, readable, joined words chosen with the user; calligraphic styles carry real words, never random letters.
7. Region precision: the Gulf is not the Levant, the Maghreb, Turkey or Iran.
8. Credit everywhere: the credit names the tradition and its people, not "the artisans".
Also check facts (dates, places, UNESCO listings, makers, meanings) and remove anything you cannot stand behind; and check that dos and donts are concrete design instructions, not slogans. The donts must keep the line "no sacred or Quranic text as decoration".

Reply with one \`\`\`json block. When the lens passes: {"ok": true}. When it does not: {"problems": ["<field>: <what is wrong>", ...], "fix": {<only the fields you change, from: ${TEXT_FIELDS.join(", ")}>}}. Write each changed field whole (a changed array is the full new array).`;

const problems: Array<{ id: string; problems: string[] }> = [];

export default defineJob<Input, LensPack>({
  id: "r1-lenses",
  kind: "lenses",
  model: OPUS,
  mode: "batch",
  schema: LensPackSchema,
  system: SYSTEM,
  maxTokens: 24000,
  expectedOutputTokens: 6000,
  effort: "high",

  loadInputs: () => readKindRecords<LensPack>("lenses").sort((a, b) => a.id.localeCompare(b.id)).map((lens) => ({ lens })),
  requestId: (input) => `lens-${input.lens.id}`,
  buildPrompt: (input) => {
    const { motifSvg: _svg, ...rest } = input.lens;
    return `Review this lens.\n\n\`\`\`json\n${JSON.stringify(rest, null, 1)}\n\`\`\``;
  },
  parse: (text, input) => {
    const v = extractJson(text) as { ok?: boolean; problems?: string[]; fix?: Record<string, unknown> };
    if (!v.fix || Object.keys(v.fix).length === 0) return [];
    problems.push({ id: input.lens.id, problems: Array.isArray(v.problems) ? v.problems.map(String) : [] });
    const fix = Object.fromEntries(Object.entries(v.fix).filter(([k]) => (TEXT_FIELDS as readonly string[]).includes(k)));
    return [{ ...input.lens, ...fix }];
  },
  check: (rec, ctx) => j6.check!(rec, ctx),
  finalize: (fixed, ctx) => {
    mkdirSync(PATHS.review, { recursive: true });
    writeFileSync(join(PATHS.review, "r1-lenses-problems.json"), JSON.stringify(problems, null, 2));
    ctx.log(`  lenses corrected: ${fixed.length} (${fixed.map((l) => l.id).join(", ")})`);
    return mergeByKey(readKindRecords<LensPack>("lenses"), fixed, (l) => l.id);
  },
  renderReview: j6.renderReview,
});
