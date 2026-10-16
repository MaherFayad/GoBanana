import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { recipeKeyString } from "../../banana-server/lib/atlas/loader.ts";
import { GENRE_NEG } from "../../banana-server/lib/sources/genre.ts";
import { exemplarPicks, genreArg, notesName } from "../j7-taste.ts";
import { GENRE_WORDINGS, MAX_WORDS, buildInputs, genreInputs, genreKindWordings, requestIdOf, searchQueryFor } from "../jobs/j7-recipes.ts";
import { QueryRecipeSchema } from "../schema.ts";

describe("J7 genre lane inputs", () => {
  const inputs = genreInputs();

  it("covers every kind of both genres, at most 4 wordings each", () => {
    const keys = new Set(inputs.map((i) => recipeKeyString(i.key)));
    expect([...keys].filter((k) => k.startsWith("deck|"))).toHaveLength(6);
    expect([...keys].filter((k) => k.startsWith("brand|"))).toHaveLength(7);
    expect(keys.has("deck|pitch-deck|-|-|-")).toBe(true);
    expect(keys.has("brand|logo-system|-|-|-")).toBe(true);
    for (const k of keys) expect(inputs.filter((i) => recipeKeyString(i.key) === k).length).toBeLessThanOrEqual(GENRE_WORDINGS);
    for (const i of inputs) expect(i.wording.query.split(/\s+/).length).toBeLessThanOrEqual(MAX_WORDS);
  });

  it("words the measured wordings the server uses", () => {
    expect(genreKindWordings("presentation", "big number slide")[0]).toEqual({ source: "pinterest", query: "big number data slide presentation design" });
    expect(genreKindWordings("presentation", "pitch deck")[0]).toEqual({ source: "dribbble", query: "dark pitch deck presentation design" });
    expect(genreKindWordings("branding", "packaging")[0]).toEqual({ source: "bpando", query: "packaging" });
    expect(genreKindWordings("branding", "nope")).toEqual([]);
  });

  it("adds the genre negatives on core sites and none on galleries", () => {
    const deck = inputs.find((i) => i.wording.source === "dribbble" && i.key.lane === "deck")!;
    expect(searchQueryFor(deck)).toBe(`${deck.wording.query} ${GENRE_NEG} site:dribbble.com/shots`);
    const pitch = inputs.find((i) => i.wording.source === "pitch")!;
    expect(searchQueryFor(pitch)).toBe(`${pitch.wording.query} site:pitch.com/templates`);
  });

  it("goes after the page and art inputs, so chunk offsets stay put, with gn- ids that pass the schema", () => {
    const all = buildInputs([], [], [{ id: "k1", name: "K", texture: "t", imagery: "i", artQueries: ["x one"] }], inputs);
    expect(all[0]!.kind).toBe("art");
    expect(all.slice(1).every((i) => i.kind === "genre")).toBe(true);
    expect(buildInputs([], [], [])).toEqual([]);
    for (const i of inputs) {
      expect(requestIdOf(i)).toMatch(/^gn-[0-9a-f]{20}$/);
      expect(QueryRecipeSchema.safeParse({ key: i.key, query: i.wording.query, source: i.wording.source, precision: 0.5, judged: 8, at: "2026-10-16" }).success).toBe(true);
    }
  });
});

describe("j7-taste genre filter", () => {
  const picks = JSON.parse(readFileSync(join(__dirname, "..", "..", "banana-server", "bench", "taste", "picks.default.json"), "utf8")).picks as { id: string; genre?: string; platform?: string }[];

  it("reads the UI genres by default and one genre with --genre", () => {
    const ui = exemplarPicks(picks);
    expect(ui.length).toBe(40);
    expect(ui.every((p) => p.genre === undefined)).toBe(true);
    expect(exemplarPicks(picks, "presentation").every((p) => p.genre === "presentation")).toBe(true);
    expect(exemplarPicks(picks, "presentation")).toHaveLength(15);
    expect(exemplarPicks(picks, "branding")).toHaveLength(15);
    expect(genreArg(["node", "j7-taste.ts", "--genre", "branding"])).toBe("branding");
    expect(genreArg(["node", "j7-taste.ts"])).toBeUndefined();
    expect(notesName()).toBe("j7-taste-notes.md");
    expect(notesName("branding")).toBe("j7-taste-notes-branding.md");
  });
});
