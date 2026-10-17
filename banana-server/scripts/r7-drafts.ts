/**
 * R7 draft samples: what an agent holds after bend_brief and frankenstein_page for one direction,
 * before and after the R7 "Bend it" lines (lib/stitch/bend-lines.ts). Offline, no Serper.
 *
 *   npx tsx scripts/r7-drafts.ts [run dir, default bench/runs/2026-10-17r5a]
 *
 * For each searched direction with 4 or more UI references, a Frankenstein page is stacked from its
 * top UI references in the platform's usual role order (the recipe an agent passes most), and the
 * draft text is the direction's spec plus frankenstein_page's text (skeleton lines with sources).
 * Writes bench/runs/r7-drafts/samples.json for the atlas-build job r7-drafts (Opus rates each draft:
 * could a designer take this and expand it into something original?).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StitchRowSnapshot } from "@/lib/canvas/types";
import { bendLines, type BendMechanic } from "@/lib/stitch/bend-lines";
import { skeletonLines } from "@/lib/stitch/skeleton";
import type { PartRole } from "@/lib/stitch/types";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const runDir = resolve(process.argv[2] ?? join(ROOT, "bench", "runs", "2026-10-17r5a"));

/** The roles an agent stacks most per platform, top to bottom (one part each). */
const RECIPE: Record<string, PartRole[]> = {
  mobile: ["status-header", "hero", "cards", "cta"],
  tablet: ["status-header", "hero", "cards", "tabbar"],
  website: ["nav", "hero", "features", "pricing", "footer"],
  webapp: ["sidebar", "toolbar", "cards", "table"],
};

type Ref = { id: string; zone: string; title?: string; imageUrl: string; sourceUrl: string; sourceSite: string };
type Dir = { id: string; title: string; mechanic?: BendMechanic; spec?: Record<string, unknown>; search?: { references: Ref[] } };
type Brief = { id: string; brief: string; platform: string; directions: Dir[] };

const run = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8")) as { briefs: Brief[] };
const samples = [];
for (const b of run.briefs) {
  for (const d of b.directions) {
    const ui = (d.search?.references ?? []).filter((r) => r.zone === "ui");
    const roles = RECIPE[b.platform] ?? RECIPE.website!;
    if (ui.length < roles.length) continue;
    const rows: StitchRowSnapshot[] = roles.map((role, i) => ({
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
    const spec = Object.entries(d.spec ?? {})
      .filter(([, v]) => typeof v === "string")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    const head = [`Brief: ${b.brief} (${b.platform})`, `Direction: ${d.title}`, `Direction spec:\n${spec}`, "", `frankenstein_page answered:`, `- ${d.title} page (st-1, ${b.platform}, collage)`];
    const skel = skeletonLines(rows, "    ");
    const tail = ["Show each slot's source link next to it. Take the structure, not the pixels."];
    samples.push({
      briefId: b.id,
      directionId: d.id,
      title: d.title,
      before: [...head, ...skel, ...tail].join("\n"),
      after: [...head, ...skel, ...bendLines(d.mechanic, rows), ...tail].join("\n"),
    });
  }
}
const out = join(ROOT, "bench", "runs", "r7-drafts");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "samples.json"), JSON.stringify({ source: runDir, samples }, null, 1) + "\n");
console.log(`${samples.length} draft samples written to ${out}`);
