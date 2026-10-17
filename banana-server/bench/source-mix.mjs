#!/usr/bin/env node
/**
 * Source mix of a rated Bench run (Refinement R7): per zone, how many top references come from each
 * host, and per host the agent and J10 precision and great share.
 *
 *   node bench/source-mix.mjs bench/runs/2026-10-17r5a [more run dirs]
 *
 * UI counts the top 8 UI references of each searched direction (the rated set); art counts every art
 * reference. A reference is rated when ratings.json (agent) or ratings-judge-r5.json (J10) has it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const TOP_UI = 8;
const read = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null);

export function hostOf(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (/pinterest\./.test(h) || h === "pin.it") return "pinterest";
    return h.split(".").slice(-2)[0];
  } catch {
    return "?";
  }
}

function main() {
  const stats = { ui: new Map(), art: new Map() };
  const dirMix = [];
  const bump = (m, host, verdictA, verdictJ) => {
    const s = m.get(host) ?? { n: 0, a: 0, aGood: 0, aGreat: 0, j: 0, jGood: 0, jGreat: 0 };
    s.n++;
    if (verdictA) {
      s.a++;
      if (verdictA !== "bad") s.aGood++;
      if (verdictA === "great") s.aGreat++;
    }
    if (verdictJ) {
      s.j++;
      if (verdictJ !== "bad") s.jGood++;
      if (verdictJ === "great") s.jGreat++;
    }
    m.set(host, s);
  };

  for (const dir of process.argv.slice(2)) {
    const run = read(join(dir, "run.json"));
    const agent = read(join(dir, "ratings.json"))?.references ?? {};
    const judge = read(join(dir, "ratings-judge-r5.json"))?.references ?? {};
    for (const b of run.briefs)
      for (const d of b.directions) {
        const refs = d.search?.references ?? [];
        if (!refs.length) continue;
        const ui = refs.filter((r) => r.zone === "ui").slice(0, TOP_UI);
        const art = refs.filter((r) => r.zone === "art");
        const k = (r) => `${b.id}/${d.id}/${r.id}`;
        for (const r of ui) bump(stats.ui, hostOf(r.sourceUrl ?? r.imageUrl), agent[k(r)], judge[k(r)]);
        for (const r of art) bump(stats.art, hostOf(r.sourceUrl ?? r.imageUrl), agent[k(r)], judge[k(r)]);
        const hosts = new Set(ui.map((r) => hostOf(r.sourceUrl ?? r.imageUrl)));
        const drib = ui.filter((r) => hostOf(r.sourceUrl ?? r.imageUrl) === "dribbble").length;
        dirMix.push({ dir, brief: b.id, id: d.id, title: d.title, ui: ui.length, hosts: hosts.size, dribbble: drib });
      }
  }

  const pct = (x, n) => (n ? `${((x / n) * 100).toFixed(1)}%` : "n/a");
  for (const zone of ["ui", "art"]) {
    const rows = [...stats[zone].entries()].sort((a, b) => b[1].n - a[1].n);
    const total = rows.reduce((s, [, v]) => s + v.n, 0);
    console.log(`\n${zone.toUpperCase()} (${total} references)`);
    console.log("| Source | Count | Share | Agent rated | Agent precision | Agent great | J10 rated | J10 precision | J10 great |");
    console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const [h, s] of rows) console.log(`| ${h} | ${s.n} | ${pct(s.n, total)} | ${s.a} | ${pct(s.aGood, s.a)} | ${pct(s.aGreat, s.a)} | ${s.j} | ${pct(s.jGood, s.j)} | ${pct(s.jGreat, s.j)} |`);
  }
  const searched = dirMix.length;
  console.log(`\nDirections searched: ${searched}; with 3 or more UI sources: ${dirMix.filter((d) => d.hosts >= 3).length}; Dribbble over 40% of UI: ${dirMix.filter((d) => d.ui && d.dribbble / d.ui > 0.4).length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
