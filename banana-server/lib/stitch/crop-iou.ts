/**
 * Crop accuracy (docs/next-step-plan.md P1-I4 and section 8): IoU of guessed and agent crops
 * against the owner's gold parts (bench/gold/*.json, P1-J11). Pure: the script
 * scripts/crop-iou.ts reads the files and prints the result.
 *
 * Gold part shape (one JSON file holds `{ "parts": [...] }` or a bare array):
 *   { "id": "p1", "role": "cta", "page": "checkout", "platform": "mobile",
 *     "imageWidth": 390, "imageHeight": 844, "single": true,
 *     "crop": { "x": 0.06, "y": 0.82, "w": 0.88, "h": 0.09 },      // the owner's gold box
 *     "agentCrop": { "x": 0.05, "y": 0.8, "w": 0.9, "h": 0.1 } }   // optional: what the agent cut
 */
import type { PageAnatomy } from "@/lib/atlas/types";
import { defaultCrop } from "./crop";
import { clampCrop, isPartRole, type Crop, type PartRole, type StitchPlatform } from "./types";

export interface GoldPart {
  id: string;
  role: PartRole;
  page?: string;
  platform?: StitchPlatform;
  imageWidth?: number;
  imageHeight?: number;
  single?: boolean;
  crop: Crop;
  agentCrop?: Crop;
}

/** The plan's target for agent crops (Gate 3). */
export const IOU_TARGET = 0.8;

export function iou(a: Crop, b: Crop): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

const PLATFORMS = new Set(["mobile", "tablet", "website", "webapp"]);

function readCrop(raw: unknown): Crop | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const n = (k: string) => (typeof r[k] === "number" && Number.isFinite(r[k]) ? (r[k] as number) : NaN);
  const c = { x: n("x"), y: n("y"), w: n("w"), h: n("h") };
  return Object.values(c).some(Number.isNaN) || c.w <= 0 || c.h <= 0 ? null : clampCrop(c);
}

/** Gold parts from one parsed file; malformed parts are dropped and counted. */
export function parseGold(raw: unknown): { parts: GoldPart[]; dropped: number } {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? (raw as { parts?: unknown }).parts : null;
  if (!Array.isArray(list)) return { parts: [], dropped: 0 };
  const parts: GoldPart[] = [];
  let dropped = 0;
  for (const item of list) {
    const r = (item ?? {}) as Record<string, unknown>;
    const crop = readCrop(r.crop);
    if (typeof r.id !== "string" || !isPartRole(r.role) || !crop) {
      dropped++;
      continue;
    }
    const part: GoldPart = { id: r.id, role: r.role, crop };
    if (typeof r.page === "string") part.page = r.page;
    if (typeof r.platform === "string" && PLATFORMS.has(r.platform)) part.platform = r.platform as StitchPlatform;
    if (typeof r.imageWidth === "number") part.imageWidth = r.imageWidth;
    if (typeof r.imageHeight === "number") part.imageHeight = r.imageHeight;
    if (r.single === true) part.single = true;
    const agent = readCrop(r.agentCrop);
    if (agent) part.agentCrop = agent;
    parts.push(part);
  }
  return { parts, dropped };
}

export interface IouScore {
  /** Parts scored. */
  n: number;
  mean: number | null;
  /** Share of parts at IOU_TARGET or more. */
  atTarget: number | null;
}

export interface CropReport {
  parts: number;
  /** Today's guess: ROLE_BANDS only. */
  roleBands: IouScore;
  /** The guess with the page's anatomy bands, where the page is known in `anatomies`. */
  anatomy: IouScore;
  /** Parts whose page has an anatomy: the two guesses compared on the same parts. */
  withAnatomy: { roleBands: IouScore; anatomy: IouScore };
  /** Crops the agent measured (parts with agentCrop). */
  agent: IouScore;
  byRole: Record<string, { n: number; roleBands: number; anatomy: number }>;
}

function score(values: number[]): IouScore {
  if (values.length === 0) return { n: 0, mean: null, atTarget: null };
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return {
    n: values.length,
    mean: round(values.reduce((a, b) => a + b, 0) / values.length),
    atTarget: round(values.filter((v) => v >= IOU_TARGET).length / values.length),
  };
}

/** Scores the guesses and the agent crops against the gold parts. */
export function evaluateCrops(parts: readonly GoldPart[], anatomies: ReadonlyMap<string, Pick<PageAnatomy, "sections">> = new Map()): CropReport {
  const plain: number[] = [];
  const withAtlas: number[] = [];
  const knownPlain: number[] = [];
  const knownAtlas: number[] = [];
  const agent: number[] = [];
  const byRole: CropReport["byRole"] = {};
  for (const p of parts) {
    const ctx = { imageWidth: p.imageWidth, imageHeight: p.imageHeight, platform: p.platform, single: p.single };
    const anatomy = p.page ? anatomies.get(p.page) : undefined;
    const a = iou(defaultCrop(p.role, ctx), p.crop);
    const b = anatomy ? iou(defaultCrop(p.role, { ...ctx, anatomy }), p.crop) : a;
    plain.push(a);
    withAtlas.push(b);
    if (anatomy) {
      knownPlain.push(a);
      knownAtlas.push(b);
    }
    if (p.agentCrop) agent.push(iou(p.agentCrop, p.crop));
    const r = (byRole[p.role] ??= { n: 0, roleBands: 0, anatomy: 0 });
    r.roleBands = (r.roleBands * r.n + a) / (r.n + 1);
    r.anatomy = (r.anatomy * r.n + b) / (r.n + 1);
    r.n++;
  }
  return {
    parts: parts.length,
    roleBands: score(plain),
    anatomy: score(withAtlas),
    withAnatomy: { roleBands: score(knownPlain), anatomy: score(knownAtlas) },
    agent: score(agent),
    byRole,
  };
}

const show = (s: IouScore) => (s.mean === null ? "n/a" : `${s.mean} mean, ${Math.round((s.atTarget ?? 0) * 100)}% at ${IOU_TARGET} or more (${s.n} parts)`);

export function formatCropReport(r: CropReport): string {
  return [
    `Crop accuracy on ${r.parts} gold parts.`,
    "",
    "| Crop | IoU | Target |",
    "| --- | --- | --- |",
    `| Agent crops | ${show(r.agent)} | ${IOU_TARGET} or more |`,
    `| Default bands (anatomy where known) | ${show(r.anatomy)} | beats ROLE_BANDS |`,
    `| Default bands (ROLE_BANDS only) | ${show(r.roleBands)} | |`,
    `| Pages with anatomy: anatomy bands | ${show(r.withAnatomy.anatomy)} | |`,
    `| Pages with anatomy: ROLE_BANDS | ${show(r.withAnatomy.roleBands)} | |`,
  ].join("\n");
}
