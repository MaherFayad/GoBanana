/**
 * The mouse glyph trail (2D canvas, behind the page content, over the stage). The screen is a
 * grid of 10px cells; the pointer stamps a short band of cells as it moves, and each stamped cell
 * shows a glyph (`o`, `x`, `+`, `.` as it fades) for about a second. Near the head a few glyphs
 * split into a warm and a cool copy, like the reference's RGB shift. Mouse only; StoryStage.tsx
 * never mounts it under prefers-reduced-motion. Colors come from --st-desk-trail* tokens.
 */
const CELL = 10;
const LIFE = 1.0;
const RADIUS = 2.6;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "currentColor";
}

export function mountTrail(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const colors = { base: token("--st-desk-trail"), warm: token("--st-desk-trail-warm"), cool: token("--st-desk-trail-cool") };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let cols = 0;
  let rows = 0;
  let life = new Float32Array(0);
  const resize = () => {
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    cols = Math.ceil(window.innerWidth / CELL);
    rows = Math.ceil(window.innerHeight / CELL);
    life = new Float32Array(cols * rows);
  };
  resize();
  window.addEventListener("resize", resize);

  let last: { x: number; y: number } | null = null;
  let raf = 0;
  let prev = performance.now();
  let alive = 0;

  const stamp = (x: number, y: number) => {
    const cx = x / CELL;
    const cy = y / CELL;
    const r = Math.ceil(RADIUS);
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        const gx = Math.floor(cx) + i;
        const gy = Math.floor(cy) + j;
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
        const d = Math.hypot(gx + 0.5 - cx, gy + 0.5 - cy) / RADIUS;
        if (d > 1) continue;
        const v = 1 - d * 0.55;
        const at = gy * cols + gx;
        if (v > life[at]!) life[at] = v;
      }
    }
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const p = { x: e.clientX, y: e.clientY };
    if (last) {
      const dist = Math.hypot(p.x - last.x, p.y - last.y);
      const steps = Math.min(80, Math.ceil(dist / (CELL * 0.8)));
      for (let s = 1; s <= steps; s++) stamp(last.x + ((p.x - last.x) * s) / steps, last.y + ((p.y - last.y) * s) / steps);
    } else stamp(p.x, p.y);
    last = p;
    alive = 1;
    loop();
  };
  const onLeave = () => {
    last = null;
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    ctx!.font = `${CELL}px ui-monospace, monospace`;
    ctx!.textAlign = "center";
    ctx!.textBaseline = "middle";
    let any = false;
    for (let at = 0; at < life.length; at++) {
      let v = life[at]!;
      if (v <= 0) continue;
      v -= dt / LIFE;
      life[at] = v;
      if (v <= 0.06) {
        life[at] = 0;
        continue;
      }
      any = true;
      const x = (at % cols) * CELL + CELL / 2;
      const y = Math.floor(at / cols) * CELL + CELL / 2;
      const glyph = v > 0.75 ? "o" : v > 0.5 ? "x" : v > 0.25 ? "+" : ".";
      if (v > 0.8 && (at * 2654435761) % 7 === 0) {
        ctx!.globalAlpha = v * 0.8;
        ctx!.fillStyle = colors.warm;
        ctx!.fillText(glyph, x - 1.5, y);
        ctx!.fillStyle = colors.cool;
        ctx!.fillText(glyph, x + 1.5, y);
      }
      ctx!.globalAlpha = Math.min(1, v * 0.9);
      ctx!.fillStyle = colors.base;
      ctx!.fillText(glyph, x, y);
    }
    ctx!.globalAlpha = 1;
    alive = any ? 1 : 0;
    if (alive) loop();
  }
  function loop() {
    if (!raf && !document.hidden) {
      prev = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerleave", onLeave);
  };
}
