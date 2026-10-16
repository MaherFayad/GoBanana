/**
 * A small hand-written Banana Atlas for tests (the real one is built offline in atlas-build/).
 * Every record is typed with lib/atlas/types.ts, so the compiler validates it against the section
 * 6.2 schemas. Plain words, no em dashes.
 */
import type {
  CardElementLine,
  CC0Item,
  DomainEntry,
  FitScore,
  IngredientCard,
  Mechanic,
  PageAnatomy,
  QueryRecipe,
  UiElement,
} from "@/lib/atlas/types";

export const PAGES: PageAnatomy[] = [
  {
    id: "plan-picker",
    names: { en: ["plan picker", "plan selection", "pick a plan"], ar: ["اختيار الباقة"] },
    platforms: ["mobile", "webapp", "website"],
    sections: [
      { role: "header", element: "header", label: "Title and trip", required: true, bands: { mobile: { y0: 0, y1: 0.15 } } },
      { role: "list", element: "card", label: "Plan cards", required: true, bands: { mobile: { y0: 0.15, y1: 0.75 } } },
      { role: "cta", element: "cta", label: "Buy button", required: true, bands: { mobile: { y0: 0.85, y1: 1 } } },
    ],
    baseline: "A list of plan cards with data, days and price, and one buy button.",
    mustKeep: ["clear price per plan", "one primary action"],
    wildSpots: [
      { element: "header", why: "The header can carry the trip and the place." },
      { element: "divider", why: "Bands between plan groups can carry the idea." },
      { element: "progress", why: "Data left reads as progress." },
    ],
    mobbinTerms: ["plan picker", "subscription plans"],
    queryNouns: ["plan picker", "data plan"],
  },
  {
    id: "checkout",
    names: { en: ["checkout", "payment page"], ar: ["الدفع"] },
    platforms: ["mobile", "website", "webapp"],
    sections: [
      { role: "header", element: "header", label: "Title", required: true, bands: { mobile: { y0: 0, y1: 0.12 } } },
      { role: "steps", element: "stepper", label: "Steps", required: false, bands: { mobile: { y0: 0.12, y1: 0.2 } } },
      { role: "total", element: "total", label: "Total", required: true, bands: { mobile: { y0: 0.7, y1: 0.85 } } },
      { role: "cta", element: "cta", label: "Pay button", required: true, bands: { mobile: { y0: 0.85, y1: 1 } } },
    ],
    baseline: "Steps on top, a summary, the total and one pay button.",
    mustKeep: ["clear total", "one primary action"],
    wildSpots: [
      { element: "progress", why: "The steps can carry the idea." },
      { element: "divider", why: "Section bands are safe to restyle." },
      { element: "header", why: "The title strip sets the mood." },
    ],
    mobbinTerms: ["checkout"],
    queryNouns: ["checkout", "payment"],
  },
  {
    id: "landing",
    names: { en: ["landing page", "home page"], ar: ["الصفحة الرئيسية"] },
    platforms: ["website"],
    sections: [
      { role: "hero", element: "hero", label: "Hero", required: true, bands: { website: { y0: 0, y1: 0.4 } } },
      { role: "cta", element: "cta", label: "Main action", required: true, bands: { website: { y0: 0.3, y1: 0.4 } } },
    ],
    baseline: "A hero with one line and one action, then three feature rows.",
    mustKeep: ["one primary action"],
    wildSpots: [
      { element: "hero", why: "The hero is where people expect a show." },
      { element: "section-nav", why: "Sections can switch like tabs." },
      { element: "divider", why: "Bands between rows are free to play." },
    ],
    mobbinTerms: ["landing"],
    queryNouns: ["landing page"],
  },
];

export const DOMAINS: DomainEntry[] = [
  {
    id: "telecom-travel",
    names: { en: ["travel", "roaming", "travel app"], ar: ["سفر"] },
    productNouns: ["eSIM", "data plan", "roaming"],
    audience: "Travellers buying data before a trip.",
    regionNotes: "GCC travellers often fly to Europe and Asia.",
    fitsFamilies: ["label or tag", "board or sign", "weaving"],
    clashFamilies: ["printed page"],
  },
  {
    id: "food",
    names: { en: ["coffee shop", "cafe", "bakery"], ar: ["مقهى"] },
    productNouns: ["coffee", "menu"],
    audience: "Locals who want a quick order.",
    fitsFamilies: ["printed page", "material"],
    clashFamilies: ["board or sign"],
  },
];

const PALETTE_WARM: IngredientCard["palette"] = [
  { hex: "#F4E9D8", role: "surface", name: "undyed wool" },
  { hex: "#2B1A12", role: "ink", name: "dark henna" },
  { hex: "#B23A1E", role: "accent", name: "madder red" },
  { hex: "#D9A441", role: "support", name: "saffron" },
];
const PALETTE_DARK: IngredientCard["palette"] = [
  { hex: "#111111", role: "surface", name: "board black" },
  { hex: "#F2F2F2", role: "ink", name: "flap white" },
  { hex: "#F5C400", role: "accent", name: "signal yellow" },
];
const PALETTE_LIGHT: IngredientCard["palette"] = [
  { hex: "#FBFAF7", role: "surface", name: "paper" },
  { hex: "#1C1C1C", role: "ink", name: "carbon" },
  { hex: "#2F6B4F", role: "accent", name: "ink green" },
];

function card(partial: Partial<IngredientCard> & Pick<IngredientCard, "id" | "kind" | "name" | "family">): IngredientCard {
  return {
    idea: `${partial.name} turned into one working part of the page.`,
    surprise: `Nobody expects ${partial.name.toLowerCase()} in an app.`,
    palette: PALETTE_LIGHT,
    shipPairs: [["#1C1C1C", "#FBFAF7"]],
    type: { voice: "grotesk", latin: { display: "Space Grotesk", body: "Inter" }, arabic: { display: "IBM Plex Sans Arabic", body: "Noto Sans Arabic" } },
    texture: `Flat ${partial.name.toLowerCase()} surface`,
    imagery: `Close photos of ${partial.name.toLowerCase()}`,
    motion: { verb: "slide", ms: 240, reduced: "fade only" },
    radius: "small",
    density: "balanced",
    avoid: ["Text over busy texture"],
    artQueries: [partial.name.toLowerCase()],
    ...partial,
  };
}

export const CARDS: IngredientCard[] = [
  card({
    id: "luggage-tag",
    kind: "object",
    name: "Luggage tag",
    family: "label or tag",
    idea: "A luggage tag holds a trip's key facts on one small card.",
    surprise: "A paper tag on a phone screen feels handled and real.",
    palette: PALETTE_WARM,
    texture: "Kraft paper with a punched eyelet",
    artQueries: ["luggage tag", "vintage luggage label"],
  }),
  card({
    id: "departure-board",
    kind: "object",
    name: "Departure board",
    family: "board or sign",
    palette: PALETTE_DARK,
    type: { voice: "mono", latin: { display: "JetBrains Mono", body: "Inter" }, arabic: { display: "IBM Plex Sans Arabic", body: "Noto Sans Arabic" } },
    motion: { verb: "flip", ms: 180, reduced: "swap without the flip" },
    artQueries: ["split flap departure board"],
  }),
  card({ id: "boarding-pass", kind: "object", name: "Boarding pass", family: "printed card, cover or ticket", artQueries: ["boarding pass"] }),
  card({
    id: "sadu-weaving",
    kind: "tradition",
    name: "Sadu weaving",
    nameAr: "السدو",
    family: "weaving",
    region: "gulf",
    palette: PALETTE_WARM,
    culturalNotes: "Bedouin women's weaving from Kuwait and Saudi Arabia; credit the craft.",
    texture: "Tight wool weave in bands",
    artQueries: ["sadu weaving", "al sadu textile"],
  }),
  card({
    id: "talli-braid",
    kind: "tradition",
    name: "Talli braiding",
    nameAr: "التلي",
    family: "braid",
    region: "gulf",
    palette: PALETTE_WARM,
    culturalNotes: "Emirati braided trim with metal thread; credit the craft.",
    artQueries: ["talli braid"],
  }),
  card({
    id: "qatt-asiri",
    kind: "tradition",
    name: "Al Qatt Al Asiri",
    family: "painted wall",
    region: "gulf",
    culturalNotes: "Women's painted walls from Asir; credit the painters.",
    artQueries: ["al qatt al asiri"],
  }),
  card({ id: "zellige", kind: "tradition", name: "Zellige tiles", family: "tile", region: "mena", culturalNotes: "Moroccan tile craft.", artQueries: ["zellige tiles"] }),
  card({ id: "iznik", kind: "tradition", name: "Iznik tiles", family: "tile", region: "anatolia", culturalNotes: "Ottoman tile craft.", artQueries: ["iznik tiles"] }),
  card({ id: "noren", kind: "tradition", name: "Noren curtains", family: "textile", region: "east-asia", culturalNotes: "Japanese shop curtains.", artQueries: ["noren curtain"] }),
  card({ id: "brushed-brass", kind: "material", name: "Brushed brass", family: "metal", motion: { verb: "glint", ms: 300, reduced: "no glint" }, artQueries: ["brushed brass"] }),
  card({ id: "limestone", kind: "material", name: "Limestone", family: "stone", texture: "Pale limestone grain", artQueries: ["limestone texture"] }),
  card({ id: "art-deco", kind: "era", name: "Art Deco 1925", family: "deco", type: { voice: "display-retro", latin: { display: "Poiret One", body: "Inter" }, arabic: { display: "Aref Ruqaa", body: "Noto Sans Arabic" } }, artQueries: ["art deco poster"] }),
  card({ id: "one-typeface", kind: "constraint", name: "One typeface only", family: "rule", artQueries: ["single typeface poster"] }),
  card({ id: "giant-numerals", kind: "scale", name: "Giant numerals", family: "numerals", artQueries: ["giant numerals graphic"] }),
  card({ id: "exam-sheet", kind: "object", name: "Exam answer sheet", family: "printed page", artQueries: ["exam answer sheet"] }),
  card({ id: "diner-menu", kind: "object", name: "Diner menu", family: "printed page", artQueries: ["diner menu"] }),
];

const allCardIds = CARDS.map((c) => c.id);

/** Travel fits: tags, boards and Gulf crafts score high; the printed page family clashes. */
const TRAVEL_SCORES: Record<string, FitScore["score"]> = {
  "luggage-tag": 3,
  "departure-board": 3,
  "boarding-pass": 3,
  "sadu-weaving": 2,
  "talli-braid": 2,
  "qatt-asiri": 2,
  zellige: 2,
  iznik: 2,
  noren: 2,
  "brushed-brass": 2,
  limestone: 2,
  "art-deco": 2,
  "one-typeface": 2,
  "giant-numerals": 2,
  "exam-sheet": 1,
  "diner-menu": 0,
};
const FOOD_SCORES: Record<string, FitScore["score"]> = {
  "diner-menu": 3,
  "exam-sheet": 2,
  limestone: 3,
  "brushed-brass": 2,
  "art-deco": 2,
  "one-typeface": 2,
  "giant-numerals": 2,
  "luggage-tag": 1,
  "departure-board": 1,
  "boarding-pass": 1,
  zellige: 2,
  noren: 2,
  "sadu-weaving": 1,
  "talli-braid": 1,
  "qatt-asiri": 1,
  iznik: 1,
};

export const FIT: FitScore[] = [
  ...allCardIds.map((cardId) => ({ cardId, domainId: "telecom-travel", score: TRAVEL_SCORES[cardId] ?? 0, reason: `${cardId} and travel: a trip object people already trust.` })),
  ...allCardIds.map((cardId) => ({ cardId, domainId: "food", score: FOOD_SCORES[cardId] ?? 0, reason: `${cardId} and food: something people see at the counter.` })),
];

const LINE_ELEMENTS: UiElement[] = ["header", "progress", "divider", "total", "cta", "hero", "section-nav", "empty-state"];
export const LINES: CardElementLine[] = CARDS.flatMap((c, i) =>
  LINE_ELEMENTS.map((element, j) => ({
    cardId: c.id,
    element,
    how: `${c.name} as the ${element.replace("-", " ")}, built from plain parts`,
    buildability: (((i + j) % 5) + 1) as CardElementLine["buildability"],
  })),
);

export const MECHANICS: Mechanic[] = LINE_ELEMENTS.flatMap((element) => [
  {
    id: `${element}-a`,
    element,
    name: `${element} strip`,
    how: `The ${element.replace("-", " ")} is one row of parts that fill in order.`,
    buildability: 5,
    rtl: "The fill runs right to left in Arabic.",
    a11y: "Each part has a text label, contrast 3 to 1 or more.",
    pages: ["checkout", "plan-picker"],
  },
  {
    id: `${element}-b`,
    element,
    name: `${element} stack`,
    how: `The ${element.replace("-", " ")} stacks its parts like cards.`,
    buildability: 3,
    rtl: "The stack mirrors in Arabic.",
    a11y: "Keep focus order top to bottom.",
    pages: ["landing"],
  },
]);

export const RECIPES: QueryRecipe[] = [
  { key: { lane: "baseline", page: "plan-picker", platform: "mobile" }, query: "esim plan picker app ui", source: "dribbble", precision: 0.8, judged: 8, at: "2026-10-20" },
  { key: { lane: "concept", cardId: "luggage-tag", element: "header" }, query: "luggage tag esim plan ui", source: "dribbble", precision: 0.62, judged: 8, at: "2026-10-20" },
  { key: { lane: "concept", cardId: "departure-board", element: "header" }, query: "split flap data plan ui", source: "dribbble", precision: 0.5, judged: 8, at: "2026-10-20" },
  { key: { lane: "component", page: "plan-picker", platform: "mobile", element: "divider" }, query: "plan picker section divider app ui", source: "dribbble", precision: 0.62, judged: 8, at: "2026-10-20" },
  { key: { lane: "component", page: "plan-picker", platform: "mobile", element: "header" }, query: "esim plan picker header app ui", source: "dribbble", precision: 0.65, judged: 8, at: "2026-10-20" },
  { key: { lane: "component", page: "plan-picker", platform: "mobile", element: "progress" }, query: "data plan usage progress app ui", source: "dribbble", precision: 0.6, judged: 8, at: "2026-10-20" },
  // A recipe without the product or page noun: never used for a UI lane (Phase 0 guarantee).
  { key: { lane: "component", platform: "mobile", element: "header" }, query: "big header app ui", source: "dribbble", precision: 0.9, judged: 8, at: "2026-10-20" },
  { key: { lane: "art", cardId: "luggage-tag" }, query: "vintage luggage tag close up", source: "pinterest", precision: 0.88, judged: 8, at: "2026-10-20" },
  { key: { lane: "art", cardId: "sadu-weaving" }, query: "al sadu weaving bands", source: "pinterest", precision: 0.75, judged: 8, at: "2026-10-20" },
];

export const CC0: CC0Item[] = [
  {
    id: "met-1",
    museum: "met",
    title: "Woven band with stripes",
    culture: "Bedouin",
    imageUrl: "https://images.metmuseum.org/CRDImages/is/web-large/band.jpg",
    pageUrl: "https://www.metmuseum.org/art/collection/search/1",
    steal: ["rhythm", "border"],
    motif: ["sadu", "weaving", "stripes"],
    region: "gulf",
    rights: { flag: "isPublicDomain", value: "true" },
  },
  {
    id: "aic-2",
    museum: "aic",
    title: "Travel label for a steamship line",
    imageUrl: "https://www.artic.edu/iiif/2/abc/full/400,/0/default.jpg",
    pageUrl: "https://www.artic.edu/artworks/2",
    steal: ["palette", "layout"],
    motif: ["luggage", "label", "tag"],
    rights: { flag: "is_public_domain", value: "true" },
    region: "global",
  },
];
