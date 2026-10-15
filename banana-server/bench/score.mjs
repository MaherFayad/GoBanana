#!/usr/bin/env node
/**
 * Banana Bench score: the section 8 metrics of docs/next-step-plan.md for one run.
 *
 *   node bench/score.mjs bench/runs/<date>              # reads run.json and ratings.json there
 *   node bench/score.mjs bench/runs/<date> --ratings f  # ratings from another file
 *   node bench/score.mjs bench/runs/<date> --json       # machine readable
 *
 * run.json is written by scripts/bench-run.mjs. ratings.json comes from the Download button in that
 * run's report.html. Metrics this bench cannot measure yet (slop, crops, accessibility) are listed
 * as "not measured" with the reason, so the table always has every section 8 row.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** A direction counts as on brief when its brief relevance rating is 4 or 5. */
export const ON_BRIEF_MIN = 4;
/** Reference precision looks at the top 8 UI results of each direction. */
export const TOP_UI = 8;

export const directionKey = (briefId, directionId) => `${briefId}/${directionId}`;
export const referenceKey = (briefId, directionId, refId) => `${briefId}/${directionId}/${refId}`;

function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const pct = (n, d) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);

/**
 * Computes the metrics from a run and its ratings. Pure: no files, no network.
 * Unrated directions and references are left out of the shares (and counted in `rated`).
 */
export function computeMetrics(run, ratings = { directions: {}, references: {} }) {
  const dirRatings = ratings.directions ?? {};
  const refRatings = ratings.references ?? {};
  const directions = run.briefs.flatMap((b) => b.directions.map((d) => ({ brief: b, d })));

  // Brief relevance and wow.
  const relevance = [];
  const wow = [];
  const coherenceRatings = [];
  for (const { brief, d } of directions) {
    const r = dirRatings[directionKey(brief.id, d.id)];
    if (!r) continue;
    if (Number.isFinite(r.relevance)) relevance.push(r.relevance);
    if (Number.isFinite(r.wow)) wow.push(r.wow);
    if (Number.isFinite(r.coherence)) coherenceRatings.push(r.coherence);
  }
  const onBrief = relevance.filter((v) => v >= ON_BRIEF_MIN).length;

  // Spec coherence: checkCoherence problems when the engine has it (P0-08), else not measured.
  const checked = directions.filter(({ d }) => Array.isArray(d.coherence));
  const coherenceFailures = checked.filter(({ d }) => d.coherence.length > 0).length;

  // Query overlap: UI queries sent by more than one direction of the same brief (one canvas).
  let sharedQueries = 0;
  let briefsWithOverlap = 0;
  let searchedBriefs = 0;
  for (const b of run.briefs) {
    const searched = b.directions.filter((d) => d.search);
    if (searched.length < 2) continue;
    searchedBriefs++;
    const seen = new Map();
    for (const d of searched) {
      for (const q of new Set(d.search.uiQueries ?? [])) seen.set(q, (seen.get(q) ?? 0) + 1);
    }
    const shared = [...seen.values()].filter((n) => n > 1).length;
    sharedQueries += shared;
    if (shared > 0) briefsWithOverlap++;
  }

  // Reference precision: good or great among the top 8 UI results per direction.
  let precisionRated = 0;
  let precisionGood = 0;
  let refsRated = 0;
  for (const { brief, d } of directions) {
    if (!d.search) continue;
    const ui = d.search.references.filter((r) => r.zone !== "art").slice(0, TOP_UI);
    for (const r of ui) {
      const v = refRatings[referenceKey(brief.id, d.id, r.id)];
      if (!v) continue;
      precisionRated++;
      if (v === "good" || v === "great") precisionGood++;
    }
  }
  for (const v of Object.values(refRatings)) if (v) refsRated++;

  // Cost: Serper credits per board (one brief, every direction searched).
  const boards = run.briefs.filter((b) => b.directions.length > 0 && b.directions.every((d) => d.search));
  const boardCredits = boards.map((b) => b.directions.reduce((sum, d) => sum + (d.search.credits ?? 0), 0));
  const searches = directions.filter(({ d }) => d.search);
  const totalCredits = searches.reduce((sum, { d }) => sum + (d.search.credits ?? 0), 0);

  return {
    run: run.run,
    dry: Boolean(run.dry),
    rated: { directions: relevance.length, of: directions.length, references: refsRated },
    briefRelevance: { onBrief, rated: relevance.length, percent: pct(onBrief, relevance.length), target: 80 },
    specCoherence: {
      failures: checked.length > 0 ? coherenceFailures : null,
      checked: checked.length,
      ownerMedian: median(coherenceRatings),
      target: 0,
    },
    queryOverlap: { sharedQueries: searchedBriefs > 0 ? sharedQueries : null, briefsWithOverlap, searchedBriefs, target: 0 },
    referencePrecision: { goodOrGreat: precisionGood, rated: precisionRated, percent: pct(precisionGood, precisionRated), target: 75 },
    wow: { median: median(wow), rated: wow.length, target: 4 },
    cost: {
      creditsPerBoard: boardCredits.length > 0 ? Math.round((boardCredits.reduce((a, b) => a + b, 0) / boardCredits.length) * 10) / 10 : null,
      boards: boards.length,
      creditsPerSearch: searches.length > 0 ? Math.round((totalCredits / searches.length) * 10) / 10 : null,
      /** Per search times the directions per brief: the board cost when the budget cut the run short. */
      estimatedPerBoard:
        searches.length > 0 ? Math.round((totalCredits / searches.length) * Math.max(...run.briefs.map((b) => b.directions.length)) * 10) / 10 : null,
      totalCredits,
      target: 15,
    },
    notMeasured: {
      distanceFromSlop: "Needs a built page (J8). Not part of this bench yet.",
      cropAccuracy: "Needs bench/gold/*.json (200 gold parts, Phase 1).",
      accessibility: "Checked on builds and boards, not by this bench.",
    },
  };
}

const show = (v, unit = "") => (v === null || v === undefined ? "n/a" : `${v}${unit}`);

/** The metrics as a Markdown table, in section 8 order. */
export function formatMetrics(m) {
  const rows = [
    ["Brief relevance", `${show(m.briefRelevance.percent, "%")} (${m.briefRelevance.onBrief} of ${m.briefRelevance.rated} rated 4 or 5)`, "80% or more"],
    [
      "Spec coherence",
      `${m.specCoherence.failures === null ? "checkCoherence not in the engine yet" : `${m.specCoherence.failures} of ${m.specCoherence.checked} fail`}; owner median ${show(m.specCoherence.ownerMedian)}`,
      "0",
    ],
    ["Query overlap", `${show(m.queryOverlap.sharedQueries)} shared UI queries (${m.queryOverlap.briefsWithOverlap} of ${m.queryOverlap.searchedBriefs} boards)`, "0"],
    ["Reference precision", `${show(m.referencePrecision.percent, "%")} (${m.referencePrecision.goodOrGreat} of ${m.referencePrecision.rated} top ${TOP_UI} UI)`, "75% or more"],
    ["Distance from slop", `not measured: ${m.notMeasured.distanceFromSlop}`, "Fewer than 2 matches"],
    ["Crop accuracy", `not measured: ${m.notMeasured.cropAccuracy}`, "0.8 or more"],
    ["Wow", `median ${show(m.wow.median)} (${m.wow.rated} rated)`, "Median 4"],
    ["Accessibility", `not measured: ${m.notMeasured.accessibility}`, "100%"],
    [
      "Cost",
      `${show(m.cost.creditsPerBoard)} credits per board (${m.cost.boards} full boards; about ${show(m.cost.estimatedPerBoard)} estimated); ${show(m.cost.creditsPerSearch)} per search; ${m.cost.totalCredits} total`,
      "15 or fewer",
    ],
  ];
  return [
    `Run ${m.run}${m.dry ? " (dry: no search)" : ""}. Rated ${m.rated.directions} of ${m.rated.of} directions and ${m.rated.references} references.`,
    "",
    "| Metric | This run | Target |",
    "| --- | --- | --- |",
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

function main() {
  const dir = process.argv[2];
  if (!dir || dir.startsWith("--")) {
    console.error("Usage: node bench/score.mjs bench/runs/<date> [--ratings ratings.json] [--json]");
    process.exit(2);
  }
  const runFile = join(resolve(dir), "run.json");
  if (!existsSync(runFile)) {
    console.error(`No run.json in ${dir}. Run scripts/bench-run.mjs first.`);
    process.exit(2);
  }
  const i = process.argv.indexOf("--ratings");
  const ratingsFile = i > 0 ? resolve(process.argv[i + 1]) : join(resolve(dir), "ratings.json");
  const run = JSON.parse(readFileSync(runFile, "utf8"));
  let ratings;
  if (existsSync(ratingsFile)) ratings = JSON.parse(readFileSync(ratingsFile, "utf8"));
  else console.error(`No ratings at ${ratingsFile}: rate the run in report.html and download ratings.json first. Showing the unrated metrics.`);
  const m = computeMetrics(run, ratings);
  console.log(process.argv.includes("--json") ? JSON.stringify(m, null, 2) : formatMetrics(m));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
