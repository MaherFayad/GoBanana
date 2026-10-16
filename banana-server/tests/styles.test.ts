/**
 * The style round (docs/styles): the style data and its docs mirror, style detection, the
 * diversity rule, direction style ids and the style lane in search. Pure.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { laneTexts } from "@/lib/bend/queries";
import { noModelInputHosts } from "@/lib/sources/registry";
import { planRequests, type LaneTexts } from "@/lib/sources/plan";
import { DARK_STYLES, detectStyles, STYLES, styleKeyword, type StyleId } from "@/lib/styles";
import { cleanStyles, MERGED_STYLE_IDS, STYLE_IDS } from "@/lib/styles/ids";
import { assignDirectionStyles, checkBoard, checkDirectionStyles, mainCap, orderByStyle } from "@/lib/styles/diversity";
import { directionStyleIds, FALLBACK_STYLES } from "@/lib/styles/directions";
import { canvasStyleTags, orderResults, tagResults, withStyleLane } from "@/lib/styles/search";
import { parseState } from "@/canvas/state";
import { itemKey } from "@/lib/sources/web-search";

const ROOT = join(__dirname, "..", "..");
const DOCS = join(ROOT, "docs", "styles");

const refs = (...styles: (StyleId[] | null)[]) => styles.map((s, i) => ({ id: `r${i}`, ...(s ? { styles: s } : {}) }));

describe("style data", () => {
  it("has 19 styles, the server mirror equals docs/styles/styles.json, and the ids list matches", () => {
    const docs = readFileSync(join(DOCS, "styles.json"), "utf8").replace(/\r\n/g, "\n");
    const mirror = readFileSync(join(__dirname, "..", "lib", "styles", "styles.json"), "utf8").replace(/\r\n/g, "\n");
    expect(mirror).toBe(docs);
    expect(STYLES.map((s) => s.id)).toEqual([...STYLE_IDS]);
    expect(STYLES).toHaveLength(19);
    for (const merged of Object.keys(MERGED_STYLE_IDS)) expect(STYLE_IDS as readonly string[]).not.toContain(merged);
    expect(DARK_STYLES).toEqual(["dark-luminous", "dark-quiet-matte"]);
  });

  it("keeps every style complete: a neighbour, signals, keywords for its genres, a folder with STYLE.md and exemplars", () => {
    for (const s of STYLES) {
      expect(STYLE_IDS, s.id).toContain(s.neighbour);
      expect(s.neighbour, s.id).not.toBe(s.id);
      expect(s.signals.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.words.length, s.id).toBeGreaterThan(0);
      for (const g of s.genres) expect(styleKeyword(s.id, g), `${s.id} ${g}`).toBeTruthy();
      const md = readFileSync(join(DOCS, s.id, "STYLE.md"), "utf8");
      for (const h of ["## Definition", "## Visual signals", "## Great versus cheap", "## Do", "## Don't", "## Nearest neighbour", "## Keywords per genre", "## Judge rubric"]) {
        expect(md, `${s.id} ${h}`).toContain(h);
      }
      expect(md.startsWith(`---\nname: style-${s.id}\n`) || md.startsWith(`---\r\nname: style-${s.id}\r\n`), s.id).toBe(true);
      expect(existsSync(join(DOCS, s.id, "exemplars.json")), s.id).toBe(true);
    }
    // One folder per style, nothing else.
    const dirs = readdirSync(DOCS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    expect(dirs).toEqual([...STYLE_IDS].sort());
  });

  it("notes where each merged draft style lives", () => {
    for (const [from, to] of Object.entries(MERGED_STYLE_IDS)) {
      expect(readFileSync(join(DOCS, to, "STYLE.md"), "utf8"), from).toContain(`\`${from}\``);
    }
  });

  it("never lists a Craftwork, Best Designs on X or x.com pick as an exemplar", () => {
    const hosts = noModelInputHosts();
    const cands = (JSON.parse(readFileSync(join(__dirname, "..", "bench", "taste", "candidates.json"), "utf8")) as { candidates: Record<string, unknown>[] }).candidates;
    const urls = (c: Record<string, unknown>) =>
      [c.imageUrl, c.thumbUrl, c.sourceUrl, c.foundOn, c.liveUrl, ...((c.media as { url?: string; poster?: string }[] | undefined) ?? []).flatMap((m) => [m.url, m.poster])].filter(
        (u): u is string => typeof u === "string",
      );
    const host = (u: string) => {
      try {
        return new URL(u).hostname;
      } catch {
        return "";
      }
    };
    const banned = new Set(cands.filter((c) => c.group === "Best Designs on X" || urls(c).some((u) => hosts.includes(host(u)) || /b-cdn\.net$/.test(host(u)))).map((c) => c.id as string));
    expect(banned.size).toBeGreaterThan(50);
    for (const id of STYLE_IDS) {
      const ex = JSON.parse(readFileSync(join(DOCS, id, "exemplars.json"), "utf8")) as { core: string[]; edge: string[] };
      for (const pick of [...ex.core, ...ex.edge]) expect(banned.has(pick), `${id} ${pick}`).toBe(false);
    }
    for (const s of STYLES) for (const pick of s.exemplars) expect(banned.has(pick), `${s.id} ${pick}`).toBe(false);
  });

  it("has no em or en dashes in the style docs", () => {
    const files = [join(DOCS, "INDEX.md"), join(DOCS, "styles.json"), ...STYLE_IDS.flatMap((id) => [join(DOCS, id, "STYLE.md"), join(DOCS, id, "exemplars.json")])];
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/[—–]/);
  });

  it("cleans style tags: known ids, merged ids read as their style, main first, at most 2", () => {
    expect(cleanStyles(["dark-luminous", "nope", "glass-frosted", "flat-color-field"])).toEqual(["dark-luminous", "glass-frosted"]);
    expect(cleanStyles(["ai-orb-glow", "dark-luminous"])).toEqual(["dark-luminous"]);
    expect(cleanStyles(["brutalist-raw"])).toEqual(["retro-pixel-halftone"]);
    expect(cleanStyles([])).toBeUndefined();
    expect(cleanStyles("dark-luminous")).toBeUndefined();
  });
});

describe("detectStyles", () => {
  it("reads styles from brief and taste words, longest phrase first", () => {
    expect(detectStyles(["glassmorphism banking app"])).toEqual(["glass-frosted"]);
    expect(detectStyles(["dark matte trading dashboard"])).toEqual(["dark-quiet-matte"]);
    expect(detectStyles(["fintech app onboarding, dark"])).toEqual(["dark-luminous"]);
    expect(detectStyles(["big typography and big numbers"])).toEqual(["big-type-display", "hero-numeral"]);
    expect(detectStyles(["minimal", "dark mode"])).toEqual(["minimal-mono-light", "dark-luminous"]);
  });

  it("fits the genre: 3d is soft 3D objects on a phone and the WebGL scene on a website", () => {
    expect(detectStyles(["3d wallet app"], "mobile")).toEqual(["soft-3d-objects"]);
    expect(detectStyles(["3d coffee shop site"], "showcase")).toEqual(["webgl-3d-scene"]);
  });

  it("names nothing for briefs with no style words (their search plans as before)", () => {
    for (const brief of ["meditation timer", "recipe app home screen", "saas analytics dashboard", "flight checkout screen", "arabic flight booking app", "habit tracker", "coffee shop landing page", "CRM pipeline board"]) {
      expect(detectStyles([brief]), brief).toEqual([]);
    }
  });
});

describe("diversity rule", () => {
  it("caps one main style at 3, or 2 on a board of 6 or fewer", () => {
    expect(mainCap(8)).toBe(3);
    expect(mainCap(6)).toBe(2);
    const four = refs(["glass-frosted"], ["glass-frosted"], ["glass-frosted"], ["glass-frosted"], ["minimal-mono-light"], ["photographic-hero"], null, ["hero-numeral"]);
    const ordered = orderByStyle(four, 8);
    expect(ordered.refs.map((r) => r.id)).toEqual(["r0", "r1", "r2", "r4", "r5", "r6", "r7", "r3"]);
    expect(ordered.moved).toBe(1);
    expect(checkBoard(four).problems.join(" ")).toContain("4 references are glass-frosted; at most 3");
  });

  it("keeps any one tag to 60%, with the two dark styles counted as one unless dark is asked", () => {
    const dark = refs(["dark-luminous"], ["dark-luminous"], ["dark-quiet-matte"], ["dark-quiet-matte"], ["data-dense-dashboard", "dark-quiet-matte"], ["minimal-mono-light"], ["photographic-hero"], ["hero-numeral"]);
    expect(checkBoard(dark).problems.join(" ")).toContain("carry dark (dark-luminous and dark-quiet-matte together)");
    expect(checkBoard(dark, { asked: ["dark-luminous"] }).problems.join(" ")).not.toContain("carry dark");
  });

  it("asks for 3 main styles, 4 at 8 or more, when no style is asked", () => {
    const two = refs(["glass-frosted"], ["glass-frosted"], ["minimal-mono-light"], ["minimal-mono-light"]);
    expect(checkBoard(two).problems.join(" ")).toContain("Only 2 main styles; show at least 3");
    const three = refs(["glass-frosted"], ["glass-frosted"], ["minimal-mono-light"], ["minimal-mono-light"], ["photographic-hero"], ["photographic-hero"], ["hero-numeral"], null);
    expect(checkBoard(three).problems).toEqual([]);
    const threeOf8 = refs(["glass-frosted"], ["glass-frosted"], ["minimal-mono-light"], ["minimal-mono-light"], ["photographic-hero"], ["photographic-hero"], ["glass-frosted"], ["minimal-mono-light"]);
    expect(checkBoard(threeOf8).problems.join(" ")).toContain("show at least 4 on a board of 8");
  });

  it("asks 60% of the board from the asked style or its neighbour", () => {
    const board = refs(["glass-frosted"], ["glass-frosted"], ["minimal-mono-light"], ["photographic-hero"], ["hero-numeral"]);
    expect(checkBoard(board, { asked: ["glass-frosted"] }).problems.join(" ")).toContain("Only 2 of 5 tagged references are glass-frosted or soft-3d-objects");
    const lean = refs(["glass-frosted"], ["glass-frosted"], ["glass-frosted"], ["soft-3d-objects"], ["soft-3d-objects"], ["photographic-hero"], ["hero-numeral"], ["minimal-mono-light"]);
    expect(checkBoard(lean, { asked: ["glass-frosted"] }).problems).toEqual([]);
  });

  it("allows 1 vivid gradient unless asked", () => {
    const board = refs(["vivid-gradient"], ["dark-luminous", "vivid-gradient"], ["minimal-mono-light"], ["photographic-hero"]);
    expect(checkBoard(board).problems.join(" ")).toContain("2 vivid-gradient references; at most 1");
    expect(checkBoard(board, { asked: ["vivid-gradient"] }).problems.join(" ")).not.toContain("vivid-gradient references");
    expect(orderByStyle(board, 8).refs.map((r) => r.id)).toEqual(["r0", "r2", "r3", "r1"]);
  });

  it("does not judge a board with fewer than 2 tagged references, and lists the untagged", () => {
    const c = checkBoard(refs(["glass-frosted"], null, null));
    expect(c.problems).toEqual([]);
    expect(c.untagged).toEqual(["r1", "r2"]);
  });

  it("gives each direction its own style id (rule 5)", () => {
    expect(checkDirectionStyles([{ id: "a", styleId: "glass-frosted" }, { id: "b", styleId: "glass-frosted" }, { id: "c" }])).toEqual([
      "Directions a and b share the main style glass-frosted; give each direction its own.",
      "Direction c names no style id.",
    ]);
    const ids = assignDirectionStyles([["glass-frosted"], ["glass-frosted"], []], { fallback: FALLBACK_STYLES.mobile });
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBe("glass-frosted");
    const asked = assignDirectionStyles([[], [], []], { asked: ["dark-luminous"], fallback: FALLBACK_STYLES.mobile });
    expect(asked.slice(0, 2)).toEqual(["dark-luminous", "dark-quiet-matte"]);
    expect(new Set(asked).size).toBe(3);
  });

  it("assigns distinct style ids that fit the genre to a bend's directions", () => {
    const dirs = [{ platform: "mobile", spec: { styleWords: ["glassmorphism"] } }, { platform: "mobile", spec: { styleWords: ["glassmorphism"] } }, { platform: "mobile" }];
    const out = directionStyleIds(dirs, { brief: "wallet home screen", platform: "mobile" });
    expect(out.genre).toBe("mobile");
    expect(out.asked).toEqual([]);
    expect(out.ids).toEqual(["glass-frosted", "dark-luminous", "minimal-mono-light"]);
    const deck = directionStyleIds([{ platform: "any" }, { platform: "any" }], { brief: "pitch deck for a fintech startup", platform: "any" });
    expect(deck.genre).toBe("deck");
    expect(deck.ids).toEqual(["big-type-display", "hero-numeral"]);
    const showcase = directionStyleIds([{ platform: "website" }, { platform: "website" }], { brief: "coffee landing page", taste: ["playful"], platform: "website" });
    expect(showcase.ids).toEqual(["playful-too-fun", "illustrative-handmade"]);
  });
});

describe("styles in search", () => {
  const mobile = () => laneTexts("wallet home screen", "sadu weaving", [], "d1", { platform: "mobile" });

  it("leaves lanes alone when no style is in play (same object, same plan)", () => {
    const lanes = mobile();
    expect(withStyleLane(lanes, null, "asked").lanes).toBe(lanes);
    expect(withStyleLane(lanes, undefined, "direction").lanes).toBe(lanes);
    const plain = [{ id: "a", sourceUrl: "https://dribbble.com/shots/1", zone: "ui" }];
    expect(orderResults(plain, 12).refs).toBe(plain);
    expect(tagResults(plain, {})).toEqual(plain);
  });

  it("an asked style becomes the taste lane's words; a taste lane that already names it keeps its wording", () => {
    const lanes = mobile();
    const glass = withStyleLane(lanes, "glass-frosted", "asked");
    expect(glass.style).toEqual({ id: "glass-frosted", words: expect.stringContaining("glassmorphism app ui") });
    expect(glass.lanes.taste).toBe(glass.style!.words);
    expect(planRequests(glass.lanes).some((r) => r.lane === "taste" && r.query.startsWith(glass.style!.words))).toBe(true);
    // Taste "dark, minimal": the measured taste lane ("minimal wallet balance ui ios app") names an
    // asked style, so it keeps its wording and its results carry that style.
    const taste = ["dark", "minimal"];
    const dark = laneTexts("wallet home screen", "sadu weaving", taste, "d1", { platform: "mobile" });
    const asked = detectStyles(taste, "mobile");
    expect(asked).toEqual(["dark-luminous", "minimal-mono-light"]);
    const kept = withStyleLane(dark, asked[0], "asked", asked);
    expect(kept.lanes).toBe(dark);
    expect(kept.style).toEqual({ id: "minimal-mono-light", words: dark.taste });
    // The default mobile taste lane ("dark {phrase} ui ios app") already names dark.
    const plainDark = withStyleLane(mobile(), "dark-luminous", "asked");
    expect(plainDark.lanes.taste).toBe(mobile().taste);
    expect(plainDark.style?.id).toBe("dark-luminous");
  });

  it("a direction's own style only changes its tasteAlt", () => {
    const lanes = mobile();
    const out = withStyleLane(lanes, "hero-numeral", "direction");
    if (lanes.tasteAlt) {
      expect(out.lanes.tasteAlt).toContain("big number app ui");
      expect(out.lanes.taste).toBe(lanes.taste);
    } else expect(out.lanes).toBe(lanes);
  });

  it("a deck or brand brief gets the style keyword as its first genre request", () => {
    const lanes: LaneTexts = { idea: "sadu", genre: "presentation", genreRequests: [{ lane: "deck", query: "pitch deck presentation design -template -kit -free", site: "dribbble" }] };
    const out = withStyleLane(lanes, "editorial-serif", "asked");
    expect(out.lanes.genreRequests![0]).toEqual({ lane: "deck", query: "editorial presentation layout -template -kit -free", site: "pinterest" });
    expect(out.lanes.genreRequests).toHaveLength(2);
    expect(withStyleLane(lanes, "editorial-serif", "direction").lanes).toBe(lanes);
  });

  it("tags results: the style request's results, known canvas tags first, art never", () => {
    const style = { id: "glass-frosted" as const, words: "wallet glassmorphism app ui" };
    const list = [
      { sourceUrl: "https://dribbble.com/shots/1", query: "wallet glassmorphism app ui", zone: "ui" },
      { sourceUrl: "https://dribbble.com/shots/2", query: "wallet app ui", zone: "ui" },
      { sourceUrl: "https://dribbble.com/shots/3", query: "wallet glassmorphism app ui", zone: "art" },
      { sourceUrl: "https://dribbble.com/shots/4", query: "wallet app ui", zone: "ui" },
    ];
    const known = new Map([[itemKey("https://dribbble.com/shots/4"), ["hero-numeral"]]]);
    const out = tagResults(list, { style, known, keyOf: itemKey });
    expect(out.map((r) => (r as { styles?: string[] }).styles)).toEqual([["glass-frosted"], undefined, undefined, ["hero-numeral"]]);
  });

  it("reads style tags from a canvas's tray and placed references", () => {
    const state = parseState({
      tray: [{ id: "a", imageUrl: "https://i.pinimg.com/a.jpg", sourceUrl: "https://www.pinterest.com/pin/1/", styles: ["glass-frosted", "nope"] }],
      nodes: [{ id: "n1", type: "image", x: 0, y: 0, w: 10, h: 10, data: { imageUrl: "https://cdn.dribbble.com/b.png", sourceUrl: "https://dribbble.com/shots/9", styles: ["ai-orb-glow"] } }],
    });
    expect(state.tray[0]!.styles).toEqual(["glass-frosted"]);
    const tags = canvasStyleTags(state, itemKey);
    expect(tags.get(itemKey("https://dribbble.com/shots/9"))).toEqual(["dark-luminous"]);
    expect(tags.size).toBe(2);
  });
});
