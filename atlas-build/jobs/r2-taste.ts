/**
 * R2 round 2: the taste pass on the J13 stunning layer. Opus, batch, vision. One request per
 * shader and motion recipe: its frame strip from the J13 render check (review/j13-shaders/<id>.png,
 * review/j13-motion/<id>.png; rebuild them with `npx tsx run.ts j13-shaders --from-raw` and
 * j13-motion), its idea, its ties and its style tags (r2-styles), judged against the owner's taste
 * bar (docs/taste-bar.md) and the style it is tagged with (docs/styles).
 *
 * Output kind "taste-verdicts": `{ id, kind, verdict, score, styleFit, literal, problems, fix }`.
 * "drop" leaves the record out of the server layout; "rewrite" leaves it out unless
 * r2-rewrite-shaders or r2-rewrite-motion writes a replacement that passes the render check
 * (lib/overlays.ts). Inputs are the J13 outputs as built, so a rebuild never changes them.
 *
 *   npx tsx run.ts r2-taste --dry
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { JUDGE, PATHS } from "../config.ts";
import { STYLES } from "../../banana-server/lib/styles/index.ts";
import { atlasInputs } from "../lib/j13.ts";
import { defineJob, placeholderImage } from "../lib/job.ts";
import { escapeHtml } from "../lib/review.ts";
import { readKind } from "../lib/shards.ts";
import { extractJson } from "../lib/validate.ts";
import type { MotionRecipe, ShaderRecipe } from "../schema.ts";
import type { StyleTag } from "../lib/overlays.ts";

type Kind = "shaders" | "motion";
type Input = { kind: Kind; rec: ShaderRecipe | MotionRecipe; styles: string[] };

const score = z.number().int().min(1).max(5);
export const TasteVerdictSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["shaders", "motion"]),
  /** The applied verdict (verdictOf): keep at 3 or more unless literal; rewrite or drop as the judge advises otherwise. */
  verdict: z.enum(["keep", "rewrite", "drop"]),
  /** The judge's own recommendation. */
  advice: z.enum(["keep", "rewrite", "drop"]),
  score,
  styleFit: score,
  literal: z.boolean(),
  problems: z.array(z.string()),
  fix: z.string().optional(),
});
export type FullVerdict = z.infer<typeof TasteVerdictSchema>;

/**
 * The verdict the overlays apply, from the judge's score, literal flag and advice: literal records
 * are rewritten (or dropped when the judge says nothing is worth keeping); at score 3 or more the
 * record stays; under 3 the judge's advice holds (a "keep" under 3 becomes "rewrite").
 */
export function verdictOf(v: { advice: "keep" | "rewrite" | "drop"; score: number; literal: boolean }): "keep" | "rewrite" | "drop" {
  if (v.literal) return v.advice === "drop" ? "drop" : "rewrite";
  if (v.score >= 3) return "keep";
  return v.advice === "keep" ? "rewrite" : v.advice;
}

const styleBlock = STYLES.map((s) => `- ${s.id}: ${s.definition} Great: ${s.great} Cheap: ${s.cheap}`).join("\n");

const SYSTEM = `You are the taste judge for GoBanana's stunning layer: GLSL shaders and UI motion recipes a developer drops into a shipped product screen (a hero band, a loading or success moment, an empty state, a paywall plan card, a list that arrives). Each one carries the idea of an ingredient card (a material, era, object, tradition, scale or rule) or a cultural lens. You judge one record at a time from its rendered frames and its data, against the owner's taste bar and the style it is tagged with.

The owner's taste bar (docs/taste-bar.md, the owner's own Pinterest boards of shipped product UI):
- Shipped-grade craft, not concept shots or demo-scene art. It must sit behind or beside real UI and make the screen feel made, not busy.
- Dark first, restrained colour: near-black or calm surfaces, one accent used as a focal point, luminous glow or gradient only as a single focus.
- Texture as a second voice: halftone, dot grids, grain, fine lines, woven or stacked bands. Never a loud full-frame wash behind text.
- Motion is purposeful, quick and physical for UI motion; slow and calm for backgrounds. Custom curves, not the default ease. Never flashing, never performing for its own sake.
- Fails the bar: rainbow plasma, neon overload, kaleidoscopes, tunnels, lava lamps, screensaver looks, generic purple and blue blobs, busy noise everywhere, spinning logos, endless bouncing, confetti cliches, everything flying in from every side, long reveals that block the user.

Literal is cheap. The stunning layer abstracts its source: the rhythm, repeat, proportion, colour ratio, texture or making process of the card or lens. It never draws a picture of the thing. A shader that draws literal gears for a watch card, a clip-art sun, a cartoon flame, a coin, a building, a camel, a lantern, letters or letter-like glyphs is literal and fails, however well it is drawn. A motion recipe is literal when it mimes the object as a gimmick (a box lid that flips open on every card, a page curl on every row) instead of borrowing its timing and feel. Abstract grammar (bands that settle like strata, a stepped intermittent advance borrowed from a Geneva drive, a halftone screen that breathes) passes.

The styles (docs/styles/INDEX.md), with what is great and cheap in each:
${styleBlock}

How to judge:
- Shader frames: a strip of frames from a 320 by 180 render at different times (and the reduced-motion frame). Judge the composition, colour restraint, craft, whether it leaves calm space for text and controls, and whether it could sit behind real UI on the owner's boards.
- Motion frames: a strip of 4 frames (2%, 35%, 65%, 98% of the run) of a test harness: a stock demo card (an orange to yellow gradient with a white border) or five list rows on a dark stage. The demo card, its colours and the stage are the harness, not part of the recipe: never judge them. The frames only show positions; judge the motion from the keyframes, curves and timing given in the request: is it purposeful, physical, quick enough, and does it borrow the card's verb without miming the object? A motion recipe has no colours of its own, so judge its style fit by its character (calm, crisp, playful, heavy) only.
- score: 1 to 5 against the taste bar. 5 could ship on a top product today; 3 is decent but generic; 1 to 2 is cheap.
- styleFit: 1 to 5, how well it delivers the great version of its main style tag (3 when it has no tag).
- literal: true when it draws or mimes the object itself (see above).
- verdict: "keep" at score 4 or 5 with literal false; "rewrite" when the source idea is worth having but the execution is cheap, generic, literal or off style (most literal ones: the grammar behind the object is usually worth keeping); "drop" when nothing about it is worth keeping or it duplicates a common cliche with no idea of its own. Be strict: the owner wants fewer, better records.
- problems: 1 to 4 short, concrete lines on what is cheap or wrong (empty for a clean keep).
- fix: for "rewrite", one or two sentences a shader or motion author can act on: what to abstract from the source, which technique or curve, what to remove, and which style to aim for. Empty otherwise.

Reply with JSON only, inside one \`\`\`json fenced block: {"id": "...", "verdict": "keep" | "rewrite" | "drop", "score": 1-5, "styleFit": 1-5, "literal": true | false, "problems": ["..."], "fix": "..."}. Plain words, no em dashes.`;

function inputs(): Input[] {
  const tags = new Map<string, string[]>();
  try {
    for (const t of readKind<StyleTag>(PATHS.out, "style-tags")) tags.set(`${t.kind}|${t.id}`, t.styles);
  } catch {
    // r2-styles not built: judge without tags.
  }
  const out: Input[] = [];
  for (const kind of ["shaders", "motion"] as const) {
    for (const rec of readKind<ShaderRecipe | MotionRecipe>(PATHS.out, kind).sort((a, b) => a.id.localeCompare(b.id))) {
      out.push({ kind, rec, styles: tags.get(`${kind}|${rec.id}`) ?? [] });
    }
  }
  return out;
}

const stripPath = (input: Input) => join(PATHS.review, input.kind === "shaders" ? "j13-shaders" : "j13-motion", `${input.rec.id}.png`);

function ties(rec: ShaderRecipe | MotionRecipe): string {
  const { cards, lenses } = atlasInputs();
  const byId = new Map(cards.map((c) => [c.id, c]));
  const cardText = rec.cardIds.map((id) => byId.get(id)).filter(Boolean).map((c) => `${c!.name} (${c!.kind}, ${c!.family}): ${c!.idea}`);
  const lensText = rec.lensIds.map((id) => lenses.find((l) => l.id === id)).filter(Boolean).map((l) => `lens ${l!.name}: ${l!.rhythm}`);
  return [...cardText, ...lensText].join("\n") || "none";
}

function describe(input: Input): string {
  const r = input.rec;
  const head = `Record id: ${r.id} (${input.kind === "shaders" ? "shader" : "motion recipe"})
Name: ${r.name}
Idea: ${r.idea}
Use: ${r.use.join(", ")}
Style tags: ${input.styles.join(", ") || "none"}
Written for:
${ties(r)}`;
  if (input.kind === "shaders") {
    const s = r as ShaderRecipe;
    return `${head}
Default colors (surface, ink, accent, support): ${s.colors.join(", ")}
Reduced motion: ${s.reduced.kind} at ${s.reduced.at}s: ${s.reduced.note}`;
  }
  const m = r as MotionRecipe;
  return `${head}
Verb: ${m.verb}. Trigger: ${m.trigger}. Target: ${m.target}${m.stagger ? `, stagger ${m.stagger} ms` : ""}. Origin: ${m.origin}.
Timing: ${JSON.stringify(m.timing)}
Keyframes: ${JSON.stringify(m.keyframes)}
Reduced motion: ${m.reduced.kind}: ${m.reduced.note}`;
}

export default defineJob<Input, FullVerdict>({
  id: "r2-taste",
  kind: "taste-verdicts",
  model: JUDGE,
  mode: "batch",
  schema: TasteVerdictSchema,
  system: SYSTEM,
  maxTokens: 6000,
  expectedOutputTokens: 1200,
  effort: "medium",
  imageTokens: 400,

  loadInputs: inputs,
  requestId: (input) => `t${input.kind === "shaders" ? "s" : "m"}-${input.rec.id}`.slice(0, 64),
  buildPrompt: (input, ctx) => {
    let image: Anthropic.ImageBlockParam;
    if (ctx.dry) image = placeholderImage();
    else {
      const file = stripPath(input);
      if (!existsSync(file)) throw new Error(`no frame strip at ${file}: rebuild j13-${input.kind === "shaders" ? "shaders" : "motion"} with --from-raw first`);
      image = { type: "image", source: { type: "base64", media_type: "image/png", data: readFileSync(file).toString("base64") } };
    }
    return [image, { type: "text", text: `${describe(input)}\n\nJudge this record.` }];
  },
  parse: (text) => [extractJson(text)],
  prepare: (raw, input) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as { verdict?: unknown; score?: unknown; literal?: unknown };
    const advice = r.verdict;
    const applied = typeof r.score === "number" && typeof r.literal === "boolean" && (advice === "keep" || advice === "rewrite" || advice === "drop") ? verdictOf({ advice, score: r.score, literal: r.literal }) : advice;
    return { ...r, id: input.rec.id, kind: input.kind, advice, verdict: applied };
  },
  finalize: (records, ctx) => {
    for (const kind of ["shaders", "motion"] as const) {
      const mine = records.filter((r) => r.kind === kind);
      const n = (v: string) => mine.filter((r) => r.verdict === v).length;
      ctx.log(`  ${kind}: ${mine.length} judged, keep ${n("keep")}, rewrite ${n("rewrite")}, drop ${n("drop")}, literal ${mine.filter((r) => r.literal).length}, mean score ${(mine.reduce((s, r) => s + r.score, 0) / Math.max(1, mine.length)).toFixed(2)}`);
    }
    return records.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  },
  shardOf: (r) => r.kind,
  renderReview: (v) => `<h3>${escapeHtml(v.id)} <small>${escapeHtml(v.kind)}: ${escapeHtml(v.verdict)}, score ${v.score}, style ${v.styleFit}${v.literal ? ", literal" : ""}</small></h3>
<p><img alt="${escapeHtml(v.id)} frames" style="max-width:100%" src="${v.kind === "shaders" ? "j13-shaders" : "j13-motion"}/${escapeHtml(v.id)}.png"></p>
<ul>${v.problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>${v.advice !== v.verdict ? `<p>Judge advised ${escapeHtml(v.advice)}.</p>` : ""}${v.fix ? `<p><b>Fix:</b> ${escapeHtml(v.fix)}</p>` : ""}`,
});
