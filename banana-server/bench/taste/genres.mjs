/**
 * Taste genres: the one place that lists them. The picker (picker.html, built by build-picker.mjs)
 * shows one tab per genre, and every reader of picks.json (atlas-build j7-taste.ts and the J7
 * recipes judge, bench rating) filters exemplars by genre with `genreOf`.
 *
 * A candidate or pick names its genre in a `genre` field. The first 270 candidates (and the owner's
 * first 120 picks) predate the field: they are Mobile UI or Web UI by their `platform`. To add a
 * genre's candidates, append them to candidates.json with `genre` set to one of these ids and run
 * `node build-picker.mjs`; to add a genre, add it here first.
 */

/** @type {readonly { id: string; label: string; aim: [number, number]; note: string }[]} */
export const GENRES = [
  { id: "mobile-ui", label: "Mobile UI", aim: [20, 40], note: "Phone app screens." },
  { id: "web-ui", label: "Web UI", aim: [20, 40], note: "Web apps and dashboards." },
  { id: "web-showcase", label: "Web showcase", aim: [20, 40], note: "Award-level websites (Awwwards, Motion Sites, Craftwork)." },
  { id: "presentation", label: "Presentation", aim: [20, 40], note: "Pitch decks, keynote slides and editorial report layouts." },
  { id: "branding", label: "Branding", aim: [20, 40], note: "Identities, logo systems, guidelines, posters, packaging and type-led work." },
];

export const GENRE_IDS = GENRES.map((g) => g.id);

/** The genre of a candidate or pick: its `genre`, else Mobile UI or Web UI by its `platform`. */
export function genreOf(item) {
  if (item && typeof item.genre === "string" && GENRE_IDS.includes(item.genre)) return item.genre;
  return item && item.platform === "mobile" ? "mobile-ui" : "web-ui";
}

/** The picks of one genre (all of them when `genre` is empty). */
export function picksOfGenre(picks, genre) {
  return genre ? picks.filter((p) => genreOf(p) === genre) : [...picks];
}

/**
 * Sources whose pictures are never a model input (owner rules, banana-server/DECISIONS.md): Best
 * Designs on X (X posts by third-party designers, no AI license; candidates in group "Best Designs
 * on X", ids bx) and Craftwork (its license bars testing AI models on its previews). Their
 * candidates show in the picker and can be picked, but no judge, notes run or exemplar prompt
 * (atlas-build j7-taste.ts, J7, J10) ever sends them to a model.
 */
export const NO_MODEL_SITES = ["x.com", "bestdesignsonx.com", "craftwork.design"];
export const NO_MODEL_HOSTS = ["cdn.bestdesignsonx.com", "craftwork-products.b-cdn.net", "marketstorage.b-cdn.net", "curated-images.b-cdn.net"];

const hostOf = (url) => {
  try {
    return new URL(String(url)).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};
const onSite = (host, sites) => sites.some((s) => host === s || host.endsWith(`.${s}`));

/** True when a candidate, pick or reference may be shown to a model (false for the sources above). */
export function modelInputOk(item) {
  if (!item) return false;
  if (item.group === "Best Designs on X") return false;
  if (typeof item.id === "string" && /^bx\d+$/.test(item.id)) return false;
  for (const u of [item.sourceUrl, item.foundOn]) if (u && onSite(hostOf(u), NO_MODEL_SITES)) return false;
  for (const u of [item.imageUrl, item.thumbUrl]) if (u && NO_MODEL_HOSTS.includes(hostOf(u))) return false;
  return true;
}

