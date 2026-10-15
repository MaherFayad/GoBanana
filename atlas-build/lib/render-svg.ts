/**
 * Render check for motif SVG tiles (J6): each tile is drawn in headless Chrome as a 3x3 repeat,
 * once with red ink and its CSS variables unset, once with blue ink and the variables set.
 * It passes when the SVG parses, draws something in both, and the two renders differ (so it
 * really follows currentColor or the variables instead of hard-coded colors).
 * Playwright comes from banana-server/node_modules (this worktree's, else the main checkout's).
 * PNGs are written for the reviewer; they are our own generated art, never third-party images.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { MAIN_ATLAS, ROOT } from "../config.ts";

export type RenderResult = { id: string; ok: boolean; problems: string[]; png?: string };

/** The CSS variables a motif may use, with the test values for the themed render. */
export const MOTIF_VARS: Record<string, string> = {
  "--motif-1": "#1d4ed8",
  "--motif-2": "#f59e0b",
  "--motif-3": "#10b981",
  "--motif-bg": "#fef3c7",
};

type Pw = { chromium: { launch(o: { channel: string; headless: boolean }): Promise<Browser> } };
type Browser = { newPage(o?: object): Promise<Page>; close(): Promise<void> };
type Page = {
  setContent(html: string): Promise<void>;
  evaluate<T>(fn: string): Promise<T>;
  locator(sel: string): { screenshot(o?: object): Promise<Buffer> };
  on(ev: "console" | "pageerror", cb: (m: { type?: () => string; text?: () => string; message?: string }) => void): void;
};

function loadPlaywright(): Pw {
  const dirs = [resolve(ROOT, "..", "banana-server"), resolve(MAIN_ATLAS, "..", "banana-server")];
  for (const d of dirs) {
    if (existsSync(join(d, "node_modules", "playwright"))) return createRequire(join(d, "package.json"))("playwright") as Pw;
  }
  throw new Error("playwright not found in banana-server/node_modules");
}

function page(svg: string, themed: boolean): string {
  const vars = themed ? Object.entries(MOTIF_VARS).map(([k, v]) => `${k}:${v}`).join(";") : "";
  const cell = `<div class="c">${svg}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#fff}
#g{display:grid;grid-template-columns:repeat(3,120px);grid-auto-rows:120px;gap:0;width:360px;color:${themed ? "#1e3a8a" : "#dc2626"};${vars}}
.c{width:120px;height:120px;overflow:hidden}.c svg{width:120px;height:120px;display:block}
</style></head><body><div id="g">${cell.repeat(9)}</div></body></html>`;
}

const STATS = `(() => {
  const svg = document.querySelector('#g svg');
  const parsed = new DOMParser().parseFromString(document.querySelector('.c').innerHTML, 'image/svg+xml');
  const err = parsed.querySelector('parsererror');
  return { hasSvg: !!svg, parseError: err ? err.textContent.slice(0, 200) : null };
})()`;

/** In the page: share of pixels that are not the white page, and their mean color. */
const INK = `(async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let inked = 0; let r = 0, g = 0, b = 0;
  const colors = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 245 || d[i+1] < 245 || d[i+2] < 245) { inked++; r += d[i]; g += d[i+1]; b += d[i+2]; }
    const k = (d[i] >> 5) + '.' + (d[i+1] >> 5) + '.' + (d[i+2] >> 5);
    colors.set(k, (colors.get(k) || 0) + 1);
  }
  const n = Math.max(1, inked);
  const total = d.length / 4;
  const major = [...colors.values()].filter((c) => c > total * 0.01).length;
  return { inked: inked / total, mean: [r / n, g / n, b / n], colors: major };
})`;

export async function renderMotifs(items: Array<{ id: string; svg: string }>, outDir: string): Promise<RenderResult[]> {
  mkdirSync(outDir, { recursive: true });
  const pw = loadPlaywright();
  const browser = await pw.chromium.launch({ channel: "chrome", headless: true });
  const results: RenderResult[] = [];
  try {
    for (const it of items) {
      const problems: string[] = [];
      const shots: Array<{ inked: number; mean: number[]; colors: number }> = [];
      let pngPath: string | undefined;
      for (const themed of [false, true]) {
        const p = await browser.newPage({ viewport: { width: 400, height: 400 } });
        const errors: string[] = [];
        p.on("pageerror", (e) => errors.push(e.message ?? "page error"));
        p.on("console", (m) => {
          if (m.type?.() === "error") errors.push(m.text?.() ?? "console error");
        });
        await p.setContent(page(it.svg, themed));
        const s = await p.evaluate<{ hasSvg: boolean; parseError: string | null }>(STATS);
        if (!s.hasSvg) problems.push("no <svg> element rendered");
        if (s.parseError) problems.push(`SVG does not parse: ${s.parseError}`);
        const png = await p.locator("#g").screenshot({ type: "png" });
        const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
        const st = await p.evaluate<{ inked: number; mean: number[]; colors: number }>(`${INK}(${JSON.stringify(dataUrl)})`);
        shots.push(st);
        if (themed) {
          pngPath = join(outDir, `${it.id}.png`);
          writeFileSync(pngPath, png);
        } else {
          writeFileSync(join(outDir, `${it.id}-plain.png`), png);
        }
        problems.push(...errors.map((e) => `render error: ${e}`));
        await (p as unknown as { close(): Promise<void> }).close();
      }
      const [plain, themed] = shots as [(typeof shots)[0], (typeof shots)[0]];
      if (plain.inked < 0.02) problems.push(`plain render is nearly empty (${(plain.inked * 100).toFixed(1)}% inked)`);
      if (themed.inked < 0.02) problems.push(`themed render is nearly empty (${(themed.inked * 100).toFixed(1)}% inked)`);
      if (plain.colors < 2 && themed.colors < 2) problems.push("tile is one flat color with no motif");
      const diff = plain.mean.reduce((a, v, i) => a + Math.abs(v - themed.mean[i]!), 0);
      if (diff < 30) problems.push("colors do not change with currentColor or the CSS variables (hard-coded colors)");
      results.push({ id: it.id, ok: problems.length === 0, problems, png: pngPath });
    }
  } finally {
    await browser.close();
  }
  return results;
}
