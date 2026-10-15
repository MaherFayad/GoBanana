/**
 * Brand stretch (VAL-07): how far a wild direction may stretch the product's own brand. The agent
 * passes the brand's DESIGN.md or design tokens and a stretch:
 *
 *   keep-logo-and-primary  the brand primary stays the main action and accent color, and the logo
 *                          stays as the brand ships it (its rules from DESIGN.md)
 *   keep-primary           the brand primary stays; everything else may bend
 *   free                   nothing is kept; the primary is shown as a reference only
 *
 * Pure and rule based: the primary color and the logo rules are read from the text and tokens,
 * never guessed. The brand never changes direction ids or picks (it is not part of the seed);
 * it rewrites the color line, the avoid list, the prompt and (for a header mechanic) the
 * mechanic line, so every direction a brand team sees keeps what they asked to keep.
 */
import { contrastRatio, TEXT_MIN, UI_MIN } from "@/lib/palette/contrast";
import type { BendResult, Direction } from "./types";

export const BRAND_STRETCHES = ["keep-logo-and-primary", "keep-primary", "free"] as const;
export type BrandStretch = (typeof BRAND_STRETCHES)[number];

export interface BrandInput {
  /** The brand's DESIGN.md (or any design notes), as text. */
  designMd?: string;
  /** Design tokens as JSON (W3C design tokens, Tokens Studio, Style Dictionary or a flat object). */
  tokens?: Record<string, unknown>;
  stretch: BrandStretch;
}

/** What bend_brief read from the brand, as it returns it. */
export interface BrandRead {
  stretch: BrandStretch;
  /** The brand primary as #RRGGBB, or null when neither the DESIGN.md nor the tokens name one. */
  primary: string | null;
  /** Up to 3 logo rules from the DESIGN.md or tokens ("Clear space of 16px around the logo"). */
  logoRules: string[];
  /** The text color that reads best on the primary (#FFFFFF or #111111), and its contrast ratio. */
  onPrimary: { hex: string; ratio: number } | null;
}

export const MAX_DESIGN_MD = 20_000;
export const MAX_TOKENS_JSON = 20_000;
const MAX_LOGO_RULES = 3;
const MAX_RULE_LENGTH = 160;

const HEX_RE = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i;

/** "#abc" and "#AABBCC" as "#AABBCC". */
function fullHex(hex: string): string {
  const h = hex.replace("#", "");
  const six = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return `#${six.toUpperCase()}`;
}

/** A token value as a hex color: a string, or a `$value` / `value` field holding one. */
function tokenHex(v: unknown): string | null {
  if (typeof v === "string") {
    const m = HEX_RE.exec(v.trim());
    return m && m[0].length === v.trim().length ? fullHex(m[0]) : null;
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return tokenHex(o.$value ?? o.value);
  }
  return null;
}

/** Every leaf of a token object with its key path, depth first, at most 6 levels and 2,000 leaves. */
function leaves(obj: unknown, path: string[] = [], out: { path: string[]; value: unknown }[] = []): { path: string[]; value: unknown }[] {
  if (out.length >= 2000 || path.length > 6) return out;
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const o = obj as Record<string, unknown>;
    if ("$value" in o || "value" in o) {
      out.push({ path, value: o });
      return out;
    }
    for (const [k, v] of Object.entries(o)) leaves(v, [...path, k], out);
    return out;
  }
  out.push({ path, value: obj });
  return out;
}

/** The primary color in the tokens: a key named "primary" (or "brand" under color), the shortest path first. */
export function primaryFromTokens(tokens: Record<string, unknown> | undefined): string | null {
  if (!tokens) return null;
  const hits = leaves(tokens)
    .map(({ path, value }) => ({ path: path.map((p) => p.toLowerCase()), hex: tokenHex(value) }))
    .filter((x): x is { path: string[]; hex: string } => x.hex !== null)
    .map((x) => {
      const exact = x.path.some((p) => p === "primary");
      const loose = x.path.some((p) => /primary/.test(p));
      const brand = x.path.some((p) => p === "brand") && x.path.some((p) => /colou?rs?/.test(p));
      const rank = exact ? 0 : loose ? 1 : brand ? 2 : 9;
      return { ...x, rank };
    })
    .filter((x) => x.rank < 9)
    .sort((a, b) => a.rank - b.rank || a.path.length - b.path.length);
  return hits[0]?.hex ?? null;
}

/** The primary color in a DESIGN.md: the first line that names "primary" and a hex color. */
export function primaryFromDesignMd(md: string | undefined): string | null {
  if (!md) return null;
  for (const line of md.split(/\r?\n/)) {
    if (!/primary/i.test(line)) continue;
    const m = HEX_RE.exec(line);
    if (m) return fullHex(m[0]);
  }
  return null;
}

/** Logo rules: DESIGN.md lines that name the logo (list markers and headings stripped), else logo token strings. */
export function logoRules(md: string | undefined, tokens: Record<string, unknown> | undefined): string[] {
  const out: string[] = [];
  const add = (raw: string) => {
    const t = raw
      .replace(/^\s*(?:[-*+]|\d+[.)]|#+)\s*/, "")
      .replace(/[*_`]/g, "")
      .replaceAll(String.fromCharCode(0x2014), ",")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_RULE_LENGTH);
    if (t && /\blogo/i.test(t) && /\s/.test(t) && !out.includes(t)) out.push(t);
  };
  for (const line of (md ?? "").split(/\r?\n/)) {
    if (out.length >= MAX_LOGO_RULES) break;
    if (/^\s*#/.test(line)) continue;
    if (/\blogo/i.test(line)) add(line);
  }
  if (out.length === 0 && tokens) {
    for (const { path, value } of leaves(tokens)) {
      if (out.length >= MAX_LOGO_RULES) break;
      const v = tokenHex(value) ?? (typeof value === "string" ? value : null);
      if (v && path.some((p) => /logo/i.test(p))) add(`${path.join(" ")}: ${v}`);
    }
  }
  return out.slice(0, MAX_LOGO_RULES);
}

/** What a brand input says: its primary, logo rules and the text color that reads on the primary. */
export function readBrand(brand: BrandInput): BrandRead {
  const primary = primaryFromTokens(brand.tokens) ?? primaryFromDesignMd(brand.designMd);
  let onPrimary: BrandRead["onPrimary"] = null;
  if (primary) {
    const light = contrastRatio("#FFFFFF", primary);
    const dark = contrastRatio("#111111", primary);
    onPrimary = light >= dark ? { hex: "#FFFFFF", ratio: Math.round(light * 100) / 100 } : { hex: "#111111", ratio: Math.round(dark * 100) / 100 };
  }
  return { stretch: brand.stretch, primary, logoRules: logoRules(brand.designMd, brand.tokens), onPrimary };
}

const bare = (s: string) => s.trim().replace(/[.\s]+$/, "");
const sentence = (s: string) => `${bare(s).charAt(0).toUpperCase()}${bare(s).slice(1)}.`;

/** One direction with the brand kept as its stretch says. */
function stretchDirection(d: Direction, read: BrandRead): Direction {
  const keepPrimary = read.stretch !== "free" && read.primary !== null;
  const keepLogo = read.stretch === "keep-logo-and-primary";
  const spec = { ...d.spec, avoid: [...d.spec.avoid] };
  const prompt: string[] = [d.prompt];
  let mechanic = d.mechanic;
  if (keepPrimary && read.onPrimary) {
    const use = read.onPrimary.ratio >= TEXT_MIN ? "" : read.onPrimary.ratio >= UI_MIN ? ", large text and UI parts only" : ", never under text";
    spec.color = sentence(
      `Brand primary ${read.primary} stays the main action and accent color, with ${read.onPrimary.hex} text on it (${read.onPrimary.ratio} to 1${use}); the idea's palette supports it: ${bare(d.spec.color)}`,
    );
    spec.avoid = [`Replacing the brand primary ${read.primary} with the idea's accent`, ...spec.avoid];
    prompt.push(`Keep the brand primary ${read.primary} as the main action and accent color.`);
  } else if (read.stretch !== "free") {
    prompt.push("Keep the brand's primary color as the main action color.");
  }
  if (keepLogo) {
    const rules = read.logoRules.length > 0 ? `: ${read.logoRules.map(bare).join("; ")}` : "";
    spec.avoid = [`Changing, recoloring or crowding the logo${rules}`, ...spec.avoid];
    prompt.push(`Keep the logo exactly as the brand ships it${rules}.`);
    if (d.mechanic.element === "header") mechanic = { ...d.mechanic, how: `${bare(d.mechanic.how)}; the logo stays as the brand ships it` };
  }
  if (read.stretch === "free") {
    prompt.push(read.primary ? `Brand stretch is free: the brand primary ${read.primary} is a reference, not a rule.` : "Brand stretch is free: the brand is a reference, not a rule.");
  }
  spec.avoid = spec.avoid.slice(0, 3).map(sentence);
  return { ...d, spec, mechanic, prompt: prompt.join(" ") };
}

/** The bend result with the brand kept as `brand.stretch` says, and what was read under `brand`. */
export function applyBrand(result: BendResult, brand: BrandInput | undefined): BendResult {
  if (!brand) return result;
  const read = readBrand(brand);
  return { ...result, brand: read, directions: result.directions.map((d) => stretchDirection(d, read)) };
}

/** One line for the agent on what the brand stretch keeps, or "" without a brand. */
export function brandLine(read: BrandRead | undefined): string {
  if (!read) return "";
  const primary = read.primary ? `primary ${read.primary}` : "no primary color found (pass tokens or a DESIGN.md line that names the primary hex)";
  const logo = read.logoRules.length > 0 ? `${read.logoRules.length} logo rule${read.logoRules.length > 1 ? "s" : ""}` : "no logo rules found";
  const keeps =
    read.stretch === "keep-logo-and-primary"
      ? "every direction keeps the brand primary and the logo as shipped"
      : read.stretch === "keep-primary"
        ? "every direction keeps the brand primary; the logo and the rest may bend"
        : "nothing is kept; the brand is a reference only";
  return `Brand stretch ${read.stretch}: ${keeps}. Read: ${primary}, ${logo}.`;
}
