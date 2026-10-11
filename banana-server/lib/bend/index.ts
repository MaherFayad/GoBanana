import { BendInputError, parseBendInput } from "./input";
import { getLens, LISTS, STOP_WORDS } from "./lists";
import { MOVE_DEFS } from "./moves";
import { cyrb53, mulberry32, shuffle, stableId, type Rng } from "./prng";
import { extractSubject, type Subject } from "./subject";
import {
  MODIFIER_TEMPLATES,
  PRIMARY_TEMPLATES,
  PROMPT_CLAUSES,
  PROMPT_OPENING,
  render,
} from "./templates";
import {
  MOVES,
  type BendInput,
  type BendResult,
  type Direction,
  type Ingredients,
  type ListEntry,
  type MoveId,
  type Wildness,
} from "./types";
import { WILDNESS } from "./wildness";

export { parseBendInput, bendInputSchema, BendInputError, MAX_COUNT, DEFAULT_COUNT } from "./input";
export { LENSES, LENS_IDS, LISTS } from "./lists";
export { WILDNESS } from "./wildness";
export { MOVES } from "./types";
export type { BendInput, BendResult, Direction, MoveId, Wildness } from "./types";

/** Hard cap on search query length, in words. */
export const MAX_QUERY_WORDS = 9;
/** Bump when lists or rules change in a way that should reshuffle every brief. */
const ENGINE_VERSION = "bend-v1";

/** Every direction is generated up to this many, then sliced to count, so ids stay stable across counts. */
const GENERATED = 8;

function stem(word: string): string {
  const w = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w;
}

function contentStems(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s-]+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .map(stem)
    .filter(Boolean);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k <= 0) return [[]];
  if (k > items.length) return [];
  const out: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i] as T);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

/** Draws list entries without repeats, and avoids entries that share a word with anything already used. */
class EntryPicker {
  private readonly usedLabels = new Set<string>();
  private readonly usedStems = new Set<string>();
  private readonly pools = new Map<string, ListEntry[]>();

  constructor(
    private readonly rng: Rng,
    subjectWords: readonly string[],
  ) {
    for (const w of subjectWords) this.usedStems.add(stem(w));
  }

  pick(poolKey: string, entries: readonly ListEntry[], checkOverlap: boolean): ListEntry {
    let pool = this.pools.get(poolKey);
    if (!pool) {
      pool = shuffle(entries, this.rng);
      this.pools.set(poolKey, pool);
    }
    const fresh = pool.filter((e) => !this.usedLabels.has(e.label.toLowerCase()));
    const clear = checkOverlap
      ? fresh.find((e) => contentStems(e.label).every((s) => !this.usedStems.has(s)))
      : undefined;
    const chosen = clear ?? fresh[0] ?? pool[0];
    if (!chosen) throw new Error(`Empty word list: ${poolKey}`);
    this.usedLabels.add(chosen.label.toLowerCase());
    for (const s of contentStems(chosen.label)) this.usedStems.add(s);
    return chosen;
  }
}

/** Rotates through a shuffled order of each template list so one call rarely repeats a template. */
class TemplatePicker {
  private readonly orders = new Map<string, number[]>();
  private readonly cursors = new Map<string, number>();

  constructor(private readonly rng: Rng) {}

  next(key: string, size: number): number {
    let order = this.orders.get(key);
    if (!order) {
      order = shuffle(
        Array.from({ length: size }, (_, i) => i),
        this.rng,
      );
      this.orders.set(key, order);
    }
    const cursor = this.cursors.get(key) ?? 0;
    this.cursors.set(key, cursor + 1);
    return order[cursor % order.length] ?? 0;
  }
}

interface QueryPiece {
  text: string;
  order: number;
  priority: number;
  required: boolean;
}

function buildQuery(
  moves: readonly MoveId[],
  entries: readonly ListEntry[],
  mood: string,
  subject: Subject,
  wildness: Wildness,
): string {
  const pieces: QueryPiece[] = [];
  moves.forEach((move, i) => {
    const def = MOVE_DEFS[move];
    const entry = entries[i];
    if (!entry) return;
    const core = def.prefix ? `${def.prefix} ${entry.query}` : entry.query;
    pieces.push({ text: core, order: i * 2, priority: 0, required: true });
    const tail = i === 0 ? def.fullTail : def.shortTail;
    if (tail) pieces.push({ text: tail, order: i * 2 + 1, priority: i === 0 ? 1 : 4 + i, required: false });
  });

  // Subject: always at 1 and 2 (layout words kept at 1), when it fits at 3,
  // and at 4 and 5 only where the era pattern asks for it.
  if (wildness <= 2) {
    pieces.push({ text: subject.query, order: 10, priority: 0, required: true });
  } else if (wildness === 3 || moves.includes("era")) {
    pieces.push({ text: subject.query, order: 10, priority: 2, required: false });
  }
  // Mood rides along only on a lone transplant ("neon-lit matchbook packaging design").
  if (moves[0] === "transplant" && moves.length === 1 && wildness >= 2) {
    pieces.push({ text: mood, order: -1, priority: 3, required: false });
  }

  const chosen = pieces.filter((p) => p.required);
  let words = chosen.reduce((n, p) => n + wordCount(p.text), 0);
  const taken = new Set(chosen.flatMap((p) => p.text.toLowerCase().split(/\s+/)));
  for (const p of pieces.filter((x) => !x.required).sort((a, b) => a.priority - b.priority)) {
    const w = wordCount(p.text);
    const parts = p.text.toLowerCase().split(/\s+/);
    // Skip a piece that would echo words already in the query ("design design").
    if (words + w <= MAX_QUERY_WORDS && !parts.some((x) => taken.has(x))) {
      for (const x of parts) taken.add(x);
      chosen.push(p);
      words += w;
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of chosen.sort((a, b) => a.order - b.order)) {
    for (const w of p.text.split(/\s+/)) {
      const k = w.toLowerCase();
      if (!w || seen.has(k)) continue;
      seen.add(k);
      out.push(w);
    }
  }
  return out.slice(0, MAX_QUERY_WORDS).join(" ");
}

function seedKey(input: BendInput): string {
  const brief = input.brief.trim().toLowerCase().replace(/\s+/g, " ");
  const moves = input.moves ? [...new Set(input.moves)].sort() : null;
  return JSON.stringify([ENGINE_VERSION, brief, input.wildness, moves, input.lens ?? null]);
}

/** Moves per direction for each slot, before capping by how many moves are allowed. */
function moveCounts(wildness: Wildness, rng: Rng): number[] {
  const [min, max] = WILDNESS[wildness].moves;
  if (min === max) return Array.from({ length: GENERATED }, () => min);
  const first = rng() < 0.5 ? min : max;
  return Array.from({ length: GENERATED }, (_, i) => (i % 2 === 0 ? first : first === min ? max : min));
}

/**
 * Turn a plain brief into wild design directions. Rule-based and deterministic:
 * the same brief, wildness, moves and lens always give the same directions, and
 * a larger count only appends directions.
 * Throws BendInputError with a plain message on invalid input; tools should call
 * parseBendInput first.
 */
export function bendBrief(raw: BendInput): BendResult {
  const parsed = parseBendInput(raw);
  if (!parsed.ok) throw new BendInputError(parsed.message);
  const input = parsed.input;
  const wildness = input.wildness;
  const rule = WILDNESS[wildness];
  const lens = input.lens ? getLens(input.lens) : undefined;

  const key = seedKey(input);
  const rng = mulberry32(cyrb53(key));
  const subject = extractSubject(input.brief, wildness);
  const entries = new EntryPicker(rng, subject.words);
  const templates = new TemplatePicker(rng);

  // Allowed moves, in canonical order. A lens preset forces the lens move into every direction.
  const allowed: MoveId[] = MOVES.filter((m) => !input.moves || input.moves.includes(m));
  if (lens && !allowed.includes("lens")) allowed.push("lens");
  const forced: MoveId | null = lens ? "lens" : null;
  const free = allowed.filter((m) => m !== forced);

  const moveRank = new Map(shuffle(MOVES, rng).map((m, i) => [m, i]));
  const usage = new Map<MoveId, number>();
  const primaryUsage = new Map<MoveId, number>();
  const comboCache = new Map<number, MoveId[][]>();
  const usedCombos = new Set<string>();

  const combosFor = (k: number): MoveId[][] => {
    let combos = comboCache.get(k);
    if (!combos) {
      if (forced) {
        const restSize = Math.min(k - 1, free.length);
        combos = combinations(free, restSize).map((c) => [...c, forced]);
      } else {
        combos = combinations(free, Math.min(k, free.length));
      }
      combos = shuffle(combos, rng);
      comboCache.set(k, combos);
    }
    return combos;
  };

  const pickCombo = (k: number): MoveId[] => {
    const combos = combosFor(k);
    let open = combos.filter((c) => !usedCombos.has(c.join("+")));
    if (open.length === 0) {
      for (const c of combos) usedCombos.delete(c.join("+"));
      open = combos;
    }
    let best = open[0] ?? [];
    let bestScore = Infinity;
    for (const c of open) {
      const score = c.reduce((n, m) => n + (usage.get(m) ?? 0), 0);
      if (score < bestScore) {
        best = c;
        bestScore = score;
      }
    }
    usedCombos.add(best.join("+"));
    for (const m of best) usage.set(m, (usage.get(m) ?? 0) + 1);
    return best;
  };

  /** Primary move first, constraint always last (it reads best as a closing rule). */
  const orderCombo = (combo: MoveId[]): MoveId[] => {
    const leaders = combo.length > 1 ? combo.filter((m) => m !== "constraint") : combo;
    const rank = (m: MoveId) => (primaryUsage.get(m) ?? 0) * 10 + (moveRank.get(m) ?? 0);
    const primary = leaders.slice().sort((a, b) => rank(a) - rank(b))[0] ?? combo[0]!;
    primaryUsage.set(primary, (primaryUsage.get(primary) ?? 0) + 1);
    const rest = combo
      .filter((m) => m !== primary)
      .sort((a, b) => {
        if (a === "constraint") return 1;
        if (b === "constraint") return -1;
        return (moveRank.get(a) ?? 0) - (moveRank.get(b) ?? 0);
      });
    return [primary, ...rest];
  };

  const lensEntries: ListEntry[] = lens ? lens.terms.map((t) => ({ label: t, query: t })) : [];
  const counts = moveCounts(wildness, rng);
  const titles = new Set<string>();
  const directions: Direction[] = [];

  for (let i = 0; i < GENERATED; i++) {
    const moves = orderCombo(pickCombo(counts[i] ?? 1));
    const picked: ListEntry[] = moves.map((m) => {
      if (m === "lens" && lens) return entries.pick(`lens:${lens.id}`, lensEntries, false);
      const def = MOVE_DEFS[m];
      return entries.pick(def.list, LISTS[def.list], true);
    });
    const mood = entries.pick("moods", LISTS.moods, true).label;

    const ingredients: Ingredients = { mood };
    moves.forEach((m, j) => {
      const entry = picked[j];
      if (entry) ingredients[MOVE_DEFS[m].slot] = entry.label;
    });

    // Title: primary clause plus one modifier per extra move. Retry templates on a clash.
    const vars = (j: number) => ({
      subj: subject.title,
      head: subject.head,
      x: picked[j]?.label ?? "",
      m: mood,
    });
    let title = "";
    for (let attempt = 0; attempt < 12; attempt++) {
      const primary = moves[0]!;
      const pList = PRIMARY_TEMPLATES[primary];
      const opener = pList[templates.next(`p:${primary}`, pList.length)] ?? pList[0]!;
      // Openers that end in a clause ("where the stars are the size of buildings") take a comma before modifiers.
      const clauseOpener = /[,:]|\b(where|until|could|if|If)\b/.test(opener);
      let t = render(opener, vars(0));
      for (let j = 1; j < moves.length; j++) {
        const m = moves[j]!;
        const mList = MODIFIER_TEMPLATES[m];
        const mod = render(mList[templates.next(`m:${m}`, mList.length)] ?? mList[0]!, vars(j));
        const firstWord = mod.replace(/^[,\s]+/, "").split(" ")[0] ?? "";
        const echoes = new RegExp(`\\b${firstWord}\\b`, "i").test(t);
        // Readable chains: a comma after clause openers, after the first modifier, and before repeated words.
        t += !mod.startsWith(",") && (j >= 2 || clauseOpener || echoes) ? `,${mod}` : mod;
      }
      title = t;
      if (!titles.has(title.toLowerCase())) break;
    }
    titles.add(title.toLowerCase());

    const prompt = [
      render(PROMPT_OPENING, { ...vars(0), subj: subject.full }),
      ...moves.map((m, j) => render(PROMPT_CLAUSES[m], vars(j))),
      `Mood: ${mood}.`,
      rule.hint,
    ].join(" ");

    const searchQuery = buildQuery(moves, picked, mood, subject, wildness);
    const id = stableId(`${key}|${i}|${moves.join("+")}|${picked.map((e) => e.label).join("|")}`);

    directions.push({
      id,
      move: moves.join(" + "),
      moves,
      title,
      searchQuery,
      prompt,
      ingredients,
    });
  }

  return {
    brief: input.brief,
    subject: subject.title,
    wildness,
    wildnessLabel: rule.label,
    lens: lens ? { id: lens.id, name: lens.name } : null,
    directions: directions.slice(0, input.count),
  };
}

/** Readable text listing of a bend result for the agent. */
export function formatDirections(result: BendResult): string {
  const lensNote = result.lens ? `, lens: ${result.lens.name.en}` : "";
  const lines = [
    `${result.directions.length} directions for "${result.brief}" (wildness ${result.wildness}, ${result.wildnessLabel}${lensNote}):`,
    "",
  ];
  result.directions.forEach((d, i) => {
    lines.push(`${i + 1}. ${d.title}`);
    lines.push(`   move: ${d.move} | id: ${d.id}`);
    lines.push(`   search: ${d.searchQuery}`);
    lines.push(`   prompt: ${d.prompt}`);
    lines.push("");
  });
  lines.push(
    "Next: call search_references with a direction's search text as the query to pull image references. Pick the directions that excite the user, or bend again at a different wildness.",
  );
  return lines.join("\n");
}
