/**
 * Light validation of `directions.detail` (lib/direction-detail.ts DirectionDetail) on write and read.
 * Unknown keys are dropped, wrong types are dropped field by field, and anything that is not an
 * object reads as null. Strings are trimmed and capped so a bad caller cannot bloat the row.
 */
import { isDirectionSource, isPlatform, isTypeVoice, parseLanguage, type DirectionDetail, type Reconciled, type VisualSpec } from "@/lib/direction-detail";

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max = 400): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

function strs(v: unknown, maxItems = 8, maxLen = 200): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.flatMap((x) => {
    const s = str(x, maxLen);
    return s ? [s] : [];
  }).slice(0, maxItems);
}

const SPEC_TEXT = [
  "typography",
  "color",
  "layout",
  "imagery",
  "motion",
  "texture",
  "iconography",
  "density",
  "signature",
  "pattern",
  "whyItFits",
] as const;

function spec(v: unknown): VisualSpec | undefined {
  if (!isObj(v) || !isTypeVoice(v.typeVoice)) return undefined;
  const out: Partial<VisualSpec> = { typeVoice: v.typeVoice };
  for (const k of SPEC_TEXT) out[k] = str(v[k]) ?? "";
  out.steal = strs(v.steal) ?? [];
  out.avoid = strs(v.avoid) ?? [];
  out.styleWords = strs(v.styleWords, 6, 60) ?? [];
  return out as VisualSpec;
}

const HEX = /^#[0-9a-f]{6}$/;
const hex = (v: unknown): string | undefined => (typeof v === "string" && HEX.test(v.toLowerCase()) ? v.toLowerCase() : undefined);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** reconcile_direction output: hex colors, ratios and short lines only, capped. */
export function parseReconciled(v: unknown): Reconciled | undefined {
  if (!isObj(v) || !Array.isArray(v.palette) || !Array.isArray(v.contrast)) return undefined;
  const palette = v.palette.filter(isObj).flatMap((c) => {
    const h = hex(c.hex);
    return h ? [{ hex: h, oklch: str(c.oklch, 80) ?? "", role: str(c.role, 40) ?? "" }] : [];
  }).slice(0, 12);
  const contrast = v.contrast.filter(isObj).flatMap((c) => {
    const fg = hex(c.fg);
    const bg = hex(c.bg);
    if (!fg || !bg) return [];
    return [{ fg, bg, ratio: num(c.ratio), passesText: c.passesText === true, passesUi: c.passesUi === true, tag: c.tag === "ship" ? ("ship" as const) : ("explore" as const) }];
  }).slice(0, 60);
  const out: Reconciled = {
    at: str(v.at, 40) ?? "",
    itemsKey: str(v.itemsKey, 80) ?? "",
    palette,
    contrast,
    mood: str(v.mood, 300) ?? "",
    images: num(v.images),
    great: num(v.great),
  };
  if (isObj(v.parts)) {
    const parts: Record<string, string[]> = {};
    for (const [id, list] of Object.entries(v.parts).slice(0, 40)) {
      const hexes = Array.isArray(list) ? list.flatMap((x) => hex(x) ?? []).slice(0, 4) : [];
      if (hexes.length > 0) parts[id.slice(0, 100)] = hexes;
    }
    out.parts = parts;
  }
  return out;
}

/** The mechanic as bend_brief saves it: an element name and one line on how. Missing on old rows. */
export function parseMechanic(v: unknown): { element: string; how: string } | undefined {
  if (!isObj(v)) return undefined;
  const element = str(v.element, 40);
  const how = str(v.how, 400);
  return element && how ? { element, how } : undefined;
}

/** Clean detail, or null when `raw` is not an object or has nothing usable. */
export function parseDirectionDetail(raw: unknown): DirectionDetail | null {
  if (!isObj(raw)) return null;
  const out: DirectionDetail = {};
  if (isPlatform(raw.platform)) out.platform = raw.platform;
  const pages = strs(raw.pages, 6, 120);
  if (pages) out.pages = pages;
  const s = spec(raw.spec);
  if (s) out.spec = s;
  const art = strs(raw.artQueries, 6, 200);
  if (art) out.artQueries = art;
  const brief = str(raw.brief, 500);
  if (brief) out.brief = brief;
  const twist = str(raw.twist, 600);
  if (twist) out.twist = twist;
  const prompt = str(raw.prompt, 4000);
  if (prompt) out.prompt = prompt;
  if (typeof raw.wildness === "number" && Number.isFinite(raw.wildness)) out.wildness = raw.wildness;
  if (raw.verdict === "keep" || raw.verdict === "drop") out.verdict = raw.verdict;
  const mechanic = parseMechanic(raw.mechanic);
  if (mechanic) out.mechanic = mechanic;
  const language = parseLanguage(raw.language);
  if (language) out.language = language;
  if (isDirectionSource(raw.source)) out.source = raw.source;
  const rec = parseReconciled(raw.reconciled);
  if (rec) out.reconciled = rec;
  return Object.keys(out).length > 0 ? out : null;
}
