/**
 * The glass Bend mark (OGL, MIT). Loaded on demand by GlassMark.tsx, landing page only.
 *
 * The mark is rasterised once into a texture: red holds the crisp shape, green a blurred copy.
 * The fragment shader treats the blurred copy as a height field, so its slope is a surface normal:
 * the edges catch light (fresnel), a soft highlight follows the pointer and drifts slowly, and the
 * inside is refracted through the bevel. Output is premultiplied grey glass with a faint yellow
 * glint, on a transparent canvas, so the window in front of it blurs it like the reference.
 */
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { BRAND_MARK_PATH } from "@/components/brand/BrandMark";

const MARK_W = 710;
const MARK_H = 536.3;
const SIZE = 512;

function markTexture(): HTMLCanvasElement {
  const pad = SIZE * 0.14;
  const scale = (SIZE - pad * 2) / MARK_W;
  const draw = (blur: number) => {
    const c = document.createElement("canvas");
    c.width = c.height = SIZE;
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    ctx.filter = blur ? `blur(${blur}px)` : "none";
    ctx.translate(pad, (SIZE - MARK_H * scale) / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = "white";
    ctx.fill(new Path2D(BRAND_MARK_PATH));
    return c;
  };
  const sharp = draw(0).getContext("2d")!.getImageData(0, 0, SIZE, SIZE);
  const soft = draw(14).getContext("2d")!.getImageData(0, 0, SIZE, SIZE);
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
uniform float uTime;
uniform vec2 uPointer;
uniform float uAspect;
uniform float uIntensity;
varying vec2 vUv;

float shapeAt(vec2 p) { return texture2D(tMap, p).r; }
float heightAt(vec2 p) { return texture2D(tMap, p).g; }

void main() {
  vec2 uv = vUv;
  if (uAspect > 1.0) uv.x = (uv.x - 0.5) * uAspect + 0.5;
  else uv.y = (uv.y - 0.5) / uAspect + 0.5;
  uv.y = 1.0 - uv.y;
  vec2 drift = vec2(sin(uTime * 0.35), cos(uTime * 0.27)) * 0.012 + uPointer * 0.02;
  uv += drift;

  vec2 e = vec2(1.5 / 512.0, 0.0);
  float hx = heightAt(uv + e.xy) - heightAt(uv - e.xy);
  float hy = heightAt(uv + e.yx) - heightAt(uv - e.yx);
  vec3 n = normalize(vec3(-hx * 9.0, hy * 9.0, 1.0));

  float body = smoothstep(0.02, 0.55, heightAt(uv));
  float inner = shapeAt(uv + n.xy * 0.035);
  vec3 L = normalize(vec3(uPointer * 0.7 + vec2(cos(uTime * 0.21), sin(uTime * 0.17)) * 0.35, 0.75));
  float spec = pow(max(dot(n, L), 0.0), 28.0);
  float rim = pow(1.0 - n.z, 1.4);

  vec3 glass = vec3(0.78, 0.78, 0.77) * (0.16 + 0.34 * inner) + vec3(0.95) * rim * 0.9 + vec3(1.0, 0.86, 0.32) * spec * 0.35 + vec3(1.0) * spec * 0.55;
  float alpha = clamp(body * (0.22 + 0.4 * inner + rim * 0.9 + spec), 0.0, 1.0);
  alpha *= uIntensity;
  gl_FragColor = vec4(glass * alpha, alpha);
}
`;

export function mountGlass(host: HTMLElement, onReady: () => void): () => void {
  const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr: Math.min(window.devicePixelRatio || 1, 1.5) });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const texture = new Texture(gl, { image: markTexture(), generateMipmaps: false, flipY: false });
  const program = new Program(gl, {
    vertex,
    fragment,
    transparent: true,
    uniforms: { tMap: { value: texture }, uTime: { value: 0 }, uPointer: { value: [0, 0] }, uAspect: { value: 1 }, uIntensity: { value: 1 } },
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    program.uniforms.uAspect!.value = w / h;
    // How bright the glass may get: a CSS custom property, lower where text sits over it.
    const k = parseFloat(getComputedStyle(host).getPropertyValue("--glass-intensity"));
    program.uniforms.uIntensity!.value = Number.isFinite(k) ? k : 1;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let tx = 0;
  let ty = 0;
  let px = 0;
  let py = 0;
  const onMove = (e: PointerEvent) => {
    tx = (e.clientX / window.innerWidth) * 2 - 1;
    ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  let visible = true;
  const io = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    if (visible) loop();
  });
  io.observe(host);

  let raf = 0;
  let first = true;
  const t0 = performance.now();
  function frame(now: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    px += (tx - px) * 0.05;
    py += (ty - py) * 0.05;
    program.uniforms.uTime!.value = (now - t0) / 1000;
    program.uniforms.uPointer!.value = [px, py];
    renderer.render({ scene: mesh });
    if (first) {
      first = false;
      onReady();
    }
    loop();
  }
  function loop() {
    if (!raf) raf = requestAnimationFrame(frame);
  }
  const onVis = () => !document.hidden && loop();
  document.addEventListener("visibilitychange", onVis);
  loop();

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("visibilitychange", onVis);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  };
}
