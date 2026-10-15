/**
 * P1-J13 stunning layer: the pure parts (motion CSS, static checks, schemas, ids, layout).
 * The browser checks have a manual script: tests/render-stunning.manual.ts.
 */
import { describe, expect, it } from "vitest";
import { serverLayout } from "../lib/layout.ts";
import { uniqueIds } from "../lib/j13.ts";
import { computedOffsets, motionCss, motionStaticProblems } from "../lib/motion-css.ts";
import { shaderStaticProblems } from "../lib/render-stunning.ts";
import { MotionRecipeSchema, ShaderRecipeSchema, type MotionRecipe, type ShaderRecipe } from "../schema.ts";

const HEAD = "precision highp float;\nuniform vec2 u_resolution;\nuniform float u_time;\nuniform vec3 u_c0;\nuniform vec3 u_c1;\nuniform vec3 u_c2;\nuniform vec3 u_c3;\n";
const FRAG = `${HEAD}void main(){vec2 uv=gl_FragCoord.xy/u_resolution.xy;gl_FragColor=vec4(mix(u_c0,u_c2,0.5+0.5*sin(uv.x*9.0+u_time)),1.0);}`;

const shader: ShaderRecipe = {
  id: "band-drift",
  name: "Band drift",
  idea: "Soft bands drift across the surface.",
  use: ["hero"],
  frag: FRAG,
  colors: ["#101418", "#f2efe6", "#e4572e", "#2e86ab"],
  reduced: { kind: "static", at: 3, note: "One still frame." },
  cardIds: ["a-card"],
  families: ["metal"],
  lensIds: [],
};

const base: Omit<MotionRecipe, "css"> = {
  id: "rows-rise",
  name: "Rows rise",
  verb: "rises",
  idea: "Rows rise into place one after another.",
  use: ["list-row"],
  trigger: "enter",
  target: "children",
  stagger: 60,
  origin: "50% 100%",
  keyframes: [
    { transform: "translateY(24px)", opacity: 0, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    { transform: "translateY(0px)", opacity: 1 },
  ],
  timing: { duration: 480, delay: 0, easing: "linear", iterations: 1, direction: "normal", fill: "both" },
  reduced: { kind: "fade", ms: 200, note: "Rows fade in." },
  cardIds: ["a-card"],
  families: [],
  lensIds: [],
};

describe("motion css", () => {
  it("spreads missing offsets like WAAPI", () => {
    expect(computedOffsets([{}, {}, {}])).toEqual([0, 0.5, 1]);
    expect(computedOffsets([{}, { offset: 0.8 }, {}, {}])).toEqual([0, 0.8, 0.9, 1]);
  });

  it("writes keyframes, the stagger delay and a fade fallback", () => {
    const css = motionCss(base);
    expect(css).toContain("@keyframes gb-rows-rise {");
    expect(css).toContain("0% { transform: translateY(24px); opacity: 0; animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1); }");
    expect(css).toContain(".gb-rows-rise > * {");
    expect(css).toContain("animation-delay: calc(var(--i, 0) * 60ms + 0ms);");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\n {2}\.gb-rows-rise > \* \{ animation: gb-rows-rise-reduced 200ms/);
  });

  it("turns animation off for a static fallback", () => {
    const css = motionCss({ ...base, target: "self", stagger: 0, reduced: { kind: "static", note: "x" } });
    expect(css).toContain("@media (prefers-reduced-motion: reduce) {\n  .gb-rows-rise { animation: none; }\n}");
    expect(css).not.toContain("animation-delay");
  });

  it("flags motions that only fade, flash, or break the timing rules", () => {
    expect(motionStaticProblems(base)).toEqual([]);
    const fadeOnly = { ...base, keyframes: [{ opacity: 0 }, { opacity: 1 }] };
    expect(motionStaticProblems(fadeOnly).join()).toMatch(/only fades/);
    const flash = { ...base, trigger: "loop" as const, timing: { ...base.timing, duration: 900, iterations: "infinite" as const }, keyframes: [{ transform: "scale(1)", opacity: 0 }, { transform: "scale(1.1)", opacity: 1 }, { transform: "scale(1)", opacity: 0 }, { transform: "scale(1.1)", opacity: 1 }, { transform: "scale(1)", opacity: 0 }] };
    expect(motionStaticProblems(flash).join()).toMatch(/flashes/);
    expect(motionStaticProblems({ ...base, timing: { ...base.timing, duration: 2400 } }).join()).toMatch(/within 1600ms/);
    expect(motionStaticProblems({ ...base, keyframes: [{ transform: "scale(0.9)" }, { opacity: 1 }] }).join()).toMatch(/must both set/);
  });
});

describe("shader static checks", () => {
  it("passes the contract and catches missing uniforms, extra uniforms and long loops", () => {
    expect(shaderStaticProblems(FRAG)).toEqual([]);
    expect(shaderStaticProblems(FRAG.replace("uniform vec3 u_c3;\n", "")).join()).toMatch(/u_c3/);
    expect(shaderStaticProblems(`${HEAD}uniform float u_extra;\nvoid main(){gl_FragColor=vec4(u_c0,1.0);}`).join()).toMatch(/only u_resolution/);
    expect(shaderStaticProblems(`${HEAD}void main(){for(int i=0;i<200;i++){}gl_FragColor=vec4(u_c0,1.0);}`).join()).toMatch(/200 times/);
  });
});

describe("schemas", () => {
  it("parse a shader and a motion recipe", () => {
    expect(ShaderRecipeSchema.safeParse(shader).success).toBe(true);
    expect(MotionRecipeSchema.safeParse({ ...base, css: motionCss(base) }).success).toBe(true);
  });

  it("reject textures, unknown keyframe properties and script-like values", () => {
    expect(ShaderRecipeSchema.safeParse({ ...shader, frag: FRAG.replace("void main", "uniform sampler2D t;\nvoid main") }).success).toBe(false);
    expect(MotionRecipeSchema.safeParse({ ...base, css: "x", keyframes: [{ left: "0px" }, { left: "9px" }] }).success).toBe(false);
    expect(MotionRecipeSchema.safeParse({ ...base, css: "x", keyframes: [{ transform: "url(javascript:x)" }, { transform: "none" }] }).success).toBe(false);
  });
});

describe("ids and layout", () => {
  it("renames repeated ids in place and drops exact duplicates", () => {
    const a = { id: "glow", body: "1" };
    const b = { id: "glow", body: "2" };
    const c = { id: "other", body: "1" };
    const out = uniqueIds([a, b, c], (r) => r.body);
    expect(out.map((r) => r.id)).toEqual(["glow", "glow-2"]);
    expect(out[1]).toBe(b);
  });

  it("puts shaders and motion in size-split server shards", () => {
    const layout = serverLayout(new Map<string, unknown[]>([["shaders", [shader]], ["motion", [{ ...base, css: motionCss(base) }]]]));
    expect(layout.manifest.shards.map((s) => `${s.kind}/${s.shard}`)).toEqual(["motion/00", "shaders/00"]);
    expect(layout.skipped).toEqual([]);
  });
});
