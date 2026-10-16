/**
 * Spot check the deck and brand genres live (2026-10-16): each query runs the plain search path
 * with its genre plan, at most `--requests` Serper credits each (default 2). Prints what came back:
 * source, image host and title. The key is read from .dev.vars (SERPER_API_KEY) and never printed.
 *
 *   npx tsx scripts/genre-spot.ts "pitch deck for a fintech startup" "brand identity for a coffee roaster"
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createWebSearchAdapter } from "../lib/sources/web-search";

const args = process.argv.slice(2);
const at = args.indexOf("--requests");
const maxRequests = at >= 0 ? Number(args.splice(at, 2)[1]) : 2;
const varsFile = process.env.DEV_VARS ?? join(__dirname, "..", ".dev.vars");
const apiKey = /^SERPER_API_KEY\s*=\s*"?([^"\r\n]+)"?/m.exec(readFileSync(varsFile, "utf8"))?.[1]?.trim();
if (!apiKey) throw new Error("no SERPER_API_KEY in .dev.vars");

const adapter = createWebSearchAdapter({ apiKey });
let credits = 0;
for (const query of args) {
  const r = await adapter.run({ query, count: 12, userId: "spot", maxRequests, maxPages: 1 });
  credits += r.requests ?? 0;
  console.log(`\n## ${query}\n   sent: ${(r.queries ?? []).join("  |  ")}\n   kept ${r.references.length}, dropped ${r.dropped ?? 0}${r.note ? `, note: ${r.note}` : ""}`);
  for (const ref of r.references) console.log(`   - ${ref.sourceSite} | ${new URL(ref.imageUrl).hostname} | ${ref.title ?? "(no title)"} | ${ref.sourceUrl}`);
}
console.log(`\ncredits: ${credits}`);
