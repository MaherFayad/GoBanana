/**
 * P1-J11 crop tuning (docs/next-step-plan.md 6.3 and section 8). The model looks at each gold
 * image at the CDN's "cut" size (as cut_parts `look` shows it, banana-server/lib/vision/look.ts)
 * and gives crop fractions for the parts the gold set names there. Each image runs under two
 * prompts: "plain" (today's cut_parts instruction) and "tuned" (measuring rules). The IoU of each
 * against the gold boxes says which prompt the skill should use; the gold boxes themselves give
 * tuned ROLE_BANDS (median box per role on single screens).
 *
 *   npx tsx run.ts j11-crops --dry          # build every prompt (placeholder images), estimate, budget check
 *   npx tsx run.ts j11-crops --limit 4      # a real run on the first 4 requests
 *   npx tsx run.ts j11-crops                # the full run (about 80 requests, Sonnet batch, well under $3)
 *
 * Input: banana-server/bench/gold/*.json files with `parts` (the J11 gold crops; lib/stitch/crop-iou.ts
 * shape plus `imageUrl`, the hotlinked cut size URL the labels were read at). Images are fetched
 * into memory (lib/thumbs.ts fetchImageBlock, allowlisted hosts only) and never written to disk.
 *
 * Output: out/v1/crop-eval/<variant>.json (one record per gold part: the agent box and its IoU;
 * the upload skips this kind) and review/j11-crops-report.md (IoU per prompt and role, the tuned
 * prompt text, suggested ROLE_BANDS).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { evaluateCrops, formatCropReport, iou, IOU_TARGET, parseGold, type GoldPart } from "../../banana-server/lib/stitch/crop-iou.ts";
import { imageLayout, ROLE_BANDS } from "../../banana-server/lib/stitch/crop.ts";
import { PART_ROLES, type Crop } from "../../banana-server/lib/stitch/types.ts";
import { PATHS, ROOT, SONNET } from "../config.ts";
import { defineJob, placeholderImage } from "../lib/job.ts";
import { fetchImageBlock } from "../lib/thumbs.ts";
import { extractJson } from "../lib/validate.ts";

export const GOLD_DIR = join(ROOT, "..", "banana-server", "bench", "gold");
export const VARIANTS = ["plain", "tuned"] as const;
export type Variant = (typeof VARIANTS)[number];

export type GoldImage = {
  key: string;
  imageUrl: string;
  platform?: GoldPart["platform"];
  page?: string;
  width?: number;
  height?: number;
  single?: boolean;
  parts: GoldPart[];
};
export type Input = { image: GoldImage; variant: Variant };

const CropSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) });
export const CropEvalSchema = z.object({
  variant: z.enum(VARIANTS),
  image: z.string(),
  partId: z.string(),
  role: z.enum(PART_ROLES),
  gold: CropSchema,
  agent: CropSchema.nullable(),
  iou: z.number().min(0).max(1),
});
export type CropEval = z.infer<typeof CropEvalSchema>;

/** Gold images from the gold files: parts grouped by their image URL, in file order. */
export function loadGoldImages(dir = GOLD_DIR): GoldImage[] {
  if (!existsSync(dir)) return [];
  const byUrl = new Map<string, GoldImage>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const raw = JSON.parse(readFileSync(join(dir, f), "utf8")) as { parts?: Array<Record<string, unknown>> };
    if (!Array.isArray(raw?.parts)) continue;
    const urls = new Map(raw.parts.map((p) => [String(p.id), typeof p.imageUrl === "string" ? p.imageUrl : ""]));
    const keys = new Map(raw.parts.map((p) => [String(p.id), `${String(p.run ?? "")}-${String(p.refId ?? "")}`]));
    for (const part of parseGold(raw).parts) {
      const url = urls.get(part.id);
      if (!url) continue;
      let img = byUrl.get(url);
      if (!img) {
        img = { key: keys.get(part.id) ?? part.id, imageUrl: url, platform: part.platform, page: part.page, width: part.imageWidth, height: part.imageHeight, single: part.single, parts: [] };
        byUrl.set(url, img);
      }
      img.parts.push(part);
    }
  }
  return [...byUrl.values()];
}

/** "cta x3, hero x2, nav": the parts to find, by role, in first-seen order. */
export function partList(parts: readonly GoldPart[]): string {
  const counts = new Map<string, number>();
  for (const p of parts) counts.set(p.role, (counts.get(p.role) ?? 0) + 1);
  return [...counts].map(([role, n]) => (n > 1 ? `${role} x${n}` : role)).join(", ");
}

const ROLE_HELP = `Part roles: nav (a website's top bar), status-header (a phone screen's top bar with its title), hero (the first big block: headline, art or photo), toolbar (an app's action bar), filters (chips, tabs, segmented controls, a search and filter row), cards, list (stacked rows), detail (one item's details), stats (big numbers), chart, table, form (inputs), cta (one primary button, just the button), tabbar (a phone's bottom bar), sidebar, sheet (a bottom sheet), empty (an empty state), content (a text block), pricing, features, logos, testimonial, faq, footer, gallery, other.`;

const ANSWER = `Answer with JSON only: {"parts": [{"role": "<role>", "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0}, ...]}, one entry for every part asked for, each role as many times as asked. Fractions from 0 to 1 with 3 decimals. No other text.`;

/** Today's cut_parts look instruction (banana-server/lib/vision/look.ts), as the skill sees it. */
export const PLAIN_SYSTEM = `You cut parts out of UI reference images for GoBanana's Frankenstein pages. You get one image and its pixel size, and the parts to cut.

Crop fractions from the image: x = left edge px / width, w = part width px / width, y = top edge px / height, h = part height px / height.

${ROLE_HELP}

${ANSWER}`;

/** The tuned instruction: measuring rules that fix the misses seen in the gold set. */
export const TUNED_SYSTEM = `You cut parts out of UI reference images for GoBanana's Frankenstein pages. You get one image and its pixel size, and the parts to cut.

Crop fractions from the image: x = left edge px / width, w = part width px / width, y = top edge px / height, h = part height px / height.

How to measure:
1. Fractions are of the whole image, background included. Many images are presentations: one to five phones or browser windows on a colored backdrop. First find the frame of each screen (its left, right, top and bottom in fractions), then place each part inside the screen it belongs to. Never stretch a part across two screens.
2. When a role is asked for more than once, each one is a different instance: one per screen, or several in one screen (two cards rows, three buttons). Order does not matter.
3. A part's box hugs the part: from its first to its last visible pixel, plus about 1% of padding. A cta is the button itself, not the bar around it. A status-header or tabbar spans its screen's full width. A nav spans the window's width. A hero runs from under the top bar to the end of its headline, art or photo.
4. Check each box: the left plus width stays inside the screen, and the top plus height stays inside the screen.

${ROLE_HELP}

${ANSWER}`;

export const SYSTEMS: Record<Variant, string> = { plain: PLAIN_SYSTEM, tuned: TUNED_SYSTEM };

export function readCrops(text: string): Array<{ role: string; crop: Crop }> {
  const json = extractJson(text) as { parts?: unknown } | unknown[];
  const list = Array.isArray(json) ? json : (json as { parts?: unknown }).parts;
  if (!Array.isArray(list)) throw new Error("no parts array");
  const out: Array<{ role: string; crop: Crop }> = [];
  for (const p of list as Array<Record<string, unknown>>) {
    const n = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : NaN);
    const crop = { x: n("x"), y: n("y"), w: n("w"), h: n("h") };
    if (typeof p.role !== "string" || Object.values(crop).some((v) => !Number.isFinite(v)) || crop.w <= 0 || crop.h <= 0) continue;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const x = clamp(crop.x);
    const y = clamp(crop.y);
    out.push({ role: p.role, crop: { x, y, w: Math.min(1 - x, clamp(crop.w)), h: Math.min(1 - y, clamp(crop.h)) } });
  }
  return out;
}

/**
 * Pairs each gold part with the agent box of the same role that overlaps it most (greedy, best
 * pairs first). Gold parts left without a box score 0.
 */
export function matchCrops(gold: readonly GoldPart[], agent: ReadonlyArray<{ role: string; crop: Crop }>): Array<{ part: GoldPart; agent: Crop | null; iou: number }> {
  const pairs: Array<{ g: number; a: number; v: number }> = [];
  gold.forEach((p, g) => agent.forEach((b, a) => b.role === p.role && pairs.push({ g, a, v: iou(b.crop, p.crop) })));
  pairs.sort((x, y) => y.v - x.v);
  const usedG = new Set<number>();
  const usedA = new Set<number>();
  const result = gold.map((part) => ({ part, agent: null as Crop | null, iou: 0 }));
  for (const { g, a, v } of pairs) {
    if (usedG.has(g) || usedA.has(a)) continue;
    usedG.add(g);
    usedA.add(a);
    result[g] = { part: gold[g]!, agent: agent[a]!.crop, iou: v };
  }
  return result;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Suggested ROLE_BANDS from the gold set: the median box per role on single-screen images (3 or more parts). */
export function suggestedBands(images: readonly GoldImage[]): Record<string, Crop & { n: number }> {
  const byRole = new Map<string, Crop[]>();
  for (const img of images) {
    if (imageLayout({ imageWidth: img.width, imageHeight: img.height, platform: img.platform, single: img.single }) !== "screen") continue;
    for (const p of img.parts) byRole.set(p.role, [...(byRole.get(p.role) ?? []), p.crop]);
  }
  const out: Record<string, Crop & { n: number }> = {};
  for (const [role, crops] of byRole) {
    if (crops.length < 3) continue;
    const y0 = median(crops.map((c) => c.y));
    const y1 = median(crops.map((c) => c.y + c.h));
    const x0 = median(crops.map((c) => c.x));
    const x1 = median(crops.map((c) => c.x + c.w));
    out[role] = { x: r3(x0), y: r3(y0), w: r3(Math.max(0.02, x1 - x0)), h: r3(Math.max(0.02, y1 - y0)), n: crops.length };
  }
  return out;
}

/** The report: IoU per prompt (crop-iou's own table), per role, the tuned prompt and suggested bands. */
export function cropReport(records: readonly CropEval[], images: readonly GoldImage[]): string {
  const goldById = new Map(images.flatMap((i) => i.parts).map((p) => [p.id, p]));
  const lines = ["# J11 crop tuning", "", `Gold parts: ${goldById.size} on ${images.length} images.`, "", formatCropReport(evaluateCrops([...goldById.values()])), ""];
  const means: Record<string, number> = {};
  for (const variant of VARIANTS) {
    const recs = records.filter((r) => r.variant === variant);
    if (recs.length === 0) continue;
    // A gold part the model gave no box for scores 0.
    const mean = recs.reduce((a, r) => a + r.iou, 0) / recs.length;
    means[variant] = mean;
    lines.push(
      `## Prompt "${variant}"`,
      "",
      `Agent crops: ${r3(mean)} mean IoU, ${Math.round((recs.filter((r) => r.iou >= IOU_TARGET).length / recs.length) * 100)}% at ${IOU_TARGET} or more, ${Math.round((recs.filter((r) => r.iou >= 0.5).length / recs.length) * 100)}% at 0.5 or more (${recs.length} parts; ${recs.filter((r) => !r.agent).length} with no box).`,
      "",
    );
    const roles = new Map<string, number[]>();
    for (const r of recs) roles.set(r.role, [...(roles.get(r.role) ?? []), r.iou]);
    lines.push("| Role | Parts | Agent IoU |", "| --- | --- | --- |");
    for (const [role, v] of [...roles].sort((a, b) => b[1].length - a[1].length)) lines.push(`| ${role} | ${v.length} | ${r3(v.reduce((a, b) => a + b, 0) / v.length)} |`);
    lines.push("");
  }
  const best = Object.entries(means).sort((a, b) => b[1] - a[1])[0]?.[0] as Variant | undefined;
  if (best) lines.push(`Best prompt: "${best}" (mean IoU ${r3(means[best]!)}). Its instruction, for the gobanana-frankenstein skill and the cut_parts look text:`, "", "```", SYSTEMS[best], "```", "");
  const bands = suggestedBands(images);
  lines.push("## Suggested ROLE_BANDS (median gold box per role, single-screen images)", "", "| Role | Gold parts | Suggested | ROLE_BANDS today |", "| --- | --- | --- | --- |");
  for (const [role, b] of Object.entries(bands)) {
    const now = ROLE_BANDS[role as keyof typeof ROLE_BANDS];
    lines.push(`| ${role} | ${b.n} | x ${b.x}, y ${b.y}, w ${b.w}, h ${b.h} | x ${now.x}, y ${now.y}, w ${now.w}, h ${now.h} |`);
  }
  return lines.join("\n") + "\n";
}

let imagesCache: GoldImage[] | null = null;
const goldImages = () => (imagesCache ??= loadGoldImages());

export default defineJob<Input, CropEval>({
  id: "j11-crops",
  kind: "crop-eval",
  model: SONNET,
  mode: "batch",
  schema: CropEvalSchema,
  // The run's system prompt is the plain one; the tuned variant puts its rules at the top of the user turn
  // (run.ts sends one cached system prefix per job).
  system: PLAIN_SYSTEM,
  maxTokens: 8000,
  expectedOutputTokens: 2500,
  effort: "medium",

  loadInputs: (ctx) => {
    const images = goldImages();
    ctx.log(`Gold images: ${images.length}, parts: ${images.reduce((n, i) => n + i.parts.length, 0)}.`);
    if (images.length === 0) throw new Error(`no gold crops in ${GOLD_DIR} (files with a "parts" array)`);
    return VARIANTS.flatMap((variant) => images.map((image) => ({ image, variant })));
  },
  requestId: (input) => `j11-${input.variant}-${input.image.key}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64),
  async buildPrompt(input, ctx) {
    const { image, variant } = input;
    const blocks: Anthropic.ContentBlockParam[] = [];
    if (variant === "tuned") blocks.push({ type: "text", text: `Use these measuring rules for this image (they replace the short instruction in the system prompt):\n\n${TUNED_SYSTEM}` });
    blocks.push({ type: "text", text: `Image: ${image.width ?? "?"} x ${image.height ?? "?"} px, a ${image.platform ?? "unknown"} reference${image.page ? ` showing a ${image.page} page` : ""}.` });
    if (ctx.dry) blocks.push(placeholderImage());
    else {
      const got = await fetchImageBlock(image.imageUrl);
      if (!got.ok) throw new Error(`image for ${image.key} did not load (${got.reason})`);
      blocks.push(got.block);
    }
    blocks.push({ type: "text", text: `Cut these parts: ${partList(image.parts)}.` });
    return blocks;
  },
  parse: (text, input) =>
    matchCrops(input.image.parts, readCrops(text)).map((m) => ({
      variant: input.variant,
      image: input.image.key,
      partId: m.part.id,
      role: m.part.role,
      gold: m.part.crop,
      agent: m.agent,
      iou: r3(m.iou),
    })),
  finalize(records, ctx) {
    const report = cropReport(records, goldImages());
    mkdirSync(PATHS.review, { recursive: true });
    const file = join(PATHS.review, "j11-crops-report.md");
    writeFileSync(file, report);
    ctx.log(report);
    ctx.log(`Report: ${file}`);
    return records;
  },
  shardOf: (r) => r.variant,
});
