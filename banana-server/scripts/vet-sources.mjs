#!/usr/bin/env node
/**
 * Vet candidate design galleries for search_references (live Serper image search, no scraping).
 *
 * For each candidate it runs N `"{topic} site:{scope}"` image searches and prints:
 * item-page rate (the result links to one piece of work), unique items, image hosts, the share of
 * big images, sample titles, and a keep or drop verdict. With no item pattern it prints the URL
 * path shapes it saw, so you can write one.
 *
 * Usage:
 *   node scripts/vet-sources.mjs candidates.json [--queries 5] [--max 60]
 *   node scripts/vet-sources.mjs --site lapa.ninja/post --item '^/post/[a-z0-9-]+/?$' --topics "fintech,ai,saas"
 *
 * candidates.json: [{ "id": "lapa", "scope": "lapa.ninja/post", "item": "^/post/[a-z0-9-]+/?$",
 *                     "topics": ["fintech", "ai", "portfolio", "dark", "saas"] }, ...]
 * The key comes from SERPER_API_KEY or banana-server/.dev.vars. Each query costs one credit;
 * --max caps the total. At most 4 requests in flight and 4 per second (Serper allows 5).
 *
 * Verdict (keep needs all): item pages >= 60% of results, unique items >= 15 over the queries,
 * one image host carries >= 70% of item results and is not a shared CDN (or the shared CDN is
 * flagged for an owner decision), big images (>= 600 px or unknown) >= 70%.
 * Add a kept source as one entry in lib/sources/registry.ts with the numbers and the date.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SHARED_CDNS = /(^|\.)(framerusercontent\.com|gumlet\.io|imgix\.net|cloudfront\.net|googleusercontent\.com|website-files\.com|cloudinary\.com|supabase\.co|r2\.dev|amazonaws\.com|wp\.com|squarespace-cdn\.com|shopify\.com|ytimg\.com|vimeocdn\.com)$/i;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

function apiKey() {
  if (process.env.SERPER_API_KEY) return process.env.SERPER_API_KEY.trim();
  const vars = fs.readFileSync(path.join(here, "..", ".dev.vars"), "utf8");
  const m = /^SERPER_API_KEY\s*=\s*"?([^"\n\r]+)"?/m.exec(vars);
  if (!m) throw new Error("No SERPER_API_KEY in env or .dev.vars");
  return m[1].trim();
}

function candidates() {
  const file = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : undefined;
  if (file) return JSON.parse(fs.readFileSync(file, "utf8"));
  const scope = arg("site");
  if (!scope) {
    console.error("Pass a candidates.json file or --site <domain/path>.");
    process.exit(1);
  }
  return [{ id: scope, scope, item: arg("item"), topics: (arg("topics") ?? "website,app,dashboard,landing page,poster").split(",") }];
}

/** "/website/123-foo-bar/" -> "/website/{n}-{slug}/" so path shapes can be compared. */
function shape(p) {
  return p
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      if (/^\d+$/.test(seg)) return "{n}";
      if (/^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(seg)) return "{uuid}";
      if (/^\d+-/.test(seg)) return "{n}-{slug}";
      if (/^[a-z0-9]{20,}$/i.test(seg)) return "{id}";
      if (/-/.test(seg)) return "{slug}";
      return seg;
    })
    .join("/");
}

async function main() {
  const key = apiKey();
  const perSite = Number(arg("queries", "5"));
  const max = Number(arg("max", "60"));
  const list = candidates();
  const jobs = list.flatMap((c) => (c.topics ?? []).slice(0, perSite).map((t) => ({ c, q: `${t} site:${c.scope}` })));
  if (jobs.length > max) {
    console.error(`${jobs.length} queries planned, over --max ${max}. Raise --max or trim the list.`);
    process.exit(1);
  }
  const results = [];
  for (let i = 0; i < jobs.length; i += 4) {
    const batch = jobs.slice(i, i + 4);
    results.push(
      ...(await Promise.all(
        batch.map(async (j) => {
          const res = await fetch("https://google.serper.dev/images", {
            method: "POST",
            headers: { "X-API-KEY": key, "Content-Type": "application/json" },
            body: JSON.stringify({ q: j.q, num: 10 }),
          });
          const json = res.status === 200 ? await res.json() : null;
          return { ...j, status: res.status, images: json?.images ?? [] };
        }),
      )),
    );
    await new Promise((r) => setTimeout(r, 1000));
  }

  const rows = [];
  for (const c of list) {
    const rs = results.filter((r) => r.c === c);
    const domain = c.scope.split("/")[0].replace(/^www\./, "");
    const itemRe = c.item ? new RegExp(c.item, "i") : null;
    let total = 0;
    let items = 0;
    let big = 0;
    const hosts = {};
    const shapes = {};
    const unique = new Set();
    const samples = [];
    for (const r of rs) {
      for (const im of r.images) {
        total++;
        let u;
        try {
          u = new URL(im.link);
        } catch {
          continue;
        }
        const onSite = u.hostname.replace(/^www\./, "") === domain || u.hostname.endsWith(`.${domain}`);
        shapes[shape(u.pathname)] = (shapes[shape(u.pathname)] ?? 0) + 1;
        if (!onSite || (itemRe && !itemRe.test(u.pathname))) continue;
        items++;
        let h = "";
        try {
          h = new URL(im.imageUrl).hostname;
        } catch {
          // no image URL
        }
        hosts[h] = (hosts[h] ?? 0) + 1;
        const side = Math.max(Number(im.imageWidth) || 0, Number(im.imageHeight) || 0);
        if (!side || side >= 600) big++;
        if (!unique.has(u.pathname)) {
          unique.add(u.pathname);
          if (samples.length < 4) samples.push(`${String(im.title ?? "").slice(0, 60)} | ${u.pathname.slice(0, 60)}`);
        }
      }
    }
    const [topHost, topCount] = Object.entries(hosts).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    const itemRate = total ? items / total : 0;
    const hostShare = items ? topCount / items : 0;
    const bigShare = items ? big / items : 0;
    const shared = SHARED_CDNS.test(topHost);
    const reasons = [];
    if (!itemRe) reasons.push("no item pattern yet");
    if (itemRate < 0.6) reasons.push(`item pages ${Math.round(itemRate * 100)}%`);
    if (unique.size < 15) reasons.push(`${unique.size} unique items`);
    if (hostShare < 0.7) reasons.push("no main image host");
    if (bigShare < 0.7) reasons.push("small images");
    const verdict = reasons.length === 0 ? (shared ? "keep (shared CDN host: owner decision)" : "keep") : `drop (${reasons.join(", ")})`;
    rows.push({ id: c.id, total, items, unique: unique.size, topHost, hostShare, bigShare, verdict });
    console.log(`\n## ${c.id}  (${c.scope})`);
    console.log(`   results ${total}, item pages ${items} (${Math.round(itemRate * 100)}%), unique ${unique.size}, big ${Math.round(bigShare * 100)}%`);
    console.log(`   statuses ${rs.map((r) => `${r.status}:${r.images.length}`).join(" ")}`);
    console.log(`   image hosts ${JSON.stringify(hosts)}`);
    if (!itemRe) console.log(`   path shapes ${JSON.stringify(Object.entries(shapes).sort((a, b) => b[1] - a[1]).slice(0, 6))}`);
    for (const s of samples) console.log(`   - ${s}`);
    console.log(`   verdict: ${verdict}`);
  }
  console.log(`\n${jobs.length} Serper requests sent.`);
  console.log("\n| id | results | item pages | unique | main host | verdict |\n| --- | --- | --- | --- | --- | --- |");
  for (const r of rows) console.log(`| ${r.id} | ${r.total} | ${r.items} | ${r.unique} | ${r.topHost} (${Math.round(r.hostShare * 100)}%) | ${r.verdict} |`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "failed");
  process.exit(1);
});
