/**
 * Refinement R7 source probe: does a source other than Dribbble hold up on the Bench briefs?
 *
 *   npx tsx scripts/r7-probe.ts --dev-vars <path to .dev.vars> [--dry]
 *
 * Takes 8 searched directions of run 2026-10-17r5a and sends, through the live search adapter (the
 * same filters as search_references), one UI request per direction on Behance (the brief page words, its
 * fidelity lane) and one art request per direction on Cosmos or Are.na (its
 * first art query, as galleryWords words it). 16 Serper credits. Writes bench/runs/r7-probe/run.json
 * in the Bench run shape (the r5a direction with the probe's references), so the R7 judge
 * (atlas-build jobs/r7-judge-refs.ts, R5_RUN=r7-probe) rates the results with J10's prompt.
 * URLs and metadata only, no image bytes. The Serper key is never printed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { galleryWords, UI_NEG, type PlannedRequest } from "@/lib/sources/plan";
import { createWebSearchAdapter } from "@/lib/sources/web-search";
import { compileTakedowns } from "@/lib/takedown";
import type { SourceSite } from "@/lib/sources/types";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const dry = process.argv.includes("--dry");
const devVars = resolve(arg("dev-vars") ?? join(ROOT, ".dev.vars"));
function devVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name]!.trim();
  if (!existsSync(devVars)) return undefined;
  return new RegExp(`^${name}\\s*=\\s*"?([^"\\n\\r]+)"?`, "m").exec(readFileSync(devVars, "utf8"))?.[1]?.trim();
}

type Dir = { id: string; title: string; lanes?: { component?: string[]; fidelity?: string; art?: string[]; idea?: string }; search?: { references: unknown[] } };
type Brief = { id: string; platform: string; directions: Dir[] };
const source = JSON.parse(readFileSync(join(ROOT, "bench", "runs", "2026-10-17r5a", "run.json"), "utf8")) as { briefs: Brief[] };

/** The probe set: brief, direction, the art gallery. Spread over the platforms and briefs. */
const PICKS: Array<[string, string, SourceSite]> = [
  ["esim-plan-picker", "bd-7le7dwhz", "cosmos"],
  ["flight-checkout-gcc-ota", "bd-ns524bym", "arena"],
  ["banking-onboarding", "bd-9hwrs7gn", "cosmos"],
  ["fitness-empty-state", "bd-h3nhd8qu", "arena"],
  ["ramadan-food-delivery", "bd-9bm2vxvb", "cosmos"],
  ["saas-pricing", "bd-fluldst5", "arena"],
  ["kids-reading-home", "bd-oocqzat2", "cosmos"],
  ["qatar-gov-services", "bd-m5md8vcw", "arena"],
];

const plain = (q: string) => q.replace(/(^|\s)-\S+/g, " ").replace(/\s+/g, " ").trim();

async function main() {
  const out: Array<{ brief: Brief; dir: Dir; ui: PlannedRequest; art: PlannedRequest }> = [];
  for (const [briefId, dirId, gallery] of PICKS) {
    const brief = source.briefs.find((b) => b.id === briefId)!;
    const dir = brief.directions.find((d) => d.id === dirId)!;
    const words = plain(dir.lanes?.fidelity ?? dir.lanes?.component?.[0] ?? "");
    const art = plain(dir.lanes?.art?.[0] ?? dir.lanes?.idea ?? dir.title);
    out.push({
      brief,
      dir,
      ui: { lane: "component", query: `${words} ${UI_NEG}`, site: "behance" },
      art: { lane: "art", query: galleryWords(gallery, art), site: gallery },
    });
  }
  for (const o of out) console.log(`${o.brief.id}: UI "${o.ui.query}" on behance; art "${o.art.query}" on ${o.art.site}`);
  if (dry) return;
  const apiKey = devVar("SERPER_API_KEY");
  const dbUrl = devVar("DATABASE_URL");
  if (!apiKey || !dbUrl) throw new Error(`SERPER_API_KEY and DATABASE_URL are needed (from ${devVars})`);
  const rows = (await neon(dbUrl)`select url_or_domain from takedowns`) as Array<{ url_or_domain: string }>;
  const matcher = compileTakedowns(rows.map((r) => r.url_or_domain));
  let sent = 0;
  const adapter = createWebSearchAdapter({
    apiKey,
    fetch: (input, init) => {
      sent++;
      return fetch(input, init);
    },
    loadTakedowns: async () => matcher,
  });
  const briefs = new Map<string, Brief>();
  for (const o of out) {
    // One request per plan, no fallback: each probe costs one credit.
    const ui = await adapter.runPlan([o.ui], { count: 8, userId: "bench-r7-probe" });
    const art = await adapter.runPlan([o.art], { count: 8, userId: "bench-r7-probe" });
    const refs = [...(ui.references ?? []).map((r) => ({ ...r, zone: "ui" })), ...(art.references ?? []).map((r) => ({ ...r, zone: "art" }))];
    const b = briefs.get(o.brief.id) ?? { ...o.brief, directions: [] };
    b.directions.push({ ...o.dir, search: { references: refs, probe: { ui: o.ui, art: o.art, uiGood: ui.references?.length ?? 0, artGood: art.references?.length ?? 0 } } as Dir["search"] });
    briefs.set(o.brief.id, b);
    console.log(`${o.brief.id}: behance ${ui.references?.length ?? 0} kept, ${o.art.site} ${art.references?.length ?? 0} kept`);
  }
  const dir = join(ROOT, "bench", "runs", "r7-probe");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "run.json"), JSON.stringify({ run: "r7-probe", createdAt: new Date().toISOString(), credits: sent, briefs: [...briefs.values()] }, null, 1) + "\n");
  console.log(`Serper requests: ${sent}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
