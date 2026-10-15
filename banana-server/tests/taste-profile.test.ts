/** P2-02 taste profile and VAL-03 import. Fakes only. */
import { describe, expect, it } from "vitest";
import {
  applyTaste,
  EMPTY_TASTE,
  matchStyleVocabulary,
  mergeStyleWords,
  MAX_PROFILE_WORDS,
  paletteStyleWords,
  styleWordsFromPalettes,
  withProfileFallback,
  type UserTasteProfile,
} from "@/lib/taste-profile";
import { importTasteFromUploads } from "@/lib/taste-profile/import";
import {
  exchangePinterestCode,
  pinterestAuthorizeUrl,
  pinterestImportEnabled,
  readPinterestTaste,
} from "@/lib/taste-profile/pinterest";
import type { TasteStore } from "@/lib/taste-profile/store";
import type { UploadRecord, UploadRepo } from "@/lib/uploads/types";
import { createBendBriefTool } from "@/lib/mcp/tools/bend_brief";
import { fakeR2 } from "./fake-r2";
import { ALICE, makeDeps } from "./tools-fixtures";
import { bandsRgba, encodePng, hexToRgba } from "./fixtures/palette-images";

describe("applyTaste", () => {
  const cands = [
    { id: "a", fit: 1, words: ["bold"] },
    { id: "b", fit: 1, words: ["minimal"] },
    { id: "c", fit: 1, words: [] },
  ];

  it("keeps the order with an empty profile", () => {
    expect(applyTaste(cands, EMPTY_TASTE).map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(applyTaste(cands, null).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks ties by liked ids first, then shared style words", () => {
    expect(applyTaste(cands, { styleWords: ["Minimal"] }).map((c) => c.id)).toEqual(["b", "a", "c"]);
    expect(applyTaste(cands, { styleWords: ["minimal"], likedCardIds: ["c"] }).map((c) => c.id)).toEqual(["c", "b", "a"]);
  });

  it("never lifts a lower fit over a higher fit", () => {
    const out = applyTaste(
      [
        { id: "fits", fit: 0.9, words: [] },
        { id: "liked", fit: 0.5, words: ["minimal"] },
      ],
      { styleWords: ["minimal"], likedCardIds: ["liked"] },
    );
    expect(out.map((c) => c.id)).toEqual(["fits", "liked"]);
  });

  it("does not change the input or the fit values", () => {
    const input = [...cands];
    const out = applyTaste(input, { styleWords: ["minimal"] });
    expect(input).toEqual(cands);
    expect(out.map((c) => c.fit)).toEqual([1, 1, 1]);
  });
});

describe("style words", () => {
  it("reads dark, muted and warm palettes", () => {
    expect(paletteStyleWords(["#1a1208", "#2b1d0e", "#3a2511"])).toContain("dark mode");
    expect(paletteStyleWords(["#777777", "#888888", "#999999"])).toContain("monochrome");
    expect(paletteStyleWords(["#e8602c", "#f2a65a", "#d94f30"])).toContain("warm tones");
    expect(paletteStyleWords(["#2a6fdb", "#3aa6c9", "#4b5fd1"])).toContain("cool tones");
    expect(paletteStyleWords(["nope"])).toEqual([]);
  });

  it("keeps words most images share", () => {
    const dark = ["#111111", "#1c1c1c"];
    const light = ["#f4f4f4", "#eaeaea"];
    expect(styleWordsFromPalettes([dark, dark, dark, light])).toContain("dark mode");
    expect(styleWordsFromPalettes([dark, light])).toContain("monochrome");
    expect(styleWordsFromPalettes([])).toEqual([]);
  });

  it("merges new words first, without repeats, up to the cap", () => {
    expect(mergeStyleWords(["dark mode"], ["minimal", "dark mode"])).toEqual(["dark mode", "minimal"]);
    const many = Array.from({ length: 20 }, (_, i) => `word${i}`);
    expect(mergeStyleWords([], many)).toHaveLength(MAX_PROFILE_WORDS);
  });

  it("matches the style vocabulary in pin text", () => {
    expect(matchStyleVocabulary(["Minimal dark mode app", "minimal landing, Bento Grid"])).toEqual(["minimal", "dark mode", "bento grid"]);
  });
});

describe("withProfileFallback", () => {
  const read = async () => ({ styleWords: ["luxury", "dark mode"] });

  it("only fills the gap: words from the call or canvas win", async () => {
    expect(await withProfileFallback(read, "u1", ["brutalist"])).toEqual(["brutalist"]);
    expect(await withProfileFallback(read, "u1", [])).toEqual(["luxury", "dark mode"]);
  });

  it("does nothing without a user or reader, and fails open", async () => {
    expect(await withProfileFallback(read, undefined, [])).toEqual([]);
    expect(await withProfileFallback(undefined, "u1", [])).toEqual([]);
    expect(await withProfileFallback(() => Promise.reject(new Error("db")), "u1", [])).toEqual([]);
  });
});

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function memoryStore(): TasteStore & { saved: UserTasteProfile } {
  const state = { saved: { ...EMPTY_TASTE } as UserTasteProfile };
  return {
    get saved() {
      return state.saved;
    },
    async get() {
      return state.saved;
    },
    async save(_id, p) {
      state.saved = { ...p, updatedAt: new Date() };
    },
    async clear() {
      state.saved = { ...EMPTY_TASTE };
    },
  };
}

function uploadsFixture(count: number, owner = USER) {
  const bucket = fakeR2();
  const rows = new Map<string, UploadRecord>();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const key = `u/${owner}/${id}`;
    const png = encodePng(bandsRgba([[hexToRgba("#141414"), 16]], 16));
    bucket.objects.set(key, { bytes: png, contentType: "image/png" });
    rows.set(id, { id, userId: owner, r2Key: key, mime: "image/png", bytes: png.byteLength });
    ids.push(id);
  }
  const repo = { get: async (id: string) => rows.get(id) ?? null } as unknown as UploadRepo;
  return { bucket, repo, ids };
}

describe("importTasteFromUploads", () => {
  it("keeps style words from the user's own images, nothing else", async () => {
    const { bucket, repo, ids } = uploadsFixture(6);
    const store = memoryStore();
    const out = await importTasteFromUploads({ uploads: repo, bucket, store }, USER, ids);
    expect(out).toMatchObject({ ok: true, used: 6 });
    expect(store.saved.styleWords).toContain("dark mode");
    expect(JSON.stringify(store.saved)).not.toMatch(/PNG|bytes/);
    // The images stay as the user's uploads; nothing new was written to R2.
    expect(bucket.calls.put).toBe(0);
  });

  it("needs 5 to 20 images", async () => {
    const { bucket, repo, ids } = uploadsFixture(6);
    const store = memoryStore();
    expect(await importTasteFromUploads({ uploads: repo, bucket, store }, USER, ids.slice(0, 4))).toEqual({ ok: false, error: "bad_count" });
    expect(await importTasteFromUploads({ uploads: repo, bucket, store }, USER, ["not-a-uuid", ...ids])).toEqual({ ok: false, error: "bad_count" });
    expect(store.saved.styleWords).toEqual([]);
  });

  it("refuses someone else's uploads", async () => {
    const { bucket, repo, ids } = uploadsFixture(6, OTHER);
    const store = memoryStore();
    expect(await importTasteFromUploads({ uploads: repo, bucket, store }, USER, ids)).toEqual({ ok: false, error: "not_found" });
    expect(store.saved.styleWords).toEqual([]);
  });

  it("clear empties the profile", async () => {
    const store = memoryStore();
    await store.save(USER, { likedCardIds: ["c1"], styleWords: ["minimal"], sourceUrls: [] });
    await store.clear(USER);
    expect(store.saved.styleWords).toEqual([]);
    expect(store.saved.likedCardIds).toEqual([]);
  });
});

describe("Pinterest import (flag off by default)", () => {
  const env = { TASTE_IMPORT_PINTEREST: "on", PINTEREST_APP_ID: "id", PINTEREST_APP_SECRET: "secret" };

  it("is off unless the flag is on and the app credentials are set", () => {
    expect(pinterestImportEnabled({})).toBe(false);
    expect(pinterestImportEnabled({ ...env, TASTE_IMPORT_PINTEREST: "off" })).toBe(false);
    expect(pinterestImportEnabled({ ...env, PINTEREST_APP_SECRET: "" })).toBe(false);
    expect(pinterestImportEnabled(env)).toBe(true);
  });

  it("asks only for read scopes", () => {
    const url = new URL(pinterestAuthorizeUrl(env, "https://app.test/cb", "st"));
    expect(url.origin + url.pathname).toBe("https://www.pinterest.com/oauth/");
    expect(url.searchParams.get("scope")).toBe("boards:read,pins:read");
    expect(url.searchParams.get("state")).toBe("st");
  });

  it("keeps words and pin links only, and never reads image fields", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: string) => {
      calls.push(input);
      if (input.includes("/oauth/token")) return Response.json({ access_token: "tok" });
      if (input.includes("/pins")) {
        return Response.json({ items: [{ id: "123", title: "Minimal dark mode app", media: { images: { "600x": { url: "https://i.pinimg.com/x.jpg" } } } }] });
      }
      return Response.json({ items: [{ id: "77", name: "Editorial ideas" }] });
    };
    const token = await exchangePinterestCode(env, "code", "https://app.test/cb", fetchImpl);
    expect(token).toBe("tok");
    const taste = await readPinterestTaste(token!, fetchImpl);
    expect(taste).toEqual({ words: ["minimal", "dark mode", "editorial"], sourceUrls: ["https://www.pinterest.com/pin/123/"] });
    expect(JSON.stringify(taste)).not.toContain("pinimg");
    expect(calls.every((c) => c.startsWith("https://api.pinterest.com/v5/"))).toBe(true);
  });

  it("returns null when Pinterest refuses", async () => {
    const no = async () => new Response("no", { status: 401 });
    expect(await exchangePinterestCode(env, "c", "r", no)).toBeNull();
    expect(await readPinterestTaste("tok", no)).toBeNull();
  });
});

describe("bend_brief wiring", () => {
  const BRIEF = { brief: "Flight checkout screen for a GCC travel OTA", wildness: 3 as const, count: 3 };
  const tasteLanes = async (profile: UserTasteProfile | null, taste?: string[]) => {
    const { repos } = makeDeps();
    const tool = createBendBriefTool(() => ({ repos, ...(profile ? { tasteProfile: async () => profile } : {}) }));
    const res = await tool(taste ? { ...BRIEF, taste } : BRIEF, ALICE);
    return JSON.stringify((res.structuredContent as { directions: unknown[] }).directions);
  };

  it("uses the profile words only when the call gives none", async () => {
    const profile = { ...EMPTY_TASTE, styleWords: ["brutalist"] };
    expect(await tasteLanes(profile)).toContain("brutalist");
    expect(await tasteLanes(profile, ["luxury"])).not.toContain("brutalist");
    expect(await tasteLanes(null)).not.toContain("brutalist");
  });

  it("a cleared profile changes nothing", async () => {
    expect(await tasteLanes(EMPTY_TASTE)).toBe(await tasteLanes(null));
  });
});
