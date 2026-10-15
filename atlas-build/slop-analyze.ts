/**
 * P1-J8 step 3 (no API calls): renders every default page from raw/j8-pages-sonnet.jsonl and
 * raw/j8-pages-opus.jsonl in headless Chrome, reads features from computed styles and the page
 * text, and writes the share of pages that show each feature value as SlopRule[] to
 * out/v1/slop/, with review/j8-slop.html.
 *
 *   npx tsx slop-analyze.ts [--min-share 0.1]
 *
 * Screenshots are taken in memory to make sure each page painted, then dropped.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PATHS } from "./config.ts";
import { loadBriefs } from "./jobs/j8-briefs.ts";
import { browser, closeBrowser } from "./lib/browser.ts";
import { extractHtml, VIEWPORTS } from "./lib/j8.ts";
import { escapeHtml, reviewHtml, writeReview } from "./lib/review.ts";
import { writeKind } from "./lib/shards.ts";
import { writingProblems } from "./lib/validate.ts";
import { SlopRuleSchema, type SlopRule } from "./schema.ts";

type Raw = { id: string; status: string; stop_reason?: string | null; text?: string };
type Feature = SlopRule["feature"];
export type PageFeatures = Record<Feature, string[]>;

/** Raw in-page measurements; everything is computed in the browser from computed styles. */
type Measure = {
  bodyFont: string;
  headingFont: string | null;
  colors: Array<{ rgb: string; w: number }>;
  buttons: Array<{ r: number; h: number }>;
  cards: Array<{ r: number; shadowBlur: number }>;
  gradients: { text: boolean; big: boolean; any: boolean };
  centeredHero: boolean;
  splitHero: boolean;
  stickyHeader: boolean;
  bottomBar: boolean;
  rowMax: number;
  darkPage: boolean;
  text: string;
};

function measure(): Measure {
  const cs = (el: Element) => getComputedStyle(el);
  const first = (ff: string) => ff.split(",")[0]!.trim().replace(/["']/g, "");
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const heading = document.querySelector("h1") ?? document.querySelector("h2");
  const all = Array.from(document.querySelectorAll("body *")).slice(0, 4000);
  const visible = all.filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && cs(e).visibility !== "hidden" && cs(e).display !== "none";
  });
  const transparent = (c: string) => c === "rgba(0, 0, 0, 0)" || c === "transparent";
  const blurOf = (s: string) => {
    if (s === "none") return 0;
    const px = s.match(/-?\d+(\.\d+)?px/g)?.map(parseFloat) ?? [];
    return px.length >= 3 ? px[2]! : 0;
  };

  const colors: Array<{ rgb: string; w: number }> = [];
  const buttons: Array<{ r: number; h: number }> = [];
  const cards: Array<{ r: number; shadowBlur: number }> = [];
  let gText = false;
  let gBig = false;
  let gAny = false;
  let stickyHeader = false;
  let bottomBar = false;
  let rowMax = 0;

  for (const el of visible) {
    const s = cs(el);
    const r = el.getBoundingClientRect();
    const isButton = el.tagName === "BUTTON" || (el.tagName === "A" && !transparent(s.backgroundColor) && r.height < 90) || /\b(btn|button|cta)\b/i.test(el.className?.toString() ?? "");
    if (isButton && r.height > 0) {
      buttons.push({ r: parseFloat(s.borderTopLeftRadius) || 0, h: r.height });
      if (!transparent(s.backgroundColor)) colors.push({ rgb: s.backgroundColor, w: 3 });
    }
    if (el.tagName === "A" && transparent(s.backgroundColor)) colors.push({ rgb: s.color, w: 1 });
    if (/^H[1-3]$/.test(el.tagName)) colors.push({ rgb: s.color, w: 1 });
    if (!transparent(s.backgroundColor) && r.width * r.height < vw * vh * 0.2) colors.push({ rgb: s.backgroundColor, w: 1 });
    const bordered = s.borderTopStyle !== "none" && parseFloat(s.borderTopWidth) > 0;
    const shadow = s.boxShadow !== "none";
    const parentBg = el.parentElement ? cs(el.parentElement).backgroundColor : "";
    const ownSurface = !transparent(s.backgroundColor) && s.backgroundColor !== parentBg;
    if (!isButton && r.width >= 140 && r.width <= vw * 0.7 && r.height >= 80 && (shadow || bordered || ownSurface)) {
      cards.push({ r: parseFloat(s.borderTopLeftRadius) || 0, shadowBlur: blurOf(s.boxShadow) });
    }
    const bgi = s.backgroundImage;
    if (bgi.includes("gradient")) {
      gAny = true;
      const clip = s.getPropertyValue("background-clip") || s.getPropertyValue("-webkit-background-clip");
      if (clip.includes("text")) gText = true;
      else if (r.width * r.height >= vw * vh * 0.25) gBig = true;
    }
    if ((s.position === "sticky" || s.position === "fixed") && r.top <= 1 && r.width >= vw * 0.9 && r.height < 160) stickyHeader = true;
    if (s.position === "fixed" && r.bottom >= vh - 1 && r.width >= vw * 0.9 && r.height < 120) bottomBar = true;
    if ((s.display === "grid" || s.display === "flex") && el.children.length >= 2 && !el.closest("header, nav, footer")) {
      const kids = Array.from(el.children).map((k) => k.getBoundingClientRect()).filter((k) => k.width > 140 && k.height > 100);
      const tops = new Map<number, number[]>();
      for (const k of kids) {
        const t = Math.round(k.top / 4);
        if (!tops.has(t)) tops.set(t, []);
        tops.get(t)!.push(k.width);
      }
      for (const ws of tops.values()) {
        if (ws.length < 2) continue;
        const min = Math.min(...ws);
        const max = Math.max(...ws);
        if (max - min <= max * 0.08) rowMax = Math.max(rowMax, ws.length);
      }
    }
  }

  let centeredHero = false;
  let splitHero = false;
  if (heading) {
    const hr = heading.getBoundingClientRect();
    if (hr.top < vh * 1.2) {
      centeredHero = cs(heading).textAlign === "center" || Math.abs(hr.left + hr.width / 2 - vw / 2) < vw * 0.04 && hr.width < vw * 0.8;
      let p: Element | null = heading.parentElement;
      for (let i = 0; p && i < 4; i++, p = p.parentElement) {
        const sibs = Array.from(p.children).map((k) => k.getBoundingClientRect()).filter((k) => k.width >= vw * 0.3 && k.height > 100);
        if (sibs.length >= 2 && Math.abs(sibs[0]!.top - sibs[1]!.top) < 40) {
          splitHero = true;
          break;
        }
      }
    }
  }
  const bodyBg = cs(document.body).backgroundColor;
  const htmlBg = cs(document.documentElement).backgroundColor;
  const bg = transparent(bodyBg) ? htmlBg : bodyBg;
  const nums = bg.match(/\d+(\.\d+)?/g)?.map(Number) ?? [255, 255, 255];
  const darkPage = !transparent(bg) && (0.2126 * nums[0]! + 0.7152 * nums[1]! + 0.0722 * nums[2]!) / 255 < 0.25;

  return {
    bodyFont: first(cs(document.body).fontFamily),
    headingFont: heading ? first(cs(heading).fontFamily) : null,
    colors,
    buttons,
    cards,
    gradients: { text: gText, big: gBig, any: gAny },
    centeredHero,
    splitHero,
    stickyHeader,
    bottomBar,
    rowMax,
    darkPage,
    text: document.body.innerText.slice(0, 20_000),
  };
}

// ---------------------------------------------------------------------------------------------
// Measurements to feature values (node side, unit-testable).

const HUES: Array<[number, string]> = [
  [15, "red"], [40, "orange"], [55, "amber"], [70, "yellow"], [95, "lime"], [150, "green"], [175, "teal"], [195, "cyan"],
  [215, "sky blue"], [235, "blue"], [255, "indigo"], [275, "violet"], [295, "purple"], [320, "fuchsia"], [345, "pink"], [360, "rose"],
];

export function hueName(rgb: string): string | null {
  const n = rgb.match(/\d+(\.\d+)?/g)?.map(Number);
  if (!n || n.length < 3) return null;
  if (n.length >= 4 && n[3]! < 0.5) return null;
  const [r, g, b] = [n[0]! / 255, n[1]! / 255, n[2]! / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return null;
  const s = d / (1 - Math.abs(2 * l - 1));
  if (s < 0.35 || l < 0.18 || l > 0.85) return null;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return HUES.find(([lim]) => h < lim)?.[1] ?? "rose";
}

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

const SYSTEM_FONTS = /^(-apple-system|system-ui|blinkmacsystemfont|segoe ui|ui-sans-serif|helvetica neue|helvetica|arial|sans-serif|roboto)$/i;
const fontValue = (f: string) => (SYSTEM_FONTS.test(f) ? "system font stack" : f);

const COPY: Array<[RegExp, string]> = [
  [/—/, "em dash in copy"],
  [/\p{Emoji_Presentation}/u, "emoji in copy"],
  [/get started/i, "\"Get started\" call to action"],
  [/learn more/i, "\"Learn more\" link"],
  [/seamless/i, "\"seamless\""],
  [/effortless/i, "\"effortless\""],
  [/elevate/i, "\"elevate\""],
  [/unlock/i, "\"unlock\""],
  [/supercharge/i, "\"supercharge\""],
  [/revolutioni[sz]e/i, "\"revolutionize\""],
  [/all-in-one/i, "\"all-in-one\""],
  [/trusted by/i, "\"Trusted by\" logo or proof line"],
  [/no credit card/i, "\"No credit card required\""],
  [/join (thousands|over|\d)/i, "\"Join thousands\" social proof"],
  [/★★★★★|5\.0|4\.9/, "five star or 4.9 rating"],
  [/\b(10|50|100)k\+|\d+,\d{3}\+|\d+(\.\d)?m\+/i, "big number plus stat (10K+)"],
  [/©\s*20\d\d/, "copyright year footer"],
  [/lorem ipsum/i, "lorem ipsum"],
  [/made with|crafted with/i, "\"Made with\" or \"crafted with\" line"],
  [/simple,? transparent pricing/i, "\"Simple, transparent pricing\""],
  [/most popular/i, "\"Most popular\" plan badge"],
  [/24\/7/, "\"24/7\""],
];

export function features(m: Measure): PageFeatures {
  const f: PageFeatures = { font: [], "accent-hue": [], radius: [], gradient: [], layout: [], shadow: [], copy: [] };
  f.font.push(`body ${fontValue(m.bodyFont)}`);
  if (m.headingFont) f.font.push(`heading ${fontValue(m.headingFont)}`);
  if (m.headingFont && m.headingFont === m.bodyFont) f.font.push("one family for headings and body");

  const weights = new Map<string, number>();
  for (const c of m.colors) {
    const h = hueName(c.rgb);
    if (h) weights.set(h, (weights.get(h) ?? 0) + c.w);
  }
  const top = [...weights].sort((a, b) => b[1] - a[1])[0];
  f["accent-hue"].push(top ? top[0] : "no saturated accent");

  const pill = m.buttons.filter((b) => b.r >= b.h / 2 - 1).length;
  const br = median(m.buttons.map((b) => b.r));
  if (m.buttons.length) {
    if (pill > m.buttons.length / 2) f.radius.push("pill buttons");
    else if (br !== null) f.radius.push(br === 0 ? "square buttons" : br <= 4 ? "buttons 1 to 4px radius" : br <= 10 ? "buttons 5 to 10px radius" : "buttons 11px or more radius");
  }
  const cr = median(m.cards.map((c) => c.r));
  if (cr !== null) f.radius.push(cr === 0 ? "square cards" : cr <= 6 ? "cards 1 to 6px radius" : cr <= 12 ? "cards 7 to 12px radius" : cr <= 20 ? "cards 13 to 20px radius" : "cards over 20px radius");

  if (m.gradients.text) f.gradient.push("gradient text");
  if (m.gradients.big) f.gradient.push("large gradient background");
  if (m.gradients.any) f.gradient.push("any gradient");
  else f.gradient.push("no gradient");

  if (m.centeredHero) f.layout.push("centered hero headline");
  if (m.splitHero) f.layout.push("split hero, text beside a visual");
  if (m.stickyHeader) f.layout.push("sticky or fixed top bar");
  if (m.bottomBar) f.layout.push("fixed bottom bar");
  if (m.rowMax >= 2) f.layout.push(`${Math.min(m.rowMax, 4)}${m.rowMax >= 4 ? " or more" : ""} equal cards in a row`);
  if (m.darkPage) f.layout.push("dark page background");

  const blur = median(m.cards.map((c) => c.shadowBlur));
  const shadowed = m.cards.filter((c) => c.shadowBlur > 0).length;
  if (m.cards.length === 0 || shadowed === 0) f.shadow.push("no card shadows");
  else if (blur !== null && blur >= 16) f.shadow.push("soft wide card shadows (blur 16px or more)");
  else f.shadow.push("small card shadows (blur under 16px)");

  for (const [re, label] of COPY) if (re.test(m.text)) f.copy.push(label);
  return f;
}

/** Shares of pages per feature value, highest first, at or above minShare. */
export function shares(pages: PageFeatures[], minShare: number): SlopRule[] {
  const counts = new Map<string, number>();
  for (const p of pages) {
    for (const [feature, values] of Object.entries(p)) for (const v of new Set(values)) counts.set(`${feature}\u0000${v}`, (counts.get(`${feature}\u0000${v}`) ?? 0) + 1);
  }
  return [...counts]
    .map(([k, n]) => {
      const [feature, value] = k.split("\u0000") as [Feature, string];
      return { feature, value, share: Math.round((n / pages.length) * 100) / 100 };
    })
    .filter((r) => r.share >= minShare)
    .sort((a, b) => a.feature.localeCompare(b.feature) || b.share - a.share || a.value.localeCompare(b.value));
}

async function main(argv: string[]): Promise<void> {
  const minIdx = argv.indexOf("--min-share");
  const minShare = minIdx >= 0 ? Number(argv[minIdx + 1]) : 0.1;
  const briefs = new Map(loadBriefs().map((b) => [b.id, b]));
  const byModel = new Map<string, PageFeatures[]>();
  let failed = 0;
  let truncated = 0;
  for (const job of ["j8-pages-sonnet", "j8-pages-opus"]) {
    const path = join(PATHS.raw, `${job}.jsonl`);
    if (!existsSync(path)) {
      console.log(`skip ${job}: no ${path}`);
      continue;
    }
    const list: PageFeatures[] = [];
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      const r = JSON.parse(line) as Raw;
      const brief = briefs.get(r.id.replace(/^page-/, ""));
      const html = r.status === "succeeded" ? extractHtml(r.text ?? "") : null;
      if (!brief || !html) {
        failed++;
        continue;
      }
      if (r.stop_reason !== "end_turn") truncated++;
      const page = await (await browser()).newPage({ viewport: VIEWPORTS[brief.platform], deviceScaleFactor: 1 });
      try {
        await page.setContent(html, { waitUntil: "networkidle", timeout: 20_000 }).catch(() => undefined);
        await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => true);
        await page.screenshot({ type: "jpeg", quality: 60 }); // in memory only: proves the page painted
        await page.evaluate("globalThis.__name = (f) => f"); // tsx wraps named functions with __name
        list.push(features(await page.evaluate(measure)));
      } catch (e) {
        failed++;
        console.log(`  ${r.id}: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        await page.close();
      }
    }
    byModel.set(job, list);
    console.log(`${job}: ${list.length} pages measured`);
  }
  await closeBrowser();

  const all = [...byModel.values()].flat();
  const rules = shares(all, minShare).filter((r) => SlopRuleSchema.safeParse(r).success && writingProblems(r).length === 0);
  const entries = writeKind(PATHS.out, "slop", rules, (r) => "all");
  const perModel = [...byModel].map(([job, list]) => ({ job, rules: shares(list, 0) }));
  const table = rules
    .map((r) => {
      const cells = perModel.map((m) => m.rules.find((x) => x.feature === r.feature && x.value === r.value)?.share ?? 0);
      return `<tr><td>${escapeHtml(r.feature)}</td><td>${escapeHtml(r.value)}</td><td>${r.share}</td>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    })
    .join("");
  const review = writeReview(
    PATHS.review,
    "j8-slop",
    reviewHtml({ job: "j8-slop", kind: "slop", total: rules.length, rejects: failed, sampled: [], render: () => "" }).replace(
      "</body>",
      `<table><tr><th>feature</th><th>value</th><th>share</th>${perModel.map((m) => `<th>${escapeHtml(m.job)}</th>`).join("")}</tr>${table}</table></body>`,
    ),
  );
  console.log(`Pages measured: ${all.length} (${truncated} cut at max_tokens), failed or missing: ${failed}. SlopRule records: ${rules.length}.`);
  for (const e of entries) console.log(`  ${e.path}: ${e.count} records, ${e.bytes} bytes`);
  console.log(`Review page: ${review}`);
  for (const r of rules) console.log(`  ${r.feature.padEnd(10)} ${r.share.toFixed(2)}  ${r.value}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).then(
    () => process.exit(0),
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    },
  );
}
