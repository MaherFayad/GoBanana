/**
 * reconcile_direction logic, pure: which images belong to a direction, when its saved reconcile is
 * stale, and how the board's palette compares with the spec written before the board existed.
 * Template text only (no AI). The tool (lib/mcp/tools/reconcile_direction.ts) does the fetching.
 */
import type { CanvasItem, CanvasSnapshot, ReferenceItem, TypeSampleItem } from "@/lib/canvas/types";
import type { DirectionDetail, Reconciled, ReconciledPair, VisualSpec } from "@/lib/direction-detail";
import { evaluatePair } from "@/lib/palette";
import { hexToOklchColor } from "@/lib/palette/color";

/** Placed images a direction needs before the hints and the export ask for a reconcile. */
export const RECONCILE_MIN_IMAGES = 3;

/** Ids a direction goes by on the board: sections store the bend id or the row id. */
export type DirectionIds = { id: string; bendId?: string | null };

function idsOf(d: DirectionIds): Set<string> {
  return new Set([d.id, ...(d.bendId ? [d.bendId] : [])]);
}

/** Section ids made for this direction. */
export function directionSectionIds(snapshot: Pick<CanvasSnapshot, "sections">, d: DirectionIds): Set<string> {
  const ids = idsOf(d);
  return new Set(snapshot.sections.filter((s) => s.directionId && ids.has(s.directionId)).map((s) => s.id));
}

/** Image and upload items (art and UI) placed in this direction's sections, in board order. */
export function directionImages(snapshot: Pick<CanvasSnapshot, "sections" | "items">, d: DirectionIds): ReferenceItem[] {
  const sections = directionSectionIds(snapshot, d);
  return snapshot.items.filter((i): i is ReferenceItem => (i.type === "image" || i.type === "upload") && !!i.sectionId && sections.has(i.sectionId));
}

/** Type samples in this direction's sections (the user's own font pick for it). */
export function directionTypeSamples(snapshot: Pick<CanvasSnapshot, "sections" | "items">, d: DirectionIds): TypeSampleItem[] {
  const sections = directionSectionIds(snapshot, d);
  return snapshot.items.filter((i: CanvasItem): i is TypeSampleItem => i.type === "typeSample" && !!i.sectionId && sections.has(i.sectionId));
}

/** FNV-1a, hex. Short and stable; it only has to change when the set changes. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Fingerprint of a direction's placed images and which of them are rated great. */
export function itemsKey(images: readonly Pick<ReferenceItem, "id">[], greatIds: ReadonlySet<string>): string {
  const ids = images.map((i) => i.id).sort();
  return `${ids.length}-${hash(`${ids.join(",")}|${ids.filter((id) => greatIds.has(id)).join(",")}`)}`;
}

/** True when the direction was never reconciled, or images were added, removed or rated since. */
export function isStale(detail: DirectionDetail | null | undefined, key: string): boolean {
  return !detail?.reconciled || detail.reconciled.itemsKey !== key;
}

/** One line for a tool result: which directions changed and should be reconciled before export. */
export function reconcileHint(titles: readonly string[]): string | null {
  if (titles.length === 0) return null;
  const names = titles.map((t) => `"${t}"`).join(", ");
  return `Direction ${names} changed: run reconcile_direction before export so the spec matches the board.`;
}

/**
 * Contrast pairs as reconcile tags them: ship when the pair passes 4.5:1 (text) or 3:1 (UI parts,
 * large text and icons only); explore otherwise.
 */
export function reconcilePairs(pairs: readonly ReconciledPair[]): ReconciledPair[] {
  return pairs.map((p) => {
    const e = evaluatePair(p.fg, p.bg);
    return { ...e, tag: e.passesUi ? "ship" : "explore" };
  });
}

type Lch = { hex: string; role: string; l: number; c: number; h: number };

function lch(palette: Reconciled["palette"]): Lch[] {
  return palette.flatMap((p) => {
    try {
      return [{ hex: p.hex, role: p.role, ...hexToOklchColor(p.hex) }];
    } catch {
      return [];
    }
  });
}

const HUES: [string, number, number][] = [
  ["red", 0, 35],
  ["orange", 35, 70],
  ["yellow", 70, 110],
  ["green", 110, 170],
  ["teal", 170, 215],
  ["blue", 215, 275],
  ["purple", 275, 330],
  ["pink", 330, 360],
];

function hueName(h: number): string {
  return HUES.find(([, a, b]) => h >= a && h < b)?.[0] ?? "red";
}

const CHROMATIC = 0.05;

/** "light, warm, with a loud accent": a plain mood line from lightness and chroma. */
export function moodLine(palette: Reconciled["palette"]): string {
  const cols = lch(palette);
  if (cols.length === 0) return "";
  const surface = cols.find((c) => c.role === "surface") ?? cols[0]!;
  const tone = surface.l >= 0.7 ? "light" : surface.l <= 0.35 ? "dark" : "mid tone";
  const chromatic = cols.filter((c) => c.c >= CHROMATIC);
  const maxC = Math.max(0, ...cols.map((c) => c.c));
  const energy = maxC >= 0.18 ? "with a loud, saturated accent" : maxC >= 0.09 ? "with a clear accent" : "muted, nearly gray";
  const warm = chromatic.filter((c) => c.h < 110 || c.h >= 330).length;
  const cool = chromatic.length - warm;
  const temp = chromatic.length === 0 ? "neutral" : warm > cool ? "warm" : cool > warm ? "cool" : "warm and cool mixed";
  const hues = [...new Set(chromatic.map((c) => hueName(c.h)))];
  return `${tone}, ${temp}, ${energy}${hues.length > 0 ? ` (${hues.join(", ")})` : ""}.`;
}

/** The spec's color line rewritten from the board's palette. */
export function boardColorLine(palette: Reconciled["palette"], contrast: readonly ReconciledPair[]): string {
  const by = (role: string) => palette.find((p) => p.role === role)?.hex;
  const parts = [
    by("surface") && `base ${by("surface")}`,
    by("on-surface") && `text ${by("on-surface")}`,
    by("primary") && `primary ${by("primary")}`,
    by("accent") && `accent ${by("accent")}`,
  ].filter(Boolean);
  const text = contrast.filter((p) => p.passesText).length;
  const ui = contrast.filter((p) => !p.passesText && p.passesUi).length;
  return `From the board: ${parts.join(", ")}; ${text} pairs pass 4.5:1 for text, ${ui} more pass 3:1 for UI parts only.`;
}

export type Conflict = { axis: "color" | "typography" | "mood"; spec: string; board: string };

const DARK_WORDS = /\b(dark|black|night|midnight|noir|charcoal|ink)\b/i;
const LIGHT_WORDS = /\b(light|white|paper|cream|ivory|pale|bright background)\b/i;
const MUTED_WORDS = /\b(muted|pastel|soft|desaturated|calm|neutral|monochrome)\b/i;
const LOUD_WORDS = /\b(neon|vivid|saturated|loud|electric|acid|bold color)\b/i;

/**
 * Where the spec written by bend_brief disagrees with what is on the board. Plain lines, one per
 * mismatch, so the agent can tell the user.
 */
export function findConflicts(
  spec: VisualSpec | undefined,
  palette: Reconciled["palette"],
  boardType: { voiceFonts: string; sample?: string } | null,
): Conflict[] {
  if (!spec) return [];
  const out: Conflict[] = [];
  const cols = lch(palette);
  if (cols.length > 0 && spec.color) {
    const surface = cols.find((c) => c.role === "surface") ?? cols[0]!;
    const shows = moodLine(palette);
    if (DARK_WORDS.test(spec.color) && !LIGHT_WORDS.test(spec.color) && surface.l >= 0.7) {
      out.push({ axis: "color", spec: spec.color, board: `The board's base is light (${surface.hex}).` });
    } else if (LIGHT_WORDS.test(spec.color) && !DARK_WORDS.test(spec.color) && surface.l <= 0.35) {
      out.push({ axis: "color", spec: spec.color, board: `The board's base is dark (${surface.hex}).` });
    }
    const boardHues = new Set(cols.filter((c) => c.c >= CHROMATIC).map((c) => hueName(c.h)));
    const missing = HUES.map(([name]) => name).filter((name) => new RegExp(`\\b${name}\\b`, "i").test(spec.color) && !boardHues.has(name));
    if (missing.length > 0) {
      out.push({
        axis: "color",
        spec: spec.color,
        board: `No ${missing.join(" or ")} on the board; it shows ${boardHues.size > 0 ? [...boardHues].join(", ") : "only neutrals"} (${shows})`,
      });
    }
    const maxC = Math.max(0, ...cols.map((c) => c.c));
    const moodText = `${spec.color} ${spec.texture} ${spec.styleWords.join(" ")}`;
    if (MUTED_WORDS.test(moodText) && !LOUD_WORDS.test(moodText) && maxC >= 0.18) {
      out.push({ axis: "mood", spec: `${spec.color} ${spec.texture}`.trim(), board: `The board is loud: ${shows}` });
    } else if (LOUD_WORDS.test(moodText) && !MUTED_WORDS.test(moodText) && maxC < 0.09) {
      out.push({ axis: "mood", spec: `${spec.color} ${spec.texture}`.trim(), board: `The board is muted: ${shows}` });
    }
  }
  if (boardType?.sample) {
    out.push({
      axis: "typography",
      spec: `${spec.typography} (type voice ${spec.typeVoice}: ${boardType.voiceFonts})`,
      board: `The board's type sample sets ${boardType.sample}.`,
    });
  }
  return out;
}

/** The spec with color (and typography, when the board has a type sample) taken from the board. */
export function reconciledSpec(spec: VisualSpec | undefined, colorLine: string, sampleLine?: string): VisualSpec | undefined {
  if (!spec) return undefined;
  return {
    ...spec,
    color: colorLine.slice(0, 400),
    ...(sampleLine ? { typography: sampleLine.slice(0, 400) } : {}),
  };
}
