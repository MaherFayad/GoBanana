/**
 * Search hints for an Atlas direction (Gate 2 round 3, fix 4): what the reference lanes should say
 * and which result titles they drop, from the J2 domains and the J1 page the bend parsed. Generic,
 * no brief is named here. Pure.
 *
 *   - The topic. The Phase 0 lanes word the brief's own subject ("ramadan offers"), which loses the
 *     product when an occasion leads the brief: "Ramadan offers page for a Saudi food delivery app"
 *     searched "ramadan offers app ui" and got prayer apps in every round 2 run (1 or 2 good of 12 to
 *     14). When that topic shares no word with the Atlas topic (the product the brief names, J2), the
 *     product goes in after the occasion: "ramadan food delivery offers".
 *   - Title words to drop. (a) A theme domain the brief names through an occasion ("Ramadan" names
 *     faith and lifestyle) pulls its own look: its telling name and product noun words (prayer,
 *     qibla, quran) that the main domain never says. (b) A domain whose product nouns are surfaces
 *     (dashboard, chart, report, widget) pulls that surface on another page: the analytics SaaS
 *     pricing search returned dashboards (5 to 7 good of 16).
 */
import type { LaneTexts } from "@/lib/sources/plan";
import { occasionsIn } from "./brief-fit";
import type { DomainEntry, PageAnatomy } from "./types";

/** Product nouns that are a surface of their own: on another page they pull that surface's look. */
const SURFACES = new Set(["dashboard", "dashboards", "chart", "charts", "report", "reports", "widget", "widgets"]);
/** Most title words a direction drops this way. */
export const MAX_AVOID = 8;

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const wordsOf = (s: string) => norm(s).split(/\s+/).filter((w) => w.length >= 3);
const STOP = new Set(["app", "apps", "the", "and", "for", "with", "daily", "life", "time", "times", "plan", "planner", "planners", "lifestyle", "tracker", "calculator", "alert", "reading", "progress", "counter", "nearby"]);

export type SearchHints = { searchTopic?: string; avoidWords?: string[] };

export function searchHints(o: {
  brief: string;
  domain: DomainEntry;
  theme: DomainEntry | null;
  page: PageAnatomy;
  /** The Atlas topic (bend briefTopic): the product noun or domain name the brief holds. */
  topic: string;
  /** The Phase 0 lanes' topic (lib/bend/queries.ts briefTopic). */
  phase0Topic: string;
}): SearchHints {
  const out: SearchHints = {};
  const briefWords = new Set(wordsOf(o.brief));
  const occasionWords = wordsOf(o.phase0Topic).filter((w) => occasionsIn(w).length > 0);
  const p0 = new Set(wordsOf(o.phase0Topic));
  const atlasWords = wordsOf(o.topic);
  if (occasionWords.length > 0 && atlasWords.length > 0 && !atlasWords.some((w) => p0.has(w))) {
    const rest = wordsOf(o.phase0Topic).filter((w) => !occasionWords.includes(w));
    out.searchTopic = [...new Set([...occasionWords, ...atlasWords, ...rest])].join(" ");
  }

  const mainText = [...o.domain.names.en, ...o.domain.productNouns, o.domain.audience, o.domain.regionNotes ?? ""].join(" ");
  const mainWords = new Set(wordsOf(mainText));
  const avoid: string[] = [];
  if (o.theme && o.theme.id !== o.domain.id && occasionsIn(o.brief).length > 0) {
    // The first word of each product noun first ("prayer" of "prayer times", "qibla" of "qibla compass"), then the rest.
    const nouns = o.theme.productNouns.map(wordsOf);
    const heads = nouns.map((n) => n[0] ?? "").filter((w) => w && !mainWords.has(w) && !briefWords.has(w) && !STOP.has(w));
    for (const w of [...heads.slice(0, 5), ...o.theme.names.en.flatMap(wordsOf), ...heads.slice(5), ...nouns.flatMap((n) => n.slice(1))]) {
      if (!w) continue;
      if (!mainWords.has(w) && !briefWords.has(w) && !STOP.has(w) && occasionsIn(w).length === 0 && !avoid.includes(w)) avoid.push(w);
    }
  }
  const pageText = norm([...o.page.names.en, o.page.id.replace(/-/g, " ")].join(" "));
  for (const noun of o.domain.productNouns) {
    const w = norm(noun);
    if (SURFACES.has(w) && !pageText.includes(w.replace(/s$/, "")) && !briefWords.has(w) && !avoid.includes(w)) avoid.unshift(w);
  }
  if (avoid.length > 0) out.avoidWords = avoid.slice(0, MAX_AVOID);
  return out;
}

/**
 * Lanes with the hints applied: the Phase 0 topic phrase becomes the search topic wherever a UI lane
 * says it, and the avoid words join the lanes' title filter. Lanes without the phrase keep their words.
 */
export function applySearchHints(lanes: LaneTexts, hints: SearchHints | undefined): LaneTexts {
  if (!hints || (!hints.searchTopic && !hints.avoidWords?.length)) return lanes;
  const out: Record<string, unknown> = { ...lanes };
  const from = lanes.topic?.trim();
  if (hints.searchTopic && from && from !== hints.searchTopic) {
    const re = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const swap = (v: unknown): unknown => (typeof v === "string" ? v.replace(re, hints.searchTopic!) : Array.isArray(v) ? v.map(swap) : v);
    for (const k of UI_LANE_KEYS) if (k in out) out[k] = swap(out[k]);
    out.topic = hints.searchTopic;
  }
  if (hints.avoidWords?.length) out.avoid = [...new Set([...(lanes.avoid ?? []), ...hints.avoidWords])];
  return out as LaneTexts;
}

/** UI lane fields whose words carry the topic (lib/sources/plan.ts LaneTexts). */
const UI_LANE_KEYS = ["taste", "tasteAlt", "tasteFallback", "fidelity", "lightTwin", "fidelityCore", "component", "locale"] as const;
