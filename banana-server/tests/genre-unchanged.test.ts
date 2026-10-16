/**
 * The Presentation and Branding genres (lib/sources/genre.ts) are additive: mobile, tablet, website
 * and web app searches must plan and filter exactly as before. tests/fixtures/genre-baseline.json
 * was written from the code before the genres existed (next/phase-1, 3b90c77) with
 * WRITE_GENRE_BASELINE=1; this test recomputes the same values and compares the JSON text byte for
 * byte. Only rewrite the baseline for a deliberate change to the UI lanes.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { laneTexts } from "@/lib/bend/queries";
import { DEFAULT_IMAGE_HOSTS, parseAllowlist } from "@/lib/sources/allowlist";
import { artQueryPlan, plainQueryPlan, planRequests, type LaneTexts } from "@/lib/sources/plan";
import { pickGalleries } from "@/lib/sources/registry";
import { mapSerperImagesWithStats } from "@/lib/sources/web-search";
import { EMPTY_TAKEDOWNS } from "@/lib/takedown";
import type { Platform } from "@/lib/direction-detail";
import type { SourceSite } from "@/lib/sources/types";
import bench from "../bench/briefs.json";
import images from "./fixtures/genre-serper-images.json";

const FIXTURE = join(__dirname, "fixtures", "genre-baseline.json");

/** Bench briefs plus everyday UI briefs with and without platform words. */
const BRIEFS: { brief: string; platform?: Platform }[] = [
  ...bench.briefs.map((b) => ({ brief: b.brief, platform: b.platform as Platform })),
  { brief: "meditation timer" },
  { brief: "recipe app home screen" },
  { brief: "saas analytics dashboard" },
  { brief: "portfolio website for a photographer" },
  { brief: "fintech app onboarding, dark" },
  { brief: "arabic flight booking app" },
  { brief: "coffee shop landing page" },
  { brief: "habit tracker" },
  { brief: "crypto wallet send flow on iPhone" },
  { brief: "ipad drawing app toolbar" },
  { brief: "CRM pipeline board", platform: "webapp" },
  { brief: "museum exhibition microsite", platform: "website" },
];
const QUERIES = ["teletext 1980s", "fintech app ui", "bento grid dashboard", "checkout page", "brutalist landing page ai startup", "sadu weaving", "dark mode wallet", "meditation timer"];
const TASTES: string[][] = [[], ["dark", "minimal"]];

function compute() {
  const lanes: unknown[] = [];
  for (const b of BRIEFS) {
    for (const platform of [b.platform, undefined]) {
      for (const taste of TASTES) {
        const l: LaneTexts = laneTexts(b.brief, "sadu weaving", taste, "d1", platform ? { platform } : {});
        const withArt: LaneTexts = { ...l, art: ["sadu weaving pattern"] };
        lanes.push({
          brief: b.brief,
          platform: platform ?? null,
          taste,
          lanes: l,
          ui: planRequests(l),
          both: planRequests(withArt, undefined, { zone: "both" }),
          picked: planRequests(l, ["awwwards", "behance"] as SourceSite[]),
        });
      }
    }
  }
  const plain = QUERIES.map((q) => ({
    q,
    none: plainQueryPlan(q, []),
    picked: plainQueryPlan(q, ["dribbble", "awwwards"] as SourceSite[]),
    art: artQueryPlan(q, []),
  }));
  const galleries = (["mobile", "tablet", "website", "webapp", "any"] as Platform[]).map((platform) => ({
    platform,
    plain: pickGalleries({ platform, key: "d1" }),
    styled: pickGalleries({ platform, styleWords: ["dark mode", "bento grid", "big typography"], key: "d2", artText: ["swiss poster"] }),
  }));
  const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);
  const mapped = {
    ui: mapSerperImagesWithStats(images, { sources: ["pinterest", "dribbble", "behance"], allowlist, takedowns: EMPTY_TAKEDOWNS, count: 50 }),
    art: mapSerperImagesWithStats(images, { sources: ["pinterest", "dribbble", "behance"], allowlist, takedowns: EMPTY_TAKEDOWNS, count: 50, gate: "art", artQuery: "pitch deck" }),
  };
  return { lanes, plain, galleries, mapped };
}

describe("mobile and web search is unchanged by the deck and brand genres", () => {
  it("matches the baseline written before the genres, byte for byte", () => {
    const text = JSON.stringify(compute(), null, 1) + "\n";
    if (process.env.WRITE_GENRE_BASELINE === "1" || !existsSync(FIXTURE)) {
      writeFileSync(FIXTURE, text);
      return;
    }
    // A Windows checkout may turn the fixture's line ends into CRLF; the bytes compared are LF.
    expect(text === readFileSync(FIXTURE, "utf8").replace(/\r\n/g, "\n")).toBe(true);
  });
});
