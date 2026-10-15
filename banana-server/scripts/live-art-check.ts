/**
 * Live check for P0-16 (docs/next-step-plan.md): does a concrete art query return real results?
 *
 *   npx tsx scripts/live-art-check.ts                    # "ruler ticks", the brutalism lane of plan Appendix C
 *   npx tsx scripts/live-art-check.ts "exhibition catalog"
 *
 * Runs the real art plan (lib/sources/plan.ts artRequests: Pinterest pins, then Behance, with the
 * art junk gate and a bare noun retry) through the live Serper adapter. Costs 2 to 4 Serper credits.
 * Needs SERPER_API_KEY in the environment or in banana-server/.dev.vars.
 *
 * Hard rules: URLs and titles only. No image is fetched, downloaded or stored; nothing is written.
 * The takedown list is not loaded (nothing is shown to users or saved), so treat the printed links
 * as a check, not as references to place.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { artRequests } from "@/lib/sources/plan";
import { createWebSearchAdapter } from "@/lib/sources/web-search";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function serperKey(): string | undefined {
  if (process.env.SERPER_API_KEY) return process.env.SERPER_API_KEY;
  const file = join(ROOT, ".dev.vars");
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.startsWith("SERPER_API_KEY="));
  return line?.slice("SERPER_API_KEY=".length).trim().replace(/^"|"$/g, "") || undefined;
}

async function main() {
  const query = process.argv[2] ?? "ruler ticks";
  const apiKey = serperKey();
  if (!apiKey) {
    console.log("No SERPER_API_KEY: set it, or add it to banana-server/.dev.vars, then run again.");
    process.exit(2);
  }
  let sent = 0;
  const adapter = createWebSearchAdapter({
    apiKey,
    fetch: (input, init) => {
      sent++;
      return fetch(input, init);
    },
  });
  const plan = artRequests([query]);
  const out = await adapter.runPlan(plan, { count: 12, userId: "live-art-check" });
  const date = new Date().toISOString().slice(0, 10);
  console.log(`Live art check ${date}: "${query}", ${sent} Serper requests, ${out.references.length} kept results.`);
  for (const r of out.report ?? []) console.log(`  ${r.site}: ${r.good} kept, ${r.dropped ?? 0} dropped${r.retried ? `, retried "${r.retried}"` : ""}`);
  for (const ref of out.references) console.log(`  - ${ref.title ?? "(no title)"} ${ref.sourceUrl}`);
  console.log(out.references.length >= 3 ? "PASS: 3 or more results." : "FAIL: fewer than 3 results.");
}

void main();
