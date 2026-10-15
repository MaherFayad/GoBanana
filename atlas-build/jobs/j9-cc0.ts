/**
 * P1-J9 CC0 art index: public domain and CC0 works from the Met, the Art Institute of Chicago and
 * the Cleveland Museum of Art, tagged by the vision judge for what a UI designer can steal.
 *
 *   npx tsx run.ts j9-cc0 --dry
 *   npx tsx run.ts j9-cc0 --limit 5
 *   npx tsx run.ts j9-cc0 --limit <sheets that fit the budget>
 *
 * Harvest (no AI, cached in .cache/j9-pool.json, which is git-ignored): each museum's official
 * open API, read politely (AIC: 1 request a second, under its 60 a minute; Met: about 10 a second, far
 * under its 80 a second; Cleveland: 1 at a time). An item is kept only when the API's own flag says
 * public domain or CC0 (Met isPublicDomain, AIC is_public_domain, Cleveland share_license_status
 * "CC0"), and the flag is kept in the record as `rights`. Only metadata and URLs are stored.
 *
 * Judging: 16 items per request on one contact sheet rendered in headless Chrome from the
 * museums' own image URLs and screenshotted into memory (never written to disk). The pool is
 * ordered by design use (textiles, ornament, posters, prints, maps, architecture drawings,
 * typography), interleaved, so any prefix of sheets is a balanced subset.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JUDGE, ROOT } from "../config.ts";
import { browser } from "../lib/browser.ts";
import { defineJob, placeholderImage, type JobContext } from "../lib/job.ts";
import { escapeHtml } from "../lib/review.ts";
import { CC0ItemSchema, type CC0Item } from "../schema.ts";

type Category = "textiles" | "ornament" | "posters" | "prints" | "maps" | "architecture" | "typography";
const CATEGORIES: Category[] = ["textiles", "ornament", "posters", "prints", "maps", "architecture", "typography"];

type PoolItem = {
  id: string;
  museum: "met" | "aic" | "cleveland";
  category: Category;
  title: string;
  date?: string;
  culture?: string;
  imageUrl: string;
  thumbUrl: string;
  pageUrl: string;
  rights: { flag: string; value: string };
};
type Sheet = { index: number; items: PoolItem[] };

const PER_SHEET = 16;
const COLS = 4;
const TILE = 224;
const POOL_FILE = join(ROOT, ".cache", "j9-pool.json");
const UA = "GoBanana atlas-build (maherfayad55@gmail.com)";

// ---------------------------------------------------------------------------------------------
// Harvest queries per category. Caps are candidates per query (before the public domain filter).

type AicQ = { cat: Category; q?: string; typeIds?: number[]; cap: number };
type CleQ = { cat: Category; q?: string; type?: string; cap: number };
type MetQ = { cat: Category; q: string; dept?: number; cap: number };

const AIC: AicQ[] = [
  { cat: "textiles", q: "pattern", typeIds: [5], cap: 1000 },
  { cat: "textiles", q: "silk", typeIds: [5, 38], cap: 1000 },
  { cat: "textiles", q: "cotton", typeIds: [5, 38], cap: 1000 },
  { cat: "textiles", typeIds: [38], cap: 400 },
  { cat: "ornament", q: "ornament", typeIds: [18, 14, 31], cap: 1000 },
  { cat: "ornament", q: "pattern design", typeIds: [14, 31, 18], cap: 1000 },
  { cat: "ornament", q: "decoration frieze border", typeIds: [14, 31, 18], cap: 1000 },
  { cat: "ornament", q: "tile", typeIds: [36], cap: 400 },
  { cat: "posters", q: "poster", typeIds: [18, 32], cap: 1000 },
  { cat: "posters", q: "lithograph advertisement", typeIds: [18, 32], cap: 1000 },
  { cat: "prints", q: "woodblock", typeIds: [18], cap: 1000 },
  { cat: "prints", q: "Japan", typeIds: [18], cap: 1000 },
  { cat: "maps", q: "map", cap: 600 },
  { cat: "architecture", typeIds: [34], cap: 1000 },
  { cat: "architecture", q: "elevation", typeIds: [34, 14], cap: 1000 },
  { cat: "typography", q: "calligraphy", cap: 600 },
  { cat: "typography", q: "alphabet lettering", typeIds: [18, 11, 32], cap: 600 },
  { cat: "typography", typeIds: [11], cap: 600 },
];
const CLE: CleQ[] = [
  { cat: "textiles", type: "Textile", cap: 1000 },
  { cat: "textiles", type: "Embroidery", cap: 400 },
  { cat: "textiles", type: "Lace", cap: 300 },
  { cat: "ornament", type: "Print", q: "ornament", cap: 600 },
  { cat: "ornament", type: "Print", q: "pattern", cap: 600 },
  { cat: "ornament", type: "Drawing", q: "design", cap: 600 },
  { cat: "ornament", type: "Ceramic", q: "tile", cap: 200 },
  { cat: "posters", q: "poster", cap: 300 },
  { cat: "prints", type: "Print", q: "woodblock", cap: 1000 },
  { cat: "maps", q: "map", cap: 300 },
  { cat: "architecture", type: "Drawing", q: "architectural", cap: 400 },
  { cat: "typography", type: "Manuscript", cap: 800 },
  { cat: "typography", type: "Calligraphy", cap: 41 },
];
const MET: MetQ[] = [
  { cat: "textiles", q: "textile", dept: 14, cap: 1200 },
  { cat: "textiles", q: "textile pattern", dept: 12, cap: 800 },
  { cat: "textiles", q: "textile", dept: 6, cap: 800 },
  { cat: "ornament", q: "ornament", dept: 9, cap: 1500 },
  { cat: "ornament", q: "tile", dept: 14, cap: 600 },
  { cat: "posters", q: "poster", dept: 9, cap: 1000 },
  { cat: "prints", q: "woodblock print", dept: 6, cap: 1000 },
  { cat: "maps", q: "map", dept: 9, cap: 500 },
  { cat: "architecture", q: "architectural drawing", dept: 9, cap: 1000 },
  { cat: "typography", q: "calligraphy", dept: 14, cap: 800 },
  { cat: "typography", q: "calligraphy", dept: 6, cap: 400 },
  { cat: "typography", q: "alphabet", dept: 9, cap: 400 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

async function getJson(url: string, init?: RequestInit, tries = 4): Promise<unknown> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { ...init, headers: { "User-Agent": UA, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(30_000) });
      if (r.status === 403 || r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      if (i + 1 >= tries) throw e;
      await sleep(15_000 * (i + 1)); // back off hard on 403, 429 and 5xx
    }
  }
}

async function harvestAic(log: (l: string) => void): Promise<PoolItem[]> {
  const out: PoolItem[] = [];
  for (const q of AIC) {
    let got = 0;
    // AIC search refuses page x limit past 1,000 results (HTTP 403), so each query stops at page 10.
    for (let page = 1; got < q.cap && page <= 10; page++) {
      const filter: unknown[] = [{ term: { is_public_domain: true } }, { exists: { field: "image_id" } }];
      if (q.typeIds) filter.push({ terms: { artwork_type_id: q.typeIds } });
      const body = { ...(q.q ? { q: q.q } : {}), query: { bool: { filter } }, fields: ["id", "title", "date_display", "place_of_origin", "image_id", "is_public_domain"], limit: 100, page };
      const j = (await getJson("https://api.artic.edu/api/v1/artworks/search", { method: "POST", headers: { "Content-Type": "application/json", "AIC-User-Agent": UA }, body: JSON.stringify(body) })) as { data?: Array<Record<string, unknown>> } | null;
      await sleep(1_100); // AIC: anonymous clients get 60 requests a minute
      const data = j?.data ?? [];
      if (data.length === 0) break;
      for (const d of data) {
        got++;
        const imageId = str(d.image_id);
        if (d.is_public_domain !== true || !imageId) continue; // verified per item from the API flag
        out.push({
          id: `aic-${d.id}`,
          museum: "aic",
          category: q.cat,
          title: str(d.title) ?? "Untitled",
          date: str(d.date_display),
          culture: str(d.place_of_origin),
          imageUrl: `https://www.artic.edu/iiif/2/${imageId}/full/843,/0/default.jpg`,
          thumbUrl: `https://www.artic.edu/iiif/2/${imageId}/full/,${TILE}/0/default.jpg`,
          pageUrl: `https://www.artic.edu/artworks/${d.id}`,
          rights: { flag: "is_public_domain", value: "true" },
        });
      }
    }
    log(`  aic ${q.cat} ${q.q ?? ""} ${q.typeIds?.join("+") ?? ""}: ${out.length} so far`);
  }
  return out;
}

async function harvestCleveland(log: (l: string) => void): Promise<PoolItem[]> {
  const out: PoolItem[] = [];
  for (const q of CLE) {
    const u = new URL("https://openaccess-api.clevelandart.org/api/artworks/");
    u.searchParams.set("cc0", "");
    u.searchParams.set("has_image", "1");
    u.searchParams.set("limit", String(Math.min(q.cap, 1000)));
    u.searchParams.set("fields", "id,title,creation_date,culture,images,url,share_license_status");
    if (q.type) u.searchParams.set("type", q.type);
    if (q.q) u.searchParams.set("q", q.q);
    const j = (await getJson(u.toString())) as { data?: Array<Record<string, unknown>> } | null;
    await sleep(1_000);
    for (const d of j?.data ?? []) {
      const web = str((d.images as { web?: { url?: unknown } } | null)?.web?.url);
      if (d.share_license_status !== "CC0" || !web) continue; // verified per item from the API flag
      const url = str(d.url);
      if (!url?.startsWith("https://")) continue;
      out.push({
        id: `cleveland-${d.id}`,
        museum: "cleveland",
        category: q.cat,
        title: str(d.title) ?? "Untitled",
        date: str(d.creation_date),
        culture: Array.isArray(d.culture) ? str(d.culture[0]) : undefined,
        imageUrl: web,
        thumbUrl: web,
        pageUrl: url,
        rights: { flag: "share_license_status", value: "CC0" },
      });
    }
    log(`  cleveland ${q.cat} ${q.type ?? ""} ${q.q ?? ""}: ${out.length} so far`);
  }
  return out;
}

async function harvestMet(log: (l: string) => void): Promise<PoolItem[]> {
  const out: PoolItem[] = [];
  const seen = new Set<number>();
  for (const q of MET) {
    const u = new URL("https://collectionapi.metmuseum.org/public/collection/v1.1/search");
    u.searchParams.set("q", q.q);
    u.searchParams.set("hasImages", "true");
    if (q.dept) u.searchParams.set("departmentId", String(q.dept));
    u.searchParams.set("offset", "0");
    u.searchParams.set("limit", String(q.cap));
    const j = (await getJson(u.toString())) as { objectIDs?: number[] } | null;
    const ids = (j?.objectIDs ?? []).filter((id) => !seen.has(id)).slice(0, q.cap);
    ids.forEach((id) => seen.add(id));
    let next = 0;
    let fails = 0;
    const worker = async () => {
      while (next < ids.length) {
        const id = ids[next++]!;
        let d: Record<string, unknown> | null = null;
        try {
          d = (await getJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)) as Record<string, unknown> | null;
        } catch {
          d = null;
        }
        if (!d) fails++;
        await sleep(300); // 4 workers, about 10 requests a second, far under the Met's 80
        const small = str(d?.primaryImageSmall);
        const page = str(d?.objectURL);
        if (!d || d.isPublicDomain !== true || !small?.startsWith("https://") || !page?.startsWith("https://")) continue; // verified per item
        out.push({
          id: `met-${id}`,
          museum: "met",
          category: q.cat,
          title: str(d.title) ?? str(d.objectName) ?? "Untitled",
          date: str(d.objectDate),
          culture: str(d.culture) ?? str(d.country),
          imageUrl: small,
          thumbUrl: small,
          pageUrl: page,
          rights: { flag: "isPublicDomain", value: "true" },
        });
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    log(`  met ${q.cat} ${q.q} dept ${q.dept ?? "-"}: ${ids.length} ids, ${fails} failed fetches, ${out.length} kept so far`);
  }
  return out;
}

/** Dedupe, then interleave: category round robin, museums round robin inside each category. */
export function orderPool(items: PoolItem[]): PoolItem[] {
  const seen = new Set<string>();
  const queues = new Map<string, PoolItem[]>();
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    const k = `${it.category}|${it.museum}`;
    if (!queues.has(k)) queues.set(k, []);
    queues.get(k)!.push(it);
  }
  const out: PoolItem[] = [];
  const keys = CATEGORIES.flatMap((c) => (["aic", "met", "cleveland"] as const).map((m) => `${c}|${m}`)).filter((k) => queues.has(k));
  for (let more = true; more; ) {
    more = false;
    for (const k of keys) {
      const it = queues.get(k)!.shift();
      if (it) {
        out.push(it);
        more = true;
      }
    }
  }
  return out;
}

async function loadPool(ctx: JobContext): Promise<PoolItem[]> {
  if (existsSync(POOL_FILE)) return JSON.parse(readFileSync(POOL_FILE, "utf8")) as PoolItem[];
  ctx.log("Harvesting the museum APIs (metadata and URLs only) ...");
  const all = [...(await harvestAic(ctx.log)), ...(await harvestCleveland(ctx.log)), ...(await harvestMet(ctx.log))];
  const pool = orderPool(all);
  mkdirSync(join(ROOT, ".cache"), { recursive: true });
  writeFileSync(POOL_FILE, JSON.stringify(pool));
  return pool;
}

// ---------------------------------------------------------------------------------------------
// Contact sheets, rendered in memory with a few in flight ahead of the runner.

function sheetHtml(s: Sheet): string {
  const tiles = s.items
    .map((it, i) => `<figure><img src="${escapeHtml(it.thumbUrl)}" referrerpolicy="no-referrer"><b>${i + 1}</b></figure>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{background:#fff;width:${COLS * TILE + (COLS + 1) * 6}px;padding:6px;display:grid;grid-template-columns:repeat(${COLS},${TILE}px);gap:6px}
figure{position:relative;width:${TILE}px;height:${TILE}px;background:#e9e9e9;overflow:hidden}
img{width:100%;height:100%;object-fit:contain}
b{position:absolute;top:0;left:0;background:#000;color:#fff;font:700 18px/1 sans-serif;padding:4px 7px}
</style></head><body>${tiles}</body></html>`;
}

async function renderSheet(s: Sheet): Promise<{ jpeg: Buffer; failed: number[] }> {
  const page = await (await browser()).newPage({ viewport: { width: COLS * TILE + (COLS + 1) * 6, height: 100 }, deviceScaleFactor: 1 });
  try {
    await page.setContent(sheetHtml(s), { waitUntil: "load", timeout: 60_000 }).catch(() => undefined);
    const failed = await page.evaluate(() => Array.from(document.images).map((im, i) => (im.complete && im.naturalWidth > 0 ? -1 : i + 1)).filter((n) => n > 0));
    const rows = Math.ceil(s.items.length / COLS);
    const jpeg = await page.screenshot({ type: "jpeg", quality: 80, clip: { x: 0, y: 0, width: COLS * TILE + (COLS + 1) * 6, height: rows * TILE + (rows + 1) * 6 } });
    return { jpeg, failed };
  } finally {
    await page.close();
  }
}

let sheetsAll: Sheet[] = [];
const renders = new Map<number, Promise<{ jpeg: Buffer; failed: number[] }>>();
const AHEAD = 6;
function render(i: number) {
  const s = sheetsAll[i];
  if (!s) return;
  if (!renders.has(i)) renders.set(i, renderSheet(s));
}

const SYSTEM = `You tag public domain museum images for GoBanana, a tool that bends an app or web page into a wild but buildable design direction. Designers use these tags to find art they can borrow from: a border rhythm, a repeat, a palette, a layout.

You get one contact sheet: numbered tiles, each one artwork, and a list with each number's museum metadata. For every number in the list, write exactly one line:

N | steal | motif | region | palette

- steal: 2 or 3 things a UI designer can take from what you see, each 2 to 4 plain words, separated by "; ". Examples: border rhythm, dense repeat grid, framed panels, stepped layering, radial layout, bold lettering scale, two tone palette, generous margins, diagonal movement, hairline detail.
- motif: 1 to 3 concrete motifs, plain nouns, separated by "; ". Examples: palmette, lattice, wave, vine scroll, star polygon, checker, stripes, medallion, figures, landscape, letters, birds, florals, architecture.
- region: one of gulf, mena, persia, central-asia, south-asia, east-asia, southeast-asia, europe, americas, africa, oceania. Use the metadata when it names a place.
- palette: 3 colors you see, most used first, as #rrggbb separated by spaces.

Write "N | skip" when the tile is blank or broken, when there is nothing a designer could borrow (a plain object photo, a faded unreadable fragment), or when it shows sacred or Quranic text, which must never become decoration.

Plain words, no em dashes, no other text before or after the lines.`;

type Line = { n: number; steal: string[]; motif: string[]; region?: string; palette: string[] } | { n: number; skip: true };

const REGIONS = new Set(["gulf", "mena", "persia", "central-asia", "south-asia", "east-asia", "southeast-asia", "europe", "americas", "africa", "oceania"]);

export function parseLines(text: string): Line[] {
  const out: Line[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*(\d+)\s*\|(.*)$/.exec(raw);
    if (!m) continue;
    const n = Number(m[1]);
    const parts = m[2]!.split("|").map((p) => p.trim());
    if (parts[0]?.toLowerCase() === "skip") {
      out.push({ n, skip: true });
      continue;
    }
    const list = (s?: string) => (s ?? "").split(";").map((x) => x.trim().toLowerCase()).filter(Boolean);
    const region = parts[2]?.toLowerCase();
    out.push({
      n,
      steal: list(parts[0]),
      motif: list(parts[1]),
      region: region && REGIONS.has(region) ? region : undefined,
      palette: (parts[3] ?? "").match(/#[0-9a-fA-F]{6}\b/g)?.map((h) => h.toLowerCase()) ?? [],
    });
  }
  return out;
}

export default defineJob<Sheet, CC0Item>({
  id: "j9-cc0",
  kind: "cc0",
  model: JUDGE,
  mode: "batch",
  schema: CC0ItemSchema,
  system: SYSTEM,
  maxTokens: 2000,
  expectedOutputTokens: 700,
  effort: "low",

  loadInputs: async (ctx) => {
    const pool = await loadPool(ctx);
    const counts = new Map<string, number>();
    for (const it of pool) counts.set(`${it.museum} ${it.category}`, (counts.get(`${it.museum} ${it.category}`) ?? 0) + 1);
    ctx.log(`Pool: ${pool.length} public domain or CC0 items. ${[...counts].map(([k, v]) => `${k} ${v}`).join(", ")}`);
    sheetsAll = [];
    for (let i = 0; i < pool.length; i += PER_SHEET) sheetsAll.push({ index: sheetsAll.length, items: pool.slice(i, i + PER_SHEET) });
    return sheetsAll;
  },
  requestId: (s) => `sheet-${s.index}`,
  buildPrompt: async (s, ctx) => {
    const list = (failed: number[]) =>
      s.items
        .map((it, i) => (failed.includes(i + 1) ? null : `${i + 1}. ${[it.title, it.culture, it.date].filter(Boolean).join(" | ").slice(0, 140)}`))
        .filter(Boolean)
        .join("\n");
    if (ctx.dry) return [placeholderImage(), { type: "text", text: list([]) }];
    for (let k = 0; k <= AHEAD; k++) render(s.index + k);
    const r = await renders.get(s.index)!;
    renders.delete(s.index);
    if (r.failed.length) ctx.log(`  sheet ${s.index}: ${r.failed.length} image(s) did not load`);
    return [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: r.jpeg.toString("base64") } },
      { type: "text", text: `Tiles to tag (skip any number not listed):\n${list(r.failed)}` },
    ];
  },

  parse: (text, s) =>
    parseLines(text).flatMap((l) => {
      const it = s.items[l.n - 1];
      if (!it || "skip" in l) return [];
      return [
        {
          id: it.id,
          museum: it.museum,
          title: it.title,
          ...(it.date ? { date: it.date } : {}),
          ...(it.culture ? { culture: it.culture } : {}),
          imageUrl: it.imageUrl,
          pageUrl: it.pageUrl,
          steal: l.steal,
          motif: l.motif,
          ...(l.region ? { region: l.region } : {}),
          ...(l.palette.length ? { paletteHint: l.palette.slice(0, 3) } : {}),
          rights: it.rights,
        },
      ];
    }),
  check: (r) => (r.steal.length === 0 ? ["no steal tags"] : []),
  finalize: (records) => {
    const seen = new Set<string>();
    return records.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  },
  shardOf: (r) => r.museum,
  renderReview: (r) =>
    `<p><a href="${escapeHtml(r.pageUrl)}">${escapeHtml(r.title)}</a> (${escapeHtml(r.museum)}, ${escapeHtml(r.rights.flag)}=${escapeHtml(r.rights.value)}) · <a href="${escapeHtml(r.imageUrl)}">image</a></p>
<p>${escapeHtml([r.culture, r.date, r.region].filter(Boolean).join(" · "))}</p>
<p>steal: ${escapeHtml(r.steal.join(", "))}<br>motif: ${escapeHtml(r.motif.join(", "))}</p>
<p>${(r.paletteHint ?? []).map((h) => `<span class="chip" style="background:${escapeHtml(h)}" title="${escapeHtml(h)}"></span>`).join("")}</p>`,
});
