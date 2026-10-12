/**
 * Families of objects that make the same core metaphor (pure word lists). Field report,
 * 2026-10-12: one bend held "a film noir index card" and "a vinyl record sleeve"; the agent dropped
 * the card as too close to the sleeve (both a printed card with the detail on its back). A bend for
 * a platform draws at most one object per family.
 */

/** Family name to object keys (lists/objects.json). An object in no family is its own. */
export const OBJECT_FAMILIES: Readonly<Record<string, readonly string[]>> = {
  "printed card, cover or ticket": [
    "vinyl record sleeve", "cassette tape insert", "matchbook", "seed packet", "trading card", "museum ticket",
    "postage stamp", "banknote", "passport stamp page", "parking ticket", "library checkout card", "metro ticket",
    "airline safety card", "carnival ticket roll", "bingo card", "index card", "rolodex", "card catalog", "punch card",
    "air traffic flight strip", "race bib", "greeting card", "paint swatch card", "lottery scratch card", "book jacket",
    "paperback cover", "comic book cover", "magazine cover", "sewing pattern envelope", "airmail envelope",
    "letterpress invitation", "35mm slide mount", "instant photo",
  ],
  "label or tag": [
    "luggage tag", "hotel key tag", "garment care label", "shipping label", "wine label", "hot sauce label",
    "firework label", "apothecary label", "museum wall label", "sticker sheet",
  ],
  "box, tin or wrapper": [
    "cereal box", "sneaker box", "board game box", "bakery box", "milk carton", "sardine tin", "tea tin", "olive oil tin",
    "chocolate bar wrapper", "craft beer can", "perfume bottle", "pill blister pack",
  ],
  "dial, panel or machine": [
    "barometer dial", "watch dial", "modular synth panel", "vintage car dashboard", "elevator panel", "pocket calculator",
    "pinball machine", "arcade cabinet", "vending machine", "game cartridge",
  ],
  "board or sign": [
    "airport departure board", "stadium scoreboard", "gas station price sign", "neon shop sign", "highway sign",
    "do not disturb sign", "license plate", "bus stop timetable",
  ],
  "map or chart": ["subway map", "nautical chart", "topographic map", "weather map", "star chart", "tide table", "architectural drawing"],
  "poster or program": ["gig poster", "boxing poster", "circus poster", "theater playbill", "concert program", "newspaper front page"],
  "printed page": [
    "typewriter page", "lab notebook", "dot matrix printout", "exam answer sheet", "thermal receipt", "telegram",
    "crossword puzzle", "origami instructions", "knitting pattern", "flat-pack instruction manual", "film contact sheet",
    "diner menu", "ice cream truck menu", "hotel stationery", "field guide", "botanical specimen sheet", "exhibition catalog",
  ],
};

const FAMILY_OF: ReadonlyMap<string, string> = new Map(
  Object.entries(OBJECT_FAMILIES).flatMap(([family, keys]) => keys.map((k) => [k.toLowerCase(), family] as const)),
);

/** The family of a list entry ("objects" pool only), or undefined. */
export function familyOf(poolKey: string, key: string): string | undefined {
  return poolKey === "objects" ? FAMILY_OF.get(key.toLowerCase()) : undefined;
}
