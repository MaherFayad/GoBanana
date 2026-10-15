/**
 * Render checks for the stunning layer (P1-J13), in headless Chrome through Playwright (the same
 * Chrome the J6 motif check uses).
 *
 * Shaders: compile and link in WebGL 1, then draw at several times with the recipe's colors and
 * read the pixels back. A shader fails when it does not compile, is blank, flat or one color,
 * does not change over time, ignores the color uniforms (hard-coded colors), flashes more than
 * three times a second, or is too slow to draw. Its reduced-motion frame must also draw.
 *
 * Motion: play the WAAPI keyframes on a demo element, pause at several times and read the
 * computed style and pixels: it must move. The computed CSS must play the same values, and with
 * prefers-reduced-motion on it must stand still (static) or change only opacity (fade).
 *
 * PNG strips go to the review folder for the owner; they are our own generated art.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MotionRecipe, ShaderRecipe } from "../schema.ts";
import { loadPlaywright } from "./render-svg.ts";

type Page = {
  setContent(html: string): Promise<void>;
  evaluate<T>(fn: string): Promise<T>;
  locator(sel: string): { screenshot(o?: object): Promise<Buffer> };
  emulateMedia(o: { reducedMotion: "reduce" | "no-preference" }): Promise<void>;
  on(ev: "console" | "pageerror", cb: (m: { type?: () => string; text?: () => string; message?: string }) => void): void;
  close(): Promise<void>;
};
type Browser = { newPage(o?: object): Promise<Page>; close(): Promise<void> };
type Launch = { chromium: { launch(o: { channel: string; headless: boolean; args?: string[] }): Promise<Browser> } };

export type CheckResult = { id: string; ok: boolean; problems: string[]; metrics: Record<string, number> };

async function launch(): Promise<Browser> {
  const pw = loadPlaywright() as unknown as Launch;
  return pw.chromium.launch({ channel: "chrome", headless: true });
}

// ---------------------------------------------------------------------------------------------
// Shaders

/** Fixed uniforms every recipe uses; the export kit sets them the same way. */
export const SHADER_UNIFORMS = ["u_resolution", "u_time", "u_c0", "u_c1", "u_c2", "u_c3"] as const;

/** The vertex shader the kit pairs with every recipe: one full-screen triangle. */
export const SHADER_VERTEX = "attribute vec2 a_pos;\nvoid main() { gl_Position = vec4(a_pos, 0.0, 1.0); }\n";

/** Two palettes far apart, to prove the shader follows u_c0 to u_c3. */
export const TEST_PALETTES: [string[], string[]] = [
  ["#101418", "#f2efe6", "#e4572e", "#2e86ab"],
  ["#f7f3e8", "#1b1b1b", "#2bb673", "#7b2cbf"],
];

/** Thresholds, exported for the tests and the review page. */
export const SHADER_LIMITS = {
  /** Luma standard deviation (0 to 1) under which a frame with few colors is flat. */
  flatLuma: 0.012,
  /** Mean per-channel change (0 to 255) between frames under which nothing moves. */
  stillDiff: 0.5,
  /** Share of pixels that must change by more than 3/255 when the mean change is small. */
  stillShare: 0.02,
  /** Mean color shift (sum of channel means, 0 to 765) the two test palettes must cause. */
  paletteShift: 24,
  /** Luma swings over this (0 to 1) between frames 1/15 s apart count as a flash. */
  flashLuma: 0.18,
  /** Milliseconds per 1024 by 1024 frame on the build machine's GPU above which a shader is too heavy. */
  maxFrameMs: 6,
};

/** GLSL rules the compiler does not catch. */
export function shaderStaticProblems(frag: string): string[] {
  const out: string[] = [];
  if (!/precision\s+(highp|mediump)\s+float\s*;/.test(frag)) out.push("declare precision highp float (or mediump) at the top");
  for (const u of ["u_resolution", "u_time"]) if (!new RegExp(`uniform\\s+\\w+\\s+${u}\\s*;`).test(frag)) out.push(`declare uniform ${u}`);
  for (const u of ["u_c0", "u_c1", "u_c2", "u_c3"]) if (!new RegExp(`uniform\\s+vec3\\s+${u}\\s*;`).test(frag)) out.push(`declare uniform vec3 ${u}`);
  if (/uniform\s+(?!vec2\s+u_resolution|float\s+u_time|vec3\s+u_c[0-3])\w+\s+\w+/.test(frag)) out.push("only u_resolution, u_time and u_c0 to u_c3 may be uniforms");
  for (const m of frag.matchAll(/for\s*\(\s*(?:int|float)\s+\w+\s*=\s*[\d.]+\s*;\s*\w+\s*<=?\s*([\d.]+)/g)) {
    if (Number(m[1]) > 96) out.push(`a loop runs ${m[1]} times; keep loops at 96 or fewer`);
  }
  if (/gl_FragData|gl_FragDepth|discard\b/.test(frag)) out.push("write only gl_FragColor (no discard, gl_FragData or gl_FragDepth)");
  if (!/gl_FragColor/.test(frag)) out.push("write gl_FragColor");
  return out;
}

type GlStats = { luma: number; colors: number; mean: number[]; sum: number };

const SHADER_PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#888}#strip{display:flex;gap:4px;padding:4px;width:max-content}canvas.f{width:320px;height:180px;display:block}
</style></head><body><div id="strip"></div></body></html>`;

/** In the page: runs every shader check for one recipe and fills #strip with labelled frames. */
const SHADER_TEST = `(async (a) => {
  const W = 320, H = 180;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const gl = c.getContext('webgl', { preserveDrawingBuffer: true, antialias: false });
  if (!gl) return { fatal: 'no WebGL context' };
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? { s } : { err: gl.getShaderInfoLog(s) || 'compile failed' }; };
  const v = sh(gl.VERTEX_SHADER, a.vert);
  const f = sh(gl.FRAGMENT_SHADER, a.frag);
  if (f.err) return { fatal: 'compile error: ' + f.err.trim().slice(0, 600) };
  const p = gl.createProgram(); gl.attachShader(p, v.s); gl.attachShader(p, f.s);
  gl.bindAttribLocation(p, 0, 'a_pos'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return { fatal: 'link error: ' + (gl.getProgramInfoLog(p) || '').slice(0, 600) };
  gl.useProgram(p);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const loc = (n) => gl.getUniformLocation(p, n);
  const unused = ['u_time', 'u_resolution', 'u_c0', 'u_c1', 'u_c2', 'u_c3'].filter((n) => !loc(n));
  const draw = (t, pal, w, h) => {
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(loc('u_resolution'), w, h);
    gl.uniform1f(loc('u_time'), t);
    pal.forEach((x, i) => gl.uniform3fv(loc('u_c' + i), hex(x)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const px = () => { const d = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, d); return d; };
  const stats = (d) => {
    let s = 0, s2 = 0; const m = [0, 0, 0]; const bins = new Map(); const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; s += l; s2 += l * l;
      m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2];
      const k = (d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4); bins.set(k, (bins.get(k) || 0) + 1);
    }
    const mean = s / n;
    return { luma: Math.sqrt(Math.max(0, s2 / n - mean * mean)), colors: [...bins.values()].filter((x) => x > n * 0.005).length, mean: m.map((x) => x / n), sum: mean };
  };
  const diff = (x, y) => { let s = 0, ch = 0; for (let i = 0; i < x.length; i += 4) { const d = Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]); s += d; if (d > 9) ch++; } return { mean: s / (x.length / 4) / 3, share: ch / (x.length / 4) }; };
  const strip = document.getElementById('strip');
  const keep = (label) => { const k = document.createElement('canvas'); k.className = 'f'; k.width = W; k.height = H; k.getContext('2d').drawImage(c, 0, 0); k.title = label; strip.appendChild(k); };
  const times = [0.5, 2.5, 5, 9];
  const frames = times.map((t) => { draw(t, a.colors, W, H); const d = px(); if (t === 0.5 || t === 5) keep('t=' + t); return d; });
  const st = frames.map(stats);
  let move = { mean: 0, share: 0 };
  for (let i = 1; i < frames.length; i++) { const d = diff(frames[0], frames[i]); if (d.mean > move.mean) move = d; }
  draw(2.5, a.pal[0], W, H); const pa = stats(px());
  draw(2.5, a.pal[1], W, H); const pb = stats(px());
  const shift = pa.mean.reduce((s, x, i) => s + Math.abs(x - pb.mean[i]), 0);
  const series = [];
  for (let k = 0; k < 16; k++) { draw(3 + k / 15, a.colors, W, H); series.push(stats(px()).sum); }
  let flashes = 0; for (let k = 1; k < series.length; k++) if (Math.abs(series[k] - series[k - 1]) > a.flashLuma) flashes++;
  draw(a.at, a.colors, W, H); const red = stats(px()); keep('reduced t=' + a.at);
  draw(1, a.colors, 1024, 1024); gl.finish();
  const t0 = performance.now(); for (let k = 0; k < 12; k++) draw(1 + k * 0.01, a.colors, 1024, 1024);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  const ms = (performance.now() - t0) / 12;
  return { unused, st, move, shift, flashes, red, ms };
})`;

export type ShaderInput = Pick<ShaderRecipe, "id" | "frag" | "colors" | "reduced">;

export async function checkShaders(items: readonly ShaderInput[], outDir: string): Promise<CheckResult[]> {
  mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  const results: CheckResult[] = [];
  const L = SHADER_LIMITS;
  try {
    for (const it of items) {
      const problems = shaderStaticProblems(it.frag);
      const metrics: Record<string, number> = {};
      const page = await browser.newPage({ viewport: { width: 1400, height: 400 } });
      try {
        await page.setContent(SHADER_PAGE);
        const arg = { vert: SHADER_VERTEX, frag: it.frag, colors: it.colors, pal: TEST_PALETTES, at: it.reduced.at, flashLuma: L.flashLuma };
        const r = await page.evaluate<{
          fatal?: string;
          unused: string[];
          st: GlStats[];
          move: { mean: number; share: number };
          shift: number;
          flashes: number;
          red: GlStats;
          ms: number;
        }>(`${SHADER_TEST}(${JSON.stringify(arg)})`);
        if (r.fatal) problems.push(r.fatal);
        else {
          metrics.luma = Number(Math.max(...r.st.map((s) => s.luma)).toFixed(4));
          metrics.colors = Math.max(...r.st.map((s) => s.colors));
          metrics.move = Number(r.move.mean.toFixed(3));
          metrics.moveShare = Number(r.move.share.toFixed(3));
          metrics.paletteShift = Number(r.shift.toFixed(1));
          metrics.flashes = r.flashes;
          metrics.ms = Number(r.ms.toFixed(2));
          if (r.unused.includes("u_time")) problems.push("u_time is never used, so the shader cannot change over time");
          if (r.unused.includes("u_resolution")) problems.push("u_resolution is never used: scale coordinates by it so the shader fits any size");
          if (r.unused.filter((u) => u.startsWith("u_c")).length > 2) problems.push(`colors come from fewer than two of u_c0 to u_c3 (unused: ${r.unused.join(", ")})`);
          const flat = (s: GlStats) => s.luma < L.flatLuma && s.colors < 3;
          if (r.st.every((s) => s.colors <= 1)) problems.push("the output is blank or a single color");
          else if (r.st.every(flat)) problems.push(`the output is flat (luma spread ${metrics.luma}, ${metrics.colors} colors): give it visible form`);
          if (r.move.mean < L.stillDiff && r.move.share < L.stillShare) problems.push(`the output barely changes over 9 seconds (mean change ${metrics.move} of 255): make the motion visible`);
          if (r.shift < L.paletteShift) problems.push(`the output ignores the color uniforms (shift ${metrics.paletteShift}): build every color from u_c0 to u_c3`);
          if (r.flashes > 3) problems.push(`the output flashes ${r.flashes} times a second (WCAG 2.3.1 allows 3)`);
          if (r.red.colors <= 1 || (r.red.luma < L.flatLuma && r.red.colors < 3)) problems.push(`the reduced-motion frame at ${it.reduced.at}s is blank or flat: pick another time`);
          if (r.ms > L.maxFrameMs) problems.push(`too heavy: ${metrics.ms} ms per 1024x1024 frame on a desktop GPU (limit ${L.maxFrameMs}); cut loop counts and octaves`);
          writeFileSync(join(outDir, `${it.id}.png`), await page.locator("#strip").screenshot({ type: "png" }));
        }
      } catch (e) {
        problems.push(`render error: ${e instanceof Error ? e.message.slice(0, 300) : String(e)}`);
      } finally {
        await page.close();
      }
      results.push({ id: it.id, ok: problems.length === 0, problems, metrics });
    }
  } finally {
    await browser.close();
  }
  return results;
}

// ---------------------------------------------------------------------------------------------
// Motion

export type MotionInput = Pick<MotionRecipe, "id" | "target" | "stagger" | "origin" | "keyframes" | "timing" | "reduced" | "css">;

const MOTION_PAGE = `<!doctype html><html><head><meta charset="utf-8"><style id="rec"></style><style>
body{margin:0;background:#0f1115;font:14px system-ui;color:#eee}
.stage{position:relative;width:320px;height:220px;display:grid;place-items:center;overflow:hidden;background:#0f1115}
.box{width:180px;height:110px;border-radius:14px;background:linear-gradient(135deg,#e4572e,#f2c14e);box-shadow:0 0 0 2px #fff inset}
.list{display:flex;flex-direction:column;gap:8px;width:220px}.list>div{height:26px;border-radius:6px;background:#e4572e}
#strip{display:flex;gap:4px;width:max-content}
</style></head><body><div id="strip"></div><div id="work"></div></body></html>`;

/** In the page: builds a stage, plays the recipe with WAAPI or its CSS, samples computed styles. */
const MOTION_TEST = `(async (a) => {
  const work = document.getElementById('work');
  const make = () => {
    const st = document.createElement('div'); st.className = 'stage';
    let el;
    if (a.target === 'children') { el = document.createElement('div'); el.className = 'list';
      for (let i = 0; i < 5; i++) { const d = document.createElement('div'); d.style.setProperty('--i', String(i)); el.appendChild(d); } }
    else { el = document.createElement('div'); el.className = 'box'; }
    st.appendChild(el); work.appendChild(st); return { st, el, first: a.target === 'children' ? el.firstElementChild : el };
  };
  const read = (el) => { const s = getComputedStyle(el); return { transform: s.transform, opacity: s.opacity, clipPath: s.clipPath, filter: s.filter }; };
  const T = a.timing;
  const total = T.delay + T.duration;
  const times = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 0.999].map((f) => T.delay + f * T.duration);
  const out = { err: null, waapi: [], css: [], cssCount: 0 };
  // WAAPI
  const w = make();
  w.first.style.transformOrigin = a.origin;
  let anims = [];
  try {
    const targets = a.target === 'children' ? [...w.el.children] : [w.el];
    anims = targets.map((t, i) => { t.style.transformOrigin = a.origin; return t.animate(a.keyframes, { duration: T.duration, delay: T.delay + i * a.stagger, easing: T.easing,
      iterations: T.iterations === 'infinite' ? Infinity : T.iterations, direction: T.direction, fill: T.fill }); });
  } catch (e) { out.err = String(e && e.message || e); return out; }
  anims.forEach((x) => x.pause());
  const strip = document.getElementById('strip');
  for (const t of times) { anims.forEach((x) => { x.currentTime = t; }); out.waapi.push(read(w.first)); }
  w.st.remove();
  // CSS (the record's computed css)
  document.getElementById('rec').textContent = a.css;
  const c = make();
  c.el.classList.add('gb-' + a.id);
  const own = () => document.getAnimations().filter((x) => x.effect && (x.effect.target === c.first));
  const ca = own(); out.cssCount = ca.length;
  for (const t of times) { ca.forEach((x) => { x.pause(); x.currentTime = t; }); out.css.push(read(c.first)); }
  c.st.remove();
  return out;
})`;

/** Pixel frames of the WAAPI play, as a strip, for the review page and the pixel move check. */
const MOTION_FRAMES = `(async (a) => {
  const strip = document.getElementById('strip'); strip.innerHTML = '';
  const T = a.timing;
  const fr = [0.02, 0.35, 0.65, 0.98].map((f) => T.delay + f * T.duration);
  for (const t of fr) {
    const st = document.createElement('div'); st.className = 'stage';
    let el;
    if (a.target === 'children') { el = document.createElement('div'); el.className = 'list'; for (let i = 0; i < 5; i++) el.appendChild(document.createElement('div')); }
    else { el = document.createElement('div'); el.className = 'box'; }
    st.appendChild(el); strip.appendChild(st);
    const targets = a.target === 'children' ? [...el.children] : [el];
    targets.forEach((x, i) => { x.style.transformOrigin = a.origin; const an = x.animate(a.keyframes, { duration: T.duration, delay: T.delay + i * a.stagger, easing: T.easing,
      iterations: T.iterations === 'infinite' ? Infinity : T.iterations, direction: T.direction, fill: 'both' }); an.pause(); an.currentTime = t; });
  }
  return fr.length;
})`;

/** In the page: pixel difference between the stages in #strip (0 to 1 share of changed pixels). */
const STRIP_DIFF = `(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const n = 4, w = Math.floor((img.width - 4 * (n - 1)) / n), h = img.height;
  const cells = []; for (let i = 0; i < n; i++) cells.push(x.getImageData(i * (w + 4), 0, w, h).data);
  let best = 0;
  for (let i = 1; i < n; i++) { let ch = 0; for (let k = 0; k < cells[0].length; k += 4) { const d = Math.abs(cells[0][k] - cells[i][k]) + Math.abs(cells[0][k+1] - cells[i][k+1]) + Math.abs(cells[0][k+2] - cells[i][k+2]); if (d > 24) ch++; } best = Math.max(best, ch / (cells[0].length / 4)); }
  return best;
})`;

const MOVING = ["transform", "clipPath", "filter"] as const;
type Css4 = { transform: string; opacity: string; clipPath: string; filter: string };

/** Numbers in a computed value, for a tolerant compare. */
function nums(s: string): number[] {
  return [...s.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((m) => Number(m[0]));
}
function close(a: string, b: string): boolean {
  if (a === b) return true;
  const x = nums(a);
  const y = nums(b);
  if (x.length !== y.length || a.replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g, "#") !== b.replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g, "#")) return false;
  return x.every((v, i) => Math.abs(v - y[i]!) <= Math.max(0.02, Math.abs(v) * 0.02));
}

export async function checkMotions(items: readonly MotionInput[], outDir: string): Promise<CheckResult[]> {
  mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  const results: CheckResult[] = [];
  try {
    for (const it of items) {
      const problems: string[] = [];
      const metrics: Record<string, number> = {};
      const arg = { id: it.id, target: it.target, stagger: it.stagger, origin: it.origin, keyframes: it.keyframes, timing: it.timing, css: it.css };
      const page = await browser.newPage({ viewport: { width: 1400, height: 600 } });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message ?? "page error"));
      try {
        await page.setContent(MOTION_PAGE);
        const r = await page.evaluate<{ err: string | null; waapi: Css4[]; css: Css4[]; cssCount: number }>(`${MOTION_TEST}(${JSON.stringify(arg)})`);
        if (r.err) problems.push(`element.animate() throws: ${r.err}`);
        else {
          const moving = MOVING.filter((p) => new Set(r.waapi.map((s) => s[p])).size > 1);
          metrics.movingProps = moving.length;
          if (moving.length === 0) problems.push("nothing moves: transform, clip-path and filter stay the same at every sampled time");
          if (r.cssCount === 0) problems.push("the computed CSS does not start an animation on the element");
          else {
            const off = r.waapi.findIndex((s, i) => !(["transform", "opacity", "clipPath", "filter"] as const).every((p) => close(s[p], r.css[i]![p])));
            if (off >= 0) problems.push(`the CSS and WAAPI versions differ at sample ${off}: ${JSON.stringify(r.waapi[off])} vs ${JSON.stringify(r.css[off])}`);
          }
          await page.evaluate(`${MOTION_FRAMES}(${JSON.stringify(arg)})`);
          const png = await page.locator("#strip").screenshot({ type: "png" });
          const share = await page.evaluate<number>(`${STRIP_DIFF}(${JSON.stringify(`data:image/png;base64,${png.toString("base64")}`)})`);
          metrics.pixelMove = Number(share.toFixed(3));
          if (share < 0.01) problems.push(`the demo element barely changes on screen (${(share * 100).toFixed(1)}% of pixels): make the motion visible`);
          writeFileSync(join(outDir, `${it.id}.png`), png);
        }
        // Reduced motion: the record's CSS with prefers-reduced-motion on.
        await page.emulateMedia({ reducedMotion: "reduce" });
        const rr = await page.evaluate<{ err: string | null; waapi: Css4[]; css: Css4[]; cssCount: number }>(`${MOTION_TEST}(${JSON.stringify(arg)})`);
        if (it.reduced.kind === "static") {
          if (rr.cssCount > 0) problems.push("with reduced motion (static) an animation still runs");
        } else {
          if (rr.cssCount === 0) problems.push("with reduced motion (fade) no opacity animation runs");
          if (MOVING.some((p) => new Set(rr.css.map((s) => s[p])).size > 1)) problems.push("with reduced motion (fade) more than opacity changes");
        }
        problems.push(...errors.map((e) => `page error: ${e}`));
      } catch (e) {
        problems.push(`render error: ${e instanceof Error ? e.message.slice(0, 300) : String(e)}`);
      } finally {
        await page.close();
      }
      results.push({ id: it.id, ok: problems.length === 0, problems, metrics });
    }
  } finally {
    await browser.close();
  }
  return results;
}
