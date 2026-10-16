/**
 * Refinement R3, round 2: crop accuracy for cut_parts (J11 follow-up). J11's plain cut_parts
 * instruction scores 0.708 mean IoU against the 200 gold crops (gate 0.8); toolbar, content,
 * status-header and tabbar are the weak roles. This job tries role-specific measuring rules and
 * scores them with a held-out split, so the rules are tuned on dev images only.
 *
 * Images (39, from bench/gold/crops-gold.json) are split once, stratified on whether they hold a
 * weak role: "dev" (20) for iterating, "held" (19) for the ship decision. Each request is one
 * image under one variant, list order and repeat:
 *
 * - plain: today's instruction (J11 "plain", the cut_parts look text). The control.
 * - roles: plain plus ROLE_RULES (the candidate cut_parts look text).
 * - roles-px: roles, but the model answers edges in pixels (left, top, right, bottom) and the job
 *   divides, as the look text asks the agent to do.
 * - list order "grouped" is J11's ("cta x3, hero"); "ordered" lists parts screen by screen in the
 *   gold's order, closer to a real agent that knows which part it wants.
 *
 *   R3_CROP_SET=dev R3_CROP_VARIANTS=plain,roles,roles-px R3_CROP_REPS=2 npx tsx run.ts r3-crops --dry
 *   R3_CROP_SET=held R3_CROP_VARIANTS=plain,roles R3_CROP_REPS=3 npx tsx run.ts r3-crops
 *
 * Every run's replies merge into raw/r3-crops.jsonl, and the report (review/r3-crops-report.md)
 * is rebuilt from all of them: mean IoU per set, variant, order and repeat, and per weak role.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { PART_ROLES, type Crop } from "../../banana-server/lib/stitch/types.ts";
import { IOU_TARGET } from "../../banana-server/lib/stitch/crop-iou.ts";
import { PATHS, SONNET } from "../config.ts";
import { defineJob, placeholderImage } from "../lib/job.ts";
import { fetchImageBlock } from "../lib/thumbs.ts";
import { extractJson } from "../lib/validate.ts";
import { loadGoldImages, matchCrops, partList, PLAIN_SYSTEM, readCrops, type GoldImage } from "./j11-crops.ts";
import { rng, shuffle } from "./r3-judge.ts";

export const WEAK_ROLES = ["toolbar", "content", "status-header", "tabbar"] as const;
export const CROP_VARIANTS = ["plain", "roles", "roles-px"] as const;
export type CropVariant = (typeof CROP_VARIANTS)[number];
export const ORDERS = ["grouped", "ordered"] as const;
export type Order = (typeof ORDERS)[number];
export const SETS = ["dev", "held"] as const;
export type CropSet = (typeof SETS)[number];
export const DEV_SIZE = 20;
const SPLIT_SEED = 3311;

/** The candidate cut_parts measuring rules (tuned on dev images only). */
export const ROLE_RULES = `How to measure:
- Fractions are of the whole image, backdrop included. First find the screen or window the part sits in and its four edges; a part never crosses into another screen.
- Measure each edge in pixels first (the first and last pixel row or column of the part), then divide by the image size. Do not estimate a box from a share of the screen.
- status-header: one phone screen's top bar: from that screen's top edge (the status bar row included) down to the bottom of the row with the title and its buttons. Add a large title only when it sits right under that row. Stop before the first content (search, chips, cards, hero art).
- tabbar: one phone screen's bottom bar of icons and labels: from its top edge (where its background or divider starts) to the screen's bottom edge, the full screen width. Its height is about one icon plus its label, not more.
- toolbar: one row of actions or a header row (back, title, action icons) across its screen or pane: one row high, the full width of that screen or pane.
- content: one block of text (a heading with its paragraphs, an article body): hug the text lines, from the first line's top to the last line's bottom; leave out the buttons and images around it.
- Bars (status-header, tabbar, toolbar, nav, filters) are thin: hug their top and bottom edges and add no padding.
- Every other part hugs its own visible pixels plus about 1% of padding. A cta is the button itself.`;

const PX_ANSWER = `Answer with JSON only: {"parts": [{"role": "<role>", "left": 0, "top": 0, "right": 0, "bottom": 0}, ...]}, edges in whole pixels of the image, one entry for every part asked for, each role as many times as asked. No other text.`;

export type Input = { image: GoldImage; variant: CropVariant; order: Order; rep: number; set: CropSet };

const CropSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) });
export const R3CropSchema = z.object({
  set: z.enum(SETS),
  variant: z.enum(CROP_VARIANTS),
  order: z.enum(ORDERS),
  rep: z.number().int(),
  image: z.string(),
  partId: z.string(),
  role: z.enum(PART_ROLES),
  gold: CropSchema,
  agent: CropSchema.nullable(),
  iou: z.number().min(0).max(1),
});
export type R3Crop = z.infer<typeof R3CropSchema>;

const hasWeak = (img: GoldImage) => img.parts.some((p) => (WEAK_ROLES as readonly string[]).includes(p.role));

/** The split, once and seeded: weak-role images and the rest are each shuffled and dealt so dev gets DEV_SIZE in proportion. */
export function splitImages(images: readonly GoldImage[], devSize = DEV_SIZE): Map<string, CropSet> {
  const rand = rng(SPLIT_SEED);
  const sorted = [...images].sort((a, b) => a.key.localeCompare(b.key));
  const weak = shuffle(sorted.filter(hasWeak), rand);
  const rest = shuffle(sorted.filter((i) => !hasWeak(i)), rand);
  const devWeak = Math.round((weak.length * devSize) / images.length);
  const dev = new Set([...weak.slice(0, devWeak), ...rest.slice(0, devSize - devWeak)].map((i) => i.key));
  return new Map(sorted.map((i) => [i.key, dev.has(i.key) ? "dev" : "held"]));
}

/** Parts asked for: J11's grouped list, or every part in the gold's order (screen by screen). */
export function askList(image: GoldImage, order: Order): string {
  if (order === "grouped") return `Cut these parts: ${partList(image.parts)}.`;
  return `Cut these parts, listed screen by screen (left to right, then top to bottom), in this order: ${image.parts.map((p) => p.role).join(", ")}.`;
}

/** Pixel edges to crop fractions (roles-px replies). */
export function readPxCrops(text: string, width: number, height: number): Array<{ role: string; crop: Crop }> {
  const json = extractJson(text) as { parts?: unknown } | unknown[];
  const list = Array.isArray(json) ? json : (json as { parts?: unknown }).parts;
  if (!Array.isArray(list)) throw new Error("no parts array");
  const out: Array<{ role: string; crop: Crop }> = [];
  for (const p of list as Array<Record<string, unknown>>) {
    const n = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : NaN);
    const [l, t, r, b] = [n("left"), n("top"), n("right"), n("bottom")];
    if (typeof p.role !== "string" || ![l, t, r, b].every(Number.isFinite) || r <= l || b <= t) continue;
    const cx = (v: number) => Math.min(1, Math.max(0, v / width));
    const cy = (v: number) => Math.min(1, Math.max(0, v / height));
    out.push({ role: p.role, crop: { x: cx(l), y: cy(t), w: cx(r) - cx(l), h: cy(b) - cy(t) } });
  }
  return out;
}

export const requestIdOf = (i: Pick<Input, "variant" | "order" | "rep"> & { image: { key: string } }) =>
  `r3c-${i.variant}-${i.order}-r${i.rep}-${i.image.key}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function recordsFor(text: string, input: Input): R3Crop[] {
  const boxes = input.variant === "roles-px" ? readPxCrops(text, input.image.width ?? 1, input.image.height ?? 1) : readCrops(text);
  return matchCrops(input.image.parts, boxes).map((m) => ({
    set: input.set,
    variant: input.variant,
    order: input.order,
    rep: input.rep,
    image: input.image.key,
    partId: m.part.id,
    role: m.part.role,
    gold: m.part.crop,
    agent: m.agent,
    iou: r3(m.iou),
  }));
}

/** Mean IoU tables from every record: one row per set, variant, order and repeat, then the weak roles. */
export function cropsReport(records: readonly R3Crop[], unparsed: readonly string[] = []): string {
  const lines = ["# R3 crops (held-out split)", "", "Mean IoU per gold part (a part with no box scores 0).", "", "| Set | Variant | Order | Repeat | Parts | Mean IoU | At 0.8 or more | toolbar | content | status-header | tabbar |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  const groups = new Map<string, R3Crop[]>();
  for (const r of records) {
    const k = `${r.set}|${r.variant}|${r.order}|${r.rep}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const mean = (xs: readonly R3Crop[]) => (xs.length ? r3(xs.reduce((a, r) => a + r.iou, 0) / xs.length) : NaN);
  for (const [k, rs] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [set, variant, order, rep] = k.split("|");
    const role = (name: string) => {
      const x = rs.filter((r) => r.role === name);
      return x.length ? `${mean(x)} (${x.length})` : "n/a";
    };
    lines.push(`| ${set} | ${variant} | ${order} | ${rep} | ${rs.length} | ${mean(rs)} | ${Math.round((rs.filter((r) => r.iou >= IOU_TARGET).length / rs.length) * 100)}% | ${WEAK_ROLES.map(role).join(" | ")} |`);
  }
  lines.push("", "Means over repeats:", "", "| Set | Variant | Order | Repeats | Mean IoU |", "| --- | --- | --- | --- | --- |");
  const byVar = new Map<string, R3Crop[]>();
  for (const r of records) byVar.set(`${r.set}|${r.variant}|${r.order}`, [...(byVar.get(`${r.set}|${r.variant}|${r.order}`) ?? []), r]);
  for (const [k, rs] of [...byVar].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [set, variant, order] = k.split("|");
    lines.push(`| ${set} | ${variant} | ${order} | ${new Set(rs.map((r) => r.rep)).size} | ${mean(rs)} |`);
  }
  if (unparsed.length) lines.push("", `Replies that did not parse (their parts are missing from the means above): ${unparsed.join(", ")}.`);
  return lines.join("\n") + "\n";
}

let imagesCache: GoldImage[] | null = null;
const goldImages = () => (imagesCache ??= loadGoldImages());

/** Every possible input, for mapping raw reply ids back to their inputs. */
export function allInputs(images: readonly GoldImage[], reps = 5): Input[] {
  const split = splitImages(images);
  const out: Input[] = [];
  for (const image of images) for (const variant of CROP_VARIANTS) for (const order of ORDERS) for (let rep = 1; rep <= reps; rep++) out.push({ image, variant, order, rep, set: split.get(image.key)! });
  return out;
}

/** Rebuilds every record from raw/r3-crops.jsonl (all runs of this job). */
export function recordsFromRaw(rawPath: string, images: readonly GoldImage[]): { records: R3Crop[]; unparsed: string[] } {
  if (!existsSync(rawPath)) return { records: [], unparsed: [] };
  const byId = new Map(allInputs(images).map((i) => [requestIdOf(i), i]));
  const records: R3Crop[] = [];
  const unparsed: string[] = [];
  for (const line of readFileSync(rawPath, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as { id: string; status?: string; text?: string };
    const input = byId.get(r.id);
    if (!input) continue;
    try {
      if (r.status !== "succeeded") throw new Error(r.status);
      records.push(...recordsFor(r.text ?? "", input));
    } catch {
      unparsed.push(r.id);
    }
  }
  return { records, unparsed };
}

export default defineJob<Input, R3Crop>({
  id: "r3-crops",
  kind: "work-crops-r3",
  model: SONNET,
  mode: "batch",
  schema: R3CropSchema,
  system: PLAIN_SYSTEM,
  maxTokens: 8000,
  expectedOutputTokens: 2500,
  imageTokens: 1200,
  effort: "medium",

  loadInputs: (ctx) => {
    const images = goldImages();
    const split = splitImages(images);
    const set = (process.env.R3_CROP_SET ?? "dev") as CropSet;
    if (!SETS.includes(set)) throw new Error(`R3_CROP_SET must be one of ${SETS.join(", ")}`);
    const variants = (process.env.R3_CROP_VARIANTS ?? "plain,roles").split(",").map((v) => v.trim()) as CropVariant[];
    for (const v of variants) if (!CROP_VARIANTS.includes(v)) throw new Error(`unknown variant ${v}`);
    const orders = (process.env.R3_CROP_ORDERS ?? "grouped").split(",").map((v) => v.trim()) as Order[];
    for (const o of orders) if (!ORDERS.includes(o)) throw new Error(`unknown order ${o}`);
    const reps = Number(process.env.R3_CROP_REPS ?? "1");
    const firstRep = Number(process.env.R3_CROP_FIRST_REP ?? "1");
    const picked = images.filter((i) => split.get(i.key) === set);
    ctx.log(`Split: ${[...split.values()].filter((s) => s === "dev").length} dev, ${[...split.values()].filter((s) => s === "held").length} held images. Running ${set}: ${picked.length} images, ${picked.reduce((n, i) => n + i.parts.length, 0)} parts; ${variants.join(", ")}; ${orders.join(", ")}; repeats ${firstRep} to ${firstRep + reps - 1}.`);
    const out: Input[] = [];
    for (let rep = firstRep; rep < firstRep + reps; rep++) for (const variant of variants) for (const order of orders) for (const image of picked) out.push({ image, variant, order, rep, set });
    return out;
  },
  requestId: (input) => requestIdOf(input),
  async buildPrompt(input, ctx) {
    const { image, variant } = input;
    const blocks: Anthropic.ContentBlockParam[] = [];
    if (variant !== "plain") blocks.push({ type: "text", text: `Use these rules for this image:\n\n${ROLE_RULES}${variant === "roles-px" ? `\n\n${PX_ANSWER} (This replaces the answer format in the system prompt.)` : ""}` });
    blocks.push({ type: "text", text: `Image: ${image.width ?? "?"} x ${image.height ?? "?"} px, a ${image.platform ?? "unknown"} reference${image.page ? ` showing a ${image.page} page` : ""}.` });
    if (ctx.dry) blocks.push(placeholderImage());
    else {
      const got = await fetchImageBlock(image.imageUrl);
      if (!got.ok) throw new Error(`image for ${image.key} did not load (${got.reason})`);
      blocks.push(got.block);
    }
    blocks.push({ type: "text", text: askList(image, input.order) });
    return blocks;
  },
  parse: (text, input) => recordsFor(text, input),
  finalize(records, ctx) {
    const all = recordsFromRaw(join(PATHS.raw, "r3-crops.jsonl"), goldImages());
    const report = cropsReport(all.records, all.unparsed);
    mkdirSync(PATHS.review, { recursive: true });
    const file = join(PATHS.review, "r3-crops-report.md");
    writeFileSync(file, report);
    ctx.log(report);
    ctx.log(`Report (every run so far): ${file}`);
    return records;
  },
  shardOf: (r) => `${r.set}-${r.variant}-${r.order}`,
});
