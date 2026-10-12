/**
 * Real examples for the marketing site (lib/site/examples.json), made with the real engine.
 *
 *   npx tsx scripts/make-examples.ts bend                 # print every brief's directions (free, no network)
 *   npx tsx scripts/make-examples.ts search [--cache f]   # run search_references for the picked directions (Serper)
 *   npx tsx scripts/make-examples.ts sheet  [--cache f]   # write a contact sheet HTML of the results, to judge by eye
 *   npx tsx scripts/make-examples.ts write  [--cache f]   # curate, check every URL, write lib/site/examples.json
 *
 * The briefs, the picked directions, the kept references, the steal notes and the Frankenstein
 * crops live in scripts/examples.curation.json (picked by eye from the contact sheet).
 *
 * Same code path as the MCP tools: `bendBrief` (lib/bend) and `createSearchReferencesTool`
 * (lib/mcp/tools/search_references.ts) with the live Serper adapter. The canvas and the database
 * are replaced by in-memory deps, except the takedown list, which is read from the database
 * (DATABASE_URL) and checked again here before anything is written.
 *
 * Hard rules: URLs and metadata only. Images are checked with a 1 KB range GET whose bytes are
 * thrown away; nothing is downloaded or stored. Every kept image host must be on the image host
 * allowlist and no source may be on the takedown list. Serper requests are counted, and the run
 * stops before it would pass --budget (default 120) across runs (the count is kept in the cache).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { bendBrief } from "@/lib/bend";
import type { BendResult, Direction as BendDirection } from "@/lib/bend/types";
import { createSearchReferencesTool, type SearchReferencesOutput } from "@/lib/mcp/tools/search_references";
import { createMemoryUsageStore } from "@/lib/quota";
import { allowlistFromEnv, isAllowedImageUrl } from "@/lib/sources/allowlist";
import type { Reference } from "@/lib/sources/types";
import { createWebSearchAdapter } from "@/lib/sources/web-search";
import { compileTakedowns, type TakedownMatcher } from "@/lib/takedown";
import { isPartRole, type Crop, type PartRole, type PartTheme } from "@/lib/stitch/types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CURATION = join(ROOT, "scripts", "examples.curation.json");
const OUT = join(ROOT, "lib", "site", "examples.json");

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

function devVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name]!.trim();
  const file = join(ROOT, ".dev.vars");
  if (!existsSync(file)) return undefined;
  const m = new RegExp(`^${name}\\s*=\\s*"?([^"\\n\\r]+)"?`, "m").exec(readFileSync(file, "utf8"));
  return m?.[1]?.trim();
}

// ---------------------------------------------------------------------------- curation file

type CuratedRef = { id: string; steal?: string };
type CuratedPart = { ref: string; role: PartRole; crop: Crop; theme?: PartTheme; note?: string };
type CuratedStitch = { title: string; note: string; platform: "mobile" | "tablet" | "website" | "webapp"; rows: { parts: number[]; widths?: number[] }[]; parts: CuratedPart[] };
type CuratedExample = {
  key: string;
  brief: string;
  wildness: 1 | 2 | 3 | 4 | 5;
  lens?: string;
  /** Directions to show (bend count). */
  count: number;
  /** The direction the references were searched for. */
  direction: string;
  ui?: CuratedRef[];
  art?: CuratedRef[];
  stitch?: CuratedStitch;
};
/** sizes: [w, h] of images the search returned without a size, measured in the browser (for crop aspect). */
type Curation = { featured: string; sizes?: Record<string, [number, number]>; examples: CuratedExample[] };

const curation = JSON.parse(readFileSync(CURATION, "utf8")) as Curation;

// ---------------------------------------------------------------------------- cache

type CacheEntry = { bend: BendResult; search: SearchReferencesOutput; requests: number; at: string };
type Cache = { serperRequests: number; examples: Record<string, CacheEntry> };
const cacheFile = arg("cache", join(tmpdir(), "gobanana-examples-cache.json"))!;
const cache: Cache = existsSync(cacheFile) ? (JSON.parse(readFileSync(cacheFile, "utf8")) as Cache) : { serperRequests: 0, examples: {} };
const saveCache = () => writeFileSync(cacheFile, JSON.stringify(cache, null, 1));

function bend(ex: CuratedExample): BendResult {
  return bendBrief({ brief: ex.brief, wildness: ex.wildness, count: ex.count, ...(ex.lens ? { lens: ex.lens } : {}) });
}

// ---------------------------------------------------------------------------- takedowns

async function loadTakedowns(): Promise<TakedownMatcher> {
  const url = devVar("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is needed to check the takedown list");
  const sql = neon(url);
  const rows = (await sql`select url_or_domain from takedowns`) as { url_or_domain: string }[];
  return compileTakedowns(rows.map((r) => r.url_or_domain));
}

// ---------------------------------------------------------------------------- stages

function stageBend() {
  for (const ex of curation.examples) {
    const r = bend(ex);
    console.log(`\n# ${ex.key}: ${ex.brief} (${r.platform}, wildness ${r.wildness}${r.lens ? `, lens ${r.lens.id}` : ""})`);
    for (const d of r.directions) console.log(`  ${d.id === ex.direction ? "*" : " "} ${d.id} ${d.title} | ${d.twist} | art: ${d.artQueries.join(" / ")}`);
  }
}

async function stageSearch() {
  const budget = Number(arg("budget", "120"));
  const only = arg("only");
  const apiKey = devVar("SERPER_API_KEY");
  if (!apiKey) throw new Error("No SERPER_API_KEY");
  const matcher = await loadTakedowns();
  let sent = 0;
  const countingFetch = (input: string, init?: RequestInit) => {
    sent++;
    return fetch(input, init);
  };
  const adapter = createWebSearchAdapter({ apiKey, fetch: countingFetch, loadTakedowns: async () => matcher });
  for (const ex of curation.examples) {
    if (only && ex.key !== only) continue;
    if (cache.examples[ex.key] && !process.argv.includes("--force")) {
      console.log(`${ex.key}: cached, skipped (pass --force to search again)`);
      continue;
    }
    // A direction search sends at most 8 requests (SERPER_MAX_REQUESTS).
    if (cache.serperRequests + 8 > budget) {
      console.log(`Stopping: ${cache.serperRequests} requests used, budget ${budget}.`);
      break;
    }
    const r = bend(ex);
    const d = r.directions.find((x) => x.id === ex.direction);
    if (!d) throw new Error(`${ex.key}: direction ${ex.direction} not in the bend result`);
    const tool = createSearchReferencesTool({
      adapter,
      usage: createMemoryUsageStore(),
      getPlan: async () => "pro_monthly" as const,
      getDirection: async () => ({
        id: d.id,
        bendId: d.id,
        searchQuery: d.searchQuery,
        brief: ex.brief,
        taste: null,
        detail: { platform: d.platform, pages: d.pages, spec: d.spec, artQueries: d.artQueries, twist: d.twist, prompt: d.prompt, wildness: r.wildness },
      }),
      addToTray: async () => true,
      upgradeUrl: () => "https://example.invalid/pricing",
    });
    const before = sent;
    const res = await tool({ directionId: d.id, count: 24 }, "examples-script");
    const out = res.structuredContent as SearchReferencesOutput | undefined;
    const used = sent - before;
    cache.serperRequests += used;
    if (!out) {
      console.log(`${ex.key}: ${res.content[0]?.text}`);
      saveCache();
      continue;
    }
    cache.examples[ex.key] = { bend: r, search: out, requests: used, at: new Date().toISOString() };
    saveCache();
    console.log(`${ex.key}: ${out.zones.ui} ui, ${out.zones.art} art, ${used} requests (total ${cache.serperRequests})`);
  }
}

/** Display URL on the same CDN: a smaller rendition where the CDN offers one, never a proxy. */
export function displayUrl(imageUrl: string, width = 800): string {
  const u = new URL(imageUrl);
  if (u.hostname === "cdn.dribbble.com") {
    u.search = "";
    u.searchParams.set("format", "webp");
    u.searchParams.set("resize", `${width}x`);
    return u.toString();
  }
  if (u.hostname === "mir-s3-cdn-cf.behance.net") {
    return u.toString().replace(/\/project_modules\/[^/]+\//, `/project_modules/${width >= 1000 ? "1400" : "max_1200"}/`);
  }
  // Siteinspire serves through Cloudflare image resizing: ask for the display width.
  if (u.hostname === "r2.siteinspire.com") {
    const h = Math.round((width * 1200) / 1920);
    return u.toString().replace(/width=\d+,height=\d+/, `width=${width},height=${h}`);
  }
  if (u.hostname === "i.pinimg.com") return u.toString().replace(/\/(originals|\d+x)\//, "/736x/");
  return u.toString();
}

function stageSheet() {
  const out = arg("out", join(tmpdir(), "gobanana-examples-sheet.html"))!;
  const parts: string[] = [
    "<!doctype html><meta charset=utf-8><style>body{font:12px system-ui;background:#111;color:#eee;margin:16px}h2{margin:24px 0 8px}.g{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}figure{margin:0;background:#222}img{width:100%;height:180px;object-fit:contain;display:block;background:#000}figcaption{padding:4px;height:44px;overflow:hidden}.art img{height:150px}</style>",
  ];
  for (const ex of curation.examples) {
    const c = cache.examples[ex.key];
    if (!c) continue;
    const d = c.bend.directions.find((x) => x.id === ex.direction)!;
    parts.push(`<h2>${ex.key}: ${d.title}</h2><p>${ex.brief} | ${c.search.queries.join(" ; ")}</p>`);
    for (const zone of ["ui", "art"] as const) {
      const refs = c.search.references.filter((r) => (r.zone ?? "ui") === zone);
      parts.push(`<div class="g ${zone}">`);
      for (const r of refs)
        parts.push(
          `<figure><img referrerpolicy=no-referrer src="${displayUrl(r.imageUrl, 400)}"><figcaption><b>${r.id}</b> ${r.lane ?? ""} ${r.width ?? "?"}x${r.height ?? "?"}<br>${(r.title ?? "").slice(0, 70)}</figcaption></figure>`,
        );
      parts.push("</div>");
    }
  }
  writeFileSync(out, parts.join("\n"));
  console.log(`Wrote ${out}`);
}

// ---------------------------------------------------------------------------- write

/** Status of a 1 KB range GET; the body is cancelled, never kept. */
async function imageOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-1023", "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000) });
    await res.body?.cancel();
    return (res.status === 200 || res.status === 206) && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

const SITE_NAMES: Record<string, string> = {};
/** "dribbble.com" for https://dribbble.com/shots/..., "lapa.ninja" for https://www.lapa.ninja/post/... */
function siteOfUrl(url: string): string {
  const h = new URL(url).hostname.replace(/^www\./, "").replace(/^[a-z]{2}\.pinterest\.com$/, "pinterest.com");
  return SITE_NAMES[h] ?? h;
}

/** Creator from a source title ("X by Y on Dribbble", "X by Y :: Behance"), when it names one. */
function splitTitle(raw: string | undefined): { title: string; creator?: string } {
  let t = (raw ?? "").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
  // Gallery suffixes ("| Web Design Inspiration | Siteinspire", "- Httpster", "UI Breakdown | ScreensDesign Showcase").
  t = t
    .replace(/\s*(::|\|)\s*Behance\s*$/i, "")
    .replace(/\s+on Dribbble\s*$/i, "")
    .replace(/\s*\|\s*Images\s*$/i, "")
    .replace(/\s*\|\s*Web Design Inspiration\s*\|\s*Siteinspire\s*$/i, "")
    .replace(/\s*[—–-]\s*(Httpster|Nicelydone)\s*$/i, "")
    .replace(/\s*(UI Breakdown\s*)?\|\s*ScreensDesign Showcase\s*$/i, "")
    .replace(/\s*\|\s*Community Components\s*\|\s*21st\s*$/i, "")
    .replace(/\s*\|\s*[^|]*$/, (m) => (m.length > 40 ? "" : m))
    .replace(/\s+[–—]\s+/g, ": ")
    .trim();
  const short = (s: string) => (s.length > 64 ? `${s.slice(0, 61).replace(/[\s,:;|-]+\S*$/, "")}...` : s);
  // "Title by Creator for Studio", "Title by Creator - Role", "Title by Studio | Team".
  const m = /^(.*)\s+by\s+(.+)$/i.exec(t);
  if (m) {
    const creator = m[2]!
      .split(/\s+(?:for|on)\s+|\s+[|-]\s+|:\s+|,\s+/)[0]!
      // Latin names only; a name in another script after it is left out ("Name  Name").
      .replace(/[^\p{Script=Latin}\p{N}\s.&'-]/gu, "")
      .trim();
    if (creator && creator.split(" ").length <= 4) return { title: short(m[1]!.replace(/[\s,:;|-]+$/, "").trim()), creator };
  }
  return { title: short(t) };
}

type OutRef = {
  id: string;
  title: string;
  creator?: string;
  site: string;
  href: string;
  src: string;
  w?: number;
  h?: number;
  steal?: string;
};

function toRef(r: Reference, steal: string | undefined, width: number): OutRef {
  const { title, creator } = splitTitle(r.title);
  const size = curation.sizes?.[r.id];
  if (size && !r.width) r = { ...r, width: size[0], height: size[1] };
  return {
    id: r.id,
    title: title || "Untitled",
    ...(creator ? { creator } : {}),
    site: siteOfUrl(r.sourceUrl),
    href: r.sourceUrl,
    src: displayUrl(r.imageUrl, width),
    ...(r.width ? { w: r.width } : {}),
    ...(r.height ? { h: r.height } : {}),
    ...(steal ? { steal } : {}),
  };
}

function directionOut(d: BendDirection) {
  const s = d.spec;
  return {
    id: d.id,
    title: d.title,
    twist: d.twist,
    move: d.move,
    spec: {
      typography: s.typography,
      color: s.color,
      layout: s.layout,
      motion: s.motion,
      texture: s.texture,
      signature: s.signature,
      pattern: s.pattern,
      steal: s.steal,
      avoid: s.avoid,
      whyItFits: s.whyItFits,
    },
  };
}

async function stageWrite() {
  const matcher = await loadTakedowns();
  const allowlist = allowlistFromEnv();
  const problems: string[] = [];
  const examples = [];
  for (const ex of curation.examples) {
    const c = cache.examples[ex.key];
    if (!c) {
      problems.push(`${ex.key}: not searched yet`);
      continue;
    }
    // The bend engine is deterministic: the cached result must match a fresh one.
    const r = bend(ex);
    if (JSON.stringify(r.directions.map((d) => d.id)) !== JSON.stringify(c.bend.directions.map((d) => d.id))) problems.push(`${ex.key}: bend output changed since the search`);
    const byId = new Map(c.search.references.map((x) => [x.id, x]));
    const pick = (list: CuratedRef[] | undefined, zone: "ui" | "art", width: number): OutRef[] =>
      (list ?? []).flatMap((p) => {
        const ref = byId.get(p.id);
        if (!ref) {
          problems.push(`${ex.key}: ${p.id} not in the search results`);
          return [];
        }
        if ((ref.zone ?? "ui") !== zone) problems.push(`${ex.key}: ${p.id} is ${ref.zone}, listed as ${zone}`);
        return [toRef(ref, p.steal, width)];
      });
    const ui = pick(ex.ui, "ui", 800);
    const art = pick(ex.art, "art", 800);
    let stitch = null;
    if (ex.stitch) {
      const parts = ex.stitch.parts.map((p) => {
        if (!isPartRole(p.role)) problems.push(`${ex.key}: bad role ${p.role}`);
        const ref = byId.get(p.ref);
        if (!ref) {
          problems.push(`${ex.key}: stitch part ${p.ref} not in the search results`);
          return null;
        }
        const base = toRef(ref, undefined, 1400);
        return { role: p.role, crop: p.crop, theme: p.theme ?? "unknown", ...(p.note ? { note: p.note } : {}), ref: base };
      });
      stitch = { title: ex.stitch.title, note: ex.stitch.note, platform: ex.stitch.platform, rows: ex.stitch.rows, parts };
    }
    const d = r.directions.find((x) => x.id === ex.direction)!;
    examples.push({
      key: ex.key,
      brief: ex.brief,
      platform: r.platform,
      wildness: r.wildness,
      wildnessLabel: r.wildnessLabel,
      lens: r.lens ? r.lens.name : null,
      direction: directionOut(d),
      others: r.directions.filter((x) => x.id !== d.id).map((x) => ({ id: x.id, title: x.title, twist: x.twist })),
      queries: c.search.queries.length,
      ui,
      art,
      stitch,
    });
  }

  // Every image and source is checked: allowlisted host, not taken down, image answers.
  const all = examples.flatMap((e) => [...e.ui, ...e.art, ...(e.stitch?.parts.flatMap((p) => (p ? [p.ref] : [])) ?? [])]);
  const unique = [...new Map(all.map((x) => [x.src, x])).values()];
  let i = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (i < unique.length) {
        const x = unique[i++]!;
        if (!isAllowedImageUrl(x.src, allowlist)) problems.push(`host not allowlisted: ${x.src}`);
        if (matcher.isBlocked(x.href) || matcher.isBlocked(x.src)) problems.push(`taken down: ${x.href}`);
        if (!(await imageOk(x.src))) problems.push(`image does not answer: ${x.src} (${x.href})`);
      }
    }),
  );
  if (problems.length > 0) {
    console.log(problems.join("\n"));
    if (!process.argv.includes("--allow-problems")) process.exit(1);
  }
  const data = { generatedAt: new Date().toISOString().slice(0, 10), serperRequests: cache.serperRequests, featured: curation.featured, examples };
  writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
  console.log(`Wrote ${OUT}: ${examples.length} examples, ${unique.length} images checked, ${(JSON.stringify(data).length / 1024).toFixed(1)} KB`);
}

const stage = process.argv[2];
const run = { bend: async () => stageBend(), search: stageSearch, sheet: async () => stageSheet(), write: stageWrite }[stage ?? ""];
if (!run) {
  console.log("Usage: npx tsx scripts/make-examples.ts bend|search|sheet|write [--cache file]");
  process.exit(1);
}
run().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
