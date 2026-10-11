/**
 * Design token gate (docs/design-language.md section 9.4, plan Step 0).
 *
 * Parses the real styles/studio-tokens.css, resolves var() chains per theme, composites
 * translucent fills over the surface they sit on, and checks every contrast pair the spec lists
 * (plus the owner's yellow primary button) against its WCAG 2.2 minimum: 4.5:1 for text
 * (SC 1.4.3), 3:1 for control boundaries, focus indicators and meaningful graphics (SC 1.4.11).
 * It also checks that the light attribute block and the prefers-color-scheme light block are
 * identical, so the two routes to light theme can never drift.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatHex, parse, wcagContrast, type Rgb } from "culori";

const CSS_PATH = fileURLToPath(new URL("../styles/studio-tokens.css", import.meta.url));
const css = readFileSync(CSS_PATH, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

type Decls = Map<string, string>;

function blocks(source: string): { selector: string; decls: Decls }[] {
  const out: { selector: string; decls: Decls }[] = [];
  for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (m[1] ?? "").replace(/\s+/g, " ").trim();
    const decls: Decls = new Map();
    for (const d of (m[2] ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) decls.set(d[1] as string, (d[2] as string).trim());
    out.push({ selector, decls });
  }
  return out;
}

const all = blocks(css);
const find = (selector: string) => {
  const b = all.find((x) => x.selector === selector);
  if (!b) throw new Error(`block not found: ${selector}`);
  return b.decls;
};

const base = find(":root");
const dark = find(':root, [data-theme="dark"]');
const light = find('[data-theme="light"]');
const media = find(':root:not([data-theme="dark"])');

type Theme = "dark" | "light";
const themeDecls: Record<Theme, Decls> = { dark, light };

function raw(theme: Theme, name: string): string {
  // Light overrides the dark block, which sits on the theme-free :root block.
  const v = themeDecls[theme].get(name) ?? dark.get(name) ?? base.get(name);
  if (v === undefined) throw new Error(`token not defined: ${name} (${theme})`);
  return v;
}

function resolve(theme: Theme, name: string, depth = 0): string {
  if (depth > 20) throw new Error(`var() loop at ${name}`);
  const v = raw(theme, name);
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  return ref ? resolve(theme, ref[1] as string, depth + 1) : v;
}

function color(theme: Theme, token: string): Rgb {
  const value = resolve(theme, `--st-${token}`);
  const c = parse(value);
  if (!c || c.mode !== "rgb") throw new Error(`--st-${token} is not an rgb color: ${value}`);
  return c as Rgb;
}

/** A layer is a token, or [top, base] where top is painted over base (alpha compositing). */
type Layer = string | [string, string];

function flatten(theme: Theme, layer: Layer): Rgb {
  if (typeof layer === "string") {
    const c = color(theme, layer);
    if ((c.alpha ?? 1) < 1) throw new Error(`--st-${layer} is translucent; give the surface it sits on`);
    return c;
  }
  const top = color(theme, layer[0]);
  const under = flatten(theme, layer[1]);
  const a = top.alpha ?? 1;
  return { mode: "rgb", r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a) };
}

const show = (theme: Theme, l: Layer) => (typeof l === "string" ? l : `${l[0]} over ${l[1]}`) + ` ${formatHex(flatten(theme, l))}`;

type Pair = { use: string; fg: Layer; bg: Layer; min: 3 | 4.5 };

const SURFACES = ["bg-body", "bg-surface", "bg-surface-2", "bg-surface-3"] as const;
const NOTES = ["note-yellow", "note-green", "note-blue", "note-pink", "note-gray"] as const;

function pairs(theme: Theme): Pair[] {
  const p: Pair[] = [];
  const text = (use: string, fg: Layer, bg: Layer) => p.push({ use, fg, bg, min: 4.5 });
  const ui = (use: string, fg: Layer, bg: Layer) => p.push({ use, fg, bg, min: 3 });

  for (const t of ["text-bright", "text", "text-muted"]) for (const s of SURFACES) text("body and label text", t, s);
  for (const s of ["bg-body", "bg-surface", "bg-surface-2"]) text("captions, meta", "text-subtle", s);
  for (const s of ["bg-surface", "bg-surface-2"]) text("input placeholder", "text-placeholder", s);
  for (const s of ["bg-body", "bg-surface"]) text("links (underlined)", "link", s);

  // Achromatic fills: pressed toggles, secondary, ghost and menu hovers.
  text("pressed toggle", "text", ["overlay-20", "bg-surface-2"]);
  text("pressed toggle on panel", "text", ["overlay-20", "bg-surface"]);
  text("secondary hover", "text", ["overlay-30", "bg-surface-2"]);
  text("secondary button", "btn-secondary-fg", ["overlay-10", "bg-surface-2"]);
  text("secondary button on panel", "btn-secondary-fg", ["overlay-10", "bg-surface"]);
  text("menu item hover", "text", ["overlay-10", "bg-surface-3"]);
  text("ghost button hover on panel", "text-muted", ["overlay-10", "bg-surface"]);
  text("toast repeat count", "text", ["overlay-10", "bg-surface"]);
  text("neutral chip", "text", ["overlay-10", "bg-surface"]);

  // Danger, state tints, alerts, chips.
  for (const s of ["bg-surface", "bg-surface-2", "bg-surface-3"]) text("destructive text and menu item", "danger-fg", s);
  text("destructive button", "danger-fg", ["danger-10", "bg-surface-2"]);
  text("destructive button on panel", "danger-fg", ["danger-10", "bg-surface"]);
  text("destructive button hover", "danger-text", ["danger-20", "bg-surface-2"]);
  text("destructive button hover on panel", "danger-text", ["danger-20", "bg-surface"]);
  text("ghost danger hover", "danger-fg", ["danger-10", "bg-surface"]);
  text("ghost danger hover on surface-2", "danger-fg", ["danger-10", "bg-surface-2"]);
  text("error alert, danger chip", "danger-text", ["danger-10", "bg-surface"]);
  text("warning alert", "warning-text", ["warning-10", "bg-surface"]);
  text("success alert, success chip", "success-text", ["success-10", "bg-surface"]);
  text("info text", "info-text", "bg-surface");
  text("info alert", "info-text", ["overlay-5", "bg-surface"]);
  for (const s of ["bg-surface", "bg-surface-2"]) {
    text("Ship chip", "ship-fg", ["ship-bg", s]);
    text("Explore chip", "explore-fg", ["explore-bg", s]);
  }
  for (let i = 1; i <= 10; i++) text("identity label text", `accent-${i}`, "bg-surface-2");

  text("tooltip", "text-bright", "bg-body");
  text("toast title, dialog title", "text-bright", "bg-surface");
  text("toast body", "text-muted", "bg-surface");
  text("keycap label", "kbd-text", "kbd-face-top");
  text("keycap label", "kbd-text", "kbd-face-bottom");
  for (const n of NOTES) {
    text("note text", "note-ink", n);
    text("empty note hint", ["note-ink-subtle", n], n);
    // WILD / SALVAGE label chips and the compact "+N lines" hint: ink on an ink tint over the paper.
    text("note label chip", "note-ink", ["note-label-bg", n]);
    // The paper band sits above the text, never under it; text stays readable on the band anyway.
    text("note text on the paper band", "note-ink", ["note-band", n]);
  }
  text("badge on selection", "canvas-node-badge-text", "canvas-selection-ring-color");

  // Non-text contrast (3:1).
  for (const s of SURFACES) {
    ui("input and control boundary", ["border-control", s], s);
    ui("input boundary on hover", ["border-control-hover", s], s);
    ui("focus ring", "focus-ring-color", s);
  }
  ui("focus ring against its halo", "focus-ring-color", "focus-halo-color");
  ui("ghost icon on toolbar", "text-muted", "bg-surface-2");
  ui("toast error icon", "danger-light", "bg-surface");
  ui("toast warning icon", "warning", "bg-surface");
  ui("toast success icon", "success", "bg-surface");
  if (theme === "dark") {
    ui("selection outline", "canvas-selection-ring-color", "canvas-bg");
    ui("resize handle (white fill)", "canvas-resize-handle-fill", "canvas-bg");
  } else {
    ui("selection outline (halo)", "canvas-selection-halo", "canvas-bg");
    ui("resize handle (ink edge)", "canvas-resize-handle-border", "canvas-bg");
  }
  ui("hover ring", "canvas-hover-ring-color", "canvas-bg");
  ui("snap guide", "canvas-snap-guide-color", "canvas-bg");
  ui("marquee edge", "canvas-marquee-border", "canvas-bg");
  ui("note selection ring", "annotation-selection-ring", "canvas-bg");

  // Owner decision: yellow primary button with ink text.
  for (const f of ["primary-fill", "primary-fill-hover", "primary-fill-pressed"]) text("primary button label", "primary-text", f);
  for (const s of SURFACES) ui("primary button boundary (border or fill)", "primary-border", s);
  for (const f of ["primary-fill", "primary-fill-hover", "primary-fill-pressed"]) ui("primary focus, inner ring vs fill", "primary-focus-inner", f);
  if (theme === "dark") {
    for (const f of ["primary-fill", "primary-fill-hover", "primary-fill-pressed"]) for (const s of SURFACES) ui("primary fill vs surface", f, s);
    for (const s of SURFACES) ui("primary focus, outer ring vs surface", "primary-focus-outer", s);
    ui("primary focus, outer ring vs inner ring", "primary-focus-outer", "primary-focus-inner");
  } else {
    for (const s of SURFACES) ui("primary focus, inner ring vs surface", "primary-focus-inner", s);
  }
  return p;
}

describe("studio tokens: light routes agree", () => {
  it("the [data-theme=light] block and the prefers-color-scheme light block are identical", () => {
    expect([...media.entries()]).toEqual([...light.entries()]);
  });

  it("light overrides only names the dark block defines", () => {
    const missing = [...light.keys()].filter((k) => !dark.has(k));
    expect(missing).toEqual([]);
  });

  it("the yellow primary tokens exist in every theme block", () => {
    const names = [
      "--st-primary-fill",
      "--st-primary-fill-hover",
      "--st-primary-fill-pressed",
      "--st-primary-text",
      "--st-primary-border",
      "--st-primary-focus-inner",
      "--st-primary-focus-outer",
      "--st-primary-focus-ring",
    ];
    for (const decls of [dark, light, media]) for (const n of names) expect(decls.has(n), n).toBe(true);
  });
});

for (const theme of ["dark", "light"] as const) {
  describe(`studio tokens: ${theme} contrast`, () => {
    const list = pairs(theme);
    it.each(list.map((pair) => [`${pair.use}: ${show(theme, pair.fg)} on ${show(theme, pair.bg)}`, pair] as const))(
      "%s",
      (_label, pair) => {
        const ratio = wcagContrast(flatten(theme, pair.fg), flatten(theme, pair.bg));
        expect(ratio, `${pair.use} is ${ratio.toFixed(2)}:1, needs ${pair.min}:1`).toBeGreaterThanOrEqual(pair.min);
      },
    );
  });
}

describe("studio tokens: yellow primary values (reported in DECISIONS.md)", () => {
  it("keeps the documented ratios", () => {
    const r = (t: Theme, a: Layer, b: Layer) => Number(wcagContrast(flatten(t, a), flatten(t, b)).toFixed(2));
    expect(r("dark", "primary-text", "primary-fill")).toBe(12.82);
    expect(r("light", "primary-text", "primary-fill")).toBe(12.82);
    expect(r("dark", "primary-fill", "bg-surface-3")).toBe(9.27);
    expect(r("light", "primary-border", "bg-body")).toBe(5.04);
    expect(r("dark", "primary-focus-inner", "primary-fill")).toBe(15.18);
    expect(r("light", "primary-focus-inner", "primary-fill")).toBe(12.82);
  });
});
