/**
 * R9 draft samples: what an agent holds after bend_brief and frankenstein_page for one direction,
 * before and after the R9 spec checks (lib/atlas/spec-coherence.ts). Offline, no Serper.
 *
 *   npx tsx scripts/r9-drafts.ts [atlas dir, default ../atlas-build/out/server/v1]
 *
 * Two groups, 30 drafts:
 * - "r7": the 20 R7 drafts (bench/runs/r7-drafts/samples.json). Before is R7's rated "after" text,
 *   unchanged (the reproduction). After rebuilds the same r5a direction's color, texture, motion and
 *   density lines and the mechanic lines with the R9 code from its cards (the lead and second card are
 *   read back from the spec), and the Bend it lines from the checked mechanic.
 * - "weak": 10 of the R6 weak-domain briefs (bench/r6-weak-briefs.json, not Bench briefs), each one's
 *   first direction with a second card, from the dry bends bench/runs/r9-w0 (before, R7 code) and
 *   r9-w1 (after, R9 code). These were never searched (no Serper), so the Frankenstein parts are
 *   stand-ins: UI references of the r5a directions of the Bench brief in the same domain (and
 *   platform where there is one). Both versions share the parts, so only the spec and the Bend it lines differ.
 *
 * Writes bench/runs/r9-drafts/samples.json for the atlas-build job r9-drafts.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { coherentMechanic, coherentSpec, colorLine } from "@/lib/atlas/spec-coherence";
import type { IngredientCard } from "@/lib/atlas/types";
import type { Mechanic as DirectionMechanic } from "@/lib/bend/mechanic";
import type { StitchRowSnapshot } from "@/lib/canvas/types";
import type { VisualSpec } from "@/lib/direction-detail";
import type { Platform } from "@/lib/platform";
import { bendLines } from "@/lib/stitch/bend-lines";
import { skeletonLines } from "@/lib/stitch/skeleton";
import type { PartRole } from "@/lib/stitch/types";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const atlasDir = resolve(process.argv[2] ?? join(ROOT, "..", "atlas-build", "out", "server", "v1"));
const RUNS = join(ROOT, "bench", "runs");

/** The roles an agent stacks most per platform, top to bottom (one part each), as in R7. */
const RECIPE: Record<string, PartRole[]> = {
  mobile: ["status-header", "hero", "cards", "cta"],
  tablet: ["status-header", "hero", "cards", "tabbar"],
  website: ["nav", "hero", "features", "pricing", "footer"],
  webapp: ["sidebar", "toolbar", "cards", "table"],
};

type Ref = { id: string; zone: string; title?: string; imageUrl: string; sourceUrl: string; sourceSite: string };
type Dir = { id: string; title: string; twist?: string; mechanic?: DirectionMechanic; ingredients?: Record<string, string>; spec?: VisualSpec; search?: { references: Ref[] } };
type Brief = { id: string; brief: string; platform: string; directions: Dir[] };
type Run = { briefs: Brief[] };
const readRun = (name: string) => JSON.parse(readFileSync(join(RUNS, name, "run.json"), "utf8")) as Run;

const cards = new Map<string, IngredientCard>();
for (const f of readdirSync(join(atlasDir, "cards"))) {
  const j = JSON.parse(readFileSync(join(atlasDir, "cards", f), "utf8")) as IngredientCard[] | { cards: IngredientCard[] };
  for (const c of Array.isArray(j) ? j : j.cards) cards.set(c.name, c);
}

function rowsFor(platform: string, ui: readonly Ref[]): StitchRowSnapshot[] | null {
  const roles = RECIPE[platform] ?? RECIPE.website!;
  if (ui.length < roles.length) return null;
  return roles.map((role, i) => ({
    id: `rw-${i + 1}`,
    slots: [
      {
        id: `sl-${i + 1}`,
        role,
        partId: `pt-${i + 1}`,
        imageUrl: ui[i]!.imageUrl,
        sourceUrl: ui[i]!.sourceUrl,
        sourceSite: ui[i]!.sourceSite,
        ...(ui[i]!.title ? { title: ui[i]!.title } : {}),
        crop: { x: 0, y: 0, w: 1, h: 1 },
      },
    ],
  }));
}

/** The draft text, built exactly as R7's samples (scripts/r7-drafts.ts). */
function draftText(b: Pick<Brief, "brief" | "platform">, d: Dir, rows: StitchRowSnapshot[]): string {
  const spec = Object.entries(d.spec ?? {})
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const head = [`Brief: ${b.brief} (${b.platform})`, `Direction: ${d.title}`, `Direction spec:\n${spec}`, "", `frankenstein_page answered:`, `- ${d.title} page (st-1, ${b.platform}, collage)`];
  const tail = ["Show each slot's source link next to it. Take the structure, not the pixels."];
  return [...head, ...skeletonLines(rows, "    "), ...bendLines(d.mechanic, rows), ...tail].join("\n");
}

/** The lead and second card of a direction, read back from its spec (the lead names the palette, the second is "from"). */
function picksOf(d: Dir): { lead: IngredientCard; second: IngredientCard | null; adds: "texture" | "motion" | "rule" | null } {
  const leadName = /^Palette from (.+?): /.exec(d.spec!.color)?.[1];
  const lead = leadName ? cards.get(leadName) : undefined;
  if (!lead) throw new Error(`no lead card for ${d.title} (${leadName})`);
  const from = (s: string) => /\(from (.+?)\)/.exec(s)?.[1];
  const rule = /One rule from (.+?): /.exec(d.spec!.layout)?.[1];
  const tex = from(d.spec!.texture);
  const mot = from(d.spec!.motion);
  const [name, adds] = tex ? [tex, "texture" as const] : mot ? [mot, "motion" as const] : rule ? [rule, "rule" as const] : [null, null];
  const second = name ? (cards.get(name) ?? null) : null;
  if (name && !second) throw new Error(`no second card ${name} for ${d.title}`);
  return { lead, second, adds };
}

/** An r5a direction with the R9 spec and mechanic lines. */
function withR9(b: Brief, d: Dir): Dir {
  const { lead, second, adds } = picksOf(d);
  const ctx = { lead, second, adds, platform: b.platform as Platform, parts: d.mechanic?.parts ?? [], task: d.mechanic?.task };
  const spec = coherentSpec({ ...d.spec!, color: `${colorLine(lead)}.` }, ctx);
  return { ...d, spec, ...(d.mechanic ? { mechanic: coherentMechanic(d.mechanic, ctx) } : {}) };
}

type Sample = { group: "r7" | "weak"; briefId: string; directionId: string; title: string; before: string; after: string };
const samples: Sample[] = [];

// Group r7: the R7 drafts.
const r7 = JSON.parse(readFileSync(join(RUNS, "r7-drafts", "samples.json"), "utf8")) as { source: string; samples: Array<{ briefId: string; directionId: string; title: string; after: string }> };
const r5a = readRun("2026-10-17r5a");
for (const s of r7.samples) {
  const b = r5a.briefs.find((x) => x.id === s.briefId)!;
  const d = b.directions.find((x) => x.id === s.directionId)!;
  const rows = rowsFor(b.platform, (d.search?.references ?? []).filter((r) => r.zone === "ui"))!;
  // The reproduction: R7's text must come back from the same direction, so the after text differs only by R9.
  if (draftText(b, d, rows) !== s.after) throw new Error(`R7 draft ${s.briefId}/${s.directionId} does not rebuild`);
  samples.push({ group: "r7", briefId: s.briefId, directionId: s.directionId, title: s.title, before: s.after, after: draftText(b, withR9(b, d), rows) });
}

// Group weak: 10 weak-domain briefs, stand-in parts from the same domain's r5a direction.
const WEAK: Array<[string, string, number]> = [
  ["telecom-sign-up", "esim-plan-picker", 0],
  ["telecom-bill-payment", "esim-plan-picker", 1],
  ["telecom-fiber-plans", "saas-pricing", 0],
  ["food-delivery-home", "ramadan-food-delivery", 0],
  ["food-order-tracking", "ramadan-food-delivery", 1],
  ["food-restaurant-menu", "ramadan-food-delivery", 0],
  ["villa-developer-home", "dubai-real-estate", 0],
  ["rental-search-results", "dubai-real-estate", 1],
  ["apartment-detail", "dubai-real-estate", 0],
  ["property-portal-home", "dubai-real-estate", 1],
];
const w0 = readRun("r9-w0");
const w1 = readRun("r9-w1");
for (const [briefId, donor, k] of WEAK) {
  const b0 = w0.briefs.find((x) => x.id === briefId)!;
  const b1 = w1.briefs.find((x) => x.id === briefId)!;
  const d0 = b0.directions.find((d) => picksOf(d).second) ?? b0.directions[0]!;
  const d1 = b1.directions.find((d) => d.id === d0.id)!;
  // The donor's UI references over all its directions, from the k-th group of four (so two briefs on one donor differ).
  const ui = r5a.briefs.find((x) => x.id === donor)!.directions.flatMap((d) => (d.search?.references ?? []).filter((r) => r.zone === "ui")).slice(k * 4);
  const rows = rowsFor(b0.platform, ui);
  if (!rows) throw new Error(`not enough stand-in parts for ${briefId}`);
  samples.push({ group: "weak", briefId, directionId: d0.id, title: d0.title, before: draftText(b0, d0, rows), after: draftText(b1, d1, rows) });
}

const out = join(RUNS, "r9-drafts");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "samples.json"), JSON.stringify({ atlas: atlasDir, samples }, null, 1) + "\n");
console.log(`${samples.length} draft samples (${samples.filter((s) => s.before !== s.after).length} changed) written to ${out}`);
