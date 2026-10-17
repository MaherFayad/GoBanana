#!/usr/bin/env node
/**
 * R7: a searched run against r5a on the directions both searched in the same slot (the first
 * direction of each brief the new run searched), with the R5/R7 judge files of each run.
 *
 *   node bench/r7-compare.mjs bench/runs/2026-10-17r5a bench/runs/2026-10-17r7
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hostOf } from "./source-mix.mjs";

const [oldDir, newDir] = process.argv.slice(2);
const load = (dir) => ({
  run: JSON.parse(readFileSync(join(dir, "run.json"), "utf8")),
  judge: JSON.parse(readFileSync(join(dir, "ratings-judge-r5.json"), "utf8")),
  agent: (() => {
    try {
      return JSON.parse(readFileSync(join(dir, "ratings.json"), "utf8")).references ?? {};
    } catch {
      return {};
    }
  })(),
});
const a = load(oldDir);
const b = load(newDir);
const slots = [];
for (const brief of b.run.briefs)
  brief.directions.forEach((d, i) => {
    if (!d.search) return;
    const old = a.run.briefs.find((x) => x.id === brief.id)?.directions[i];
    if (old?.search) slots.push({ brief: brief.id, i, old, now: d });
  });

function stats(side, pick) {
  let on = 0, wow4 = 0, wowSum = 0, n = 0, ui = 0, drib = 0, rated = 0, good = 0, great = 0, artRated = 0, artGood = 0, artGreat = 0, three = 0;
  const lines = [];
  for (const s of slots) {
    const d = pick(s);
    const k = `${s.brief}/${d.id}`;
    const j = side.judge.directions[k];
    if (j) {
      n++;
      if (j.relevance >= 4) on++;
      if (j.wow >= 4) wow4++;
      wowSum += j.wow;
    }
    const top = d.search.references.filter((r) => r.zone === "ui").slice(0, 8);
    ui += top.length;
    drib += top.filter((r) => hostOf(r.sourceUrl) === "dribbble").length;
    if (new Set(top.map((r) => hostOf(r.sourceUrl))).size >= 3) three++;
    for (const r of d.search.references) {
      const v = side.judge.references[`${k}/${r.id}`];
      if (!v) continue;
      if (r.zone === "art") {
        artRated++;
        if (v !== "bad") artGood++;
        if (v === "great") artGreat++;
      } else {
        rated++;
        if (v !== "bad") good++;
        if (v === "great") great++;
      }
    }
    lines.push(`  ${s.brief.slice(0, 16).padEnd(16)} ${d.title.slice(0, 34).padEnd(34)} rel ${j?.relevance ?? "?"} wow ${j?.wow ?? "?"}`);
  }
  const p = (x, y) => (y ? `${((x / y) * 100).toFixed(1)}%` : "n/a");
  return { lines, row: `on brief ${on} of ${n}; wow 4+ ${wow4} of ${n}, mean ${(wowSum / Math.max(1, n)).toFixed(2)}; UI ${ui}, Dribbble ${p(drib, ui)}, 3+ sources ${three} of ${slots.length}; J10 UI precision ${p(good, rated)} (${good} of ${rated}), great ${p(great, rated)}; J10 art precision ${p(artGood, artRated)}, great ${p(artGreat, artRated)} (${artRated} rated)` };
}

const before = stats(a, (s) => s.old);
const after = stats(b, (s) => s.now);
console.log(`${slots.length} slots`);
console.log(`before (${oldDir}): ${before.row}`);
console.log(before.lines.join("\n"));
console.log(`after (${newDir}): ${after.row}`);
console.log(after.lines.join("\n"));
