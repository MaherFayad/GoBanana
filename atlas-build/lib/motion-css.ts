/**
 * Motion recipes (P1-J13): the model writes WAAPI keyframes and timing; this file computes the
 * matching CSS (so the two can never drift) and the static checks that need no browser.
 *
 * The CSS for a recipe with id "x":
 *   @keyframes gb-x { ... }                       one block per keyframe, easing as animation-timing-function
 *   .gb-x { animation: gb-x ...; transform-origin: ... }           target "self"
 *   .gb-x > * { ...; animation-delay: calc(var(--i, 0) * Nms + Dms) } target "children": set --i on each child
 *   @media (prefers-reduced-motion: reduce) { ... }  static: animation none; fade: an opacity-only keyframe
 */
import type { MotionKeyframe, MotionRecipe } from "../schema.ts";

const PROPS = ["transform", "opacity", "clipPath", "filter"] as const;
const kebab = (p: string) => p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Offsets as WAAPI computes them: missing ones are spread evenly between known ones (first 0, last 1). */
export function computedOffsets(frames: readonly MotionKeyframe[]): number[] {
  const n = frames.length;
  const out: Array<number | undefined> = frames.map((f) => f.offset);
  if (out[0] === undefined) out[0] = n === 1 ? 1 : 0;
  if (out[n - 1] === undefined) out[n - 1] = 1;
  let i = 0;
  while (i < n) {
    if (out[i] !== undefined) {
      i++;
      continue;
    }
    const a = i - 1;
    let b = i;
    while (out[b] === undefined) b++;
    const from = out[a]!;
    const to = out[b]!;
    for (let k = i; k < b; k++) out[k] = from + ((to - from) * (k - a)) / (b - a);
    i = b;
  }
  return out as number[];
}

const pct = (o: number) => `${Number((o * 100).toFixed(3))}%`;

export type MotionCore = Pick<MotionRecipe, "id" | "target" | "stagger" | "origin" | "keyframes" | "timing" | "reduced">;

/** The CSS for one recipe (deterministic; the record's `css` field). */
export function motionCss(r: MotionCore): string {
  const name = `gb-${r.id}`;
  const offsets = computedOffsets(r.keyframes);
  const blocks = r.keyframes.map((f, i) => {
    const decl = PROPS.filter((p) => f[p] !== undefined).map((p) => `${kebab(p)}: ${f[p]};`);
    if (f.easing) decl.push(`animation-timing-function: ${f.easing};`);
    return `  ${pct(offsets[i]!)} { ${decl.join(" ")} }`;
  });
  const t = r.timing;
  const iterations = t.iterations === "infinite" ? "infinite" : String(t.iterations);
  const sel = r.target === "children" ? `.${name} > *` : `.${name}`;
  const delay = r.target === "children" && r.stagger > 0 ? `calc(var(--i, 0) * ${r.stagger}ms + ${t.delay}ms)` : `${t.delay}ms`;
  const lines = [
    `@keyframes ${name} {`,
    ...blocks,
    `}`,
    `${sel} {`,
    `  animation: ${name} ${t.duration}ms ${t.easing} ${t.delay}ms ${iterations} ${t.direction} ${t.fill};`,
    ...(delay !== `${t.delay}ms` ? [`  animation-delay: ${delay};`] : []),
    `  transform-origin: ${r.origin};`,
    `}`,
  ];
  if (r.reduced.kind === "fade") {
    const ms = r.reduced.ms ?? 200;
    lines.push(
      `@keyframes ${name}-reduced { from { opacity: 0; } to { opacity: 1; } }`,
      `@media (prefers-reduced-motion: reduce) {`,
      `  ${sel} { animation: ${name}-reduced ${ms}ms ease-out ${r.target === "children" ? "0ms" : `${t.delay}ms`} 1 normal both; transform: none; clip-path: none; filter: none; }`,
      `}`,
    );
  } else {
    lines.push(`@media (prefers-reduced-motion: reduce) {`, `  ${sel} { animation: none; }`, `}`);
  }
  return lines.join("\n") + "\n";
}

/** Rules a browser does not need to check. Problems are plain lines for the repair prompt. */
export function motionStaticProblems(r: MotionCore & Pick<MotionRecipe, "trigger">): string[] {
  const out: string[] = [];
  const offsets = r.keyframes.map((f) => f.offset).filter((o): o is number => o !== undefined);
  for (let i = 1; i < offsets.length; i++) if (offsets[i]! < offsets[i - 1]!) out.push("keyframe offsets must not go down");
  const used = new Set(r.keyframes.flatMap((f) => PROPS.filter((p) => f[p] !== undefined)));
  if (used.size === 0) out.push("keyframes animate nothing: use transform, opacity, clipPath or filter");
  else if (!used.has("transform") && !used.has("clipPath") && !used.has("filter")) out.push("the motion only fades: animate transform, clipPath or filter too (opacity alone is the reduced fallback, not a motion)");
  const ends = [r.keyframes[0]!, r.keyframes[r.keyframes.length - 1]!];
  for (const p of used) if (ends.some((f) => f[p] === undefined)) out.push(`the first and last keyframes must both set ${p} (every animated property)`);
  const d = r.timing.duration;
  const loop = r.trigger === "loop" || r.timing.iterations === "infinite";
  if (loop && d < 800) out.push(`a loop needs a duration of at least 800ms (got ${d}ms)`);
  if (!loop && d > 1600) out.push(`a one-shot ${r.trigger} motion should finish within 1600ms (got ${d}ms)`);
  if (r.target === "self" && r.stagger !== 0) out.push("stagger must be 0 when target is self");
  if (r.target === "children" && r.stagger === 0) out.push("target children needs a stagger above 0");
  // WCAG 2.3.1: no more than three flashes a second. An opacity swing over 0.5 counts as a flash.
  const op = r.keyframes.map((f) => f.opacity).filter((o): o is number => o !== undefined);
  if (op.length > 1 && Math.max(...op) - Math.min(...op) > 0.5) {
    let swings = 0;
    for (let i = 1; i < op.length; i++) if (Math.abs(op[i]! - op[i - 1]!) > 0.5) swings++;
    const cycles = r.timing.iterations === "infinite" ? Infinity : r.timing.iterations;
    const perSecond = (swings * 1000) / d;
    if (cycles > 1 && perSecond > 3) out.push(`opacity flashes ${perSecond.toFixed(1)} times a second (WCAG 2.3.1 allows 3)`);
  }
  if (r.keyframes.some((f) => f.filter && /blur\(\s*(\d+(\.\d+)?)px/.test(f.filter) && Number(/blur\(\s*(\d+(\.\d+)?)px/.exec(f.filter)![1]) > 24)) out.push("blur over 24px is too heavy");
  if (r.reduced.kind === "fade" && r.reduced.ms === undefined) out.push("a fade fallback needs ms");
  return out;
}
