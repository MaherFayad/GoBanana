/**
 * The stunning layer of a build prompt (J13, VAL-14): the GLSL shader and the CSS keyframes the
 * direction's Atlas ids name, each with its prefers-reduced-motion fallback. Pure: the caller
 * loads the recipes (lib/atlas/wiring.ts loadDirectionStunning) and passes them in the kit model.
 */
import type { MotionRecipe, ShaderRecipe } from "../atlas/types";
import type { DirectionSummary, KitModel } from "./model";
import { bullets } from "./scoped";
import { mdText, oneLine } from "./util";

/** A code fence longer than any backtick run inside the code. */
function fenced(lang: string, code: string): string[] {
  const longest = Math.max(2, ...[...code.matchAll(/`+/g)].map((r) => r[0].length));
  const fence = "`".repeat(longest + 1);
  return [`${fence}${lang}`, code.trimEnd(), fence];
}

const words = (list: readonly string[]) => list.map((s) => s.replace(/-/g, " ")).join(", ");

/** Each recipe id a direction names that the model holds, in order, without repeats. */
export function directionStunning(m: KitModel, d: DirectionSummary): { shaders: ShaderRecipe[]; motion: MotionRecipe[] } {
  const st = m.stunning;
  const atlas = d.detail?.atlas;
  if (!st || !atlas) return { shaders: [], motion: [] };
  const pick = <T>(ids: readonly string[] | undefined, by: ReadonlyMap<string, T>) => [...new Set(ids ?? [])].flatMap((id) => by.get(id) ?? []);
  return { shaders: pick(atlas.shaderIds, st.shaders).slice(0, 1), motion: pick(atlas.motionIds, st.motion).slice(0, 2) };
}

function shaderBlock(r: ShaderRecipe): string[] {
  const reduced =
    r.reduced.kind === "fade"
      ? `Reduced motion: draw one frame at u_time = ${r.reduced.at} and fade the canvas in over ${r.reduced.ms ?? 200} ms; no animation loop.`
      : `Reduced motion: draw one frame at u_time = ${r.reduced.at}, show it at once and stop; no animation loop.`;
  return [
    `**Shader: ${mdText(r.name, 80)}** (for ${words(r.use)}). ${mdText(r.idea, 300)}`,
    "",
    bullets([
      `Default colors for u_c0 (surface), u_c1 (ink), u_c2 (accent), u_c3 (support): ${r.colors.map((c) => c.toUpperCase()).join(", ")}. Replace them with this direction's ship colors, as vec3 values from 0 to 1.`,
      `${reduced} ${mdText(r.reduced.note, 300)}`,
      "Put the canvas behind solid text panels, never behind bare text. Mark it aria-hidden. Draw only while it is on screen and the tab is visible. Without WebGL, fill the surface color.",
      ...(r.culturalNotes ? [mdText(r.culturalNotes, 300)] : []),
    ]),
    "",
    ...fenced("glsl", r.frag),
    "",
  ];
}

function motionBlock(r: MotionRecipe): string[] {
  return [
    `**Motion: ${mdText(r.name, 80)}** (${r.verb}, ${r.trigger}, for ${words(r.use)}). ${mdText(r.idea, 300)}`,
    "",
    bullets([
      `Add the class \`gb-${r.id}\` to the ${r.target === "children" ? "parent; every child plays it, so set `--i` (0, 1, 2 ...) on each child" : "element"}. ${r.trigger === "enter" || r.trigger === "exit" || r.trigger === "change" ? "Add it when the event happens." : r.trigger === "loop" ? "It loops; give people a way to pause it if it runs longer than 5 seconds." : `It plays on ${r.trigger}.`}`,
      mdText(`Reduced motion: ${r.reduced.kind === "fade" ? `a plain fade over ${r.reduced.ms ?? 200} ms` : "no movement, the end state at once"} (already in the CSS below). ${r.reduced.note}`, 400),
      ...(r.culturalNotes ? [mdText(r.culturalNotes, 300)] : []),
    ]),
    "",
    ...fenced("css", r.css),
    "",
  ];
}

/** The "Stunning layer" section of BUILD-PROMPT.md; empty when no focus direction names a recipe. */
export function stunningSection(m: KitModel, heading: string): string[] {
  const rows = m.focus.map((d) => ({ d, ...directionStunning(m, d) })).filter((x) => x.shaders.length + x.motion.length > 0);
  if (rows.length === 0) return [];
  const out: string[] = [
    `${heading} Stunning layer`,
    "",
    "Optional polish from the Banana Atlas. Add it to one or two moments (a hero, a loading or success state), not to every screen. The page must work and read the same without it, and every effect below has its prefers-reduced-motion fallback: keep it.",
    "",
  ];
  for (const x of rows) {
    if (m.focus.length > 1) out.push(`${oneLine(x.d.direction.title, 120)}:`, "");
    for (const s of x.shaders) out.push(...shaderBlock(s));
    for (const r of x.motion) out.push(...motionBlock(r));
  }
  return out;
}
