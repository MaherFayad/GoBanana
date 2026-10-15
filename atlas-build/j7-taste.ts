/**
 * Writes data/j7-taste-notes.md: what the owner's exemplar pins have in common, by the judge model
 * looking at them once. J7's judge prompt carries these notes as text instead of 20 to 40 images on
 * every one of about 3,900 requests (same exemplars, a fraction of the tokens and bytes).
 *
 *   npx tsx j7-taste.ts            # picks.json, else picks.default.json, in banana-server/bench/taste/
 *
 * The images are fetched into memory (lib/thumbs.ts) and never saved. One direct call, logged to
 * costs.csv under job "j7-taste" (the j7 budget). Run it again when the owner saves picks.json.
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JUDGE, PATHS, ROOT, loadEnv } from "./config.ts";
import { buildParams } from "./lib/batch.ts";
import { checkBudget, estimateCost, logUsage, readLedger, usageCost } from "./lib/guard.ts";
import { fetchThumbBlock } from "./lib/thumbs.ts";

type Pick = { id: string; imageUrl: string; platform?: string; page?: string; origin?: string };

export function picksFile(dir = join(ROOT, "..", "banana-server", "bench", "taste")): string {
  const own = join(dir, "picks.json");
  return existsSync(own) ? own : join(dir, "picks.default.json");
}

const SYSTEM = `You write short notes for an image judge. The owner picked exemplar pictures that show their taste bar for UI references (phone screens and web app screens, mostly dark, shipped-grade). Describe what the exemplars share so a judge can tell "great" (could sit on the owner's boards) from "good" (on the right page but generic) and "bad" (wrong page, kit, concept comp, stock art).

Write plain English, no em dashes, at most 380 words, as short bullet lists under these headings:
- What the exemplars share (layout, color, type, depth, data, texture)
- By page family (home and widgets, analytics and dashboards, wallet and finance, paywall and onboarding, chat and AI tools, health and calendar, dev tools and CRM): what the best look like
- Platform differences (mobile versus web app)
- What to mark bad even when it matches the words

Name only what you can see in the images. Do not name real people.`;

async function main() {
  loadEnv();
  const file = picksFile();
  const picks = (JSON.parse(readFileSync(file, "utf8")) as { picks: Pick[] }).picks;
  console.log(`${picks.length} exemplars from ${file}`);
  const blocks: Anthropic.ContentBlockParam[] = [];
  let n = 0;
  for (const p of picks) {
    const t = await fetchThumbBlock({ imageUrl: p.imageUrl });
    if (!t.ok) {
      console.log(`  skipped ${p.id}: ${t.reason}`);
      continue;
    }
    n++;
    blocks.push({ type: "text", text: `Exemplar ${n} (${p.platform ?? "?"}, ${p.page ?? "?"}):` }, t.block);
  }
  blocks.push({ type: "text", text: "Write the notes now." });

  const est = estimateCost(JUDGE, [{ systemChars: SYSTEM.length, userChars: 4000, images: n, outputTokens: 900, imageTokens: 400 }], false);
  const guard = checkBudget("j7-taste", est.usd, readLedger(PATHS.costs));
  console.log(`estimate $${est.usd.toFixed(4)}; ${guard.lines.join("; ")}`);
  if (!guard.ok) throw new Error(`REFUSED: ${guard.reason}`);

  const client = new Anthropic();
  const res = await client.messages.create(buildParams({ model: JUDGE, system: SYSTEM, content: blocks, maxTokens: 2500, effort: "low" }));
  const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
  const usd = usageCost(JUDGE, res.usage, false);
  logUsage(PATHS.costs, {
    job: "j7-taste",
    request: "notes",
    model: res.model,
    mode: "direct",
    input_tokens: res.usage.input_tokens,
    cache_write_tokens: res.usage.cache_creation_input_tokens ?? 0,
    cache_read_tokens: res.usage.cache_read_input_tokens ?? 0,
    output_tokens: res.usage.output_tokens,
    usd,
  });
  if (/—/.test(text)) throw new Error("the notes have an em dash: run again");
  writeFileSync(join(ROOT, "data", "j7-taste-notes.md"), text + "\n");
  console.log(`wrote data/j7-taste-notes.md (${text.split(/\s+/).length} words), $${usd.toFixed(4)}, ${res.usage.input_tokens} input tokens for ${n} images`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop()!)) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
