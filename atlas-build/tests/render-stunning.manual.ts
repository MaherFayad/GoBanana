/**
 * Manual check of the J13 render checks in real Chrome (not part of `npm test`, which has no
 * browser): npx tsx tests/render-stunning.manual.ts
 * Expect: good shader ok; flat, still, hard-coded and broken shaders fail; good motion ok; still
 * motion fails.
 */
import { join } from "node:path";
import { PATHS } from "../config.ts";
import { motionCss } from "../lib/motion-css.ts";
import { checkMotions, checkShaders } from "../lib/render-stunning.ts";
import type { MotionRecipe } from "../schema.ts";

const HEAD = "precision highp float;\nuniform vec2 u_resolution;\nuniform float u_time;\nuniform vec3 u_c0;\nuniform vec3 u_c1;\nuniform vec3 u_c2;\nuniform vec3 u_c3;\n";
const good = `${HEAD}void main(){vec2 uv=gl_FragCoord.xy/u_resolution.xy;float b=0.5+0.5*sin(uv.y*18.0+u_time*0.8+sin(uv.x*4.0+u_time*0.3)*2.0);vec3 c=mix(u_c0,u_c2,smoothstep(0.3,0.7,b));c=mix(c,u_c3,0.25*uv.x);c=mix(c,u_c1,0.1*step(0.95,b));gl_FragColor=vec4(c,1.0);}`;
const flat = `${HEAD}void main(){gl_FragColor=vec4(u_c0+0.0*u_time*u_resolution.x+0.0*(u_c1+u_c2+u_c3),1.0);}`;
const still = `${HEAD}void main(){vec2 uv=gl_FragCoord.xy/u_resolution.xy;gl_FragColor=vec4(mix(u_c0,u_c2,uv.x)+0.0*u_time+0.0*(u_c1+u_c3),1.0);}`;
const hard = `${HEAD}void main(){vec2 uv=gl_FragCoord.xy/u_resolution.xy;float b=sin(uv.y*18.0+u_time);gl_FragColor=vec4(vec3(0.9,0.3,0.1)*b+0.0001*(u_c0+u_c1+u_c2+u_c3),1.0);}`;
const broken = `${HEAD}void main(){gl_FragColor=vec4(nope,1.0);}`;
const col: [string, string, string, string] = ["#0e0f12", "#f4f1ea", "#ff6a2b", "#3b5bdb"];
const red = { kind: "static" as const, at: 3, note: "one frame" };

const shaders = await checkShaders(
  [
    { id: "t-good", frag: good, colors: col, reduced: red },
    { id: "t-flat", frag: flat, colors: col, reduced: red },
    { id: "t-still", frag: still, colors: col, reduced: red },
    { id: "t-hard", frag: hard, colors: col, reduced: red },
    { id: "t-broken", frag: broken, colors: col, reduced: red },
  ],
  join(PATHS.review, "j13-manual"),
);
for (const r of shaders) console.log(r.id, r.ok, JSON.stringify(r.metrics), r.problems.join(" | "));

const base: Omit<MotionRecipe, "css"> = {
  id: "t-rise",
  name: "Rise",
  verb: "rises",
  idea: "x",
  use: ["card"],
  trigger: "enter",
  target: "children",
  stagger: 60,
  origin: "50% 100%",
  keyframes: [
    { transform: "translateY(24px) scale(0.96)", opacity: 0, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    { transform: "translateY(0px) scale(1)", opacity: 1 },
  ],
  timing: { duration: 520, delay: 0, easing: "linear", iterations: 1, direction: "normal", fill: "both" },
  reduced: { kind: "fade", ms: 200, note: "fade" },
  cardIds: [],
  families: [],
  lensIds: [],
};
const stillMotion = { ...base, id: "t-still-m", target: "self" as const, stagger: 0, keyframes: [{ opacity: 1 }, { opacity: 1 }], reduced: { kind: "static" as const, note: "none" } };
const motions = await checkMotions(
  [base, stillMotion].map((m) => ({ ...m, css: motionCss(m) })),
  join(PATHS.review, "j13-manual"),
);
for (const r of motions) console.log(r.id, r.ok, JSON.stringify(r.metrics), r.problems.join(" | "));
console.log(motionCss(base));
