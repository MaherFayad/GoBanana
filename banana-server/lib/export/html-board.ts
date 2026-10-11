/**
 * Single static HTML page laid out like the canvas. Images load from their
 * source URLs (never inlined), every tile links to its source, and a Sources
 * list sits at the bottom. All user strings are escaped.
 */
import type { CanvasItem } from "../canvas/types";
import { isReference } from "../canvas/types";
import type { KitModel, Reference } from "./model";
import { defaultPairing, findPairing } from "./model";
import { escapeHtml as e, finite, normalizeHex, oneLine, plainBlock, safeUrl, wildnessLabel } from "./util";

const PAD = 24;

function box(item: { x: number; y: number; w: number; h: number }, origin: { x: number; y: number }): string {
  const x = Math.round(finite(item.x) - origin.x);
  const y = Math.round(finite(item.y) - origin.y);
  const w = Math.round(Math.max(24, finite(item.w, 160)));
  const h = Math.round(Math.max(24, finite(item.h, 160)));
  return `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
}

const LINK_ATTRS = 'target="_blank" rel="noopener noreferrer nofollow"';

function tagLabel(tag: string | null | undefined): string {
  return tag === "ship" ? '<span class="tag ship">Ship</span>' : tag === "explore" ? '<span class="tag explore">Explore</span>' : "";
}

function referenceTile(item: CanvasItem & { type: "image" | "upload" }, ref: Reference | undefined, style: string): string {
  const url = ref?.url ?? safeUrl(item.sourceUrl);
  const img = ref?.id === item.id ? ref.imageUrl : (safeUrl(item.imageUrl) ?? safeUrl(item.thumbUrl));
  const site = ref?.site ?? (oneLine(item.sourceSite, 60) || "web");
  const title = ref?.title ?? (oneLine(item.title, 160) || `Reference from ${site}`);
  const n = ref ? `${ref.n}. ` : "";
  const media = img
    ? `<img src="${e(img)}" alt="${e(title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<span class="card-title" dir="auto">${e(title)}</span>`;
  const caption = `<span class="cap"><span dir="auto">${e(n)}${e(site)}: ${e(title)}</span>${tagLabel(item.tag)}</span>`;
  if (url) {
    return `<a class="tile ref" style="${style}" href="${e(url)}" ${LINK_ATTRS} aria-label="${e(`${title}, open source on ${site}`)}">${media}${caption}</a>`;
  }
  const raw = oneLine(item.sourceUrl, 500);
  return `<div class="tile ref" style="${style}">${media}${caption}<span class="cap bad">Source: ${e(raw || "missing")}</span></div>`;
}

function itemHtml(item: CanvasItem, origin: { x: number; y: number }, refs: Map<string, Reference>): string {
  const style = box(item, origin);
  if (isReference(item)) return referenceTile(item, refs.get(item.id), style);
  switch (item.type) {
    case "note": {
      const text = plainBlock(item.text, 2000);
      return `<div class="tile note" style="${style}" dir="auto">${e(text).replace(/\n/g, "<br>")}</div>`;
    }
    case "swatch": {
      const hex = normalizeHex(item.hex);
      if (!hex) return "";
      const role = oneLine(item.role, 40);
      return `<div class="tile swatch" style="${style}"><span class="chip" style="background:${hex}"></span><span class="meta">${role ? `<strong>${e(role)}</strong> ` : ""}<code>${hex}</code>${item.oklch ? ` <code>${e(oneLine(item.oklch, 80))}</code>` : ""} ${tagLabel(item.tag)}</span></div>`;
    }
    case "typeSample": {
      const p = findPairing(item.pairingId) ?? defaultPairing();
      const sample = oneLine(item.sample, 200) || p.sample;
      const fam = (f: { family: string; fallback: string }) => `font-family:&quot;${e(f.family)}&quot;,${e(f.fallback)}`;
      return `<div class="tile type" style="${style}"><span class="type-display" style="${fam(p.display)}" dir="auto">${e(sample)}</span><span class="meta">${e(p.display.family)} and ${e(p.body.family)}, ${e(p.licence)}. <a href="${e(p.url)}" ${LINK_ATTRS}>Fonts</a></span></div>`;
    }
    default:
      return "";
  }
}

const CSS = `
:root{color-scheme:light;--bg:#f6f5f2;--fg:#1b1b1b;--muted:#4a4a4a;--line:#c9c6bf;--tile:#ffffff;--focus:#1747d1}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header,main>section.sources,footer{max-width:960px;margin:0 auto;padding:24px 16px}
h1{margin:0 0 8px;font-size:28px;line-height:1.2}
p{margin:0 0 8px}
.muted{color:var(--muted)}
.scroll{overflow:auto;border-block:1px solid var(--line);background:#ecebe7}
.scroll:focus-visible,a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.board{position:relative;margin:0}
.section{position:absolute;border:2px dashed var(--line);border-radius:12px}
.section h2{position:absolute;top:-30px;left:0;margin:0;font-size:16px;line-height:24px;white-space:nowrap}
.tile{position:absolute;display:flex;flex-direction:column;overflow:hidden;border-radius:8px;background:var(--tile);border:1px solid var(--line);color:var(--fg);text-decoration:none}
.tile img{flex:1;min-height:0;width:100%;object-fit:cover;display:block;background:#ddd}
.card-title{flex:1;padding:12px;font-weight:600}
.cap{display:flex;gap:6px;align-items:center;justify-content:space-between;padding:4px 8px;font-size:12px;line-height:16px;background:var(--tile)}
.cap span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cap.bad{color:#8a1c00;white-space:normal}
.note{padding:12px;background:#fff6c7;font-size:14px;overflow:auto}
.swatch .chip{flex:1;min-height:24px}
.swatch .meta,.type .meta{padding:6px 8px;font-size:12px}
.type .type-display{flex:1;padding:12px;font-size:24px;line-height:1.3}
.tag{flex:none;padding:0 6px;border:1px solid currentColor;border-radius:999px;font-size:11px}
.tag.ship{color:#14532d}
.tag.explore{color:#7c2d12}
ol{padding-inline-start:24px}
li{margin-bottom:6px;overflow-wrap:anywhere}
`;

export function htmlBoard(m: KitModel): string {
  const refs = new Map(m.references.map((r) => [r.id, r]));
  const boxes = [...m.sections, ...m.sections.flatMap((s) => s.items), ...m.unsorted];
  const minX = boxes.length ? Math.min(...boxes.map((b) => finite(b.x))) : 0;
  const minY = boxes.length ? Math.min(...boxes.map((b) => finite(b.y))) : 0;
  const maxX = boxes.length ? Math.max(...boxes.map((b) => finite(b.x) + Math.max(24, finite(b.w, 160)))) : 0;
  const maxY = boxes.length ? Math.max(...boxes.map((b) => finite(b.y) + Math.max(24, finite(b.h, 160)))) : 0;
  // Extra top room so section titles stay inside the board.
  const origin = { x: minX - PAD, y: minY - PAD - 32 };
  const width = Math.round(maxX - origin.x + PAD);
  const height = Math.round(maxY - origin.y + PAD);

  const parts: string[] = [];
  for (const s of m.sections) {
    parts.push(`<div class="section" style="${box(s, origin)}"><h2 dir="auto">${e(s.title)}</h2></div>`);
  }
  for (const s of m.sections) for (const item of s.items) parts.push(itemHtml(item, origin, refs));
  for (const item of m.unsorted) parts.push(itemHtml(item, origin, refs));

  const sources = m.references.map((r) => {
    const link = r.url ? `<a href="${e(r.url)}" ${LINK_ATTRS} dir="auto">${e(r.title)}</a> (${e(r.site)})<br><span class="muted">${e(r.url)}</span>` : `<span dir="auto">${e(r.title)}</span> (${e(r.site)})<br><span class="muted">Source link not usable: ${e(r.rawUrl || "missing")}</span>`;
    return `<li>${link}</li>`;
  });

  const directions = m.directions.filter((d) => d.kept).map((d) => d.direction.title);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${e(m.title)}</title>
<style>${CSS}</style>
</head>
<body>
<header>
<h1 dir="auto">${e(m.title)}</h1>
${m.brief ? `<p dir="auto">${e(m.brief)}</p>` : ""}
<p class="muted">Wildness: ${e(wildnessLabel(m.wildness))}${m.lens ? `. Lens: ${e(m.lens)}` : ""}${directions.length ? `. Directions kept: ${e(directions.join("; "))}` : ""}.</p>
<p class="muted">Every tile links to its source. Images load from the source sites and belong to their owners.</p>
</header>
<main>
<div class="scroll" role="region" aria-label="Board" tabindex="0">
<div class="board" style="width:${width}px;height:${height}px">
${parts.filter(Boolean).join("\n")}
</div>
</div>
<section class="sources" aria-labelledby="sources-title">
<h2 id="sources-title">Sources</h2>
${sources.length ? `<ol>\n${sources.join("\n")}\n</ol>` : "<p>No references on this board.</p>"}
</section>
</main>
<footer class="muted">${m.webUrl ? `<a href="${e(m.webUrl)}" ${LINK_ATTRS}>Open the live board</a>. ` : ""}Reference images belong to their owners.</footer>
</body>
</html>
`;
}
