/**
 * R2 round 1: style tags for Atlas records. Sonnet, batch, text only. Tags every J3 card, J5
 * mechanic, J13 shader and J13 motion recipe with 0 to 2 of the 19 style ids (docs/styles), main
 * style first. Output kind "style-tags" (`{ id, kind, styles }`), kept apart from the records it
 * tags; the runner's overlays (lib/overlays.ts) set `styles` on the records when their own jobs
 * are rebuilt with --from-raw. Recipes take their styles from their card there (no API).
 *
 * Records go to requests by a hash of their id (a fixed number of buckets per kind), so a record
 * added or dropped later never moves the others between requests and --from-raw stays exact.
 *
 *   npx tsx run.ts r2-styles --dry
 *   npx tsx run.ts j3-cards --from-raw     (and j5-mechanics, j5-dedupe, j13-shaders, j13-motion, j7-recipes)
 */
import { z } from "zod";
import { SONNET } from "../config.ts";
import { STYLES } from "../../banana-server/lib/styles/index.ts";
import { STYLE_IDS, isStyleId } from "../../banana-server/lib/styles/ids.ts";
import { defineJob } from "../lib/job.ts";
import { TAGGED_KINDS, type StyleTag, type TaggedKind } from "../lib/overlays.ts";
import { escapeHtml } from "../lib/review.ts";
import { readKind } from "../lib/shards.ts";
import { PATHS } from "../config.ts";
import { extractJson } from "../lib/validate.ts";
import type { IngredientCard, Mechanic, MotionRecipe, ShaderRecipe } from "../schema.ts";

/** Requests per kind. Fixed: changing one moves records between requests (rerun the job). */
export const BUCKETS: Record<TaggedKind, number> = { cards: 20, mechanics: 30, shaders: 4, motion: 4 };

type Input = { kind: TaggedKind; bucket: number; lines: string[]; ids: string[] };

export const StyleTagSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(TAGGED_KINDS),
  styles: z
    .array(z.string().refine((s: string): boolean => isStyleId(s), "styles must be style ids"))
    .max(2)
    .refine((a) => new Set(a).size === a.length, "styles must not repeat"),
});

/** FNV-1a, so buckets never depend on the record order. */
export function bucketOf(id: string, n: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % n;
}

const styleBlock = STYLES.map(
  (s) => `### ${s.id} (${s.name})
${s.definition}
Signals: ${s.signals.join("; ")}
Great: ${s.great}
Cheap: ${s.cheap}
Nearest neighbour ${s.neighbour}: ${s.tellApart}${s.layered ? "\nA layered tag: almost never the main style, add it second when motion is the point." : ""}`,
).join("\n\n");

const SYSTEM = `You tag records of the Banana Atlas, the data behind GoBanana (a tool that bends one app or web page into a wild but buildable design direction), with visual styles. A style is how the finished screen looks: a direction built from the record is skinned in one of these 19 styles, and the tags let the tool pick records that fit the style a user asks for, or spread three directions over different styles when the user asks for none.

The styles (ids, definition, signals, what is great and cheap, and how each differs from its nearest neighbour):

${styleBlock}

How to tag:
- For each record, pick the style a strong, shipped-grade screen built from it most naturally lands in: its main style first. Add a second style only when it clearly also fits (at most 2). Never more.
- Ingredient cards (a material, object, era, tradition, rule, scale or UI element): read the palette (dark or light ground, how many hues), the type voice, texture, imagery, radius and density, not only the name. A risograph zine card is retro-pixel-halftone, a brushed steel card soft-3d-objects or dark-quiet-matte by its palette, a Gulf craft gulf-arabic-first when Arabic type and the tradition lead the screen.
- Mechanics (how one UI element behaves): tag the style the mechanic itself pushes a screen toward (a split flap counter: hero-numeral; a frosted sheet: glass-frosted; a dense sortable table: data-dense-dashboard; a hand drawn underline: illustrative-handmade). A mechanic that works the same in any style gets an empty list: do not guess.
- Shaders and motion recipes: the style the effect belongs to on a shipped screen (a single soft glow on near black: dark-luminous; a halftone dot drift: retro-pixel-halftone; a slow aurora wash: vivid-gradient; caustics on a glassy layer: glass-frosted). motion-first fits a motion recipe only as the second tag, after the style of the screen it moves.
- gulf-arabic-first only when Arabic script or a Gulf tradition leads the screen, not for any record from the region.
- dark-luminous needs one light source (glow, bloom, lit object); dark with no glow is dark-quiet-matte.
- Use only the 19 ids above, spelled exactly.

Reply with JSON only, inside one \`\`\`json fenced block: {"tags": [{"id": "<record id>", "styles": ["<main style id>", "<optional second>"]}]}, one entry for every record in the request, in the same order. Valid ids: ${STYLE_IDS.join(", ")}.`;

const hexes = (p: IngredientCard["palette"]) => p.map((x) => `${x.hex} ${x.role}`).join(", ");

function cardLine(c: IngredientCard): string {
  return `- ${c.id} | ${c.name} | ${c.kind}, ${c.family}${c.region ? `, ${c.region}` : ""}
  idea: ${c.idea}
  palette: ${hexes(c.palette)} | type: ${c.type.voice}, ${c.type.latin.display} / ${c.type.arabic.display} | radius ${c.radius}, ${c.density}
  texture: ${c.texture} | imagery: ${c.imagery} | motion: ${c.motion.verb}`;
}
const mechanicLine = (m: Mechanic) => `- ${m.id} | ${m.element} | ${m.name}: ${m.how}`;
const shaderLine = (s: ShaderRecipe) => `- ${s.id} | ${s.name} | use ${s.use.join(", ")} | colors ${s.colors.join(", ")}\n  ${s.idea}`;
const motionLine = (m: MotionRecipe) => `- ${m.id} | ${m.name} | ${m.trigger}, verb "${m.verb}", use ${m.use.join(", ")}\n  ${m.idea}`;

function inputs(): Input[] {
  const lineOf: Record<TaggedKind, (r: never) => string> = { cards: cardLine, mechanics: mechanicLine, shaders: shaderLine, motion: motionLine } as Record<TaggedKind, (r: never) => string>;
  const out: Input[] = [];
  for (const kind of TAGGED_KINDS) {
    const recs = readKind<{ id: string }>(PATHS.out, kind).sort((a, b) => a.id.localeCompare(b.id));
    for (let b = 0; b < BUCKETS[kind]; b++) {
      const mine = recs.filter((r) => bucketOf(r.id, BUCKETS[kind]) === b);
      if (mine.length === 0) continue;
      out.push({ kind, bucket: b, ids: mine.map((r) => r.id), lines: mine.map((r) => lineOf[kind](r as never)) });
    }
  }
  return out;
}

const KIND_WORD: Record<TaggedKind, string> = { cards: "ingredient cards", mechanics: "mechanics", shaders: "shaders", motion: "motion recipes" };

export default defineJob<Input, StyleTag>({
  id: "r2-styles",
  kind: "style-tags",
  model: SONNET,
  mode: "batch",
  schema: StyleTagSchema as z.ZodType<StyleTag>,
  system: SYSTEM,
  maxTokens: 8000,
  expectedOutputTokens: 2500,
  effort: "low",

  loadInputs: inputs,
  requestId: (input) => `r2s-${input.kind}-${input.bucket}`,
  buildPrompt: (input) => `Tag these ${input.lines.length} ${KIND_WORD[input.kind]}.\n\n${input.lines.join("\n")}`,

  parse: (text) => {
    const v = extractJson(text) as { tags?: unknown[] } | unknown[];
    return Array.isArray(v) ? v : (v.tags ?? []);
  },
  prepare: (raw, input) => (raw && typeof raw === "object" ? { ...(raw as object), kind: input.kind } : raw),
  finalize: (records, ctx) => {
    // Only ids the request carried, once each.
    const known = new Map<string, Set<string>>();
    const seen = new Set<string>();
    const out: StyleTag[] = [];
    for (const r of records) {
      const key = `${r.kind}|${r.id}`;
      if (seen.has(key)) continue;
      if (!known.has(r.kind)) known.set(r.kind, new Set(readKind<{ id: string }>(PATHS.out, r.kind).map((x) => x.id)));
      if (!known.get(r.kind)!.has(r.id)) {
        ctx.log(`  unknown ${r.kind} id dropped: ${r.id}`);
        continue;
      }
      seen.add(key);
      // motion-first is a layered tag (docs/styles): it goes second when the record has a base style.
      out.push(r.styles[0] === "motion-first" && r.styles.length > 1 ? { ...r, styles: [r.styles[1]!, r.styles[0]] } : r);
    }
    for (const kind of TAGGED_KINDS) {
      const mine = out.filter((r) => r.kind === kind);
      const counts = new Map<string, number>();
      for (const r of mine) counts.set(r.styles[0] ?? "(none)", (counts.get(r.styles[0] ?? "(none)") ?? 0) + 1);
      ctx.log(`  ${kind}: ${mine.length} tagged; main styles ${[...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
    }
    return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  },
  shardOf: (rec) => rec.kind,
  renderReview: (rec) => `<p><b>${escapeHtml(rec.kind)} / ${escapeHtml(rec.id)}</b>: ${escapeHtml(rec.styles.join(", ") || "(none)")}</p>`,
});
