/**
 * Refinement R10: the world each ingredient card comes from, so the twist (second card) can be kept
 * far from its lead. The verifier read Wool Felt with the texture of Badges (embroidered patches) as
 * one idea twice: two textile cards from different families. A card's family says what it is (marks
 * and stamps), not what a designer sees in it (stitched fabric), so the families cannot tell.
 *
 * Sonnet, batch, text only. Every card gets 1 or 2 worlds from CARD_WORLDS, the main one first.
 * Output kind "card-worlds" (`{ id, worlds }`), an overlay (lib/overlays.ts) that sets `worlds` on
 * the cards in the server layout. Cards go to requests by a hash of their id (as in r2-styles), so
 * a card added later never moves the others and --from-raw stays exact.
 *
 *   npx tsx run.ts r10-worlds --dry
 */
import { z } from "zod";
import { PATHS, SONNET } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import type { CardWorlds } from "../lib/overlays.ts";
import { escapeHtml } from "../lib/review.ts";
import { readKind } from "../lib/shards.ts";
import { extractJson } from "../lib/validate.ts";
import type { IngredientCard } from "../schema.ts";
import { bucketOf } from "./r2-styles.ts";

/** The worlds a card can come from: the material or object world a designer sees in the finished screen. */
export const CARD_WORLDS = [
  "textile and stitch",
  "paper and print",
  "ink, paint and hand drawing",
  "wood and woodwork",
  "stone, clay and earth",
  "metal and machines",
  "glass and ceramics",
  "plastic and toys",
  "light, neon and screens",
  "food and drink",
  "plants and gardens",
  "water and sea",
  "sky, weather and space",
  "buildings and architecture",
  "maps, charts and diagrams",
  "signs, tickets and transport",
  "games and play",
  "money, documents and seals",
  "music and sound",
  "body, hands and dress",
  "type and letters",
] as const;
const WORLD_SET: ReadonlySet<string> = new Set(CARD_WORLDS);

/** Requests. Fixed: changing it moves cards between requests (rerun the job). */
export const BUCKETS = 12;

type Input = { bucket: number; ids: string[]; lines: string[] };

export const CardWorldsSchema = z.object({
  id: z.string().min(1),
  worlds: z
    .array(z.string().refine((s) => WORLD_SET.has(s), "worlds must be from CARD_WORLDS"))
    .min(1)
    .max(2)
    .refine((a) => new Set(a).size === a.length, "worlds must not repeat"),
});

const SYSTEM = `You sort the ingredient cards of GoBanana, a tool that bends one app page into a wild but buildable design direction. A direction leads with one card (a material, object, era, tradition or UI element) and can add the texture or the motion of a second card as a twist. The twist must come from a different world than the lead, or the two read as one idea twice: linen with the texture of embroidered patches is two kinds of fabric; a nautical chart with the motion of a blueprint grid is two kinds of drafting line.

For each card, name the world a designer sees in a screen built from it: what its surfaces, objects and marks are made of or belong to. Judge by the texture, the imagery and the idea, not by the family name: a ribbon card drawn as woven ribbon is "textile and stitch" even in a family of marks; a railway departure board is "signs, tickets and transport"; a nebula card is "sky, weather and space"; a skeuomorphic 2012 app look is "light, neon and screens"; a slide rule is "metal and machines".

The worlds (use these strings exactly):
${CARD_WORLDS.map((w) => `- ${w}`).join("\n")}

Give 1 world, or 2 when the card clearly sits in both (a wooden puzzle toy: "wood and woodwork", then "games and play"). Main world first.

Reply with JSON only, inside one \`\`\`json fenced block: {"cards": [{"id": "<card id>", "worlds": ["<main world>", "<optional second>"]}]}, one entry for every card in the request, in the same order.`;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);
const cardLine = (c: IngredientCard) => `- ${c.id} | ${c.name} | ${c.kind}, ${c.family}\n  idea: ${clip(c.idea, 220)}\n  texture: ${clip(c.texture, 200)} | imagery: ${clip(c.imagery, 160)}`;

function inputs(): Input[] {
  const cards = readKind<IngredientCard>(PATHS.out, "cards").sort((a, b) => a.id.localeCompare(b.id));
  const out: Input[] = [];
  for (let b = 0; b < BUCKETS; b++) {
    const mine = cards.filter((c) => bucketOf(c.id, BUCKETS) === b);
    if (mine.length > 0) out.push({ bucket: b, ids: mine.map((c) => c.id), lines: mine.map(cardLine) });
  }
  return out;
}

export default defineJob<Input, CardWorlds>({
  id: "r10-worlds",
  kind: "card-worlds",
  model: SONNET,
  mode: "batch",
  schema: CardWorldsSchema as z.ZodType<CardWorlds>,
  system: SYSTEM,
  maxTokens: 8000,
  expectedOutputTokens: 2500,
  effort: "low",

  loadInputs: inputs,
  requestId: (input) => `r10w-${input.bucket}`,
  buildPrompt: (input) => `Sort these ${input.lines.length} cards.\n\n${input.lines.join("\n")}`,
  parse: (text) => {
    const v = extractJson(text) as { cards?: unknown[] } | unknown[];
    return Array.isArray(v) ? v : (v.cards ?? []);
  },
  prepare: (raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as { worlds?: unknown };
    // A world given twice, or an unknown third one, is trimmed rather than failing the card.
    const worlds = Array.isArray(r.worlds) ? [...new Set(r.worlds.filter((w): w is string => typeof w === "string" && WORLD_SET.has(w)))].slice(0, 2) : r.worlds;
    return { ...(raw as object), worlds };
  },
  finalize: (records, ctx) => {
    const known = new Set(readKind<{ id: string }>(PATHS.out, "cards").map((c) => c.id));
    const seen = new Set<string>();
    const out = records.filter((r) => known.has(r.id) && !seen.has(r.id) && seen.add(r.id)).sort((a, b) => a.id.localeCompare(b.id));
    const counts = new Map<string, number>();
    for (const r of out) counts.set(r.worlds[0]!, (counts.get(r.worlds[0]!) ?? 0) + 1);
    ctx.log(`  card worlds: ${out.length} of ${known.size} cards; main worlds ${[...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
    return out;
  },
  shardOf: (rec) => String(bucketOf(rec.id, 4)),
  renderReview: (rec) => `<p><b>${escapeHtml(rec.id)}</b>: ${escapeHtml(rec.worlds.join(", "))}</p>`,
});
