/**
 * A tiny J13 stunning layer for tests: shader and motion recipes typed with lib/atlas/types.ts.
 * Plain words, no em dashes. The ids match cards, families and the sadu lens in ./atlas.
 */
import type { MotionRecipe, ShaderRecipe } from "@/lib/atlas/types";

const FRAG = (body: string) =>
  `precision highp float;\nuniform vec2 u_resolution;\nuniform float u_time;\nuniform vec3 u_c0;\nuniform vec3 u_c1;\nuniform vec3 u_c2;\nuniform vec3 u_c3;\nvoid main() {\n  vec2 p = gl_FragCoord.xy / u_resolution;\n  ${body}\n}\n`;

function shader(p: Pick<ShaderRecipe, "id" | "name" | "idea" | "use" | "cardIds" | "families" | "lensIds"> & Partial<ShaderRecipe>): ShaderRecipe {
  return {
    frag: FRAG("gl_FragColor = vec4(mix(u_c0, u_c2, p.x + 0.1 * sin(u_time)), 1.0);"),
    colors: ["#F4EBDD", "#1A1A1A", "#B3402A", "#3B6E5A"],
    reduced: { kind: "static", at: 2, note: "One calm frame, no drift." },
    ...p,
  };
}

export const SHADERS: ShaderRecipe[] = [
  shader({
    id: "weave-drift",
    name: "Weave drift",
    idea: "Woven bands slide past each other slowly.",
    use: ["hero", "loading"],
    cardIds: ["sadu-weaving"],
    families: ["weaving"],
    lensIds: ["sadu"],
    culturalNotes: "Sadu is woven by Bedouin women of the Arabian Peninsula.",
  }),
  shader({ id: "tile-shimmer", name: "Tile shimmer", idea: "Glazed tiles catch a moving light.", use: ["hero"], cardIds: ["zellige"], families: ["tile"], lensIds: [], reduced: { kind: "fade", at: 1, ms: 300, note: "Fades in once." } }),
  shader({ id: "board-glow", name: "Board glow", idea: "A departure board glows from within.", use: ["loading", "hero"], cardIds: ["departure-board"], families: ["board or sign"], lensIds: [] }),
];

function motion(p: Pick<MotionRecipe, "id" | "name" | "verb" | "idea" | "use" | "trigger" | "cardIds" | "families" | "lensIds"> & Partial<MotionRecipe>): MotionRecipe {
  return {
    target: "self",
    stagger: 0,
    origin: "50% 50%",
    keyframes: [{ transform: "translateY(12px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }],
    timing: { duration: 420, delay: 0, easing: "ease-out", iterations: 1, direction: "normal", fill: "both" },
    css: `@keyframes gb-${p.id} {\n  0% { transform: translateY(12px); opacity: 0; }\n  100% { transform: translateY(0); opacity: 1; }\n}\n.gb-${p.id} {\n  animation: gb-${p.id} 420ms ease-out 0ms 1 normal both;\n  transform-origin: 50% 50%;\n}\n@media (prefers-reduced-motion: reduce) {\n  .gb-${p.id} { animation: none; }\n}\n`,
    reduced: { kind: "static", note: "Shows the end state at once." },
    ...p,
  };
}

export const MOTION: MotionRecipe[] = [
  motion({ id: "flip-in", name: "Flip in", verb: "flips", idea: "Rows flip into place like a split flap board.", use: ["list-row", "hero"], trigger: "enter", cardIds: ["departure-board"], families: ["board or sign"], lensIds: [] }),
  motion({ id: "tag-swing", name: "Tag swing", verb: "swings", idea: "A tag swings on its string when pressed.", use: ["card"], trigger: "hover", cardIds: ["luggage-tag"], families: ["label or tag"], lensIds: [] }),
  motion({ id: "weave-in", name: "Weave in", verb: "weaves in", idea: "Children slide in band by band.", use: ["hero", "list-row"], trigger: "enter", target: "children", stagger: 60, cardIds: ["sadu-weaving"], families: ["weaving"], lensIds: ["sadu"] }),
  motion({ id: "stamp-press", name: "Stamp press", verb: "stamps", idea: "A stamp presses into the ticket.", use: ["success"], trigger: "press", cardIds: ["boarding-pass"], families: ["printed card, cover or ticket"], lensIds: [], reduced: { kind: "fade", ms: 200, note: "Fades in instead." } }),
];
