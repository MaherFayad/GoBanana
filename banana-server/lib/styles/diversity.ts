/**
 * The style diversity rule (owner decisions 2026-10-16, docs/styles/INDEX.md). Pure.
 *
 * A board is one direction's UI references (the art row is not counted). A reference's main style
 * is its first style tag. Untagged references are not counted by the rule; the board check lists
 * them so the agent can tag them with rate_references.
 *
 * 1. At most 3 references of one main style per direction, or 2 when the board has 6 or fewer.
 * 2. At most 60% of a board carries any one tag (all tags counted). The two dark styles count as
 *    one tag unless the brief asks for dark. An asked style (and its neighbour) is exempt.
 * 3. At least 3 main styles per board when no style is asked, or 4 at 8 or more.
 * 4. When a style is asked, at least 60% of the board is that style or its neighbour (main style).
 * 5. Each direction names its style id, and no two directions of one brief share a main style.
 * 6. At most 1 vivid-gradient reference per board unless asked.
 */
import { DARK_STYLES, neighbourOf, STYLE_RULE, styleById, type StyleId } from "./index";
import { isStyleId } from "./ids";

export type Tagged = { styles?: readonly string[] | null };

export type StyleRuleOptions = {
  /** Styles the brief or taste asks for (detectStyles). The first one leads. */
  asked?: readonly StyleId[];
};

const VIVID: StyleId = "vivid-gradient";

/** The main style of a reference, or null when it has no known tag. */
export function mainStyle(ref: Tagged): StyleId | null {
  const first = ref.styles?.[0];
  return isStyleId(first) ? first : null;
}

/** Known style tags of a reference. */
function tagsOf(ref: Tagged): StyleId[] {
  return (ref.styles ?? []).filter(isStyleId);
}

/** Most references of one main style on a board of this size (rule 1). */
export function mainCap(boardSize: number): number {
  return boardSize <= STYLE_RULE.smallBoard ? STYLE_RULE.perDirectionMainSmall : STYLE_RULE.perDirectionMain;
}

/** Fewest main styles on a board of this size when no style is asked (rule 3). */
export function minMainStyles(boardSize: number): number {
  return boardSize >= STYLE_RULE.largeBoard ? STYLE_RULE.minMainStylesLarge : STYLE_RULE.minMainStyles;
}

const askedDark = (asked: readonly StyleId[]) => asked.some((a) => DARK_STYLES.includes(a));

/** The share keys of a reference's tags (rule 2): the dark styles fold into "dark" unless dark is asked. */
function shareKeys(ref: Tagged, asked: readonly StyleId[]): string[] {
  const fold = !askedDark(asked);
  return [...new Set(tagsOf(ref).map((t) => (fold && DARK_STYLES.includes(t) ? "dark" : t)))];
}

/** Share keys rule 2 never caps: the asked styles and their neighbours. */
function exemptKeys(asked: readonly StyleId[]): Set<string> {
  return new Set(asked.flatMap((a) => [a, neighbourOf(a)]));
}

/**
 * Order references so the first `boardSize` keep rules 1, 2 and 6 where the results allow: a
 * tagged reference that would break a cap moves after the others (never dropped). Untagged
 * references keep their place. Stable otherwise.
 */
export function orderByStyle<T extends Tagged>(refs: readonly T[], boardSize: number, opts: StyleRuleOptions = {}): { refs: T[]; moved: number } {
  const asked = opts.asked ?? [];
  const cap = mainCap(boardSize);
  const shareCap = Math.max(1, Math.floor(STYLE_RULE.tagShare * boardSize));
  const exempt = exemptKeys(asked);
  const vividAsked = asked.includes(VIVID);
  const mains = new Map<StyleId, number>();
  const shares = new Map<string, number>();
  let vivid = 0;
  let moved = 0;
  const placed: T[] = [];
  const later: T[] = [];
  for (const ref of refs) {
    if (placed.length >= boardSize) {
      later.push(ref);
      continue;
    }
    const main = mainStyle(ref);
    if (!main) {
      placed.push(ref);
      continue;
    }
    const keys = shareKeys(ref, asked);
    const isVivid = tagsOf(ref).includes(VIVID);
    const over =
      (mains.get(main) ?? 0) >= cap ||
      (!vividAsked && isVivid && vivid >= STYLE_RULE.vividMax) ||
      keys.some((k) => !exempt.has(k) && (shares.get(k) ?? 0) >= shareCap);
    if (over) {
      later.push(ref);
      moved++;
      continue;
    }
    placed.push(ref);
    mains.set(main, (mains.get(main) ?? 0) + 1);
    for (const k of keys) shares.set(k, (shares.get(k) ?? 0) + 1);
    if (isVivid) vivid++;
  }
  return { refs: [...placed, ...later], moved };
}

export type BoardCheck = {
  /** UI references on the board. */
  size: number;
  tagged: number;
  /** Ids of UI references with no style tag (tag them with rate_references). */
  untagged: string[];
  /** Main style counts. */
  mains: Partial<Record<StyleId, number>>;
  /** Plain lines, one per broken rule. Empty when the board keeps the rule. */
  problems: string[];
};

/**
 * Check one direction's board against rules 1, 2, 3, 4 and 6. Counts tagged UI references only;
 * thresholds use the whole board size. A board with fewer than 2 tagged references is not judged.
 */
export function checkBoard(refs: readonly (Tagged & { id: string })[], opts: StyleRuleOptions = {}): BoardCheck {
  const asked = opts.asked ?? [];
  const size = refs.length;
  const tagged = refs.filter((r) => mainStyle(r));
  const untagged = refs.filter((r) => !mainStyle(r)).map((r) => r.id);
  const mains: Partial<Record<StyleId, number>> = {};
  for (const r of tagged) mains[mainStyle(r)!] = (mains[mainStyle(r)!] ?? 0) + 1;
  const problems: string[] = [];
  if (tagged.length >= 2) {
    const cap = mainCap(size);
    for (const [id, n] of Object.entries(mains) as [StyleId, number][]) {
      if (n > cap) problems.push(`${n} references are ${id}; at most ${cap} of one main style on a board of ${size}.`);
    }
    const exempt = exemptKeys(asked);
    const shares = new Map<string, number>();
    for (const r of tagged) for (const k of shareKeys(r, asked)) shares.set(k, (shares.get(k) ?? 0) + 1);
    for (const [k, n] of shares) {
      if (!exempt.has(k) && n / tagged.length > STYLE_RULE.tagShare) {
        const what = k === "dark" ? "dark (dark-luminous and dark-quiet-matte together)" : k;
        problems.push(`${n} of ${tagged.length} tagged references carry ${what}; keep any one tag to 60% or less.`);
      }
    }
    if (asked.length === 0) {
      const need = minMainStyles(size);
      const have = Object.keys(mains).length;
      if (have < need) problems.push(`Only ${have} main styles; show at least ${need} on a board of ${size} when no style is asked.`);
    } else {
      const lead = asked[0]!;
      const ok = new Set<StyleId>([lead, neighbourOf(lead)]);
      const n = tagged.filter((r) => ok.has(mainStyle(r)!)).length;
      if (n / tagged.length < STYLE_RULE.askedShare) {
        problems.push(`Only ${n} of ${tagged.length} tagged references are ${lead} or ${neighbourOf(lead)}; the brief asks for ${lead}, so make it at least 60%.`);
      }
    }
    if (!asked.includes(VIVID)) {
      const v = tagged.filter((r) => tagsOf(r).includes(VIVID)).length;
      if (v > STYLE_RULE.vividMax) problems.push(`${v} vivid-gradient references; at most 1 unless the brief asks for it.`);
    }
  }
  return { size, tagged: tagged.length, untagged, mains, problems };
}

/** Rule 5: every direction names a style id, and no two share one. Plain lines, empty when kept. */
export function checkDirectionStyles(directions: readonly { id: string; styleId?: string | null }[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const d of directions) {
    if (!d.styleId || !isStyleId(d.styleId)) {
      problems.push(`Direction ${d.id} names no style id.`);
      continue;
    }
    const other = seen.get(d.styleId);
    if (other) problems.push(`Directions ${other} and ${d.id} share the main style ${d.styleId}; give each direction its own.`);
    else seen.set(d.styleId, d.id);
  }
  return problems;
}

/**
 * One style id per direction, none shared (rule 5): a direction keeps the first style its own
 * words name that is still free; the asked style goes to the first direction that has none, its
 * neighbour to the next; the rest take free styles that fit the genre, in `fallback` order.
 */
export function assignDirectionStyles(
  named: readonly (readonly StyleId[])[],
  opts: { asked?: readonly StyleId[]; fits?: (id: StyleId) => boolean; fallback: readonly StyleId[] },
): StyleId[] {
  const fits = opts.fits ?? (() => true);
  const used = new Set<StyleId>();
  const out: (StyleId | null)[] = named.map(() => null);
  const queue: StyleId[] = [];
  for (const a of opts.asked ?? []) for (const id of [a, neighbourOf(a)]) if (!queue.includes(id) && fits(id)) queue.push(id);
  // Asked styles first (the asked style, then its neighbour), so the board leans the way the user asked.
  queue.slice(0, named.length).forEach((id, i) => {
    out[i] = id;
    used.add(id);
  });
  named.forEach((ids, i) => {
    if (out[i]) return;
    const own = ids.find((id) => fits(id) && !used.has(id) && !styleById(id).layered);
    if (own) {
      out[i] = own;
      used.add(own);
    }
  });
  out.forEach((id, i) => {
    if (id) return;
    const next = opts.fallback.find((f) => fits(f) && !used.has(f) && !styleById(f).layered);
    if (next) {
      out[i] = next;
      used.add(next);
    }
  });
  return out.map((id) => id ?? opts.fallback[0]!);
}
