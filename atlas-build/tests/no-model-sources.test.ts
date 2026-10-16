/**
 * Link-out only sources (banana-server/DECISIONS.md 2026-10-16): Best Designs on X (X posts by
 * third-party designers, no AI license) and Craftwork (its license bars testing AI models on its
 * previews) never reach a model in any Atlas job: not as a J7 source, not as a j7-taste exemplar,
 * not as a J10 judged reference, not through the thumbnail fetcher every judging job uses.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { exemplarPicks } from "../j7-taste.ts";
import { buildInputs } from "../jobs/j7-recipes.ts";
import { scoringInputs, type BenchRun } from "../jobs/j10-judge.ts";
import { fetchImageBlock, fetchThumbBlock, modelInputOk, pickThumbUrl, thumbAllowlist } from "../lib/thumbs.ts";

const taste = join(__dirname, "..", "..", "banana-server", "bench", "taste");
const picks = JSON.parse(readFileSync(join(taste, "picks.default.json"), "utf8")).picks as { id: string; genre?: string; platform?: string; group?: string; imageUrl: string; sourceUrl: string }[];
const candidates = JSON.parse(readFileSync(join(taste, "candidates.json"), "utf8")).candidates as { id: string; imageUrl: string; thumbUrl?: string; sourceUrl: string; group?: string; media?: { url: string }[] }[];
const bx = candidates.filter((c) => c.id.startsWith("bx"));
const BDOX_IMAGE = bx[0]!.imageUrl;
const CRAFTWORK_IMAGE = candidates.find((c) => c.sourceUrl.includes("craftwork.design"))!.imageUrl;

describe("the thumbnail fetcher", () => {
  it("never allows a Best Designs on X or Craftwork image, and fetches nothing for one", async () => {
    const list = thumbAllowlist();
    for (const h of ["cdn.bestdesignsonx.com", "craftwork-products.b-cdn.net", "marketstorage.b-cdn.net", "curated-images.b-cdn.net"]) expect(list.entries).not.toContain(h);
    expect(list.entries).toContain("cdn.dribbble.com");
    for (const url of [BDOX_IMAGE, CRAFTWORK_IMAGE, ...bx.flatMap((c) => (c.media ?? []).map((m) => m.url))]) {
      expect(pickThumbUrl({ imageUrl: url, thumbUrl: url }, list)).toBeNull();
      const fetchImpl = vi.fn();
      expect(await fetchThumbBlock({ imageUrl: url }, { fetchImpl })).toEqual({ ok: false, reason: "not_allowed" });
      expect(await fetchImageBlock(url, { fetchImpl })).toEqual({ ok: false, reason: "not_allowed" });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });
});

describe("j7-taste exemplars", () => {
  it("leaves out the bx default picks, though they are Mobile UI and Web UI picks", () => {
    const bxPicks = picks.filter((p) => p.id.startsWith("bx"));
    expect(bxPicks).toHaveLength(10);
    expect(bxPicks.every((p) => p.genre === "mobile-ui" || p.genre === "web-ui" || p.genre === "web-showcase")).toBe(true);
    for (const genre of [undefined, "mobile-ui", "web-ui", "web-showcase"]) {
      expect(exemplarPicks(picks, genre).some((p) => !modelInputOk(p))).toBe(false);
    }
    // Even an owner's own pick of a link-out only candidate stays out, by its X post or its CDN image.
    const post = { id: "bx900", genre: "web-ui", sourceUrl: "https://x.com/someone/status/1", imageUrl: "https://cdn.dribbble.com/userupload/1.png" };
    const image = { id: "bx901", genre: "web-ui", sourceUrl: "https://dribbble.com/shots/1-a", imageUrl: BDOX_IMAGE };
    const site = { id: "bx902", genre: "web-ui", sourceUrl: "https://bestdesignsonx.com/someone/status/1", imageUrl: "https://cdn.dribbble.com/userupload/2.png" };
    expect(exemplarPicks([post, image, site], "web-ui")).toEqual([]);
    for (const c of bx) expect(modelInputOk(c)).toBe(false);
  });
});

describe("J7 recipes", () => {
  it("never words a request for X, Best Designs on X or Craftwork", () => {
    const page = (id: string, platforms: Array<"mobile" | "website" | "webapp">) => ({ id, names: { en: [id], ar: [] }, platforms, queryNouns: [] });
    const inputs = buildInputs([page("pricing", ["website", "webapp"]), page("paywall", ["mobile"])], [{ id: "paywall", from: "bench" }], [
      { id: "k1", name: "k1", texture: "grain", imagery: "stone", artQueries: ["x one", "x two", "x three"] },
    ]);
    expect(inputs.length).toBeGreaterThan(0);
    for (const i of inputs) expect(i.wording.source).not.toMatch(/craftwork|bdox|bestdesignsonx|^x$|x\.com/);
  });
});

describe("J10 judge", () => {
  it("does not score or show link-out only references", () => {
    const ref = (id: string, imageUrl: string, sourceUrl: string) => ({ id, zone: "ui" as const, imageUrl, sourceUrl });
    const run = {
      run: "2026-10-16",
      briefs: [
        {
          id: "b1",
          brief: "fitness app empty state",
          platform: "mobile",
          wildness: 5,
          directions: [
            {
              id: "d1",
              title: "t",
              search: {
                references: [
                  ref("r1", "https://cdn.dribbble.com/userupload/1.png", "https://dribbble.com/shots/1-a"),
                  ref("r2", BDOX_IMAGE, bx[0]!.sourceUrl),
                  ref("r3", CRAFTWORK_IMAGE, "https://craftwork.design/curated/website/x"),
                ],
              },
            },
          ],
        },
      ],
    } as unknown as BenchRun;
    const refs = scoringInputs(run).filter((i) => i.kind === "references").flatMap((i) => (i as { refs: { id: string }[] }).refs.map((r) => r.id));
    expect(refs).toEqual(["r1"]);
  });
});
