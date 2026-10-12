/**
 * Light validation of `directions.detail` (lib/direction-detail.ts DirectionDetail) on write and read.
 * Unknown keys are dropped, wrong types are dropped field by field, and anything that is not an
 * object reads as null. Strings are trimmed and capped so a bad caller cannot bloat the row.
 */
import { isPlatform, isTypeVoice, type DirectionDetail, type VisualSpec } from "@/lib/direction-detail";

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
  return Object.keys(out).length > 0 ? out : null;
}
