/**
 * Rewrite arms for a lane, and how one is picked (pure, deterministic, no AI). An arm is one way
 * of wording or routing a lane's requests. Ratings from rate_references are pooled per term key
 * (lib/learning/terms.ts) and arm; planning picks an arm by Thompson sampling with a seeded RNG
 * (cyrb53 + mulberry32, the same as lib/bend).
 *
 * Arms (every lane is a UI lane; the inspiration lane and its arms were removed, and old ratings
 * of it are ignored: its term keys are never asked for):
 *   fidelity     default (with the core noun fallback), core (core noun up front)
 *   taste        default "{style} {domain} {component} ui design",
 *                app "{style} {domain} app {component} ui" (app briefs), core (core domain noun)
 *   component    default "{core} {component} ui", app "{core} {component} app ui"
 *   bridge       default "{ingredient} ui design", app "{ingredient} app ui"
 *   hero, locale default
 *   any lane     agent:{words}, recorded when an agent re-searches one lane with its own words
 *
 * Rules:
 * - A term with no usable ratings uses the default arm.
 * - Ratings reach other users only when at least K_ANON distinct users rated that term and arm,
 *   each user counted once (their net verdict). Below that only the raters' own ratings apply,
 *   and only for them. With GLOBAL_LEARNING=off only the user's own ratings apply.
 */
import { cyrb53, mulberry32, type Rng } from "../bend/prng";
import { componentAppText } from "../bend/queries";
import { bridgeHead, planRequests, type LaneTexts, type PlannedRequest } from "../sources/plan";
import type { LaneName, SourceSite } from "../sources/types";
import { MAX_KEY_LENGTH, queryWords } from "./terms";

/** Distinct users who must rate a term and arm before it influences anyone else. */
export const K_ANON = 3;

export const UI_DEFAULT = "default";
export const AGENT_PREFIX = "agent:";

/** Every lane's default arm (all lanes are UI lanes). */
export function defaultArm(_lane: LaneName): string {
  return UI_DEFAULT;
}

/** Lane texts for the taste arms that are not in LaneTexts (lib/bend/queries.ts tasteVariants). */
export type ArmVariants = { tasteApp?: string; tasteCore?: string };

/** Built-in arms a lane can use, default first. */
export function builtInArms(lane: LaneName, lanes: LaneTexts, variants: ArmVariants = {}): string[] {
  switch (lane) {
    case "fidelity":
      return lanes.fidelityCore ? [UI_DEFAULT, "core"] : [UI_DEFAULT];
    case "taste":
      return [UI_DEFAULT, ...(variants.tasteApp ? ["app"] : []), ...(variants.tasteCore ? ["core"] : [])];
    case "component":
      return lanes.component?.length ? [UI_DEFAULT, "app"] : [UI_DEFAULT];
    case "bridge":
      return lanes.bridge ? [UI_DEFAULT, "app"] : [UI_DEFAULT];
    default:
      return [UI_DEFAULT];
  }
}

/** Bridge lane words for the `app` arm: "{ingredient} app ui". */
export function bridgeAppText(ingredient: string): string {
  return `${ingredient} app ui`;
}

/** Arm id for an agent's own words for a lane (site operators and negatives stripped). */
export function agentArm(text: string): string {
  return `${AGENT_PREFIX}${queryWords(text)}`.slice(0, MAX_KEY_LENGTH);
}

export function isAgentArm(arm: string): boolean {
  return arm.startsWith(AGENT_PREFIX) && arm.length > AGENT_PREFIX.length;
}

/**
 * The lane texts with each lane's picked arm applied, plus the routing the arms ask for.
 * Lanes without a pick use their default. Unknown or unavailable arms fall back to the default.
 */
export function planWithArms(
  lanes: LaneTexts,
  arms: Partial<Record<LaneName, string>>,
  sources?: readonly SourceSite[],
  variants: ArmVariants = {},
): PlannedRequest[] {
  const out: LaneTexts = { ...lanes };
  const agentWords = (lane: LaneName) => {
    const arm = arms[lane];
    return arm && isAgentArm(arm) ? arm.slice(AGENT_PREFIX.length) : undefined;
  };

  if (lanes.fidelity) {
    const agent = agentWords("fidelity");
    if (agent) {
      out.fidelity = agent;
      delete out.fidelityCore;
    } else if (arms.fidelity === "core" && lanes.fidelityCore) {
      out.fidelity = lanes.fidelityCore;
      delete out.fidelityCore;
    }
  }
  if (lanes.taste) {
    const agent = agentWords("taste");
    if (agent) out.taste = agent;
    else if (arms.taste === "app" && variants.tasteApp) out.taste = variants.tasteApp;
    else if (arms.taste === "core" && variants.tasteCore) out.taste = variants.tasteCore;
  }
  if (lanes.component?.length) {
    const agent = agentWords("component");
    if (agent) out.component = [agent];
    else if (arms.component === "app") out.component = lanes.component.map(componentAppText);
  }
  if (lanes.bridge) {
    const agent = agentWords("bridge");
    if (agent) out.bridge = agent;
    else if (arms.bridge === "app") out.bridge = bridgeAppText(lanes.idea);
  }
  for (const lane of ["hero", "locale"] as const) {
    const agent = agentWords(lane);
    if (agent && lanes[lane]) out[lane] = agent;
  }

  // The bridge filter keeps the direction's own idea, whatever words the bridge arm used.
  return planRequests(out, sources, { bridgeWord: bridgeHead(lanes.idea) });
}

/**
 * The requests one lane would send with `text` as its words (a lane-only re-search). A bridge
 * re-search keeps the title filter of the direction's `ingredient` (no ingredient, no request).
 */
export function planLane(lane: LaneName, text: string, sources?: readonly SourceSite[], ingredient?: string): PlannedRequest[] {
  const lanes: LaneTexts = { idea: ingredient ?? "" };
  if (lane === "component") lanes.component = [text];
  else lanes[lane] = text;
  return planRequests(lanes, sources, { bridgeWord: bridgeHead(ingredient) }).filter((r) => r.lane === lane);
}

/** Grouped rating counts: `great`, `bad` and `users` count each user once; `own*` are this user's raw counts. */
export type CountStat = {
  great: number;
  bad: number;
  users: number;
  ownGreat: number;
  ownBad: number;
};

/** Ratings of one term and arm. */
export type ArmStat = CountStat & {
  termKey: string;
  arm: string;
};

/** The counts that may influence this user, or null when none may. */
export function usableCounts(stat: CountStat, opts: { global: boolean; k?: number }): { great: number; bad: number } | null {
  if (opts.global && stat.users >= (opts.k ?? K_ANON)) return { great: stat.great, bad: stat.bad };
  if (stat.ownGreat + stat.ownBad > 0) return { great: stat.ownGreat, bad: stat.ownBad };
  return null;
}

/** Standard normal (Box-Muller). */
function normal(rng: Rng): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(shape >= 1, 1), Marsaglia and Tsang. Bounded loop: falls back to the mean. */
function gamma(shape: number, rng: Rng): number {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let i = 0; i < 64; i++) {
    const x = normal(rng);
    const v = (1 + c * x) ** 3;
    if (v <= 0) continue;
    const u = 1 - rng();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return shape;
}

/** Beta(a, b) sample for a, b >= 1. */
export function sampleBeta(a: number, b: number, rng: Rng): number {
  const x = gamma(a, rng);
  const y = gamma(b, rng);
  return x / (x + y);
}

export type ArmPick = { arm: string; learned: boolean };

/**
 * Pick the arm for one lane. `candidates` are the built-in arms (default first); agent arms come
 * from `stats` when their counts are usable. Thompson sampling, one Beta draw per arm:
 * - the default: Beta(2 + great, 1 + bad), a head start because it is the verified grammar;
 * - an arm with usable ratings: Beta(1 + great, 1 + bad);
 * - an untried built-in arm: Beta(1, 2), so it is tried mostly when the rated arms look poor.
 * Untried arms only take part once the term has any usable rating; a term with none keeps the
 * default. Same seed and stats, same pick.
 */
export function pickArm(input: {
  termKey: string;
  candidates: readonly string[];
  stats: readonly ArmStat[];
  global: boolean;
  seed: string;
  k?: number;
}): ArmPick {
  const def = input.candidates[0]!;
  const counts = new Map<string, { great: number; bad: number }>();
  for (const s of input.stats) {
    if (s.termKey !== input.termKey) continue;
    if (!input.candidates.includes(s.arm) && !isAgentArm(s.arm)) continue;
    const c = usableCounts(s, { global: input.global, k: input.k });
    if (c && c.great + c.bad > 0) counts.set(s.arm, c);
  }
  if (counts.size === 0) return { arm: def, learned: false };

  const others = [...new Set([...input.candidates.slice(1), ...counts.keys()])].filter((a) => a !== def).sort();
  const rng = mulberry32(cyrb53(`${input.seed}|${input.termKey}`));
  let best = def;
  let bestScore = -1;
  for (const arm of [def, ...others]) {
    const c = counts.get(arm);
    const score =
      arm === def
        ? sampleBeta(2 + (c?.great ?? 0), 1 + (c?.bad ?? 0), rng)
        : c
          ? sampleBeta(1 + c.great, 1 + c.bad, rng)
          : sampleBeta(1, 2, rng);
    if (score > bestScore) {
      best = arm;
      bestScore = score;
    }
  }
  return { arm: best, learned: best !== def };
}

/** True unless GLOBAL_LEARNING is "off" (any case). */
export function globalLearningOn(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== "off";
}
