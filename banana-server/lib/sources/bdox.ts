/**
 * Best Designs on X (bestdesignsonx.com, owner request 2026-10-16): a site that curates design
 * posts from X (UI parts, screens, motion, branding), sorted by component tags ("button", "card",
 * "switch-button", "empty-states", "analytics-chart", ...). Pure and dependency free.
 *
 * Why a curated local index, not a registry gallery: Google indexes its item pages
 * (`/{handle}/status/{id}`) with the site's generic title and no images, so Serper image search
 * with `site:bestdesignsonx.com` found nothing (2 queries, 0 results, 2026-10-16). Its posts were
 * read once, politely, from its own public tag feeds (24 component tags, 12 posts each), judged by
 * eye and kept in bdox-index.json (URLs and metadata only; bench/taste/candidates.json, bx ids).
 * The server never fetches the site.
 *
 * Link out only: each result links the original X post (sourceUrl) and credits the designer (title
 * and creditUrl). Its images stay on the site's CDN (hotlinked, never copied) and are never a model
 * input (lib/sources/allowlist.ts NO_MODEL_IMAGE_HOSTS): X content, no AI license.
 *
 * When it runs: a UI search whose component words (a direction's component lanes, a component lane
 * re-search, or a plain query) name one of the parts below adds up to MAX_BDOX_RESULTS matches to
 * the UI zone. Words that name no part add nothing, so those searches are unchanged.
 */
import index from "./bdox-index.json";
import type { Reference } from "./types";

export type BdoxItem = (typeof index.items)[number];
export type BdoxPlatform = "mobile" | "web";

/** Most index matches one search adds. */
export const MAX_BDOX_RESULTS = 2;

/** The site, for notes and docs. */
export const BDOX_NAME = "Best Designs on X";

const re = (words: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${words})(?![\\p{L}\\p{N}])`, "iu");

/**
 * The parts the index covers and the words that name them, singular or plural. Pages and whole
 * screens (dashboard, hero, onboarding) are not parts: the index has only element-level shots.
 */
export const BDOX_PARTS: Readonly<Record<string, RegExp>> = {
  button: re("buttons?|ctas?|call to actions?"),
  toggle: re("toggles?|switch(?:es)?|switch buttons?|checkbox(?:es)?"),
  slider: re("sliders?|range sliders?|knobs?|dials?"),
  input: re("inputs?|input fields?|text fields?|search bars?|search fields?|search inputs?|text inputs?"),
  form: re("forms?|login forms?|sign ?in forms?|sign ?up forms?"),
  "empty state": re("empty states?"),
  card: re("cards?"),
  chart: re("charts?|graphs?|sparklines?"),
  widget: re("widgets?"),
  modal: re("modals?|dialogs?|popups?|pop ups?"),
  dropdown: re("dropdowns?|drop downs?|select menus?|filter menus?"),
  sidebar: re("sidebars?|side ?navs?|side navigation"),
  navigation: re("navigation|nav ?bars?|navbars?|tab ?bars?|bottom navs?|bottom navigation"),
  notification: re("notifications?|toasts?|snackbars?"),
  table: re("tables?|data tables?"),
  tabs: re("tabs|segmented controls?"),
  pricing: re("pricing tables?|pricing cards?|pricing sections?"),
};

/** Words that ask for motion on any part ("micro interactions", "hover states"). */
const MOTION_WORDS = re("micro ?interactions?|hover states?|hover effects?");

/** Parts that read the same on a phone and on the web: shown for either platform. */
const NEUTRAL = new Set(["button", "toggle", "slider", "input", "notification", "modal", "dropdown", "empty state", "card", "widget"]);

/** The parts a text names, in BDOX_PARTS order. */
export function bdoxParts(text: string | null | undefined): string[] {
  const t = (text ?? "").toLowerCase().replace(/[_-]+/g, " ");
  if (!t.trim()) return [];
  return Object.keys(BDOX_PARTS).filter((p) => BDOX_PARTS[p]!.test(t));
}

/** The index platform of a search platform (mobile and tablet are phones; website and web app are the web). */
function platformOf(platform: string | undefined): BdoxPlatform | null {
  if (platform === "mobile" || platform === "tablet") return "mobile";
  if (platform === "website" || platform === "webapp") return "web";
  return null;
}

/** One index item as a search result: the X post as its source, the designer in the title. */
export function bdoxReference(item: BdoxItem, id: (sourceUrl: string, imageUrl: string) => string): Reference {
  const by = item.name && item.name.toLowerCase() !== item.handle.toLowerCase() ? `${item.name} (@${item.handle})` : `@${item.handle}`;
  const title = `${item.title} by ${by} on X, via ${BDOX_NAME}`;
  return {
    id: id(item.postUrl, item.imageUrl),
    thumbUrl: item.thumbUrl,
    imageUrl: item.imageUrl,
    sourceUrl: item.postUrl,
    sourceSite: "x.com",
    title: title.length > 200 ? `${title.slice(0, 197)}...` : title,
    creditUrl: `https://x.com/${item.handle}`,
    query: `${BDOX_NAME}: ${item.component}`,
    zone: "ui",
  };
}

/**
 * Index matches for the component words of a UI search (pure, deterministic): items whose part the
 * words name, the first named part first, items for the platform first (a part that reads the
 * same on both platforms may cross over; a web-only part never shows on a phone brief), one per
 * designer, at most `limit`. Motion words with no part pick clips of any part. Nothing named,
 * nothing returned.
 */
export function searchBdox(
  text: string | null | undefined,
  opts: { platform?: string; limit?: number; allowImage: (url: string) => boolean; items?: readonly BdoxItem[] },
): BdoxItem[] {
  const parts = bdoxParts(text);
  const motionOnly = parts.length === 0 && MOTION_WORDS.test((text ?? "").toLowerCase().replace(/[_-]+/g, " "));
  if (parts.length === 0 && !motionOnly) return [];
  const want = platformOf(opts.platform);
  const items = (opts.items ?? index.items).filter(
    (i) => opts.allowImage(i.imageUrl) && (motionOnly ? i.motion : parts.includes(i.component)) && (!want || i.platform === want || NEUTRAL.has(i.component)),
  );
  const rank = (i: BdoxItem) => (motionOnly ? 0 : parts.indexOf(i.component)) * 2 + (want && i.platform !== want ? 1 : 0);
  const sorted = items.map((item, n) => ({ item, n })).sort((a, b) => rank(a.item) - rank(b.item) || a.n - b.n);
  const out: BdoxItem[] = [];
  const seen = new Set<string>();
  for (const { item } of sorted) {
    if (seen.has(item.handle.toLowerCase())) continue;
    seen.add(item.handle.toLowerCase());
    out.push(item);
    if (out.length >= (opts.limit ?? MAX_BDOX_RESULTS)) break;
  }
  return out;
}

/**
 * Index results join the UI zone after its first two results; over `count`, the last UI results
 * make room (art keeps its places). No index results: the list as is.
 */
export function mergeBdox(refs: readonly Reference[], extra: readonly Reference[], count: number): Reference[] {
  if (extra.length === 0) return [...refs];
  const ui = refs.filter((r) => r.zone !== "art");
  const art = refs.filter((r) => r.zone === "art");
  const keep = ui.slice(0, Math.max(0, Math.min(ui.length, count - art.length - extra.length)));
  return [...keep.slice(0, 2), ...extra, ...keep.slice(2), ...art];
}
