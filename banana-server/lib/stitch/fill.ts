/**
 * Recipe filling and remixing: seeded combinatorics, no AI. The same input and seed always give
 * the same stitches. Variants differ in which part fills each role, and each one mixes parts from
 * at least 3 different sources when the library has them.
 */
import { MAX_STITCH_ROWS, MAX_VARIANTS, type Part, type PartRole, type StitchData, type StitchPlatform, type StitchRow, type StitchSlot } from "./types";

/** Roles that can stand in for a role the library has no part for, best first. */
export const RELATED_ROLES: Partial<Record<PartRole, PartRole[]>> = {
  nav: ["status-header", "toolbar"],
  "status-header": ["nav", "toolbar"],
  toolbar: ["nav", "filters"],
  hero: ["detail", "gallery", "content"],
  logos: ["stats"],
  features: ["cards", "content"],
  cards: ["features", "gallery", "list"],
  gallery: ["cards", "hero"],
  stats: ["chart", "logos"],
  chart: ["stats", "table"],
  testimonial: ["content", "cards"],
  pricing: ["cards", "features"],
  cta: ["hero", "form"],
  form: ["cta", "sheet"],
  faq: ["content", "list"],
  content: ["features", "detail"],
  footer: ["tabbar"],
  tabbar: ["footer"],
  sidebar: ["filters", "toolbar"],
  filters: ["toolbar", "sidebar"],
  table: ["list", "cards"],
  list: ["table", "cards"],
  detail: ["content", "hero"],
  sheet: ["detail", "form"],
  empty: ["content", "hero"],
  other: ["content"],
};

// ---------------------------------------------------------------------------
// Seeded random

/** FNV-1a hash of a string to a 32 bit seed. */
export function hashSeed(input: string | number): number {
  const s = String(input);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, good enough for picking parts. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Where a part came from, for source mixing: its source page. */
export function sourceKey(p: Part): string {
  return p.sourceUrl;
}

/** Stable key of which parts fill which slots, for spotting identical variants. */
export function stitchKey(rows: readonly StitchRow[]): string {
  return rows.map((r) => r.slots.map((s) => s.partId).join("+")).join("/");
}

function candidatesFor(role: PartRole, parts: readonly Part[]): { list: Part[]; role: PartRole | null } {
  const own = parts.filter((p) => p.role === role);
  if (own.length > 0) return { list: own, role };
  for (const alt of RELATED_ROLES[role] ?? []) {
    const list = parts.filter((p) => p.role === alt);
    if (list.length > 0) return { list, role: alt };
  }
  return { list: [], role: null };
}

/**
 * Pick one part per slot. Slots are visited in a random order; each prefers a part from a source
 * not used yet in this stitch, then a part not used yet, then any.
 */
function pickParts(
  slots: readonly { candidates: readonly Part[]; fixed?: Part }[],
  rand: () => number,
  prefer = true,
): Part[] {
  const out: (Part | undefined)[] = slots.map((s) => s.fixed);
  const usedSources = new Set(out.flatMap((p) => (p ? [sourceKey(p)] : [])));
  const usedParts = new Set(out.flatMap((p) => (p ? [p.id] : [])));
  const order = shuffled(slots.map((_, i) => i).filter((i) => !slots[i]!.fixed), rand);
  for (const i of order) {
    const list = shuffled(slots[i]!.candidates, rand);
    const pick = prefer
      ? (list.find((p) => !usedSources.has(sourceKey(p)) && !usedParts.has(p.id)) ?? list.find((p) => !usedParts.has(p.id)) ?? list[0])
      : list[0];
    if (!pick) continue;
    out[i] = pick;
    usedSources.add(sourceKey(pick));
    usedParts.add(pick.id);
  }
  return out as Part[];
}

/** Most distinct sources a stitch over these slots could mix, capped at 3. */
function mixTarget(slots: readonly { candidates: readonly Part[]; fixed?: Part }[]): number {
  const all = new Set(slots.flatMap((s) => (s.fixed ? [sourceKey(s.fixed)] : s.candidates.map(sourceKey))));
  return Math.min(3, slots.length, all.size);
}

function distinctSources(parts: readonly Part[]): number {
  return new Set(parts.map(sourceKey)).size;
}

const ATTEMPTS = 60;

// ---------------------------------------------------------------------------
// fillRecipe

export interface FillOptions {
  variants: number;
  seed: number | string;
  platform: StitchPlatform;
  /** Role to part id: these roles always use that part. */
  lock?: Partial<Record<PartRole, string>>;
  /** Title of the stitches; variants get " 1", " 2" and so on when there are several. */
  title?: string;
}

export interface FillResult {
  stitches: StitchData[];
  /** Plain notes: roles filled from a related role, roles skipped, fewer variants than asked. */
  notes: string[];
}

type RecipeSlot = { role: PartRole; candidates: Part[]; fixed?: Part };

/** Rows of a recipe: one row per role, except a sidebar shares its row with the next role, the main content (widths 1:4). */
function recipeRows(slots: readonly RecipeSlot[]): number[][] {
  const rows: number[][] = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]!.role === "sidebar" && i + 1 < slots.length && slots[i + 1]!.role !== "sidebar") {
      rows.push([i, i + 1]);
      i++;
    } else rows.push([i]);
  }
  return rows.slice(0, MAX_STITCH_ROWS);
}

function buildRows(layout: readonly number[][], slots: readonly RecipeSlot[], picks: readonly Part[]): StitchRow[] {
  let n = 0;
  return layout.map((idxs, r) => {
    const rowSlots: StitchSlot[] = idxs.map((i) => ({ id: `sl-${++n}`, role: slots[i]!.role, partId: picks[i]!.id }));
    const row: StitchRow = { id: `rw-${r + 1}`, slots: rowSlots };
    if (rowSlots.length === 2 && slots[idxs[0]!]!.role === "sidebar") row.widths = [1, 4];
    return row;
  });
}

export function fillRecipe(recipe: readonly PartRole[], parts: readonly Part[], opts: FillOptions): FillResult {
  const notes: string[] = [];
  const byId = new Map(parts.map((p) => [p.id, p]));
  const slots: RecipeSlot[] = [];
  for (const role of recipe) {
    const lockedId = opts.lock?.[role];
    const locked = lockedId ? byId.get(lockedId) : undefined;
    if (lockedId && !locked) notes.push(`Locked part ${lockedId} for ${role} is not in the parts library, so ${role} was filled from the library.`);
    if (locked) {
      slots.push({ role, candidates: [locked], fixed: locked });
      continue;
    }
    const found = candidatesFor(role, parts);
    if (found.list.length === 0) {
      notes.push(`No part for ${role} (or a related role) in the library, so it was skipped. Cut one with cut_parts.`);
      continue;
    }
    if (found.role !== role) notes.push(`No ${role} part in the library, so a ${found.role} part fills it.`);
    slots.push({ role, candidates: found.list });
  }
  if (slots.length === 0) return { stitches: [], notes };

  const want = Math.min(MAX_VARIANTS, Math.max(1, Math.floor(opts.variants)));
  const rand = rng(hashSeed(opts.seed));
  const target = mixTarget(slots);
  const seen = new Set<string>();
  const layout = recipeRows(slots);
  const stitches: StitchData[] = [];
  for (let v = 0; v < want; v++) {
    let best: Part[] | null = null;
    for (let a = 0; a < ATTEMPTS; a++) {
      // The first half of the attempts prefers new sources; the rest picks freely, so combinations
      // that mix fewer sources are still found once the better ones are used up.
      const picks = pickParts(slots, rand, a < ATTEMPTS / 2);
      const key = stitchKey(buildRows(layout, slots, picks));
      if (seen.has(key)) continue;
      if (distinctSources(picks) >= target) {
        best = picks;
        break;
      }
      if (!best || distinctSources(picks) > distinctSources(best)) best = picks;
    }
    if (!best) break;
    const rows = buildRows(layout, slots, best);
    seen.add(stitchKey(rows));
    const base = opts.title ?? "Frankenstein page";
    stitches.push({
      title: want > 1 ? `${base} ${v + 1}` : base,
      platform: opts.platform,
      mode: "collage",
      rows,
      ...(want > 1 ? { variant: v + 1 } : {}),
    });
  }
  if (stitches.length < want) {
    notes.push(`Made ${stitches.length} of ${want} variants: the library has no more different combinations. Cut more parts to get more.`);
  }
  return { stitches, notes };
}

// ---------------------------------------------------------------------------
// remix

export interface RemixOptions {
  count: number;
  /** Slot ids or roles to keep as they are. */
  lock?: readonly string[];
  /** Roles to swap. When set, only these roles change. */
  vary?: readonly PartRole[];
  seed: number | string;
  /** stitchKey values to avoid (the original and its siblings on the canvas). */
  avoid?: readonly string[];
}

export interface RemixResult {
  stitches: StitchData[];
  notes: string[];
}

export function remix(stitch: StitchData, parts: readonly Part[], opts: RemixOptions): RemixResult {
  const notes: string[] = [];
  const byId = new Map(parts.map((p) => [p.id, p]));
  const lock = new Set(opts.lock ?? []);
  const vary = opts.vary && opts.vary.length > 0 ? new Set<string>(opts.vary) : null;
  const flat = stitch.rows.flatMap((row) => row.slots);
  const slots = flat.map((slot) => {
    const current = byId.get(slot.partId);
    const keep = lock.has(slot.id) || lock.has(slot.role) || (vary !== null && !vary.has(slot.role));
    if (keep && current) return { candidates: [current], fixed: current };
    const found = candidatesFor(slot.role, parts);
    const candidates = found.list.length > 0 ? found.list : current ? [current] : [];
    // Prefer a different part than the one the slot has now.
    const others = candidates.filter((p) => p.id !== slot.partId);
    return { candidates: others.length > 0 ? others : candidates };
  });
  if (flat.some((_, i) => slots[i]!.candidates.length === 0)) {
    notes.push("Some slots point at parts no longer in the library; they keep their place but cannot change.");
  }
  const changeable = slots.filter((s) => !s.fixed && s.candidates.length > 0).length;
  if (changeable === 0) {
    return { stitches: [], notes: [...notes, "Nothing to remix: every slot is locked or has no other part of its role. Cut more parts or lock less."] };
  }

  const want = Math.min(MAX_VARIANTS, Math.max(1, Math.floor(opts.count)));
  const rand = rng(hashSeed(opts.seed));
  const target = mixTarget(slots);
  const seen = new Set<string>([stitchKey(stitch.rows), ...(opts.avoid ?? [])]);
  const out: StitchData[] = [];
  const rebuild = (picks: readonly (Part | undefined)[]): StitchRow[] => {
    let i = 0;
    return stitch.rows.map((row) => {
      const rowSlots = row.slots.map((slot) => {
        const pick = picks[i++];
        if (!pick || pick.id === slot.partId) return { ...slot };
        // A new part brings its own crop; the per slot override was for the old one.
        const { crop: _crop, ...rest } = slot;
        return { ...rest, partId: pick.id };
      });
      return { ...row, slots: rowSlots };
    });
  };
  for (let v = 0; v < want; v++) {
    let best: StitchRow[] | null = null;
    let bestMix = -1;
    for (let a = 0; a < ATTEMPTS; a++) {
      const picks = pickParts(slots, rand, a < ATTEMPTS / 2);
      const rows = rebuild(picks);
      if (seen.has(stitchKey(rows))) continue;
      const mix = distinctSources(picks.filter(Boolean));
      if (mix >= target) {
        best = rows;
        break;
      }
      if (mix > bestMix) {
        best = rows;
        bestMix = mix;
      }
    }
    if (!best) break;
    seen.add(stitchKey(best));
    out.push({ ...stitch, rows: best });
  }
  if (out.length < want) notes.push(`Made ${out.length} of ${want} variants: there are no more different combinations. Cut more parts or lock less.`);
  return { stitches: out, notes };
}
