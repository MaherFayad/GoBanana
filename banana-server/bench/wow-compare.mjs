#!/usr/bin/env node
/**
 * R7: compare judged bends (bench/runs/<dir>/judge-votes.json from atlas-build jobs/r7-judge-dirs.ts,
 * or judge-r5-votes.json from r5-judge.ts): on brief (final ratings file), wow of vote a, wow of both
 * votes, and each direction's lead and scores.
 *
 *   node bench/wow-compare.mjs bench/runs/r7-0 bench/runs/r7-5 [--list]
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const read = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null);
const list = process.argv.includes("--list");
for (const dir of process.argv.slice(2).filter((a) => !a.startsWith("--"))) {
  const votes = read(join(dir, "judge-votes.json")) ?? read(join(dir, "judge-r5-votes.json")) ?? [];
  const fin = (read(join(dir, "ratings-judge.json")) ?? read(join(dir, "ratings-judge-r5.json")))?.directions ?? {};
  const a = votes.filter((v) => v.vote === "a");
  const b = new Map(votes.filter((v) => v.vote === "b").map((v) => [`${v.briefId}/${v.directionId}`, v]));
  const finals = Object.values(fin);
  const on = finals.filter((d) => d.relevance >= 4).length;
  const wowA = a.map((v) => v.wow);
  const wowAB = a.map((v) => (v.wow + (b.get(`${v.briefId}/${v.directionId}`)?.wow ?? v.wow)) / 2);
  const mean = (xs) => (xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)).toFixed(2);
  console.log(
    `${dir}: on brief ${on} of ${finals.length}; wow (vote a) 4+ ${wowA.filter((w) => w >= 4).length}, 5 ${wowA.filter((w) => w >= 5).length}, mean ${mean(wowA)}; wow (mean of a and b) 4+ ${wowAB.filter((w) => w >= 4).length}, mean ${mean(wowAB)}; coherence mean ${mean(a.map((v) => v.coherence))}`,
  );
  if (list)
    for (const v of a) {
      const vb = b.get(`${v.briefId}/${v.directionId}`);
      console.log(`  ${v.briefId.slice(0, 14).padEnd(14)} ${v.title.slice(0, 34).padEnd(34)} rel ${v.relevance}/${vb?.relevance ?? "?"} coh ${v.coherence}/${vb?.coherence ?? "?"} wow ${v.wow}/${vb?.wow ?? "?"}`);
    }
}
