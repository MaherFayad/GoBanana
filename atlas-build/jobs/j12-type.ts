/**
 * P1-J12 Bilingual type atlas: Latin plus Arabic type pairs, judged from rendered specimens.
 *
 *   npx tsx run.ts j12-type --dry
 *   npx tsx run.ts j12-type --limit 5
 *   npx tsx run.ts j12-type
 *
 * Candidates come from curated Google Fonts shortlists per type voice (every name is checked
 * against data/google-fonts.json, Arabic slots need the arabic subset). Each candidate is rendered
 * as a specimen in headless Chrome with the Google Fonts CSS API, screenshotted into memory and
 * sent to Sonnet with vision, which writes the voice, notes and scores. Specimens never touch
 * disk. finalize keeps the best 200 pairs.
 */
import { SONNET } from "../config.ts";
import { browser } from "../lib/browser.ts";
import { checkFamily } from "../lib/fonts.ts";
import { defineJob, placeholderImage, type JobContext } from "../lib/job.ts";
import { escapeHtml, seeded } from "../lib/review.ts";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";
import { TypePairSchema, type TypePair } from "../schema.ts";
import { TYPE_VOICES, type TypeVoice } from "../../banana-server/lib/direction-detail.ts";

type Quad = { voice: TypeVoice; ld: string; lb: string; ad: string; ab: string };

/** Shortlists per voice: Latin display, Latin body, Arabic display, Arabic body. */
const LISTS: Record<TypeVoice, [string[], string[], string[], string[]]> = {
  grotesk: [
    ["Space Grotesk", "Archivo", "Familjen Grotesk", "Schibsted Grotesk"],
    ["Inter", "IBM Plex Sans", "Public Sans", "Work Sans"],
    ["Alexandria", "Readex Pro", "Rubik", "Beiruti"],
    ["IBM Plex Sans Arabic", "Noto Sans Arabic", "Readex Pro", "Rubik"],
  ],
  "neo-grotesk": [
    ["Inter Tight", "Manrope", "Hanken Grotesk", "Onest"],
    ["Inter", "Manrope", "Figtree", "DM Sans"],
    ["IBM Plex Sans Arabic", "Tajawal", "Almarai", "Zain"],
    ["IBM Plex Sans Arabic", "Tajawal", "Almarai", "Noto Sans Arabic"],
  ],
  "serif-editorial": [
    ["Fraunces", "Playfair Display", "Instrument Serif", "DM Serif Display"],
    ["Source Serif 4", "Newsreader", "Literata", "Lora"],
    ["Amiri", "Markazi Text", "Alyamama", "Ruwudu"],
    ["Noto Naskh Arabic", "Markazi Text", "Amiri", "Scheherazade New"],
  ],
  "serif-classic": [
    ["Cormorant Garamond", "EB Garamond", "Libre Baskerville", "Crimson Pro"],
    ["EB Garamond", "Crimson Pro", "Libre Caslon Text", "Spectral"],
    ["Amiri", "Aref Ruqaa", "Scheherazade New", "Mirza"],
    ["Noto Naskh Arabic", "Amiri", "Scheherazade New", "Lateef"],
  ],
  mono: [
    ["JetBrains Mono", "Space Mono", "IBM Plex Mono", "DM Mono"],
    ["IBM Plex Mono", "Inter", "JetBrains Mono", "Roboto Mono"],
    ["Kufam", "Cascadia Code", "Handjet", "Noto Kufi Arabic"],
    ["Cascadia Mono", "IBM Plex Sans Arabic", "Noto Kufi Arabic", "Kufam"],
  ],
  condensed: [
    ["Oswald", "Bebas Neue", "Barlow Condensed", "Antonio"],
    ["Barlow", "Roboto Condensed", "IBM Plex Sans Condensed", "Archivo Narrow"],
    ["Lalezar", "Jomhuria", "Katibeh", "Changa"],
    ["Changa", "Cairo", "Tajawal", "Noto Sans Arabic"],
  ],
  rounded: [
    ["Nunito", "Quicksand", "Fredoka", "Varela Round"],
    ["Nunito", "Nunito Sans", "Mulish", "Varela Round"],
    ["Baloo Bhaijaan 2", "Lemonada", "Reem Kufi Fun", "Marhey"],
    ["Tajawal", "Almarai", "Baloo Bhaijaan 2", "Zain"],
  ],
  "display-retro": [
    ["Bungee", "Righteous", "Shrikhand", "Abril Fatface"],
    ["Space Grotesk", "Work Sans", "Karla", "Rubik"],
    ["Lalezar", "Rakkas", "Blaka", "Reem Kufi"],
    ["Cairo", "Rubik", "Changa", "El Messiri"],
  ],
  "script-hand": [
    ["Caveat", "Kalam", "Pacifico", "Gochi Hand"],
    ["Nunito", "Karla", "Patrick Hand", "Mulish"],
    ["Aref Ruqaa", "Playpen Sans Arabic", "Marhey", "Alkalami"],
    ["Playpen Sans Arabic", "Tajawal", "Almarai", "Noto Naskh Arabic"],
  ],
  slab: [
    ["Roboto Slab", "Zilla Slab", "Arvo", "Bitter"],
    ["Bitter", "Zilla Slab", "Source Sans 3", "Roboto"],
    ["Kufam", "Noto Kufi Arabic", "Reem Kufi", "El Messiri"],
    ["Noto Kufi Arabic", "Cairo", "Noto Naskh Arabic", "Mada"],
  ],
};

/** Candidates judged per voice; finalize keeps the best KEEP overall. */
const PER_VOICE = 30;
const KEEP = 200;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const quadId = (q: Quad) => [q.ld, q.lb, q.ad, q.ab].map(slug).join("-");
const requestKey = (q: Quad) => {
  const id = `${q.voice}-${[q.ld, q.lb, q.ad, q.ab].map(slug).join("--")}`;
  if (id.length <= 64) return id;
  let h = 0;
  for (const c of id) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return `${id.slice(0, 55)}-${h.toString(36)}`;
};

/** PER_VOICE combinations per voice, spread so every shortlist name appears about evenly. */
export function candidates(): Quad[] {
  const out: Quad[] = [];
  const seen = new Set<string>();
  for (const voice of TYPE_VOICES) {
    const [ld, lb, ad, ab] = LISTS[voice];
    const all: Quad[] = [];
    for (const a of ld) for (const b of lb) for (const c of ad) for (const d of ab) if (a !== b || c !== d) all.push({ voice, ld: a, lb: b, ad: c, ab: d });
    const rand = seeded(`j12-${voice}`);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [all[i], all[j]] = [all[j]!, all[i]!];
    }
    const uses = new Map<string, number>();
    const score = (q: Quad) => [`ld:${q.ld}`, `lb:${q.lb}`, `ad:${q.ad}`, `ab:${q.ab}`].reduce((s, k) => s + (uses.get(k) ?? 0), 0);
    const picked: Quad[] = [];
    while (picked.length < PER_VOICE && all.length > 0) {
      let best = 0;
      for (let i = 1; i < all.length; i++) if (score(all[i]!) < score(all[best]!)) best = i;
      const q = all.splice(best, 1)[0]!;
      if (seen.has(quadId(q))) continue;
      seen.add(quadId(q));
      for (const k of [`ld:${q.ld}`, `lb:${q.lb}`, `ad:${q.ad}`, `ab:${q.ab}`]) uses.set(k, (uses.get(k) ?? 0) + 1);
      picked.push(q);
    }
    out.push(...picked);
  }
  return out;
}

// Sample copy. Arabic in white Saudi dialect, no tashkeel, real words.
const COPY = {
  latinDisplay: "Your next trip starts here",
  latinBody:
    "Pick the place you want and compare prices in one view. We send the booking to your phone within minutes, and you can change or cancel for free until the day before you fly.",
  latinLabel: "Book now",
  latinTotal: "Total SAR 1,240",
  arabicDisplay: "رحلتك الجاية تبدأ من هنا",
  arabicBody:
    "اختار الوجهة اللي تبيها وقارن الأسعار في مكان واحد. نرسل لك تفاصيل الحجز على جوالك خلال دقايق، وتقدر تعدل موعدك أو تلغيه بدون رسوم لين قبل السفر بيوم.",
  arabicLabel: "احجز الحين",
  arabicTotal: "المبلغ الإجمالي ١٬٢٤٠ ريال",
};

const W = 1200;
const H = 640;

function specimenHtml(q: Quad): string {
  const fams = [...new Set([q.ld, q.lb, q.ad, q.ab])].map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}`).join("&");
  const ff = (f: string) => `'${f}'`;
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fams}&display=block">
<style>
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;background:#f6f3ee;color:#1c1b19;padding:48px 56px;font-family:sans-serif}
.grid{display:grid;grid-template-columns:1fr 1fr;column-gap:64px;row-gap:28px}
.ld{font-family:${ff(q.ld)};font-size:58px;line-height:1.1}
.ad{font-family:${ff(q.ad)};font-size:58px;line-height:1.35}
.lb{font-family:${ff(q.lb)};font-size:19px;line-height:1.55}
.ab{font-family:${ff(q.ab)};font-size:19px;line-height:1.8}
[dir=rtl]{text-align:right}
.ui{display:flex;justify-content:space-between;align-items:center;border-top:2px solid #1c1b19;padding-top:18px}
.btn{background:#1c1b19;color:#f6f3ee;border-radius:6px;padding:10px 20px;font-size:18px}
.tot{font-size:22px}
.sm{font-size:14px;line-height:1.5;margin-top:10px;opacity:.8}
</style></head><body><div class="grid">
<div class="ld">${escapeHtml(COPY.latinDisplay)}</div>
<div class="ad" dir="rtl" lang="ar">${escapeHtml(COPY.arabicDisplay)}</div>
<div class="lb">${escapeHtml(COPY.latinBody)}<div class="sm">${escapeHtml(COPY.latinBody)}</div></div>
<div class="ab" dir="rtl" lang="ar">${escapeHtml(COPY.arabicBody)}<div class="sm">${escapeHtml(COPY.arabicBody)}</div></div>
<div class="ui"><span class="tot ld" style="font-size:24px">${escapeHtml(COPY.latinTotal)}</span><span class="btn lb" style="font-size:18px">${escapeHtml(COPY.latinLabel)}</span></div>
<div class="ui" dir="rtl" lang="ar"><span class="tot ad" style="font-size:24px">${escapeHtml(COPY.arabicTotal)}</span><span class="btn ab" style="font-size:18px">${escapeHtml(COPY.arabicLabel)}</span></div>
</div></body></html>`;
}

/** Renders the specimen and returns a JPEG in memory, or throws when a family did not load. */
async function renderSpecimen(q: Quad): Promise<Buffer> {
  const page = await (await browser()).newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  try {
    await page.setContent(specimenHtml(q), { waitUntil: "networkidle", timeout: 30_000 });
    const missing = await page.evaluate(async (families: string[]) => {
      await document.fonts.ready;
      const loaded: string[] = [];
      document.fonts.forEach((ff) => { if (ff.status === "loaded") loaded.push(ff.family.replace(/["']/g, "")); });
      return families.filter((f) => !loaded.includes(f));
    }, [...new Set([q.ld, q.lb, q.ad, q.ab])]);
    if (missing.length > 0) throw new Error(`fonts did not load: ${missing.join(", ")}`);
    return await page.screenshot({ type: "jpeg", quality: 82 });
  } finally {
    await page.close();
  }
}

const SYSTEM = `You judge bilingual type pairs for GoBanana, a tool that turns one app or web page into a buildable design direction. Each pair sets a Latin display and body family next to an Arabic display and body family, all from Google Fonts, for a product that ships in English and in Arabic for Saudi users.

You get one rendered specimen per request: Latin on the left, Arabic on the right (right to left). Top row: display size. Middle row: body text at 19px with a smaller 14px paragraph under it. Bottom row: a price line in the display family and a button in the body family.

Judge only what the image shows:
- harmony: do the Latin and Arabic sides read as one voice (weight, contrast, texture, optical size, mood)? 5 means a designer would ship them together as is.
- latinBody and arabicBody: how comfortable the body text is to read at 19px and 14px. Arabic needs open counters, clear dots and enough line height; decorative or Nastaliq styles score low for body text.
- hierarchy: does display against body give a clear, useful step on each side?
If a family looks like a fallback system font or shows broken glyphs, say so in the notes and score 1.

notes: two or three plain sentences: how the two sides relate, the kind of product or page this pair fits, and one thing to watch (size the Arabic up, a weight to avoid, line height). Name the families as written.
voice: the TypeVoice that best describes the pair as rendered; usually the one given.

Type voices: ${TYPE_VOICES.join(", ")}.

${PROMPT_RULES}

Reply with one TypePair object. Copy id and the four families exactly as given.

${typeText("TypePair")}`;

export default defineJob<Quad, TypePair>({
  id: "j12-type",
  kind: "type-pairs",
  model: SONNET,
  mode: "batch",
  schema: TypePairSchema,
  system: SYSTEM,
  maxTokens: 1500,
  expectedOutputTokens: 350,
  effort: "low",

  loadInputs: (ctx: JobContext) => {
    const fonts = ctx.fonts();
    const problems = Object.values(LISTS).flatMap(([ld, lb, ad, ab]) => [
      ...[...ld, ...lb].flatMap((f) => checkFamily(f, fonts, "latin")),
      ...[...ad, ...ab].flatMap((f) => checkFamily(f, fonts, "arabic")),
    ]);
    if (problems.length > 0) throw new Error(`shortlist fonts: ${[...new Set(problems)].join("; ")}`);
    const list = candidates();
    ctx.log(`${list.length} candidate pairs across ${TYPE_VOICES.length} voices.`);
    return list;
  },
  requestId: (q) => requestKey(q),
  buildPrompt: async (q, ctx) => {
    const image = ctx.dry ? placeholderImage() : { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: (await renderSpecimen(q)).toString("base64") } };
    return [
      image,
      { type: "text", text: `id: "${quadId(q)}"\nCandidate voice: ${q.voice}\nLatin display: ${q.ld}\nLatin body: ${q.lb}\nArabic display: ${q.ad}\nArabic body: ${q.ab}` },
    ];
  },

  // The families and id come from the input, never from the model.
  prepare: (raw, q) => (raw && typeof raw === "object" ? { ...raw, id: quadId(q), latin: { display: q.ld, body: q.lb }, arabic: { display: q.ad, body: q.ab } } : raw),
  check: (r, ctx) => [
    ...checkFamily(r.latin.display, ctx.fonts(), "latin"),
    ...checkFamily(r.latin.body, ctx.fonts(), "latin"),
    ...checkFamily(r.arabic.display, ctx.fonts(), "arabic"),
    ...checkFamily(r.arabic.body, ctx.fonts(), "arabic"),
  ],
  finalize: (records, ctx) => {
    const total = (r: TypePair) => r.scores.harmony * 2 + r.scores.latinBody + r.scores.arabicBody + r.scores.hierarchy;
    const kept = records
      .filter((r) => r.scores.harmony >= 3 && r.scores.arabicBody >= 3)
      .sort((a, b) => total(b) - total(a) || a.id.localeCompare(b.id))
      .slice(0, KEEP);
    ctx.log(`finalize: ${records.length} judged, ${kept.length} kept (harmony and Arabic body at 3 or more, best ${KEEP}).`);
    return kept;
  },
  shardOf: (r) => r.voice,
  renderReview: (r) =>
    `<p><b>${escapeHtml(r.voice)}</b> · ${escapeHtml(r.latin.display)} / ${escapeHtml(r.latin.body)} · ${escapeHtml(r.arabic.display)} / ${escapeHtml(r.arabic.body)}</p>
<p>harmony ${r.scores.harmony}, Latin body ${r.scores.latinBody}, Arabic body ${r.scores.arabicBody}, hierarchy ${r.scores.hierarchy}</p><p>${escapeHtml(r.notes)}</p>`,
});
