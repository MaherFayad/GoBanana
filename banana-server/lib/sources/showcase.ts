/**
 * Web showcase styles (owner request 2026-10-16: "too fun", 3D, WebGL, motion-led and award-level
 * sites like Awwwards Sites of the Year and Craftwork's website inspiration). A website brief whose
 * style words name one of these styles searches the showcase galleries (registry entries with
 * `showcase`) with the style's own words instead of the brief's topic, because live, topic plus
 * style found nothing on those sites ("3d coffee shop site:awwwards.com/sites" gave 0 item pages of
 * 10, Google dropped the site filter), while the style words alone gave award-grade sites.
 *
 * Measured 2026-10-16 on live Serper image search (one query each, item pages of 10, unique):
 * - Awwwards: "playful illustration" 10/9, "3d landing page" 10/6, "webgl portfolio" 10/9,
 *   "scroll storytelling" 10/7, "kinetic typography" 10/9, "animation" 10/10, "experimental" 10/8.
 *   Bare "3d" gave 3D asset packs, so 3D searches "3d landing page".
 * - Craftwork: single words only ("3d" 10/10, "interactive" 10/10, "animation" 10/10, "webgl"
 *   10/5, "playful" 5/4); two-word phrases found 0 or 1 ("scroll storytelling", "kinetic
 *   typography", "playful illustration"), so Craftwork gets `word`, and no word means it is not
 *   pulled for that style.
 *
 * No imports: the registry reads SHOWCASE_TAGS from here.
 */

export type ShowcaseStyle = {
  /** The tag showcase galleries carry for this style. */
  id: string;
  /** Style words that name it, as plain lowercase phrases ("too fun", "three js"). */
  words: readonly string[];
  /** What a phrase gallery (Awwwards) searches. */
  phrase: string;
  /** What a one-word gallery (Craftwork) searches, when one word works there. */
  word?: string;
};

export const SHOWCASE_STYLES: readonly ShowcaseStyle[] = [
  {
    id: "playful",
    words: ["playful", "fun", "too fun", "whimsical", "quirky", "joyful", "cartoon", "cartoony", "toylike", "toy like", "goofy", "cheeky"],
    phrase: "playful illustration",
    word: "playful",
  },
  { id: "webgl", words: ["webgl", "three js", "threejs", "three.js", "shader", "shaders", "real time 3d", "realtime 3d"], phrase: "webgl portfolio", word: "webgl" },
  { id: "3d", words: ["3d", "3 d", "three dimensional", "3d website", "3d web"], phrase: "3d landing page", word: "3d" },
  {
    id: "storytelling",
    words: ["scroll story", "scroll storytelling", "scrollytelling", "storytelling", "immersive scroll", "scroll driven", "scroll animation", "parallax"],
    phrase: "scroll storytelling",
    word: "interactive",
  },
  { id: "kinetic typography", words: ["kinetic type", "kinetic typography", "kinetic", "moving type", "animated type", "animated typography"], phrase: "kinetic typography" },
  {
    id: "animation",
    words: ["motion first", "motion led", "motion heavy", "motion", "animated", "animation", "animations", "micro interactions", "microinteractions", "lottie"],
    phrase: "animation",
    word: "animation",
  },
  { id: "interactive", words: ["interactive", "gamified", "game like", "playable", "gestures"], phrase: "interactive", word: "interactive" },
  { id: "experimental", words: ["experimental", "avant garde", "unconventional", "weird", "out there"], phrase: "experimental" },
];

/** Every showcase tag (style ids), for registry entries. */
export const SHOWCASE_TAGS: readonly string[] = SHOWCASE_STYLES.map((s) => s.id);
/** Tags of styles a one-word gallery can search (those with a `word`). */
export const SHOWCASE_WORD_TAGS: readonly string[] = SHOWCASE_STYLES.filter((s) => s.word).map((s) => s.id);

/** Lowercase plain words: "Motion-first!" gives "motion first". */
const plain = (text: string) => ` ${(text.toLowerCase().match(/[\p{L}\p{N}.]+/gu) ?? []).map((w) => w.replace(/^\.+|\.+$/g, "")).filter(Boolean).join(" ")} `;

/**
 * Every showcase style the style words name (whole words), in order: the style words' own styles
 * first (what the user or direction chose), then the brief's. No repeats.
 */
export function showcaseStyles(styleWords: readonly string[], brief?: string): ShowcaseStyle[] {
  const out: ShowcaseStyle[] = [];
  for (const text of [...styleWords, ...(brief ? [brief] : [])]) {
    const t = plain(text);
    for (const s of SHOWCASE_STYLES) if (!out.includes(s) && s.words.some((w) => t.includes(plain(w)))) out.push(s);
  }
  return out;
}

/** The showcase lane words: the first style's phrase, and the first one word any named style has. Null when none is named. */
export function showcaseLane(styleWords: readonly string[], brief?: string): { phrase: string; word?: string; ids: string[] } | null {
  const styles = showcaseStyles(styleWords, brief);
  if (styles.length === 0) return null;
  const word = styles.find((s) => s.word)?.word;
  return { phrase: styles[0]!.phrase, ...(word ? { word } : {}), ids: styles.map((s) => s.id) };
}
