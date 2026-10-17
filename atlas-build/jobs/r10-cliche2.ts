/**
 * Refinement R11: a second domain-cliche pass (budget key r10). R10's Sonnet marks (r10-cliche)
 * missed looks the slop check still finds: a luxury stone look on real estate, flat illustration on
 * telecom, a domain's own craft object read as that domain's familiar look. This pass shows the model
 * what the slop check (jobs/r10-slop.ts, Opus, every R10 run) actually called the shipped look of a
 * domain, across every Bench and weak brief, and asks it to mark more of one domain's candidate cards
 * the same way. The evidence covers every domain, so the model learns the pattern (a look the domain
 * already ships, whatever the card) rather than a list of cards.
 *
 * Opus, batch, one request per domain. Input: R10's looks for the domain and the cards they mark,
 * the domain's candidate cards R10 left unmarked (fit 2 or 3, or page fit 2 or 3), and the evidence.
 * Output kind "domain-cliches": its records merge into R10's by domain and look (mergeByKey,
 * lib/refine.ts; card ids of a look R10 already had are joined), so a rebuild runs r10-cliche
 * --from-raw first and this job after it.
 *
 *   npx tsx run.ts r10-cliche2 --dry
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { OPUS, PATHS, ROOT } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import type { DomainCliche } from "../lib/overlays.ts";
import { mergeByKey } from "../lib/refine.ts";
import { escapeHtml } from "../lib/review.ts";
import { readKind } from "../lib/shards.ts";
import { extractJson } from "../lib/validate.ts";
import type { DomainEntry, FitScore, IngredientCard, PageFitScore } from "../schema.ts";
import { DomainClicheSchema } from "./r10-cliche.ts";

type Input = { domain: DomainEntry; ids: string[]; lines: string[]; known: string[] };

/** The R10 runs whose slop checks are the evidence (bench/runs/<run>/slop.json and run.json). */
export const EVIDENCE_RUNS = ["r10-vb0", "r10-vb1", "r10-vw0", "r10-vw1"];
const BENCH_RUNS = join(ROOT, "..", "banana-server", "bench", "runs");

const SYSTEM = `You know what shipped apps and websites look like, domain by domain, from years of App Store screens, Mobbin flows and Dribbble shots. You help GoBanana, a tool that bends one app page into a wild but buildable design direction by leading with an ingredient card (a material, object, era, tradition or UI element). A direction is slop when its lead card is simply the look apps of that domain already ship: the user gets what they would have built anyway.

A first pass already listed each domain's shipped looks and marked some cards. It missed some. A senior designer then read real directions and said which ones were the domain's shipped look and why: that evidence is below, from many domains. Learn the pattern from it, then apply it to this domain:
- A luxury material that a premium domain already uses for its own status (marble, gold, velvet for luxury property, jewelry or hotels) is that domain's look.
- A flat, glossy, gradient or other era style that the domain's apps already share is its look, even when the first pass marked it only in a neighbor domain.
- An object, craft or place that is the domain's own subject or product is its look (a coffee pot, roaster or retro diner sign on a coffee site; a key, door or floor plan on property; a medal on fitness), because the domain's brands already dress in it. A craft from another world that only shares a shape is not.
- A chart, glyph or reward that is the domain's usual way to show its data stays a look in every domain that uses it.
Do not mark a card only because the domain has a task with a similar shape (numbered steps, signing, paying). Judge what the user would see. The same card can be fresh in another domain: only judge this domain. Be strict: mark a card only when you are confident a designer would say "apps in this domain already look like that".

Reply with JSON only, inside one \`\`\`json fenced block: {"looks": [{"look": "<short plain phrase>", "cards": ["<card id>", ...]}]}. Reuse a first-pass look phrase word for word when a card is that look; add a new look phrase otherwise. List only looks that mark at least one card. Use only card ids from the unmarked list. An empty list is a fine answer.`;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);

type Slop = { briefId: string; title: string; slop: number; look: string; reason: string };
type Run = { briefs: Array<{ id: string; brief: string; directions: Array<{ id: string; title: string; twist?: string }> }> };

/** The slop check's reads, one per brief and direction title: slop (4 or more) and fresh (2 or less). */
export function evidence(runs: readonly string[] = EVIDENCE_RUNS): { slop: string[]; fresh: string[] } {
  const seen = new Set<string>();
  const slop: string[] = [];
  const fresh: string[] = [];
  for (const run of runs) {
    const dir = join(BENCH_RUNS, run);
    if (!existsSync(join(dir, "slop.json"))) continue;
    const r = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) as Run;
    const s = JSON.parse(readFileSync(join(dir, "slop.json"), "utf8")) as Record<string, Slop>;
    for (const b of r.briefs) {
      for (const d of b.directions) {
        const v = s[`${b.id}/${d.id}`];
        const k = `${b.id}|${d.title}`;
        if (!v || seen.has(k)) continue;
        seen.add(k);
        const line = `- Brief "${b.brief}": direction "${d.title}"${d.twist ? ` (${d.twist})` : ""}, rated ${v.slop}. Look: ${v.look}. ${clip(v.reason, 220)}`;
        if (v.slop >= 3.5) slop.push(line);
        else if (v.slop <= 2) fresh.push(line);
      }
    }
  }
  return { slop, fresh: fresh.slice(0, 20) };
}

let evidenceCache: { slop: string[]; fresh: string[] } | null = null;
const ev = () => (evidenceCache ??= evidence());

function inputs(): Input[] {
  const domains = readKind<DomainEntry>(PATHS.out, "domains").sort((a, b) => a.id.localeCompare(b.id));
  const cards = new Map(readKind<IngredientCard>(PATHS.out, "cards").map((c) => [c.id, c]));
  const fit = readKind<FitScore>(PATHS.out, "fit");
  const pageFit = readKind<PageFitScore>(PATHS.out, "page-fit");
  // R10's marks only (the r10c2- reply set): data/r10-domain-looks.json, written by r10-cliche.
  const r10 = JSON.parse(readFileSync(join(ROOT, "data", "r10-domain-looks.json"), "utf8")) as Record<string, Array<{ look: string; cards: string[] }>>;
  return domains.map((domain) => {
    const looks = r10[domain.id] ?? [];
    const marked = new Set(looks.flatMap((l) => l.cards));
    const ids = new Set<string>();
    for (const f of fit) if (f.domainId === domain.id && f.score >= 2) ids.add(f.cardId);
    for (const p of pageFit) if (p.domainId === domain.id && p.score >= 2) ids.add(p.cardId);
    const list = [...ids].filter((id) => cards.has(id) && !marked.has(id)).sort();
    const name = (id: string) => cards.get(id)?.name ?? id;
    return {
      domain,
      ids: list,
      known: looks.map((l) => `- ${l.look}${l.cards.length ? `: ${l.cards.map(name).join(", ")}` : ""}`),
      lines: list.map((id) => {
        const c = cards.get(id)!;
        return `- ${c.id} | ${c.name} | ${c.kind}, ${c.family}${c.styles?.[0] ? `, ${c.styles[0]}` : ""} | ${clip(c.idea, 160)}`;
      }),
    };
  });
}

const lookKey = (r: DomainCliche) => `${r.domainId}|${r.look.toLowerCase()}`;

/** R10's records with this pass's added: a look both have joins its card ids. */
export function mergeCliches(base: readonly DomainCliche[], mine: readonly DomainCliche[]): DomainCliche[] {
  const baseBy = new Map(base.map((r) => [lookKey(r), r]));
  const joined = mine.map((r) => {
    const b = baseBy.get(lookKey(r));
    return b ? { ...b, cardIds: [...new Set([...b.cardIds, ...r.cardIds])].sort() } : r;
  });
  return mergeByKey(base, joined, lookKey);
}

export default defineJob<Input, DomainCliche>({
  id: "r10-cliche2",
  kind: "domain-cliches",
  model: OPUS,
  mode: "batch",
  schema: DomainClicheSchema as z.ZodType<DomainCliche>,
  system: SYSTEM,
  maxTokens: 6000,
  expectedOutputTokens: 900,
  effort: "medium",

  loadInputs: inputs,
  requestId: (input) => `r11c-${input.domain.id}`,
  buildPrompt: (input) => {
    const e = ev();
    return `Evidence: directions the senior designer rated as the domain's shipped look (4 or more of 5), from many domains:
${e.slop.join("\n")}

For contrast, directions rated fresh in their domain (2 or less):
${e.fresh.join("\n")}

Domain: ${input.domain.names.en.join(", ")} (${input.domain.id})
Products: ${input.domain.productNouns.join(", ")}
Audience: ${input.domain.audience}

First pass looks for this domain (and the cards it marked):
${input.known.join("\n") || "- (none)"}

Unmarked candidate cards (${input.lines.length}):
${input.lines.join("\n")}`;
  },
  parse: (text, input) => {
    const v = extractJson(text) as { looks?: Array<{ look?: unknown; cards?: unknown }> };
    return (v.looks ?? []).map((l) => ({ domainId: input.domain.id, look: l.look, cardIds: l.cards }));
  },
  prepare: (raw, input) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as { look?: unknown; cardIds?: unknown };
    const known = new Set(input.ids);
    const cardIds = Array.isArray(r.cardIds) ? [...new Set(r.cardIds.filter((id): id is string => typeof id === "string" && known.has(id)))].sort() : [];
    const look = typeof r.look === "string" ? r.look.replace(/\s*\u2014\s*/g, ", ").trim() : r.look;
    return { ...r, look, cardIds };
  },
  finalize: (records, ctx) => {
    const mine = records.filter((r) => r.cardIds.length > 0);
    const added = new Set(mine.flatMap((r) => r.cardIds.map((id) => `${r.domainId}|${id}`)));
    ctx.log(`  second pass: ${added.size} more card and domain pairs in ${new Set(mine.map((r) => r.domainId)).size} domains`);
    if (ctx.dry) return records;
    const base = readKind<DomainCliche>(PATHS.out, "domain-cliches");
    const out = mergeCliches(base, mine).sort((a, b) => a.domainId.localeCompare(b.domainId));
    const byDomain: Record<string, Array<{ look: string; cards: string[] }>> = {};
    for (const r of mine) (byDomain[r.domainId] ??= []).push({ look: r.look, cards: r.cardIds });
    writeFileSync(join(ROOT, "data", "r11-domain-looks.json"), JSON.stringify(byDomain, null, 1) + "\n");
    return out;
  },
  shardOf: (rec) => rec.domainId.charAt(0),
  renderReview: (rec) => `<p><b>${escapeHtml(rec.domainId)}</b>: ${escapeHtml(rec.look)}<br><small>${escapeHtml(rec.cardIds.join(", ") || "(no cards)")}</small></p>`,
});
