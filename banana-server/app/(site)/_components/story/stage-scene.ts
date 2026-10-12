/**
 * The landing stage (OGL, MIT): one full-screen WebGL pass, fixed behind the whole page, loaded on
 * demand by StoryStage.tsx after the page is idle. Landing page only.
 *
 * It draws three things, after ssscript.app (docs/landing-motion-spec.md):
 * - The desk background, which turns into the light grey of the export section through a block
 *   wipe: 56 by 40 blocks, top first, with a little jitter and a glitch while it runs.
 * - The Bend mark as a thick app tile, raymarched as an extruded rounded square with the mark
 *   raised on its face. It tilts toward the cursor, floats, dips and tips with scroll speed and
 *   flips over on a hard flick, like the reference.
 * - Where the tile sits and how big it is comes from the page: each section carries
 *   `data-mark="scale y dim"` and the stage eases toward the values of the section under the
 *   middle of the viewport; `data-grey` marks the section whose scroll drives the wipe.
 *
 * Colors come from the --st-desk-* tokens (read once from CSS), never from literals. The loop
 * stops while the tab is hidden or an app window covers the page (components/window/cover.ts)
 * and draws nothing while the page is scrolled past the story.
 */
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { BRAND_MARK_PATH } from "@/components/brand/BrandMark";
import { watchPageCover } from "@/components/window/cover";

const MARK_W = 710;
const MARK_H = 536.3;
const SIZE = 512;

/** Red: the mark, crisp. Green: a blurred copy, used as a height field for the raised edge. */
function markTexture(): HTMLCanvasElement {
  const width = SIZE * 0.66;
  const scale = width / MARK_W;
  const draw = (blur: number) => {
    const c = document.createElement("canvas");
    c.width = c.height = SIZE;
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    ctx.filter = blur ? `blur(${blur}px)` : "none";
    ctx.translate((SIZE - width) / 2, (SIZE - MARK_H * scale) / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = "white";
    ctx.fill(new Path2D(BRAND_MARK_PATH));
    return c;
  };
  const sharp = draw(0).getContext("2d")!.getImageData(0, 0, SIZE, SIZE);
  const soft = draw(5).getContext("2d")!.getImageData(0, 0, SIZE, SIZE);
  const out = document.createElement("canvas");
  out.width = out.height = SIZE;
  const ctx = out.getContext("2d")!;
  const img = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = sharp.data[i + 3]!;
    img.data[i + 1] = soft.data[i + 3]!;
    img.data[i + 2] = 0;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** A token's color as linear-ish 0..1 RGB (sRGB values; the shader works in sRGB like CSS). */
function tokenColor(name: string): [number, number, number] {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  const m = rgb.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return [(m[0] ?? 0) / 255, (m[1] ?? 0) / 255, (m[2] ?? 0) / 255];
}

const vertex = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec2 uMarkPos;
uniform float uMarkSize;
uniform vec3 uRot;
uniform float uDim;
uniform float uLight;
uniform vec3 uStage;
uniform vec3 uTile;
uniform vec3 uSide;
uniform vec3 uFace;
uniform vec3 uGlint;
uniform vec3 uGreyA;
uniform vec3 uGreyB;
varying vec2 vUv;

const float BX = 56.0;
const float BY = 40.0;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

mat3 rotation(vec3 r) {
  float cx = cos(r.x), sx = sin(r.x), cy = cos(r.y), sy = sin(r.y), cz = cos(r.z), sz = sin(r.z);
  mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
  mat3 ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 rz = mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0);
  return rz * ry * rx;
}

const float HALF_D = 0.17;
const float EDGE = 0.07;
const float CORNER = 0.44;

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

float sdTile(vec3 p) {
  float d2 = sdRoundRect(p.xy, vec2(1.0 - EDGE), CORNER - EDGE);
  vec2 w = vec2(d2, abs(p.z) - (HALF_D - EDGE));
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - EDGE;
}

vec3 tileNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float h = 0.002;
  return normalize(k.xyy * sdTile(p + k.xyy * h) + k.yyx * sdTile(p + k.yyx * h) + k.yxy * sdTile(p + k.yxy * h) + k.xxx * sdTile(p + k.xxx * h));
}

/** The tile over a background color; returns the color and how much tile covers the pixel. */
vec4 drawTile(vec2 px) {
  vec2 q = (px - uMarkPos) / uMarkSize;
  q.y = -q.y;
  if (dot(q, q) > 4.0) return vec4(0.0);
  const float F = 7.0;
  mat3 R = rotation(uRot);
  mat3 Ri = mat3(R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]);
  vec3 roW = vec3(0.0, 0.0, F);
  vec3 rdW = normalize(vec3(q, 0.0) - roW);
  vec3 ro = Ri * roW;
  vec3 rd = Ri * rdW;
  float t = F - 2.0;
  float hit = 0.0;
  vec3 p;
  for (int i = 0; i < 56; i++) {
    p = ro + rd * t;
    float d = sdTile(p);
    if (d < 0.0015) { hit = 1.0; break; }
    t += d;
    if (t > F + 2.0) break;
  }
  if (hit < 0.5) return vec4(0.0);
  vec3 n = tileNormal(p);
  vec3 col;
  float face = smoothstep(0.75, 0.95, n.z);
  // Face: the raised mark, read from the texture, with its blurred copy as a bevel.
  vec2 uv = vec2(p.x, -p.y) * 0.5 + 0.5;
  vec4 tex = texture2D(tMap, uv);
  float mark = tex.r * face;
  vec2 e = vec2(1.5 / 512.0, 0.0);
  float hx = texture2D(tMap, uv + e.xy).g - texture2D(tMap, uv - e.xy).g;
  float hy = texture2D(tMap, uv + e.yx).g - texture2D(tMap, uv - e.yx).g;
  vec3 nm = normalize(n + face * vec3(-hx * 5.0, hy * 5.0, 0.0));
  vec3 nW = R * nm;
  vec3 L = normalize(vec3(-0.45, 0.65, 0.9));
  vec3 V = -rdW;
  float diff = max(dot(nW, L), 0.0);
  float spec = pow(max(dot(nW, normalize(L + V)), 0.0), 40.0);
  float rim = pow(1.0 - max(dot(nW, V), 0.0), 3.0);
  float grain = hash12(floor(uv * 512.0)) - 0.5;
  vec3 tileCol = mix(uSide, uTile, face) * (0.75 + 0.45 * diff) + vec3(0.9) * rim * 0.18;
  vec3 faceCol = uFace * (0.78 + 0.28 * diff + grain * 0.07);
  col = mix(tileCol, faceCol, mark);
  col += (vec3(1.0) * 0.35 + uGlint * 0.15) * spec * (0.4 + mark);
  // Dims at or above 0.3 only darken (text over the tile); below that the tile fades out (phones).
  return vec4(col * max(uDim, 0.3), clamp(uDim * 3.4, 0.0, 1.0));
}

void main() {
  vec2 frag = gl_FragCoord.xy / uDpr;
  vec2 px = vec2(frag.x, uRes.y - frag.y);
  vec2 sUv = frag / uRes;

  // Block wipe into the grey section: bottom blocks first (the section rises from below), a
  // little jitter, a glitch while it runs.
  vec2 blockId = floor(sUv * vec2(BX, BY));
  vec2 blockUv = (blockId + 0.5) / vec2(BX, BY);
  float seed = hash12(blockId);
  float active = smoothstep(0.02, 0.14, uLight) * (1.0 - smoothstep(0.86, 0.98, uLight));
  float reveal = 1.0 - blockUv.y + (seed - 0.5) * 0.16;
  float lightMix = step(mix(1.1, -0.1, uLight), reveal);
  float frame = floor(uTime * 14.0);
  float glitch = step(1.0 - 0.22 * active, hash12(blockId + vec2(51.1, frame)));
  lightMix = mix(lightMix, 1.0 - lightMix, glitch * 0.6);

  float wave = sin(sUv.x * 3.8 + uTime * 0.42) * 0.045 + sin(sUv.y * 2.2 - uTime * 0.3) * 0.03;
  vec3 grey = mix(uGreyA, uGreyB, clamp(sUv.y + wave, 0.0, 1.0));
  float scan = 1.0 - 0.06 * active * step(0.5, fract(frag.y * 0.5));
  vec3 bg = mix(uStage, grey * scan, lightMix);

  // Pixelate the tile in blocks while the wipe runs, like the reference.
  vec2 tilePx = px;
  if (active > 0.0 && hash12(blockId + vec2(9.7, frame)) < 0.5 * active) {
    vec2 cell = uRes / vec2(BX, BY);
    tilePx = (floor(px / cell) + 0.5) * cell;
  }
  vec4 tile = drawTile(tilePx);
  gl_FragColor = vec4(mix(bg, tile.rgb, tile.a), 1.0);
}
`;

type MarkTarget = { scale: number; y: number; dim: number };

function readTarget(el: Element): MarkTarget {
  const [scale = 1, y = 0.55, dim = 1] = (el.getAttribute("data-mark") ?? "").split(/\s+/).map(Number);
  return { scale, y, dim };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function mountStage(host: HTMLElement, onReady: () => void): () => void {
  const narrowQuery = window.matchMedia("(max-width: 767.98px)");
  // Phones and tablets: the tile only shows in the empty slots made for it (story.css .tile-slot).
  const slotQuery = window.matchMedia("(max-width: 1099.98px)");
  const dpr = narrowQuery.matches ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  const renderer = new Renderer({ alpha: false, antialias: false, dpr });
  const gl = renderer.gl;
  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const texture = new Texture(gl, { image: markTexture(), generateMipmaps: false, flipY: false });
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      tMap: { value: texture },
      uRes: { value: [1, 1] },
      uDpr: { value: dpr },
      uTime: { value: 0 },
      uMarkPos: { value: [0, 0] },
      uMarkSize: { value: 200 },
      uRot: { value: [0, 0, 0] },
      uDim: { value: 1 },
      uLight: { value: 0 },
      uStage: { value: tokenColor("--st-desk-stage") },
      uTile: { value: tokenColor("--st-desk-tile") },
      uSide: { value: tokenColor("--st-desk-tile-side") },
      uFace: { value: tokenColor("--st-desk-mark-face") },
      uGlint: { value: tokenColor("--st-desk-mark-glint") },
      uGreyA: { value: tokenColor("--st-desk-grey-a") },
      uGreyB: { value: tokenColor("--st-desk-grey-b") },
    },
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  const u = program.uniforms as Record<string, { value: unknown }>;

  let vw = 1;
  let vh = 1;
  const resize = () => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    renderer.setSize(vw, vh);
    u.uRes!.value = [vw, vh];
  };
  window.addEventListener("resize", resize);
  resize();

  // Pointer, eased (the reference's mouseEasing is 0.12).
  let tx = 0;
  let ty = 0;
  let mx = 0;
  let my = 0;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    tx = clamp((e.clientX / vw) * 2 - 1, -1, 1);
    ty = clamp((e.clientY / vh) * 2 - 1, -1, 1);
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  const sections = Array.from(document.querySelectorAll("[data-mark]"));
  // Phones: the tile only shows inside an empty slot made for it (`data-tile-slot`), never behind text.
  const slots = Array.from(document.querySelectorAll<HTMLElement>("[data-tile-slot]"));
  const grey = document.querySelector("[data-grey]");

  const cur: MarkTarget = { scale: 1, y: 0.5, dim: 1 };
  let first = true;
  let lastY = window.scrollY;
  let vel = 0;
  let dip = 0;
  let tip = 0;
  let flipStart = -1;
  let raf = 0;
  const t0 = performance.now();

  /** Phone and tablet target: the most visible tile slot (tile centred in it, `scale` is its half size in px), else hidden. */
  function slotTarget(): MarkTarget {
    let best: DOMRect | null = null;
    let bestArea = 0;
    for (const el of slots) {
      const r = el.getBoundingClientRect();
      const seen = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (r.height > 0 && seen > bestArea) {
        bestArea = seen;
        best = r;
      }
    }
    if (!best) return { ...cur, dim: 0 };
    const width = Math.min(best.height * 0.8, best.width * 0.9, vw * 0.62);
    return { scale: width / 2, y: (best.top + best.height / 2) / vh, dim: 1 };
  }

  function target(): MarkTarget {
    if (slotQuery.matches && slots.length > 0) return slotTarget();
    const mid = vh * 0.5;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) return readTarget(s);
    }
    return cur;
  }

  function lightAmount(): number {
    if (!grey) return 0;
    // In: from the moment the section's top edge enters until it is 30% down the screen. Its text
    // only appears later (desktop: when the pin starts; phone: after a short leading gap), and the
    // pricing window above is opaque enough to sit on any background.
    // Out: while the section's bottom edge moves from 120% to 90% of the screen. By then the grey
    // heading has faded out (story-motion.ts) or scrolled away, and the next heading is still below.
    const r = grey.getBoundingClientRect();
    const into = clamp((vh - r.top) / (vh * 0.7), 0, 1);
    const out = clamp((r.bottom - vh * 0.9) / (vh * 0.3), 0, 1);
    return Math.min(into, out);
  }

  function frame(now: number) {
    raf = 0;
    if (document.hidden || covered) return;
    const time = (now - t0) / 1000;
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;
    vel += (dy - vel) * 0.25;

    const want = target();
    const k = first ? 1 : 0.06;
    const pinned = slotQuery.matches && slots.length > 0;
    cur.scale += (want.scale - cur.scale) * (pinned ? 1 : k);
    // In a slot the tile scrolls with the page, so it never drifts over the text around it.
    cur.y += (want.y - cur.y) * (pinned ? 1 : k);
    cur.dim += (want.dim - cur.dim) * Math.min(1, k * 2);
    first = false;

    // Scroll speed: the tile dips and tips, then settles back.
    dip += ((pinned ? 0 : clamp(vel * 1.4, -140, 140)) - dip) * 0.14;
    tip += (clamp(-vel * 0.012, -0.6, 0.6) - tip) * 0.14;
    if (flipStart < 0 && Math.abs(vel) > 70) flipStart = time;
    let flip = 0;
    if (flipStart >= 0) {
      const p = (time - flipStart) / 0.85;
      if (p >= 1) flipStart = -1;
      else flip = p * p * (3 - 2 * p) * Math.PI * 2 * Math.sign(vel || 1);
    }

    mx += (tx - mx) * 0.12;
    my += (ty - my) * 0.12;
    const narrow = narrowQuery.matches;
    const half = pinned ? cur.scale : (narrow ? vw * 0.4 : Math.min(vw * 0.15, vh * 0.24)) * cur.scale;
    const float = Math.sin(time * 0.9) * 0.04 * half;
    u.uMarkSize!.value = half;
    u.uMarkPos!.value = [vw / 2, vh * cur.y + float + dip];
    u.uRot!.value = [my * 0.35 + tip + flip + Math.sin(time * 0.9 * 0.8) * 0.082, mx * 0.5 + Math.cos(time * 0.9 * 0.6) * 0.082, 0];
    // On a phone the tile sits in its own slot with no text over it; without slots it stays dim
    // enough for 4.5:1 text over its face.
    u.uDim!.value = cur.dim * (narrow && !pinned ? 0.3 : 1);
    u.uLight!.value = lightAmount();
    u.uTime!.value = time;
    renderer.render({ scene: mesh });
    if (onReady) {
      onReady();
      onReady = undefined as unknown as () => void;
    }
    loop();
  }
  function loop() {
    if (!raf) raf = requestAnimationFrame(frame);
  }
  const onVis = () => !document.hidden && loop();
  document.addEventListener("visibilitychange", onVis);
  // Under an app window the stage is blurred out of sight: hold the last frame until it closes.
  let covered = false;
  const unwatch = watchPageCover((c) => {
    covered = c;
    if (!c) loop();
  });
  loop();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("visibilitychange", onVis);
    unwatch();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  };
}
