/**
 * Refinement R6, task A: crop accuracy for cut_parts (J11 follow-up of R3 and R4). R4 measured
 * 0.732 held-out mean IoU with each part named with its screen (gate 0.8). This job tests screens
 * found in code (lib/screens.ts, no model) as a hint in the look:
 *
 * - control: today's look text, each part named with its screen as R4 counted them (from the gold
 *   parts' columns), the R4 "screens" list. The baseline.
 * - segnum: the same text, but screens counted from the boxes found in code where the finder
 *   answers (a part outside every box is listed without a screen), else as control. Separates the
 *   numbering from the hint.
 * - seg: segnum plus the look line the server would add, listing each found screen's edges.
 *
 * The images and split are R3's (bench/gold/crops-gold.json, 20 dev images for tuning, 19 held
 * out). Webp images do not decode on the server (lib/palette/decode.ts), so they get no hint there
 * either: the job decodes with the same code.
 *
 *   R6_CROP_SET=dev R6_CROP_VARIANTS=control,segnum,seg R6_CROP_REPS=2 npx tsx run.ts r6-crops --dry
 *
 * Result (2 repeats each): dev control 0.769, segnum 0.764, seg 0.769; held control 0.746, seg 0.734.
 * The hint does not ship.
 *
 * Replies merge into raw/r6-crops.jsonl; review/r6-crops-report.md is rebuilt from all of them.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { decodeImage } from "../../banana-server/lib/palette/decode.ts";
import { IOU_TARGET } from "../../banana-server/lib/stitch/crop-iou.ts";
import { PART_ROLES } from "../../banana-server/lib/stitch/types.ts";
import { detectScreens, screensLine, type ScreenBox } from "../lib/screens.ts";
import { PATHS, SONNET } from "../config.ts";
import { defineJob, placeholderImage } from "../lib/job.ts";
import { fetchImageBlock } from "../lib/thumbs.ts";
import { loadGoldImages, matchCrops, partList, PLAIN_SYSTEM, readCrops, type GoldImage } from "./j11-crops.ts";
import { askList, splitImages, WEAK_ROLES, type CropSet } from "./r3-crops.ts";

export const R6_VARIANTS = ["control", "segnum", "seg"] as const;
export type R6Variant = (typeof R6_VARIANTS)[number];
const SETS = ["dev", "held"] as const;

export type Input = { image: GoldImage; variant: R6Variant; rep: number; set: CropSet };

const CropSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) });
export const R6CropSchema = z.object({
  set: z.enum(SETS),
  variant: z.enum(R6_VARIANTS),
  rep: z.number().int(),
  image: z.string(),
  hinted: z.boolean(),
  partId: z.string(),
  role: z.enum(PART_ROLES),
  gold: CropSchema,
  agent: CropSchema.nullable(),
  iou: z.number().min(0).max(1),
});
export type R6Crop = z.infer<typeof R6CropSchema>;

/** The found screen each part's center sits in (-1 for none). */
export function partScreens(image: GoldImage, boxes: readonly ScreenBox[]): number[] {
  return image.parts.map((p) => {
    const cx = p.crop.x + p.crop.w / 2;
    const cy = p.crop.y + p.crop.h / 2;
    return boxes.findIndex((b) => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h);
  });
}

/** The ask line with screens counted from the found boxes; R4's list when nothing was found. */
export function segAskList(image: GoldImage, boxes: readonly ScreenBox[]): string {
  if (boxes.length === 0) return askList(image, "screens");
  if (boxes.length === 1) return `Cut these parts: ${partList(image.parts)}.`;
  const at = partScreens(image, boxes);
  const groups = boxes.map((_, k) => image.parts.filter((_, i) => at[i] === k)).map((g, k) => (g.length ? `screen ${k + 1} of ${boxes.length}: ${partList(g)}` : "")).filter(Boolean);
  const loose = image.parts.filter((_, i) => at[i] === -1);
  return `Cut these parts. The image shows ${boxes.length} screens; each part is named with the screen it sits on, counted from the left: ${groups.join("; ")}${loose.length ? `; elsewhere on the image: ${partList(loose)}` : ""}.`;
}

export const requestIdOf = (i: { variant: R6Variant; rep: number; image: { key: string } }) => `r6c-${i.variant}-r${i.rep}-${i.image.key}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Boxes per image key, filled when a prompt is built (and by recordsFromRaw from the hint flag). */
const boxesByKey = new Map<string, ScreenBox[]>();

export async function screensFor(image: GoldImage, block?: Anthropic.ImageBlockParam): Promise<ScreenBox[]> {
  const known = boxesByKey.get(image.key);
  if (known) return known;
  let img = block;
  if (!img) {
    const got = await fetchImageBlock(image.imageUrl);
    if (!got.ok) throw new Error(`image for ${image.key} did not load (${got.reason})`);
    img = got.block;
  }
  const src = img.source as { type: string; data?: string };
  const bytes = new Uint8Array(Buffer.from(src.data ?? "", "base64"));
  const d = decodeImage(bytes);
  const boxes = d.ok ? detectScreens(d.rgba, d.width, d.height) : [];
  boxesByKey.set(image.key, boxes);
  return boxes;
}

export function recordsFor(text: string, input: Input, hinted: boolean): R6Crop[] {
  return matchCrops(input.image.parts, readCrops(text)).map((m) => ({
    set: input.set,
    variant: input.variant,
    rep: input.rep,
    image: input.image.key,
    hinted,
    partId: m.part.id,
    role: m.part.role,
    gold: m.part.crop,
    agent: m.agent,
    iou: r3(m.iou),
  }));
}

export function cropsReport(records: readonly R6Crop[], unparsed: readonly string[] = []): string {
  const mean = (xs: readonly R6Crop[]) => (xs.length ? r3(xs.reduce((a, r) => a + r.iou, 0) / xs.length) : NaN);
  const at8 = (xs: readonly R6Crop[]) => `${Math.round((xs.filter((r) => r.iou >= IOU_TARGET).length / xs.length) * 100)}%`;
  const lines = [
    "# R6 crops (screens found in code)",
    "",
    "Mean IoU per gold part (a part with no box scores 0). Hinted: images where the finder answered.",
    "",
    "| Set | Variant | Repeat | Parts | Mean IoU | At 0.8 or more | Hinted images mean | Other images mean | toolbar | content | status-header | tabbar |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  const groups = new Map<string, R6Crop[]>();
  for (const r of records) groups.set(`${r.set}|${r.variant}|${r.rep}`, [...(groups.get(`${r.set}|${r.variant}|${r.rep}`) ?? []), r]);
  for (const [k, rs] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [set, variant, rep] = k.split("|");
    const role = (name: string) => {
      const x = rs.filter((r) => r.role === name);
      return x.length ? `${mean(x)} (${x.length})` : "n/a";
    };
    lines.push(`| ${set} | ${variant} | ${rep} | ${rs.length} | ${mean(rs)} | ${at8(rs)} | ${mean(rs.filter((r) => r.hinted))} | ${mean(rs.filter((r) => !r.hinted))} | ${WEAK_ROLES.map(role).join(" | ")} |`);
  }
  lines.push("", "Means over repeats:", "", "| Set | Variant | Repeats | Parts | Mean IoU | At 0.8 or more | Hinted images mean |", "| --- | --- | --- | --- | --- | --- | --- |");
  const byVar = new Map<string, R6Crop[]>();
  for (const r of records) byVar.set(`${r.set}|${r.variant}`, [...(byVar.get(`${r.set}|${r.variant}`) ?? []), r]);
  for (const [k, rs] of [...byVar].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [set, variant] = k.split("|");
    lines.push(`| ${set} | ${variant} | ${new Set(rs.map((r) => r.rep)).size} | ${rs.length} | ${mean(rs)} | ${at8(rs)} | ${mean(rs.filter((r) => r.hinted))} |`);
  }
  if (unparsed.length) lines.push("", `Replies that did not parse (their parts are missing from the means above): ${unparsed.join(", ")}.`);
  return lines.join("\n") + "\n";
}

let imagesCache: GoldImage[] | null = null;
const goldImages = () => (imagesCache ??= loadGoldImages());

export function allInputs(images: readonly GoldImage[], reps = 6): Input[] {
  const split = splitImages(images);
  const out: Input[] = [];
  for (const image of images) for (const variant of R6_VARIANTS) for (let rep = 1; rep <= reps; rep++) out.push({ image, variant, rep, set: split.get(image.key)! });
  return out;
}

/** Every record from raw/r6-crops.jsonl. The hint flag is saved in the raw line's `hinted`. */
export function recordsFromRaw(rawPath: string, images: readonly GoldImage[], hints: ReadonlyMap<string, boolean>): { records: R6Crop[]; unparsed: string[] } {
  if (!existsSync(rawPath)) return { records: [], unparsed: [] };
  const byId = new Map(allInputs(images).map((i) => [requestIdOf(i), i]));
  const records: R6Crop[] = [];
  const unparsed: string[] = [];
  for (const line of readFileSync(rawPath, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as { id: string; status?: string; text?: string };
    const input = byId.get(r.id);
    if (!input) continue;
    try {
      if (r.status !== "succeeded") throw new Error(r.status);
      records.push(...recordsFor(r.text ?? "", input, hints.get(input.image.key) ?? false));
    } catch {
      unparsed.push(r.id);
    }
  }
  return { records, unparsed };
}

const HINTS_FILE = () => join(PATHS.review, "r6-crops-screens.json");

export default defineJob<Input, R6Crop>({
  id: "r6-crops",
  kind: "work-crops-r6",
  model: SONNET,
  mode: "batch",
  schema: R6CropSchema,
  system: PLAIN_SYSTEM,
  maxTokens: 8000,
  expectedOutputTokens: 2500,
  imageTokens: 1200,
  effort: "medium",

  loadInputs: (ctx) => {
    const images = goldImages();
    const split = splitImages(images);
    const set = (process.env.R6_CROP_SET ?? "dev") as CropSet;
    if (!SETS.includes(set)) throw new Error(`R6_CROP_SET must be one of ${SETS.join(", ")}`);
    const variants = (process.env.R6_CROP_VARIANTS ?? "control,seg").split(",").map((v) => v.trim()) as R6Variant[];
    for (const v of variants) if (!R6_VARIANTS.includes(v)) throw new Error(`unknown variant ${v}`);
    const reps = Number(process.env.R6_CROP_REPS ?? "1");
    const firstRep = Number(process.env.R6_CROP_FIRST_REP ?? "1");
    const picked = images.filter((i) => split.get(i.key) === set);
    ctx.log(`Running ${set}: ${picked.length} images, ${picked.reduce((n, i) => n + i.parts.length, 0)} parts; ${variants.join(", ")}; repeats ${firstRep} to ${firstRep + reps - 1}.`);
    const out: Input[] = [];
    for (let rep = firstRep; rep < firstRep + reps; rep++) for (const variant of variants) for (const image of picked) out.push({ image, variant, rep, set });
    return out;
  },
  requestId: (input) => requestIdOf(input),
  async buildPrompt(input, ctx) {
    const { image, variant } = input;
    let block: Anthropic.ImageBlockParam | undefined;
    if (!ctx.dry) {
      const got = await fetchImageBlock(image.imageUrl);
      if (!got.ok) throw new Error(`image for ${image.key} did not load (${got.reason})`);
      block = got.block;
    }
    // Dry runs fetch too (for the screens), but send a placeholder.
    const found = await screensFor(image, block);
    const boxes = variant === "control" ? [] : found;
    const blocks: Anthropic.ContentBlockParam[] = [{ type: "text", text: `Image: ${image.width ?? "?"} x ${image.height ?? "?"} px, a ${image.platform ?? "unknown"} reference${image.page ? ` showing a ${image.page} page` : ""}.` }];
    blocks.push(block ?? placeholderImage());
    const line = variant === "seg" ? screensLine(boxes) : null;
    if (line) blocks.push({ type: "text", text: line });
    blocks.push({ type: "text", text: variant === "control" ? askList(image, "screens") : segAskList(image, boxes) });
    return blocks;
  },
  parse: (text, input) => recordsFor(text, input, (boxesByKey.get(input.image.key) ?? []).length > 0),
  async finalize(records, ctx) {
    const images = goldImages();
    // The hint flag per image, saved once so reports rebuild without fetching.
    const file = HINTS_FILE();
    const saved = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, ScreenBox[]>) : {};
    for (const [k, v] of boxesByKey) saved[k] = v;
    mkdirSync(PATHS.review, { recursive: true });
    writeFileSync(file, JSON.stringify(saved, null, 1));
    const hints = new Map(images.map((i) => [i.key, (saved[i.key] ?? []).length > 0]));
    const all = recordsFromRaw(join(PATHS.raw, "r6-crops.jsonl"), images, hints);
    const report = cropsReport(all.records, all.unparsed);
    writeFileSync(join(PATHS.review, "r6-crops-report.md"), report);
    ctx.log(report);
    return records;
  },
  shardOf: (r) => `${r.set}-${r.variant}`,
});
