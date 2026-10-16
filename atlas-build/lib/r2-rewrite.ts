/**
 * Shared parts of the R2 rewrite jobs (jobs/r2-rewrite-shaders.ts, jobs/r2-rewrite-motion.ts):
 * the inputs (the r2-taste "rewrite" verdicts with their J13 record), the J13 context each record
 * was written for, and the rewrite prompt.
 */
import { PATHS } from "../config.ts";
import { STYLES } from "../../banana-server/lib/styles/index.ts";
import type { FullVerdict } from "../jobs/r2-taste.ts";
import type { MotionRecipe, ShaderRecipe } from "../schema.ts";
import { atlasInputs, inputContext, LENS_WORDS, type J13Input } from "./j13.ts";
import { readKind } from "./shards.ts";
import type { StyleTag } from "./overlays.ts";

export type RewriteInput<R> = { rec: R; verdict: FullVerdict; j13: J13Input; style: string | null };

/** The J13 input a record was written for, rebuilt from its ties (prepareTies and the prompt context read it). */
export function j13InputOf(rec: { id: string; cardIds: string[]; lensIds: string[] }): J13Input {
  const { cards, lenses } = atlasInputs();
  const byId = new Map(cards.map((c) => [c.id, c]));
  const tied = rec.cardIds.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const lens = rec.lensIds.map((id) => lenses.find((l) => l.id === id)).find(Boolean);
  if (lens) {
    const words = LENS_WORDS[lens.id] ?? [lens.id];
    const related = cards.filter((c) => words.some((w) => w.trim().length > 2 && `${c.name} ${c.culturalNotes ?? ""}`.toLowerCase().includes(w.trim())));
    return { mode: "lens", key: `rw-${rec.id}`, lens, cards: [...new Map([...tied, ...related].map((c) => [c.id, c])).values()].slice(0, 6), count: 1 };
  }
  const kind = tied[0]?.kind ?? "object";
  return { mode: "cards", key: `rw-${rec.id}`, kind, families: [...new Set(tied.map((c) => c.family))], cards: tied, count: 1 };
}

/** The "rewrite" verdicts of one kind with their J13 record and its main style tag. */
export function rewriteInputs<R extends { id: string; cardIds: string[]; lensIds: string[] }>(kind: "shaders" | "motion"): RewriteInput<R>[] {
  const verdicts = readKind<FullVerdict>(PATHS.out, "taste-verdicts").filter((v) => v.kind === kind && v.verdict === "rewrite");
  const recs = new Map(readKind<R>(PATHS.out, kind).map((r) => [r.id, r]));
  let tags = new Map<string, string[]>();
  try {
    tags = new Map(readKind<StyleTag>(PATHS.out, "style-tags").filter((t) => t.kind === kind).map((t) => [t.id, t.styles]));
  } catch {
    // no tags built
  }
  return verdicts
    .filter((v) => recs.has(v.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((v) => {
      const rec = recs.get(v.id)!;
      return { rec, verdict: v, j13: j13InputOf(rec), style: tags.get(v.id)?.[0] ?? null };
    });
}

function styleText(id: string | null): string {
  const s = STYLES.find((x) => x.id === id);
  if (!s) return "No style tag: aim for the taste bar, dark first and restrained.";
  return `Aim for the style ${s.id} (${s.name}): ${s.definition}\nGreat: ${s.great}\nCheap: ${s.cheap}`;
}

/** The rewrite message: the review, the target style, the old record and what it was written for. */
export function rewritePrompt(kind: "ShaderRecipe" | "MotionRecipe", input: RewriteInput<ShaderRecipe | MotionRecipe>, focus: "texture" | "motion"): string {
  const { families: _f, css: _c, styles: _s, ...rest } = input.rec as unknown as Record<string, unknown>;
  const v = input.verdict;
  return `The owner's taste review turned this ${kind} down (score ${v.score} of 5${v.literal ? ", literal: it draws or mimes the object instead of abstracting it" : ""}). Write a new version that would pass: shipped-grade, restrained, abstract. Keep its id "${input.rec.id}" and its ties (cardIds, lensIds, culturalNotes when it has a lens or a tradition card). You may change everything else, including the name and idea. Borrow the grammar of the source (rhythm, repeat, proportion, colour ratio, texture, making process, timing), never a picture or a mime of the object.

What the review found:
${v.problems.map((p) => `- ${p}`).join("\n") || "- (no notes)"}
${v.fix ? `\nThe reviewer's fix: ${v.fix}\n` : ""}
${styleText(input.style)}
Set styles to the style you built for: its id first, at most one more.

The record that was turned down:
\`\`\`json
${JSON.stringify(rest, null, 1)}
\`\`\`

What it was written for:
${inputContext(input.j13, focus)}

Reply with the one new ${kind} object.`;
}
