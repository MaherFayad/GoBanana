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

const CHUNK = 60;
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
  const client = new Anthropic();
  let usd = 0;
  let inTok = 0;
  const call = async (request: string, content: Anthropic.ContentBlockParam[], system: string, images: number) => {
    const est = estimateCost(JUDGE, [{ systemChars: system.length, userChars: 4000, images, outputTokens: 900, imageTokens: 400 }], false);
    const guard = checkBudget("j7-taste", est.usd, readLedger(PATHS.costs));
    console.log(`${request}: estimate $${est.usd.toFixed(4)}; ${guard.lines.join("; ")}`);
    if (!guard.ok) throw new Error(`REFUSED: ${guard.reason}`);
    const res = await client.messages.create(buildParams({ model: JUDGE, system, content, maxTokens: 2500, effort: "low" }));
    const u = usageCost(JUDGE, res.usage, false);
    usd += u;
    inTok += res.usage.input_tokens;
    logUsage(PATHS.costs, {
      job: "j7-taste",
      request,
      model: res.model,
      mode: "direct",
      input_tokens: res.usage.input_tokens,
      cache_write_tokens: res.usage.cache_creation_input_tokens ?? 0,
      cache_read_tokens: res.usage.cache_read_input_tokens ?? 0,
      output_tokens: res.usage.output_tokens,
      usd: u,
    });
    return res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
  };

  // Up to CHUNK images per request (the API caps images per call); several chunks are merged by a text-only call.
  const parts: string[] = [];
  let n = 0;
  for (let i = 0; i < picks.length; i += CHUNK) {
    const blocks: Anthropic.ContentBlockParam[] = [];
    let k = 0;
    for (const p of picks.slice(i, i + CHUNK)) {
      const t = await fetchThumbBlock({ imageUrl: p.imageUrl });
      if (!t.ok) {
        console.log(`  skipped ${p.id}: ${t.reason}`);
        continue;
      }
      k++;
      blocks.push({ type: "text", text: `Exemplar ${n + k} (${p.platform ?? "?"}, ${p.page ?? "?"}):` }, t.block);
    }
    n += k;
    blocks.push({ type: "text", text: "Write the notes now." });
    parts.push(await call(`notes-${parts.length + 1}`, blocks, SYSTEM, k));
  }
  const MERGE_NOTE = "You are given several note sets written from different halves of the same exemplar set. Merge them into one set under the same headings and the same word limit. Keep what repeats across sets first.";
  const joined = parts.map((x, i) => "Notes " + (i + 1) + ":\n" + x).join("\n\n") + "\n\nMerge these into one set of notes now.";
  const text = parts.length === 1 ? parts[0]! : await call("notes-merge", [{ type: "text", text: joined }], SYSTEM + "\n\n" + MERGE_NOTE, 0);
  if (/—/.test(text)) throw new Error("the notes have an em dash: run again");
  writeFileSync(join(ROOT, "data", "j7-taste-notes.md"), text + "\n");
  console.log(`wrote data/j7-taste-notes.md (${text.split(/\s+/).length} words), $${usd.toFixed(4)}, ${inTok} input tokens for ${n} images`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop()!)) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
