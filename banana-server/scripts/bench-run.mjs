#!/usr/bin/env node
/**
 * Banana Bench run (docs/next-step-plan.md P0-14 and section 8).
 *
 *   node scripts/bench-run.mjs                  # bend + search every brief in bench/briefs.json
 *   node scripts/bench-run.mjs --dry            # bend only, no Serper requests (lanes are shown, not searched)
 *   node scripts/bench-run.mjs --budget 150     # stop searching before the run could pass 150 Serper credits
 *   node scripts/bench-run.mjs --only a,b       # only these brief ids
 *   node scripts/bench-run.mjs --dev-vars path  # read SERPER_API_KEY and DATABASE_URL from another .dev.vars
 *   node scripts/bench-run.mjs --date 2026-10-15 --count 12
 *   node scripts/bench-run.mjs --atlas ../atlas-build/out/server/v1   # the Atlas engine over local shards
 *   node scripts/bench-run.mjs --no-baseline    # every direction reruns the canvas baseline lane (runs before g2)
 *   node scripts/bench-run.mjs --briefs bench/r6-weak-briefs.json --dry --atlas <dir>   # another briefs file (R6)
 *
 * --atlas <dir> reads a local Atlas in the server layout (atlas-build lib/layout.ts: <dir>/manifest.json
 * and <dir>/<kind>/<shard>.json) through the real loader, bends with the Atlas engine first and the
 * word lists when it cannot answer (as bend_brief does with BEND_ENGINE=atlas), and searches Atlas
 * directions with their recipes. run.json records the manifest hash and each brief's engine.
 *
 * Writes bench/runs/<date>/run.json (directions, queries, credits, result URLs) and
 * bench/runs/<date>/report.html (one self-contained page to rate the run). The owner rates there and
 * downloads ratings.json into the same folder; `node bench/score.mjs bench/runs/<date>` scores it.
 *
 * Same code path as the MCP tools, through their public functions only: `bendBrief` (lib/bend),
 * `directionDetail` (bend_brief) and `createSearchReferencesTool` (search_references) with the live
 * Serper adapter. The canvas and database are in-memory per brief (one board per brief, so later
 * directions skip results earlier ones placed, as on a real canvas), except the takedown list, which
 * is read from the database (DATABASE_URL) and checked on every search.
 *
 * Hard rules: URLs and metadata only. No image bytes are fetched or saved; report.html hotlinks
 * every image and shows its source link. The Serper key is never printed.
 *
 * Runs itself under tsx (the engine is TypeScript with "@/" paths), like scripts/make-examples.ts.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SELF), "..");

if (!process.env.BANANA_BENCH_TSX) {
  // Re-run under tsx. A shell command so `npx` resolves to npx.cmd on Windows.
  const args = process.argv.slice(2).map((a) => JSON.stringify(a)).join(" ");
  const res = spawnSync(`npx tsx ${JSON.stringify(SELF)} ${args}`, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, BANANA_BENCH_TSX: "1" },
  });
  process.exit(res.status ?? 1);
}

/** Most Serper requests one search_references call can send (8 UI plus 2 art). */
const MAX_CREDITS_PER_SEARCH = 10;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

function devVar(name, file) {
  if (process.env[name]) return process.env[name].trim();
  if (!existsSync(file)) return undefined;
  const m = new RegExp(`^${name}\\s*=\\s*"?([^"\\n\\r]+)"?`, "m").exec(readFileSync(file, "utf8"));
  return m?.[1]?.trim();
}

const dry = flag("dry");
const budget = Number(arg("budget", "150"));
const count = Number(arg("count", "12"));
const date = arg("date", new Date().toISOString().slice(0, 10));
const only = arg("only")?.split(",").map((s) => s.trim());
const devVarsFile = resolve(arg("dev-vars", join(ROOT, ".dev.vars")));
const atlasDir = arg("atlas") ? resolve(arg("atlas")) : null;

const briefsFile = arg("briefs") ? resolve(arg("briefs")) : join(ROOT, "bench", "briefs.json");
const bench = JSON.parse(readFileSync(briefsFile, "utf8"));
const briefs = bench.briefs.filter((b) => !only || only.includes(b.id));
const perBrief = Number(arg("directions", String(bench.directions ?? 3)));

const { bendBrief, ...bendModule } = await import("@/lib/bend");
const { directionDetail } = await import("@/lib/mcp/tools/bend_brief");
const { createSearchReferencesTool, directionLanes } = await import("@/lib/mcp/tools/search_references");
const { createMemoryUsageStore } = await import("@/lib/quota");
const { createWebSearchAdapter } = await import("@/lib/sources/web-search");
const { compileTakedowns } = await import("@/lib/takedown");
const { ART_NEG } = await import("@/lib/sources/plan");
const { mergeBaseline } = await import("@/lib/sources/baseline");
const { allowlistFromEnv, isAllowedImageUrl } = await import("@/lib/sources/allowlist");

/** The local Atlas (--atlas), or null: an AtlasSource over the files through the real loader. */
async function localAtlas(dir) {
  if (!dir) return null;
  const { createAtlasLoader, atlasReady } = await import("@/lib/atlas/loader");
  const { loaderSource } = await import("@/lib/atlas/source");
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  if (!atlasReady(manifest)) {
    console.error(`No shards in ${join(dir, "manifest.json")}: the word lists run.`);
    return null;
  }
  const source = () =>
    loaderSource(
      createAtlasLoader({
        manifest,
        budget: 1000,
        fetchShard: async (path) => {
          const rel = path.split("/").slice(2).join("/");
          const file = join(dir, rel);
          return existsSync(file) ? readFileSync(file, "utf8") : null;
        },
      }),
    );
  return { manifest, source };
}
const atlas = await localAtlas(atlasDir);
const { bendBriefAtlas } = atlas ? await import("@/lib/atlas/bend") : {};

/** Art requests carry the art negatives, or name an art lane without any UI words. */
function isArtQuery(q, artWords) {
  if (q.includes(ART_NEG)) return true;
  if (/\bui\b|-template/.test(q)) return false;
  const lower = q.toLowerCase();
  return artWords.some((w) => w && lower.includes(w));
}

/** checkCoherence lands with P0-08; until then coherence is null (not measured). */
function coherence(d, all) {
  const check = bendModule.checkCoherence;
  if (typeof check !== "function") return null;
  try {
    const problems = check(d, all);
    return Array.isArray(problems) ? problems.map(String) : null;
  } catch (e) {
    return [`checkCoherence threw: ${e instanceof Error ? e.message : String(e)}`];
  }
}

function searchDirection(brief, result, d) {
  return {
    id: d.id,
    bendId: d.id,
    canvasId: `bench-${brief.id}`,
    searchQuery: d.searchQuery,
    brief: result.brief,
    taste: null,
    detail: directionDetail(d, result.wildness, result.brief, result.atlas),
  };
}

// ---------------------------------------------------------------------------- bend (free)

const run = {
  run: date,
  dry,
  createdAt: new Date().toISOString(),
  budget,
  count,
  credits: 0,
  engine: { checkCoherence: typeof bendModule.checkCoherence === "function", canvasBaseline: !flag("no-baseline"), atlas: atlas ? { dir: atlasDir, hash: atlas.manifest.hash, shards: atlas.manifest.shards.length } : null },
  briefs: [],
};

for (const b of briefs) {
  const input = {
    brief: b.brief,
    wildness: b.wildness,
    count: perBrief,
    ...(b.platform ? { platform: b.platform } : {}),
    ...(b.lens ? { lens: b.lens } : {}),
    ...(b.pages ? { pages: b.pages } : {}),
    ...(b.mustKeep ? { mustKeep: b.mustKeep } : {}),
  };
  // With --atlas, the Atlas engine first and the word lists when it cannot answer (as bend_brief).
  const fromAtlas = atlas ? await bendBriefAtlas(input, atlas.source()) : null;
  const result = fromAtlas ?? bendBrief(input);
  run.briefs.push({
    id: b.id,
    brief: b.brief,
    engine: fromAtlas ? "atlas" : "lists",
    market: b.market ?? null,
    platform: result.platform,
    wildness: result.wildness,
    wildnessLabel: result.wildnessLabel,
    mustKeep: b.mustKeep ?? [],
    subject: result.subject,
    lens: result.lens ? result.lens.id : null,
    suggestedLenses: result.suggestedLenses,
    directions: result.directions.map((d) => {
      const sd = searchDirection(b, result, d);
      return {
        id: d.id,
        title: d.title,
        twist: d.twist,
        move: d.move,
        searchQuery: d.searchQuery,
        mechanic: d.mechanic,
        ingredients: d.ingredients,
        artQueries: d.artQueries,
        spec: d.spec,
        lanes: directionLanes(sd, []),
        coherence: coherence(d, result.directions),
        search: null,
      };
    }),
    _bend: result,
  });
}
console.log(`Bent ${run.briefs.length} briefs, ${run.briefs.reduce((n, b) => n + b.directions.length, 0)} directions.`);
if (atlas) console.log(`Atlas engine answered ${run.briefs.filter((b) => b.engine === "atlas").length} of ${run.briefs.length} briefs (manifest ${atlas.manifest.hash.slice(0, 12)}).`);

// ---------------------------------------------------------------------------- search (Serper credits)

let skipped = 0;
/**
 * The canvas baseline of each brief's board, as the live tool saves it on the canvas (P0-03): the
 * first direction search runs the baseline (fidelity) lane, later ones on the same board reuse it and
 * skip every request the board already sent. --no-baseline runs every lane for every direction, as
 * the runs before 2026-10-16g2 did.
 */
const baselines = new Map();
const wireBaseline = !flag("no-baseline");
if (dry) {
  console.log("Dry run: search skipped (--dry). The report shows each direction's planned lanes, no results.");
} else {
  const apiKey = devVar("SERPER_API_KEY", devVarsFile);
  const dbUrl = devVar("DATABASE_URL", devVarsFile);
  if (!apiKey) {
    console.error(`No SERPER_API_KEY in the environment or ${devVarsFile}. Pass --dry to bend only.`);
    process.exit(2);
  }
  if (!dbUrl) {
    console.error(`No DATABASE_URL (needed to check the takedown list). Pass --dry to bend only.`);
    process.exit(2);
  }
  const { neon } = await import("@neondatabase/serverless");
  const rows = await neon(dbUrl)`select url_or_domain from takedowns`;
  const matcher = compileTakedowns(rows.map((r) => r.url_or_domain));

  let sent = 0;
  const requests = [];
  const countingFetch = (input, init) => {
    sent++;
    try {
      const body = JSON.parse(String(init?.body ?? "{}"));
      requests.push({ q: body.q, num: body.num, page: body.page });
    } catch {
      requests.push({});
    }
    return fetch(input, init);
  };
  const adapter = createWebSearchAdapter({ apiKey, fetch: countingFetch, loadTakedowns: async () => matcher });

  // Round robin: the first direction of every brief, then the second, so a short budget still
  // covers every brief.
  for (let i = 0; i < perBrief; i++) {
    for (const b of run.briefs) {
      const d = b.directions[i];
      if (!d) continue;
      if (run.credits + MAX_CREDITS_PER_SEARCH > budget) {
        skipped++;
        continue;
      }
      const bd = b._bend.directions[i];
      const placed = new Set(b.directions.flatMap((x) => x.search?.references.map((r) => r.sourceUrl) ?? []));
      const tool = createSearchReferencesTool({
        adapter,
        usage: createMemoryUsageStore(),
        getPlan: async () => "pro_monthly",
        getDirection: async () => searchDirection(b, b._bend, bd),
        // The CC0 index (art zone) needs the image host check and the takedown list, as the live tool
        // wires them (createDbDeps). Without them no CC0 result is ever shown (Gate 2 round 2).
        ...(atlas ? { atlasSource: () => atlas.source(), allowImage: (url) => isAllowedImageUrl(url, allowlistFromEnv()), loadTakedowns: async () => matcher } : {}),
        addToTray: async (_user, _canvas, _refs, _dir, opts) => {
          if (wireBaseline && opts?.baseline) baselines.set(b.id, mergeBaseline(baselines.get(b.id), opts.baseline, new Date(opts.baseline.at)));
          return true;
        },
        ...(wireBaseline ? { getBaseline: async () => baselines.get(b.id) ?? null } : {}),
        getCanvasSourceUrls: async () => [...placed],
        upgradeUrl: () => "https://example.invalid/pricing",
      });
      const before = sent;
      const firstRequest = requests.length;
      const res = await tool({ directionId: d.id, canvasId: `bench-${b.id}`, count, thumbs: false }, "bench");
      const credits = sent - before;
      run.credits += credits;
      const out = res.structuredContent;
      if (!out) {
        d.search = { credits, queries: [], uiQueries: [], references: [], note: res.content[0]?.text ?? "No result." };
        console.log(`${b.id} / ${d.title}: no result (${credits} credits)`);
        continue;
      }
      const artWords = (out.lanes?.art ?? []).map((s) => String(s).toLowerCase());
      d.search = {
        credits,
        queries: out.queries,
        uiQueries: out.queries.filter((q) => !isArtQuery(q, artWords)),
        requests: requests.slice(firstRequest),
        dropped: out.dropped ?? 0,
        ...(out.baseline ? { baseline: { reused: out.baseline.reused, referenceIds: out.baseline.referenceIds.length } } : {}),
        ...(out.note ? { note: out.note } : {}),
        references: out.references.map((r) => ({
          id: r.id,
          zone: r.zone ?? "ui",
          lane: r.lane ?? null,
          query: r.query ?? null,
          title: r.title ?? null,
          imageUrl: r.imageUrl,
          thumbUrl: r.thumbUrl,
          sourceUrl: r.sourceUrl,
          sourceSite: r.sourceSite,
          width: r.width ?? null,
          height: r.height ?? null,
        })),
      };
      console.log(`${b.id} / ${d.title}: ${out.zones.ui} ui, ${out.zones.art} art, ${credits} credits (run total ${run.credits})`);
    }
  }
  if (skipped > 0) console.log(`Budget ${budget}: ${skipped} direction searches skipped. Raise --budget to search them.`);
}
run.skippedSearches = skipped;
for (const b of run.briefs) delete b._bend;

// ---------------------------------------------------------------------------- write

const outDir = join(ROOT, "bench", "runs", date);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "run.json"), `${JSON.stringify(run, null, 1)}\n`);
writeFileSync(join(outDir, "report.html"), reportHtml(run));
console.log(`Wrote ${relative(ROOT, join(outDir, "report.html"))} and run.json (${run.credits} Serper credits).`);

// ---------------------------------------------------------------------------- report page

function reportHtml(data) {
  // JSON inside a script tag: escape "<" so no string can close the tag.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Banana Bench ${data.run}</title>
<style>
:root{--bg:#f6f5f1;--panel:#fff;--ink:#1b1b1b;--muted:#5d5d5d;--line:#dcdad3;--accent:#8a6d00;--great:#1e7a3a;--bad:#b3261e;--chip:#efede6}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--panel:#1e1e1e;--ink:#ecebe7;--muted:#a8a69f;--line:#33322f;--accent:#f2c94c;--great:#5fd38a;--bad:#ff8a80;--chip:#2a2926}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header.top{position:sticky;top:0;z-index:5;background:var(--panel);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
header.top h1{font-size:17px;margin:0}
header.top .progress{color:var(--muted);font-size:13px}
header.top .actions{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
button,.file{font:inherit;font-size:14px;padding:6px 12px;border:1px solid var(--line);border-radius:6px;background:var(--chip);color:var(--ink);cursor:pointer;min-height:32px}
button.primary{background:var(--accent);color:#141414;border-color:var(--accent);font-weight:600}
button:focus-visible,.file:focus-within,input:focus-visible,textarea:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
main{max-width:1280px;margin:0 auto;padding:16px}
.intro{color:var(--muted);max-width:820px}
nav.toc{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 24px}
nav.toc a{font-size:13px;padding:4px 10px;border-radius:999px;background:var(--chip);color:var(--ink);text-decoration:none}
section.brief{margin:0 0 40px}
section.brief>h2{font-size:20px;margin:0 0 4px}
.meta{color:var(--muted);font-size:13px;margin:0 0 12px}
article.dir{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;margin:0 0 16px}
article.dir h3{margin:0 0 4px;font-size:17px}
.twist{color:var(--muted);margin:0 0 8px}
details{margin:8px 0}
summary{cursor:pointer;color:var(--accent);font-weight:600}
dl.spec{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:8px 0;font-size:14px}
dl.spec dt{color:var(--muted)}
dl.spec dd{margin:0}
.warn{color:var(--bad);font-size:14px}
.queries{font:12px/1.5 ui-monospace,Consolas,monospace;color:var(--muted);word-break:break-word}
fieldset.rate{border:1px solid var(--line);border-radius:8px;margin:12px 0;padding:8px 12px;display:flex;flex-wrap:wrap;gap:8px 24px}
fieldset.rate legend{font-weight:600;padding:0 4px}
.scale{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.scale span.label{min-width:110px}
.scale label{display:inline-flex;align-items:center;justify-content:center;min-width:32px;min-height:32px;border:1px solid var(--line);border-radius:6px;cursor:pointer}
.scale input{position:absolute;opacity:0;width:1px;height:1px}
.scale input:checked+span{font-weight:700}
.scale label:has(input:checked){background:var(--accent);color:#141414;border-color:var(--accent)}
.scale label:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:2px}
textarea{width:100%;min-height:44px;font:inherit;font-size:14px;padding:6px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink)}
h4{margin:16px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
figure.ref{margin:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--bg);display:flex;flex-direction:column}
figure.ref.great{border-color:var(--great);box-shadow:0 0 0 2px var(--great)}
figure.ref.bad{opacity:.55}
figure.ref .img{aspect-ratio:4/3;background:var(--chip);display:flex;align-items:center;justify-content:center}
figure.ref img{width:100%;height:100%;object-fit:contain;display:block}
figure.ref figcaption{padding:6px 8px;font-size:12px;display:flex;flex-direction:column;gap:4px}
figure.ref .t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
figure.ref a{color:var(--accent);word-break:break-all}
.rank{color:var(--muted)}
.verdict{display:flex;gap:4px}
.verdict label{flex:1;text-align:center;font-size:12px;padding:4px 0;border:1px solid var(--line);border-radius:6px;cursor:pointer;min-height:28px}
.verdict input{position:absolute;opacity:0;width:1px;height:1px}
.verdict label:has(input:checked){color:#141414;font-weight:700}
.verdict label.v-great:has(input:checked){background:var(--great);border-color:var(--great)}
.verdict label.v-good:has(input:checked){background:var(--accent);border-color:var(--accent)}
.verdict label.v-bad:has(input:checked){background:var(--bad);border-color:var(--bad)}
.verdict label:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:2px}
.empty{color:var(--muted);font-size:14px}
@media (max-width:600px){main{padding:12px 16px}.grid{grid-template-columns:repeat(2,1fr)}.scale span.label{min-width:0;width:100%}}
</style>
</head>
<body>
<header class="top">
  <h1>Banana Bench ${data.run}</h1>
  <span class="progress" id="progress"></span>
  <div class="actions">
    <label class="file">Load ratings.json <input type="file" id="load" accept="application/json" hidden></label>
    <button type="button" class="primary" id="download">Download ratings.json</button>
  </div>
</header>
<main>
  <p class="intro" id="intro"></p>
  <nav class="toc" id="toc" aria-label="Briefs"></nav>
  <div id="briefs"></div>
</main>
<script type="application/json" id="run-data">${json}</script>
<script>
(function () {
  var run = JSON.parse(document.getElementById("run-data").textContent);
  var STORE = "banana-bench:" + run.run;
  var ratings = { run: run.run, directions: {}, references: {} };
  try { var saved = localStorage.getItem(STORE); if (saved) ratings = Object.assign(ratings, JSON.parse(saved)); } catch (e) {}
  function save() { try { localStorage.setItem(STORE, JSON.stringify(ratings)); } catch (e) {} progress(); }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function dirKey(b, d) { return b.id + "/" + d.id; }
  function refKey(b, d, r) { return b.id + "/" + d.id + "/" + r.id; }

  var totalDirs = 0, totalRefs = 0;
  run.briefs.forEach(function (b) { b.directions.forEach(function (d) { totalDirs++; if (d.search) totalRefs += d.search.references.length; }); });
  function progress() {
    var dr = 0, rr = 0;
    run.briefs.forEach(function (b) { b.directions.forEach(function (d) {
      var r = ratings.directions[dirKey(b, d)];
      if (r && r.relevance && r.coherence && r.wow) dr++;
      if (d.search) d.search.references.forEach(function (x) { if (ratings.references[refKey(b, d, x)]) rr++; });
    }); });
    document.getElementById("progress").textContent = dr + " of " + totalDirs + " directions and " + rr + " of " + totalRefs + " references rated";
  }

  document.getElementById("intro").textContent =
    (run.dry ? "Dry run: search was skipped, so only the specs and planned lanes are shown. " : "") +
    "Rate each direction 1 to 5 for brief relevance (4 or 5 counts as on brief), coherence and wow, and mark each reference great, good or bad. " +
    "Ratings stay in this browser until you download ratings.json. Save it next to this file as bench/runs/" + run.run + "/ratings.json, then run: node bench/score.mjs bench/runs/" + run.run +
    ". Serper credits used: " + run.credits + (run.skippedSearches ? " (" + run.skippedSearches + " searches skipped for the budget)" : "") + ".";

  function scale(b, d, field, label) {
    var name = dirKey(b, d) + ":" + field;
    var wrap = el("div", { class: "scale", role: "radiogroup", "aria-label": label + " for " + d.title }, [el("span", { class: "label", text: label })]);
    for (var v = 1; v <= 5; v++) {
      var input = el("input", { type: "radio", name: name, value: String(v) });
      var cur = ratings.directions[dirKey(b, d)];
      if (cur && cur[field] === v) input.checked = true;
      input.addEventListener("change", (function (val) { return function () {
        var k = dirKey(b, d); ratings.directions[k] = Object.assign({ briefId: b.id, directionId: d.id }, ratings.directions[k] || {}); ratings.directions[k][field] = val; save();
      }; })(v));
      wrap.appendChild(el("label", {}, [input, el("span", { text: String(v) })]));
    }
    return wrap;
  }

  function refCard(b, d, r, rank) {
    var key = refKey(b, d, r);
    var img = el("img", { src: r.imageUrl, alt: r.title || "Reference from " + r.sourceSite, loading: "lazy", referrerpolicy: "no-referrer" });
    img.addEventListener("error", function () { if (r.thumbUrl && img.src !== r.thumbUrl) img.src = r.thumbUrl; }, { once: true });
    var fig = el("figure", { class: "ref" });
    var verdict = el("div", { class: "verdict", role: "radiogroup", "aria-label": "Rating for " + (r.title || r.sourceSite) });
    ["great", "good", "bad"].forEach(function (v) {
      var input = el("input", { type: "radio", name: key, value: v });
      if (ratings.references[key] === v) { input.checked = true; fig.classList.add(v); }
      input.addEventListener("change", function () {
        ratings.references[key] = v; fig.classList.remove("great", "good", "bad"); fig.classList.add(v); save();
      });
      verdict.appendChild(el("label", { class: "v-" + v }, [input, v]));
    });
    fig.appendChild(el("div", { class: "img" }, [img]));
    fig.appendChild(el("figcaption", {}, [
      el("span", { class: "t", text: (r.title || "Untitled") }),
      el("span", { class: "rank", text: (r.zone === "art" ? "art" : "UI #" + rank) + (r.lane ? " · " + r.lane : "") }),
      el("a", { href: r.sourceUrl, target: "_blank", rel: "noopener noreferrer", text: r.sourceSite || r.sourceUrl }),
      verdict,
    ]));
    return fig;
  }

  var SPEC = ["typography", "color", "layout", "imagery", "motion", "texture", "iconography", "density", "signature", "pattern", "whyItFits"];
  var root = document.getElementById("briefs"), toc = document.getElementById("toc");
  run.briefs.forEach(function (b) {
    toc.appendChild(el("a", { href: "#" + b.id, text: b.id }));
    var sec = el("section", { class: "brief", id: b.id }, [
      el("h2", { text: b.brief }),
      el("p", { class: "meta", text: [b.platform, "wildness " + b.wildness + " (" + b.wildnessLabel + ")", b.market ? "market " + b.market : "", "subject \\"" + b.subject + "\\"",
        b.lens ? "lens " + b.lens : (b.suggestedLenses.length ? "suggested lenses " + b.suggestedLenses.join(", ") : ""),
        b.mustKeep.length ? "must keep: " + b.mustKeep.join(", ") : ""].filter(Boolean).join(" · ") }),
    ]);
    b.directions.forEach(function (d) {
      var art = el("article", { class: "dir", "aria-label": d.title }, [
        el("h3", { text: d.title }),
        d.twist ? el("p", { class: "twist", text: "Twist: " + d.twist }) : null,
        el("p", { class: "meta", text: "Move: " + d.move + " · Mechanic: " + (d.mechanic ? d.mechanic.element + ", " + d.mechanic.how : "none") }),
      ]);
      if (Array.isArray(d.coherence) && d.coherence.length) art.appendChild(el("p", { class: "warn", text: "checkCoherence: " + d.coherence.join("; ") }));
      var dl = el("dl", { class: "spec" });
      SPEC.forEach(function (f) { if (d.spec && d.spec[f]) { dl.appendChild(el("dt", { text: f })); dl.appendChild(el("dd", { text: d.spec[f] })); } });
      ["steal", "avoid"].forEach(function (f) { if (d.spec && d.spec[f] && d.spec[f].length) { dl.appendChild(el("dt", { text: f })); dl.appendChild(el("dd", { text: d.spec[f].join(" ") })); } });
      art.appendChild(el("details", { open: "" }, [el("summary", { text: "Spec" }), dl]));
      var q = d.search ? d.search.queries : Object.keys(d.lanes || {}).filter(function (k) { return typeof d.lanes[k] === "string" || Array.isArray(d.lanes[k]); })
        .map(function (k) { return k + ": " + [].concat(d.lanes[k]).join(" | "); });
      art.appendChild(el("details", {}, [el("summary", { text: d.search ? "Queries sent (" + d.search.credits + " credits)" : "Planned lanes (not searched)" }),
        el("div", { class: "queries" }, q.map(function (s) { return el("div", { text: s }); }))]));

      var cur = ratings.directions[dirKey(b, d)] || {};
      var note = el("textarea", { "aria-label": "Note for " + d.title, placeholder: "Note (optional)" });
      note.value = cur.note || "";
      note.addEventListener("input", function () {
        var k = dirKey(b, d); ratings.directions[k] = Object.assign({ briefId: b.id, directionId: d.id }, ratings.directions[k] || {}); ratings.directions[k].note = note.value; save();
      });
      art.appendChild(el("fieldset", { class: "rate" }, [el("legend", { text: "Rate this direction" }),
        scale(b, d, "relevance", "Brief relevance"), scale(b, d, "coherence", "Coherence"), scale(b, d, "wow", "Wow"), note]));

      if (!d.search) {
        art.appendChild(el("p", { class: "empty", text: run.dry ? "Not searched (dry run)." : "Not searched (budget)." }));
      } else {
        var ui = d.search.references.filter(function (r) { return r.zone !== "art"; });
        var artRefs = d.search.references.filter(function (r) { return r.zone === "art"; });
        art.appendChild(el("h4", { text: "UI (" + ui.length + ")" }));
        art.appendChild(ui.length ? el("div", { class: "grid" }, ui.map(function (r, i) { return refCard(b, d, r, i + 1); })) : el("p", { class: "empty", text: "No UI results." + (d.search.note ? " " + d.search.note : "") }));
        art.appendChild(el("h4", { text: "Art (" + artRefs.length + ")" }));
        art.appendChild(artRefs.length ? el("div", { class: "grid" }, artRefs.map(function (r, i) { return refCard(b, d, r, i + 1); })) : el("p", { class: "empty", text: "No art results." }));
      }
      sec.appendChild(art);
    });
    root.appendChild(sec);
  });

  document.getElementById("download").addEventListener("click", function () {
    var out = Object.assign({}, ratings, { run: run.run, exportedAt: new Date().toISOString() });
    var blob = new Blob([JSON.stringify(out, null, 1)], { type: "application/json" });
    var a = el("a", { href: URL.createObjectURL(blob), download: "ratings.json" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  document.getElementById("load").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    f.text().then(function (t) {
      var loaded = JSON.parse(t);
      ratings = { run: run.run, directions: loaded.directions || {}, references: loaded.references || {} };
      save(); location.reload();
    }).catch(function () { alert("That file is not a ratings.json from this bench."); });
  });
  progress();
})();
</script>
</body>
</html>
`;
}
