/**
 * P1-J5 Mechanics atlas, step 2: a Sonnet pass per element over the j5-mechanics output that
 * names near duplicates to drop. It rewrites out/v1/mechanics with the kept records.
 * The dropped ids and reasons are logged in rejects/j5-dedupe-drops.jsonl.
 *
 *   npx tsx run.ts j5-mechanics       (first)
 *   npx tsx run.ts j5-dedupe --dry
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS, SONNET } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { escapeHtml } from "../lib/review.ts";
import { readKind } from "../lib/shards.ts";
import { extractJson } from "../lib/validate.ts";
import { MechanicSchema, UI_ELEMENTS, type Mechanic, type UiElement } from "../schema.ts";

type Input = { element: UiElement; mechanics: Mechanic[] };

const SYSTEM = `You dedupe a list of UI mechanics for one UI element. Two mechanics are duplicates only when a developer would build nearly the same component from them: the same structure, the same motion and the same input, and only the names, wording or theme differ. Mechanics that share a structure but differ in motion (a split flap flip versus an odometer roll), input (tap versus drag versus scroll), layout or what they show are not duplicates: keep both. Be strict: a typical list of 40 has 0 to 5 true duplicates.

For each group of duplicates keep the clearest, most buildable one and drop the others. Also drop a mechanic that breaks its element's job (an unreadable total, a CTA with no clear action, an error that hides what went wrong) or that is only a theme with no buildable structure.

Reply with JSON only, inside one \`\`\`json fenced block: {"drop": [{"id": "...", "reason": "duplicate of <kept id>" or a short reason}]}. Use an empty list when nothing should go.`;

const DROPS_PATH = join(PATHS.rejects, "j5-dedupe-drops.jsonl");

export default defineJob<Input, Mechanic>({
  id: "j5-dedupe",
  kind: "mechanics",
  model: SONNET,
  mode: process.env.ATLAS_DIRECT ? "direct" : "batch", // ATLAS_DIRECT=1: a small prompt test at full price
  schema: MechanicSchema,
  system: SYSTEM,
  maxTokens: 8000,
  expectedOutputTokens: 2500,
  effort: "medium",

  loadInputs: (ctx) => {
    if (!ctx.dry) {
      mkdirSync(PATHS.rejects, { recursive: true });
      writeFileSync(DROPS_PATH, "");
    }
    const all = readKind<Mechanic>(PATHS.out, "mechanics");
    return UI_ELEMENTS.map((element) => ({ element, mechanics: all.filter((m) => m.element === element) })).filter((i) => i.mechanics.length > 0);
  },
  requestId: (input) => `j5d-${input.element}`,
  buildPrompt: (input) =>
    `Element: ${input.element}\n\nMechanics:\n${input.mechanics.map((m) => `- ${m.id}: ${m.name}. ${m.how}`).join("\n")}`,

  parse: (text, input) => {
    const reply = extractJson(text) as { drop?: Array<{ id?: string; reason?: string }> };
    const drops = new Map((reply.drop ?? []).filter((d) => typeof d.id === "string").map((d) => [d.id!, d.reason ?? ""]));
    // Never drop more than half of an element: a runaway reply keeps everything.
    if (drops.size > input.mechanics.length / 2) return input.mechanics;
    mkdirSync(PATHS.rejects, { recursive: true });
    for (const [id, reason] of drops) {
      if (input.mechanics.some((m) => m.id === id)) appendFileSync(DROPS_PATH, JSON.stringify({ job: "j5-dedupe", request: `j5d-${input.element}`, reason: [reason], record: id }) + "\n");
    }
    return input.mechanics.filter((m) => !drops.has(m.id));
  },
  shardOf: (rec) => rec.element,
  renderReview: (rec) => `<p><b>${escapeHtml(rec.element)} / ${escapeHtml(rec.name)}</b> <small>${escapeHtml(rec.id)}, build ${rec.buildability}</small><br>${escapeHtml(rec.how)}</p>`,
});
