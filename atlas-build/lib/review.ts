/**
 * Review page (plan 6.1): review/<job>.html shows a random 10% sample (at least 1 record, at most
 * all) plus the reject count, for the owner to approve before upload. The sample is seeded by the
 * job id so a rerun on the same records shows the same sample. Static HTML, no script, and no
 * images: image URLs show as links, never fetched or embedded.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REVIEW_SHARE } from "../config.ts";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Small seeded PRNG (mulberry32) from a string. */
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random `share` of the items (rounded up, at least 1 when there are any), in original order. */
export function sample<T>(items: readonly T[], share = REVIEW_SHARE, seed = "atlas"): T[] {
  if (items.length === 0) return [];
  const n = Math.min(items.length, Math.max(1, Math.ceil(items.length * share)));
  const rand = seeded(seed);
  const idx = items.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, n).sort((a, b) => a - b).map((i) => items[i]!);
}

const SWATCH = /^#[0-9a-fA-F]{6}$/;

/** Default record view: the JSON, with color chips for hex strings. */
export function defaultRender(record: unknown): string {
  const json = escapeHtml(JSON.stringify(record, null, 2));
  const hexes = new Set<string>();
  JSON.stringify(record, (_k, v) => {
    if (typeof v === "string" && SWATCH.test(v)) hexes.add(v.toLowerCase());
    return v;
  });
  const chips = [...hexes].map((h) => `<span class="chip" style="background:${h}" title="${h}"></span>`).join("");
  return `${chips ? `<div class="chips">${chips}</div>` : ""}<pre>${json}</pre>`;
}

export function reviewHtml(opts: {
  job: string;
  kind: string;
  total: number;
  rejects: number;
  sampled: readonly unknown[];
  render?: (record: unknown) => string;
  notes?: string[];
}): string {
  const render = opts.render ?? defaultRender;
  const items = opts.sampled.map((r, i) => `<section><h2>Sample ${i + 1}</h2>${render(r)}</section>`).join("\n");
  const notes = (opts.notes ?? []).map((n) => `<li>${escapeHtml(n)}</li>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas review: ${escapeHtml(opts.job)}</title>
<style>
:root { color-scheme: light dark; --bg: #fafaf7; --fg: #1a1a1a; --muted: #5c5c5c; --line: #d9d9d2; }
@media (prefers-color-scheme: dark) { :root { --bg: #161615; --fg: #f1f1ec; --muted: #b4b4ac; --line: #3a3a36; } }
body { background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; margin: 0 auto; max-inline-size: 60rem; padding: 1.5rem 1rem; }
section { border-block-start: 1px solid var(--line); padding-block: 1rem; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; }
.chips { display: flex; gap: .25rem; flex-wrap: wrap; }
.chip { inline-size: 1.5rem; block-size: 1.5rem; border: 1px solid var(--line); border-radius: 4px; }
p, li { color: var(--muted); }
</style></head><body>
<h1>Atlas review: ${escapeHtml(opts.job)}</h1>
<p>Kind <strong>${escapeHtml(opts.kind)}</strong>. ${opts.total} valid records, ${opts.rejects} rejected (see rejects/${escapeHtml(opts.job)}.jsonl). Showing a random ${opts.sampled.length}.</p>
<p>Owner: read the sample. Approve by running the upload step (README.md). Reject by fixing the prompt and rerunning.</p>
${notes ? `<ul>${notes}</ul>` : ""}
${items}
</body></html>
`;
}

export function writeReview(dir: string, job: string, html: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${job}.html`);
  writeFileSync(path, html);
  return path;
}
