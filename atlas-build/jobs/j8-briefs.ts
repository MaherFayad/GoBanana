/**
 * P1-J8 step 1: 150 Bench-style briefs (BenchBrief), 15 per request across 10 segments, on Sonnet.
 * Output kind "work-j8-briefs" is intermediate and never uploaded. Next: j8-pages-sonnet and
 * j8-pages-opus make a default page per brief, then `npx tsx slop-analyze.ts` writes SlopRule[].
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SONNET } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";
import { BenchBriefSchema, type BenchBrief } from "../schema.ts";

type Segment = { key: string; platform: BenchBrief["platform"]; focus: string };

const SEGMENTS: Segment[] = [
  { key: "mobile-gcc", platform: "mobile", focus: "Gulf consumer apps: travel, telecom, food delivery, ride hailing, retail" },
  { key: "mobile-global", platform: "mobile", focus: "global consumer apps: fitness, social, music, notes, habits" },
  { key: "mobile-money", platform: "mobile", focus: "fintech, banking, insurance and health apps, Gulf and global mixed" },
  { key: "web-gcc", platform: "website", focus: "Gulf brand and commerce websites: cafes, real estate, events, fashion, tourism" },
  { key: "web-global", platform: "website", focus: "global small brands and studios: coffee, bakeries, agencies, bookshops, nonprofits" },
  { key: "web-launch", platform: "website", focus: "startup launch and pricing pages: AI tools, developer tools, hardware" },
  { key: "webapp-saas", platform: "webapp", focus: "SaaS app screens: dashboards, settings, analytics, inbox, billing" },
  { key: "webapp-gcc", platform: "webapp", focus: "Gulf business and government web apps: permits, payroll, logistics, clinics" },
  { key: "tablet", platform: "tablet", focus: "tablet apps: point of sale, reading, kids learning, recipes, in flight" },
  { key: "culture", platform: "website", focus: "culture led pages with a Gulf lens (sadu, talli, qatt-asiri, najdi, kufic, mashrabiya) or a world lens (memphis, swiss-international, japanese-ma)" },
];

const SYSTEM = `You write Banana Bench briefs for GoBanana, a tool that bends one app or web page into a wild but buildable design direction. A brief names one product and one page or screen in a single plain line, the way a founder or designer would type it, with the key job of the page after a colon when useful.

Examples:
- "eSIM plan picker for a GCC travel app: pick a destination data plan, compare GB and days, buy" (mobile, pages ["plan-picker"], wildness 3)
- "coffee shop landing page" (website, pages ["landing"], wildness 4)
- "fitness app empty state" (mobile, pages ["empty-state"], wildness 5)

Rules for a set:
- Every brief is a different product. Spread wildness from 1 to 5 evenly.
- pages: 1 or 2 short page ids, lowercase words joined by hyphens (landing, checkout, plan-picker, onboarding, dashboard, empty-state, paywall, settings, pricing, product-detail, sign-up, home).
- lens: only when the brief clearly asks for one; one of sadu, talli, qatt-asiri, najdi, kufic, mashrabiya, desert-modern, memphis, swiss-international, japanese-ma.
- id: lowercase words joined by hyphens, unique and descriptive.

${PROMPT_RULES}

Reply with a JSON array of BenchBrief.

${typeText("Platform", "BenchBrief")}`;

export default defineJob<Segment, BenchBrief>({
  id: "j8-briefs",
  kind: "work-j8-briefs",
  model: SONNET,
  mode: "batch",
  schema: BenchBriefSchema,
  system: SYSTEM,
  maxTokens: 6000,
  expectedOutputTokens: 2000,
  effort: "low",

  loadInputs: () => SEGMENTS,
  requestId: (s) => `briefs-${s.key}`,
  buildPrompt: (s) => `Write 15 briefs. Platform: ${s.platform} for every brief. Focus: ${s.focus}. Prefix every id with "${s.key}-".`,
  prepare: (raw, s) => (raw && typeof raw === "object" ? { ...raw, platform: s.platform } : raw),
  finalize: (records) => {
    const seen = new Set<string>();
    return records.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  },
  shardOf: (r) => r.platform,
});

/** The briefs from the j8-briefs output, for the page jobs. */
export function loadBriefs(): BenchBrief[] {
  const manifest = JSON.parse(readFileSync(join(ROOT, "out", "v1", "manifest.json"), "utf8")) as { shards: Array<{ kind: string; path: string }> };
  return manifest.shards
    .filter((s) => s.kind === "work-j8-briefs")
    .flatMap((s) => JSON.parse(readFileSync(join(ROOT, "out", "v1", s.path), "utf8")) as BenchBrief[])
    .sort((a, b) => a.id.localeCompare(b.id));
}
