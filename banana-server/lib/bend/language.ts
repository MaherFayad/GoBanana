/**
 * Visual language per direction (docs/gobanana-v4-plan.md section 5): 7 axes, assigned by rules so
 * the set is as different as possible. Each axis starts from what the direction's ingredients and
 * spec already say, then free axes move first so every pair differs on at least 4 of 7 axes and no
 * two directions share both type voice and color strategy. Rule based and deterministic, no AI.
 */
import {
  LANGUAGE_AXES,
  LANGUAGE_VALUES,
  type Composition,
  type DesignLanguage,
  type LanguageAxis,
  type Material,
  type Motion,
  type VisualSpec,
} from "@/lib/direction-detail";
import type { Candidate, Diversity, ListEntry, MoveId } from "./types";

/** Every pair should differ on at least this many axes. */
export const MIN_AXES_APART = 4;

/** Daily working pages (forms, tables, checkout, dashboards): motion and composition stay calm there. */
const OPERATE_WORDS =
  /\b(forms?|tables?|checkout|cart|basket|payments?|dashboards?|admin|settings|console|inbox|activity|queue|logs?|crm|billing|account|reports?|analytics|orders?|booking|bookings|editor|workspace|list view|data view)\b/i;
/** Pages that are a showcase even inside a working product. */
const SHOWCASE_WORDS = /\b(launch|landing|onboarding|welcome|splash|404|empty state|paywall|year in review|wrapped|about|home ?page|teaser|waitlist)\b/i;

/**
 * True for an operate page: a form, table, checkout or dashboard someone uses every day. Pages win
 * over the brief ("dashboard app" with pages ["launch page"] is a showcase).
 */
export function isOperatePage(brief: string, pages: readonly string[]): boolean {
  if (pages.length > 0) {
    const text = pages.join(" ");
    if (OPERATE_WORDS.test(text)) return true;
    if (SHOWCASE_WORDS.test(text)) return false;
  }
  return OPERATE_WORDS.test(brief) && !SHOWCASE_WORDS.test(brief);
}

const OPERATE_COMPOSITIONS: readonly Composition[] = ["grid", "list-first", "card-first"];
const OPERATE_MOTIONS: readonly Motion[] = ["still", "snap", "glide"];
const CALM_COMPOSITION: Record<Composition, Composition> = {
  grid: "grid",
  editorial: "list-first",
  poster: "grid",
  layered: "card-first",
  "list-first": "list-first",
  "card-first": "card-first",
};
const CALM_MOTION: Record<Motion, Motion> = { still: "still", snap: "snap", glide: "glide", spring: "snap", cinematic: "glide" };

/** What one direction is built from, for reading its language hints. */
export interface LanguageContext {
  spec: VisualSpec;
  entries: Readonly<Partial<Record<MoveId, ListEntry>>>;
  lead: MoveId;
  mood: ListEntry;
  operate: boolean;
  candidate?: Candidate;
}

/** One axis: where the search starts, and how much moving off it costs (Infinity: never). */
interface AxisPref {
  value: string;
  cost: number;
}

export interface LanguagePlan {
  /** Start value and change cost per axis; missing axes are free (no hint). */
  prefs: Partial<Record<LanguageAxis, AxisPref>>;
  /** Values the spec lines already state: a different final value rewrites that line. */
  from: Partial<DesignLanguage>;
  /** Values an axis may take (operate pages cap composition and motion). */
  allowed: Partial<Record<LanguageAxis, readonly string[]>>;
}

const FREE_COST = 0.1;

const COLOR_WORDS =
  /\b(red|yellow|blue|green|orange|pink|purple|violet|lilac|mint|teal|cyan|cobalt|indigo|navy|ochre|gold|brass|silver|cream|sand|brown|plum|sage|oxblood|magenta|turquoise|coral|olive|crimson|amber|copper|rust|maroon|terracotta|emerald|saffron)\b/gi;

function colorStrategyOf(text: string): DesignLanguage["colorStrategy"] {
  if (/\b(one color|single color|black and white|monochrome|grayscale|gray scale|grays?|greys?|neutrals?|tints|muted|low saturation|washed|faded|one mid gray)\b/i.test(text)) return "restrained";
  if (/\b(drench\w*|floods?|solid color field|saturated|acid|electric|hot pink|wall to wall|full bleed)\b/i.test(text)) return "drenched";
  const colors = new Set((text.match(COLOR_WORDS) ?? []).map((c) => c.toLowerCase()));
  return colors.size >= 3 ? "full" : "committed";
}

const DARK_GROUND = /\b(near black|black|deep navy|navy|midnight|night|charcoal|dark|graphite|slate)\b/i;
const LIGHT_GROUND = /\b(white|off-white|cream|paper|ivory|sand|bone|pastel|bleached|pale|light)\b/i;
const COLORED_GROUND = /\b(saturated color fields?|solid color fields?|color fields?)\b/i;

function groundWord(word: string): DesignLanguage["ground"] | undefined {
  if (DARK_GROUND.test(word)) return "dark";
  if (LIGHT_GROUND.test(word)) return "light";
  if (new RegExp(COLOR_WORDS.source, "i").test(word)) return "colored";
  return undefined;
}

/** The ground a color line names: "on black" first, else the earliest ground word. */
function groundOf(text: string): DesignLanguage["ground"] | undefined {
  if (/\b(photo|photos|photograph\w*)\b/i.test(text) && /\b(fills|sampled|hero photo|behind)\b/i.test(text)) return "photographic";
  const on = /\bon (?:a |an )?(?:deep |pure |warm |soft |pale |bright )?([a-z-]+)/i.exec(text);
  const fromOn = on ? groundWord(on[1]!) : undefined;
  if (fromOn) return fromOn;
  if (COLORED_GROUND.test(text)) return "colored";
  const hits = [
    { g: "dark" as const, i: text.search(DARK_GROUND) },
    { g: "light" as const, i: text.search(LIGHT_GROUND) },
  ].filter((h) => h.i >= 0);
  hits.sort((a, b) => a.i - b.i);
  return hits[0]?.g;
}

function densityOf(text: string): DesignLanguage["density"] | undefined {
  if (/\b(dense|packed|compact)\b/i.test(text)) return "dense";
  if (/\b(airy|generous|empty|wide margins)\b/i.test(text)) return "airy";
  return undefined;
}

const COMPOSITION_RULES: readonly [RegExp, Composition][] = [
  [/\b(continuous scroll|typographic list|one sentence per view|receipt-width column|horizontal track|status list|rows?|timetable|ledger|log|strip|list)\b/i, "list-first"],
  [/\b(bento|12 column grid|grid lines|baseline grid|tiles?|grid|lattice|geometry|chart|map)\b/i, "grid"],
  [/\b(overlap\w*|layers?|layered|collage|depth|stacked panels)\b/i, "layered"],
  [/\b(cards?|deck|cover|ticket|tag|label|stamp|sleeve|packet|insert|matchbook|box)\b/i, "card-first"],
  [/\b(giant|full bleed|solid color field|fills (each|the) view|color bands|diagonal|footer is the biggest|poster|billboard|signage|sign|marquee)\b/i, "poster"],
  [/\b(no cards|hairline|margin|centred column|measure|space alone|rules group|page|menu|newspaper|manual|program|magazine|book|journal|zine)\b/i, "editorial"],
];

function compositionOf(text: string): Composition | undefined {
  return COMPOSITION_RULES.find(([re]) => re.test(text))?.[1];
}

const MATERIAL_RULES: readonly [RegExp, Material][] = [
  [/\b(weav\w*|woven|textile|fabric|knit\w*|embroider\w*|quilt\w*|felt|silk|linen|denim|tweed|kilim|rugs?|carpet|cloth|threads?|tartan|batik|shibori|lace|sadu|talli|tatreez|suzani|bojagi|kente|tapestry|stitch\w*|velvet|satin|wool|suede|nap|cushions?)\b/i, "textile"],
  [/\b(glass|chrome|mercury|neon|holograph\w*|iridescent|mirror|acrylic|crystal|glow\w*|light leaks?|led)\b/i, "glass"],
  [/\b(photos?|photograph\w*|film stills?|cinema)\b/i, "photographic"],
  [/\b(clay|metal|aluminum|steel|brass|copper|concrete|stone|marble|wood\w*|plastic|rubber|ceramic|porcelain|enamel|3d|terrazzo|leather|dials?|instruments?|machines?|bevels?|carved)\b/i, "object"],
  [/\b(paper|print\w*|riso\w*|ink|inks|letterpress|stamps?|posters?|zine|newsprint|cards?|labels?|tickets?|woodcut|halftone|maps?|manual|pages?|grain|stationery|cutouts?|tiles?|zellige|azulejo|calligraph\w*|signs?|signage)\b/i, "print"],
];

function materialOf(text: string): Material | undefined {
  return MATERIAL_RULES.find(([re]) => re.test(text))?.[1];
}

function motionOf(text: string): Motion {
  if (/\b(no decorative motion|nothing moves|no motion|still)\b/i.test(text)) return "still";
  if (/\b(snaps?|flips?|quick|150ms|precise|ticks?|clicks?)\b/i.test(text)) return "snap";
  if (/\b(spring\w*|bounces?|burst|presses|wobble|pops?)\b/i.test(text)) return "spring";
  if (/\b(400ms|500ms|reveals?|cinematic|parallax|pans?|zooms?)\b/i.test(text)) return "cinematic";
  return "glide";
}

function voiceOf(text: string): DesignLanguage["typeVoice"] | undefined {
  if (/\b(monospace|mono|typewriter|terminal|teletype|dot matrix)\b/i.test(text)) return "mono";
  if (/\b(condensed|narrow|compressed)\b/i.test(text)) return "condensed";
  if (/\b(slab|stencil|wood type)\b/i.test(text)) return "slab";
  if (/\b(script|handwritten|hand-drawn|hand drawn|calligraph\w*|brush)\b/i.test(text)) return "script-hand";
  if (/\b(rounded|bubbly|soft sans)\b/i.test(text)) return "rounded";
  if (/\b(serif|engraved|bookish)\b/i.test(text)) return "serif-classic";
  return undefined;
}

const hintText = (e: ListEntry | undefined) => (e ? [e.label, e.query, e.hints.tex, e.hints.pattern, e.hints.layout].filter(Boolean).join(" ") : "");

/** Start values, change costs and the values the spec states, for one direction. */
export function languagePlan(ctx: LanguageContext): LanguagePlan {
  const { spec, entries, lead, mood, operate, candidate } = ctx;
  const prefs: LanguagePlan["prefs"] = {};
  const from: Partial<DesignLanguage> = {};
  const allowed: LanguagePlan["allowed"] = {};
  const looks = candidate ? `${candidate.name} ${candidate.looks} ${candidate.family}` : "";

  // Type voice: the spec's, unless the candidate's looks name one.
  from.typeVoice = spec.typeVoice;
  const lookVoice = candidate ? voiceOf(candidate.looks) : undefined;
  prefs.typeVoice = { value: lookVoice ?? spec.typeVoice, cost: entries.constraint?.hints.voice ? 4 : 2 };

  // Color strategy and ground: read off the color line; a constraint's color rule is close to fixed.
  const colorText = `${spec.color} ${candidate?.looks ?? ""}`;
  from.colorStrategy = colorStrategyOf(spec.color);
  prefs.colorStrategy = { value: colorStrategyOf(colorText), cost: entries.constraint?.hints.color ? 6 : 1.5 };
  const stated = groundOf(`${spec.color} ${entries.constraint?.hints.layout ?? ""}`);
  if (stated) from.ground = stated;
  // A candidate's own look wins over the mood's color line.
  const ground = (candidate ? groundOf(candidate.looks) : undefined) ?? stated;
  if (ground) prefs.ground = { value: ground, cost: 2 };
  else {
    const tone = mood.hints.tone[0];
    prefs.ground = { value: tone === "dark" ? "dark" : "light", cost: 0.5 };
  }

  // Density: the platform's line names it for phones, sites and web apps; never rewritten there.
  const density = densityOf(spec.density);
  if (density) prefs.density = { value: density, cost: Infinity };
  else from.density = "balanced";

  // Composition: a constraint's layout rule, else the lead ingredient's form.
  const constraintComposition = entries.constraint?.hints.layout ? compositionOf(entries.constraint.hints.layout) : undefined;
  const leadComposition =
    candidate
      ? compositionOf(looks)
      : lead === "scale"
        ? "poster"
        : lead === "era"
          ? ["display-retro", "condensed", "slab"].includes(spec.typeVoice)
            ? "poster"
            : "editorial"
          : lead === "material"
            ? "layered"
            : lead === "lens"
              ? "grid"
              : compositionOf(hintText(entries[lead]));
  const composition = constraintComposition ?? leadComposition;
  if (composition) prefs.composition = { value: composition, cost: constraintComposition ? 4 : 1 };

  // Material: the material ingredient (its texture line), else other ingredients, else the texture line.
  const materialEntry = entries.material ? materialOf(hintText(entries.material)) : undefined;
  const otherMaterial =
    materialOf(looks) ?? materialOf(hintText(entries.lens)) ?? materialOf(hintText(entries.transplant)) ?? materialOf(hintText(entries.era));
  from.material = materialOf(spec.texture) ?? "flat";
  if (materialEntry) {
    from.material = materialEntry;
    prefs.material = { value: materialEntry, cost: 5 };
  } else prefs.material = { value: otherMaterial ?? from.material, cost: candidate && materialOf(looks) ? 3 : otherMaterial ? 1 : 0.5 };

  // Motion: the spec's motion line; an object's own motion (split flaps) weighs more.
  from.motion = motionOf(spec.motion);
  prefs.motion = { value: from.motion, cost: entries.transplant?.hints.motion ? 2 : 1 };

  if (operate) {
    allowed.composition = OPERATE_COMPOSITIONS;
    allowed.motion = OPERATE_MOTIONS;
    if (prefs.composition) prefs.composition.value = CALM_COMPOSITION[prefs.composition.value as Composition];
    prefs.motion.value = CALM_MOTION[prefs.motion.value as Motion];
  }
  return { prefs, from, allowed };
}

/** Axes two languages differ on. */
export function axesApart(a: DesignLanguage, b: DesignLanguage): number {
  let n = 0;
  for (const axis of LANGUAGE_AXES) if (a[axis] !== b[axis]) n++;
  return n;
}

/** Alternatives per changed axis the search tries (least used first). */
const ALTERNATIVES = 3;

/**
 * Languages for directions in order: each one starts from its plan, then moves the cheapest set of
 * axes (free ones first) to values the earlier directions use least, until it differs from every
 * earlier direction on at least 4 axes and shares no type voice plus color strategy pair. Earlier
 * directions never move, so a larger count only appends.
 */
export function assignLanguages(plans: readonly LanguagePlan[]): DesignLanguage[] {
  const out: DesignLanguage[] = [];
  const axisCount = LANGUAGE_AXES.length;
  plans.forEach((plan, i) => {
    const base: string[] = [];
    const options: string[][] = [];
    const costs: number[] = [];
    LANGUAGE_AXES.forEach((axis, a) => {
      const values = (plan.allowed[axis] ?? LANGUAGE_VALUES[axis]) as readonly string[];
      const used = new Map<string, number>();
      for (const o of out) used.set(o[axis], (used.get(o[axis]) ?? 0) + 1);
      const ordered = values
        .map((v, k) => ({ v, k, n: used.get(v) ?? 0, r: (k + i) % values.length }))
        .sort((x, y) => x.n - y.n || x.r - y.r)
        .map((x) => x.v);
      const pref = plan.prefs[axis];
      const start = pref && values.includes(pref.value) ? pref.value : ordered[0]!;
      base[a] = start;
      const cost = pref ? pref.cost : FREE_COST;
      costs[a] = cost;
      options[a] = cost === Infinity ? [] : ordered.filter((v) => v !== start).slice(0, ALTERNATIVES);
    });
    const others = out.map((o) => LANGUAGE_AXES.map((axis) => o[axis] as string));
    const masks: { m: number; cost: number }[] = [];
    for (let m = 0; m < 1 << axisCount; m++) {
      let cost = 0;
      let ok = true;
      for (let a = 0; a < axisCount; a++) {
        if (!(m & (1 << a))) continue;
        if (options[a]!.length === 0) ok = false;
        cost += costs[a]!;
      }
      if (ok) masks.push({ m, cost });
    }
    masks.sort((x, y) => x.cost - y.cost || x.m - y.m);
    // Checks one candidate language: 1000 when it fits, else a score for the best near miss.
    const rate = (lang: readonly string[]): number => {
      let min: number = axisCount;
      let clashes = 0;
      for (const o of others) {
        let n = 0;
        for (let a = 0; a < axisCount; a++) if (lang[a] !== o[a]) n++;
        if (n < min) min = n;
        if (lang[0] === o[0] && lang[1] === o[1]) clashes++;
      }
      return min >= MIN_AXES_APART && clashes === 0 ? 1000 : min * 10 - clashes;
    };
    let best: string[] = base;
    let bestScore = -Infinity;
    let found: string[] | null = null;
    const lang = base.slice();
    for (const { m } of masks) {
      const axes: number[] = [];
      for (let a = 0; a < axisCount; a++) if (m & (1 << a)) axes.push(a);
      const walk = (k: number): boolean => {
        if (k === axes.length) {
          const s = rate(lang);
          if (s === 1000) {
            found = lang.slice();
            return true;
          }
          if (s > bestScore) {
            bestScore = s;
            best = lang.slice();
          }
          return false;
        }
        const a = axes[k]!;
        for (const v of options[a]!) {
          lang[a] = v;
          if (walk(k + 1)) return true;
        }
        lang[a] = base[a]!;
        return false;
      };
      if (walk(0)) break;
    }
    const chosen: string[] = found ?? best;
    out.push(Object.fromEntries(LANGUAGE_AXES.map((axis, a) => [axis, chosen[a]])) as unknown as DesignLanguage);
  });
  return out;
}

/** The diversity report over directions as returned. */
export function diversityOf(directions: readonly { id: string; language: DesignLanguage }[]): Diversity {
  let minAxesApart: number = LANGUAGE_AXES.length;
  const pairsBelow4: Diversity["pairsBelow4"] = [];
  for (let i = 0; i < directions.length; i++) {
    for (let j = i + 1; j < directions.length; j++) {
      const a = directions[i]!;
      const b = directions[j]!;
      const n = axesApart(a.language, b.language);
      minAxesApart = Math.min(minAxesApart, n);
      if (n < MIN_AXES_APART) pairsBelow4.push([a.id, b.id, n]);
    }
  }
  return { minAxesApart, pairsBelow4 };
}

/** "type serif-editorial, color committed, ground dark, ..." for the text output. */
export function languageLine(lang: DesignLanguage): string {
  return `type ${lang.typeVoice}, color ${lang.colorStrategy}, ground ${lang.ground}, density ${lang.density}, composition ${lang.composition}, material ${lang.material}, motion ${lang.motion}`;
}
