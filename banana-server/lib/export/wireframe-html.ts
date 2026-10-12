/**
 * frankenstein-wireframe.html (format `wireframe_html`): a standalone low fi wireframe of every
 * Frankenstein page. One grey box per slot, sized by its crop's aspect ratio, with the role, the
 * note and a source link caption. No reference images (nothing to hotlink, nothing to copy).
 */
import type { StitchSlotSnapshot, StitchSnapshot } from "../canvas/types";
import { cropAspect } from "../stitch/size";
import { STITCH_FRAME_WIDTH } from "../stitch/types";
import type { KitModel } from "./model";
import { scopeSentence } from "./scope";
import { kitTitle } from "./scoped";
import { escapeHtml as e, oneLine, safeUrl } from "./util";

const LINK_ATTRS = 'target="_blank" rel="noopener noreferrer nofollow"';

/** Height over width at full frame width when the image size is unknown. */
const ROLE_RATIO: Record<string, number> = { nav: 0.08, "status-header": 0.2, toolbar: 0.08, tabbar: 0.18, hero: 0.5, footer: 0.22, logos: 0.1, sidebar: 2 };

function roleLabel(role: string): string {
  const r = role.replace(/-/g, " ");
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function slotRatio(s: StitchSlotSnapshot): number {
  const known = cropAspect(s.crop, s.imageWidth, s.imageHeight);
  return Math.min(4, Math.max(0.04, known ?? ROLE_RATIO[s.role] ?? 0.45));
}

function slotHtml(s: StitchSlotSnapshot, grow: number): string {
  const site = oneLine(s.sourceSite, 80) || "web";
  const title = oneLine(s.title, 120) || `Page on ${site}`;
  const url = safeUrl(s.sourceUrl);
  const role = roleLabel(s.role);
  const ratio = slotRatio(s);
  const source = url
    ? `<a href="${e(url)}" ${LINK_ATTRS}>${e(title)}</a> (${e(site)})`
    : `${e(title)} (${e(site)}, source link not usable)`;
  return `<div class="slot" role="group" aria-label="${e(`${role}, from ${site}`)}" style="flex:${grow} 1 0;aspect-ratio:1 / ${ratio.toFixed(4)}">
<p class="role">${e(role)}</p>
${s.note ? `<p class="note" dir="auto">${e(oneLine(s.note, 300))}</p>` : ""}
<p class="src">Source: ${source}</p>
</div>`;
}

function stitchHtml(st: StitchSnapshot, i: number): string {
  const width = STITCH_FRAME_WIDTH[st.platform];
  const rows = st.rows
    .map((row) => {
      const widths = row.widths && row.widths.length === row.slots.length ? row.widths : row.slots.map(() => 1);
      return `<li class="row">${row.slots.map((s, k) => slotHtml(s, widths[k] ?? 1)).join("\n")}</li>`;
    })
    .join("\n");
  const id = `page-${i + 1}`;
  return `<section class="page" aria-labelledby="${id}">
<h2 id="${id}" dir="auto">${i + 1}. ${e(oneLine(st.title, 120))}</h2>
<p class="muted">${e(st.platform)} frame, ${width} px wide.${st.note ? ` Idea: <span dir="auto">${e(oneLine(st.note, 300))}</span>` : ""}</p>
<div class="scroll" role="region" aria-label="${e(`Wireframe of ${oneLine(st.title, 120)}`)}" tabindex="0">
<ol class="frame" style="width:${width}px" aria-label="Rows, top to bottom">
${rows || '<li class="row empty">No rows yet.</li>'}
</ol>
</div>
</section>`;
}

const CSS = `
:root{color-scheme:light;--bg:#f6f5f2;--fg:#1b1b1b;--muted:#4a4a4a;--line:#6b6b6b;--box:#d9d9d6;--frame:#ffffff;--focus:#1747d1}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header,footer,.page>h2,.page>p{max-width:960px;margin-inline:auto;padding-inline:16px}
header{padding-block:24px 8px}
h1{margin:0 0 8px;font-size:28px;line-height:1.2}
h2{margin:32px auto 4px;font-size:20px}
p{margin:0 0 8px}
.muted{color:var(--muted)}
.scroll{overflow:auto;padding:16px;border-block:1px solid var(--line)}
.scroll:focus-visible,a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.frame{list-style:none;margin:0 auto;padding:0;background:var(--frame);border:1px solid var(--line)}
.row{display:flex;align-items:flex-start;gap:4px;padding:2px}
.row.empty{padding:24px}
.slot{min-height:72px;min-width:0;padding:8px 12px;background:var(--box);border:1px dashed var(--line);overflow:hidden}
.role{margin:0;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.04em}
.note{margin:4px 0 0;font-size:14px}
.src{margin:4px 0 0;font-size:13px;color:var(--muted)}
a{color:#1747d1}
footer{padding-block:24px}
ol.sources{padding-inline-start:24px}
ol.sources li{overflow-wrap:anywhere}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
`;

export function wireframeHtml(m: KitModel): string {
  const title = `Frankenstein pages: ${kitTitle(m)}`;
  const pages = m.stitches.map(stitchHtml).join("\n");
  const seen = new Set<string>();
  const sources: string[] = [];
  for (const st of m.stitches) {
    for (const row of st.rows) {
      for (const s of row.slots) {
        const url = safeUrl(s.sourceUrl);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        sources.push(`<li><a href="${e(url)}" ${LINK_ATTRS} dir="auto">${e(oneLine(s.title, 120) || s.sourceSite)}</a> (${e(oneLine(s.sourceSite, 80))})</li>`);
      }
    }
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${e(title)}</title>
<style>${CSS}</style>
</head>
<body>
<header>
<h1 dir="auto">${e(title)}</h1>
${m.scope === "page" ? `<p><strong>${e(scopeSentence(m))}</strong></p>` : ""}
<p>Low fi wireframes of pages stacked from parts of different references. One grey box per part, sized like the cut. Take the structure, not the pixels, and unify to one theme. The reference images are not included; each box links its source.</p>
</header>
<main>
${pages || "<p>No Frankenstein pages on this board yet.</p>"}
<section aria-labelledby="sources-title">
<h2 id="sources-title">Sources</h2>
${sources.length ? `<ol class="sources">\n${sources.join("\n")}\n</ol>` : "<p>No sources.</p>"}
</section>
</main>
<footer class="muted">${m.webUrl ? `<a href="${e(m.webUrl)}" ${LINK_ATTRS}>Open the live board</a>. ` : ""}Reference images belong to their owners.</footer>
</body>
</html>
`;
}
