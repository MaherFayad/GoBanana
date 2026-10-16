/**
 * Light validation of `directions.detail` (lib/direction-detail.ts DirectionDetail) on write and read.
 * Unknown keys are dropped, wrong types are dropped field by field, and anything that is not an
 * object reads as null. Strings are trimmed and capped so a bad caller cannot bloat the row.
 */
import { isStyleId } from "@/lib/styles/ids";
import { isPlatform, isTypeVoice, type ArabicPack, type BiText, type DirectionAtlas, type DirectionDetail, type Reconciled, type VisualSpec } from "@/lib/direction-detail";

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

/** The Atlas id fields of one object: short id strings only, capped. Undefined without a card id. */
function atlasFields(v: Record<string, unknown>): DirectionAtlas | undefined {
  const cardIds = strs(v.cardIds, 4, 80) ?? [];
  if (cardIds.length === 0) return undefined;
  const out: DirectionAtlas = { cardIds, recipeIds: strs(v.recipeIds, 12, 80) ?? [] };
  const mechanicId = str(v.mechanicId, 80);
  if (mechanicId) out.mechanicId = mechanicId;
  const shaderIds = strs(v.shaderIds, 1, 80);
  if (shaderIds?.length) out.shaderIds = shaderIds;
  const motionIds = strs(v.motionIds, 2, 80);
  if (motionIds?.length) out.motionIds = motionIds;
  for (const k of ["pageId", "domainId", "productNoun", "searchTopic"] as const) {
    const s = str(v[k], 80);
    if (s) out[k] = s;
  }
  const avoidWords = strs(v.avoidWords, 8, 40);
  if (avoidWords?.length) out.avoidWords = avoidWords;
  return out;
}

/**
 * The Atlas ids of a saved direction (BEND_ENGINE=atlas). `detail.atlas` is the one place they
 * live; rows saved before that kept flat `cardIds`, `mechanicId` and `recipeIds` on the detail,
 * which are read into the same shape.
 */
export function parseDirectionAtlas(raw: unknown): DirectionAtlas | undefined {
  if (!isObj(raw)) return undefined;
  return (isObj(raw.atlas) ? atlasFields(raw.atlas) : undefined) ?? atlasFields(raw);
}

function bi(v: unknown, max: number): BiText | undefined {
  if (!isObj(v)) return undefined;
  const ar = str(v.ar, max);
  const en = str(v.en, max);
  return ar && en ? { ar, en } : undefined;
}

const fontNames = (v: unknown): { display: string; body: string } | undefined => {
  if (!isObj(v)) return undefined;
  const display = str(v.display, 80);
  const body = str(v.body, 80);
  return display && body ? { display, body } : undefined;
};

/** The saved Arabic-first pack (VAL-08): short strings only, capped; undefined unless every part is there. */
export function parseArabicPack(v: unknown): ArabicPack | undefined {
  if (!isObj(v) || !isObj(v.copy) || !isObj(v.type) || !Array.isArray(v.rtl)) return undefined;
  const headline = bi(v.copy.headline, 120);
  const action = bi(v.copy.action, 80);
  const support = bi(v.copy.support, 240);
  const latin = fontNames(v.type.latin);
  const arabic = fontNames(v.type.arabic);
  const page = str(v.page, 40);
  if (!headline || !action || !support || !latin || !arabic || !page || !isTypeVoice(v.type.voice)) return undefined;
  const rtl = v.rtl.filter(isObj).flatMap((n) => {
    const part = str(n.part, 60);
    const flips = str(n.flips, 300);
    const keeps = str(n.keeps, 300);
    return part && flips && keeps ? [{ part, flips, keeps }] : [];
  }).slice(0, 8);
  const id = str(v.type.id, 120);
  const notes = str(v.type.notes, 600);
  return {
    page,
    copy: { headline, action, support },
    rtl,
    type: { source: v.type.source === "atlas" ? "atlas" : "voice", ...(id ? { id } : {}), voice: v.type.voice, latin, arabic, ...(notes ? { notes } : {}) },
  };
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
  const rec = parseReconciled(raw.reconciled);
  if (rec) out.reconciled = rec;
  if (isObj(raw.mechanic)) {
    const element = str(raw.mechanic.element, 40);
    const how = str(raw.mechanic.how, 400);
    if (element && how) out.mechanic = { element, how };
  }
  const arabicPack = parseArabicPack(raw.arabic);
  if (arabicPack) out.arabic = arabicPack;
  if (isStyleId(raw.styleId)) out.styleId = raw.styleId;
  // Atlas ids (bend engine v2), flat fields of old rows included.
  const atlas = parseDirectionAtlas(raw);
  if (atlas) out.atlas = atlas;
  return Object.keys(out).length > 0 ? out : null;
}
