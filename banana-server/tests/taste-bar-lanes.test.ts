/** P0-17 step 3: taste lanes, source routing and title rules (docs/search-quality-experiment.md round 13). */
import { describe, expect, it } from "vitest";
import { bendBrief, type Wildness } from "@/lib/bend";
import { barTasteQuery, laneTexts, lightTwinQuery, MAX_FOCUSED_QUERY_WORDS, queryKey } from "@/lib/bend/queries";
import { mulberry32 } from "@/lib/bend/prng";
import { galleryWords, planRequests } from "@/lib/sources/plan";
import { isJunk, isListicleTitle, qualityScore, rankReferences } from "@/lib/sources/quality";
import { pickGalleries } from "@/lib/sources/registry";
import type { Reference } from "@/lib/sources/types";

const KEYS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
const words = (s: string) => s.split(/\s+/).filter(Boolean);

describe("taste lane wording per platform", () => {
  it("mobile: dark {phrase} ui ios app on Pinterest, the series phrase for the page", () => {
    expect(barTasteQuery("meditation app paywall", undefined, "mobile")).toEqual({ text: "dark paywall subscription ui ios app", site: "pinterest" });
    expect(laneTexts("meditation app paywall", "x", [], "k", { platform: "mobile" })).toMatchObject({
      taste: "dark paywall subscription ui ios app",
      tasteSite: "pinterest",
      lightTwin: "paywall subscription ui ios app",
    });
    expect(barTasteQuery("subscription plan picker for a fitness app", undefined, "mobile")!.text).toBe("dark paywall subscription ui ios app");
    expect(barTasteQuery("wallet screen for a finance app", undefined, "mobile")!.text).toBe("dark wallet balance ui ios app");
    // A product noun keeps the topic (P0-16): "crypto" stays.
    expect(barTasteQuery("crypto wallet balance screen", undefined, "mobile")!.text).toMatch(/^dark crypto .*ui ios app$/);
    expect(barTasteQuery("personal finance app home screen", undefined, "mobile")!.text).toBe("dark wallet balance ui ios app");
    expect(barTasteQuery("banking onboarding", undefined, "mobile")!.text).toBe("dark welcome screen ui ios app");
    expect(lightTwinQuery("meditation app onboarding", "mobile")).toBe("welcome screen ui ios app");
    // Other pages keep the topic; a product noun stays (P0-16).
    expect(barTasteQuery("flight checkout for a GCC OTA", undefined, "mobile")!.text).toBe("dark flight checkout ui ios app");
    expect(barTasteQuery("eSIM plan picker for a GCC travel app", undefined, "mobile")!.text).toBe("dark esim plan ui ios app");
    expect(barTasteQuery("fitness app empty state", undefined, "mobile")!.text).toBe("dark fitness empty state ui ios app");
    // Android briefs search the Android series.
    expect(barTasteQuery("android banking onboarding", undefined, "mobile")!.text).toBe("dark welcome screen ui android app");
  });

  it("web app: dark mode minimal {domain} {page} ui on Dribbble, falling back to dark {page} web app ui", () => {
    const q = barTasteQuery("logistics fleet management dashboard", undefined, "webapp")!;
    expect(q.site).toBe("dribbble");
    expect(q.text).toMatch(/^dark mode minimal /);
    expect(q.text).toBe("dark mode minimal fleet management dashboard ui");
    expect(q.fallback).toBe("dark dashboard web app ui");
    expect(barTasteQuery("admin data table dashboard for a CRM", undefined, "webapp")!.text).toMatch(/^dark mode minimal .*data table ui$/);
    const lanes = laneTexts("logistics fleet management dashboard", "x", [], "k", { platform: "webapp" });
    expect(lanes).toMatchObject({ taste: q.text, tasteFallback: q.fallback });
    expect(lanes.tasteSite).toBe("dribbble");
  });

  it("the user's style words replace dark, never the direction's style words", () => {
    expect(laneTexts("meditation app paywall", "x", ["glassmorphism"], "k", { platform: "mobile" }).taste).toBe("glassmorphism paywall subscription ui ios app");
    expect(laneTexts("meditation app paywall", "x", [], "k", { platform: "mobile", styleWords: ["bento grid"] }).taste).toBe("dark paywall subscription ui ios app");
    const web = laneTexts("logistics fleet management dashboard", "x", ["brutalist"], "k", { platform: "webapp" });
    expect(web.taste).toBe("brutalist fleet management dashboard ui");
    expect(web.tasteFallback).toBe("brutalist dashboard web app ui");
    // Other platforms keep the old taste lane.
    expect(laneTexts("coffee shop landing page", "x", ["minimal"], "k", { platform: "website" }).taste).toBe("minimal coffee shop landing page ui design");
  });

  it("never sends 2025, product design, saas or single screen, and no hero lane", () => {
    const briefs: [string, "mobile" | "webapp"][] = [
      ["meditation app paywall", "mobile"],
      ["banking onboarding", "mobile"],
      ["Retail banking mobile app homepage: balance, quick actions", "mobile"],
      ["flight checkout for a GCC OTA", "mobile"],
      ["analytics dashboard for a B2B SaaS", "webapp"],
      ["saas admin data table dashboard", "webapp"],
    ];
    for (const [brief, platform] of briefs) {
      for (const taste of [[], ["2025 product design"], ["saas"]]) {
        const lanes = laneTexts(brief, "crushed velvet", taste, "k", { platform });
        expect(lanes.hero).toBeUndefined();
        for (const r of planRequests(lanes, undefined, { zone: "ui" })) {
          // The taste lanes (taste and the light twin); the fidelity page keeps the brief's own words.
          if (r.lane !== "taste" && !(r.lane === "fidelity" && r.site === "pinterest")) continue;
          expect(r.query, brief).not.toMatch(/\b2025\b|product design|\bsaas\b|single screen/i);
          expect(words(r.query.split(" -")[0]!).length).toBeLessThanOrEqual(MAX_FOCUSED_QUERY_WORDS);
        }
      }
    }
  });

  it("mobile plans the light twin on Pinterest in the baseline lane, in place of the Pinterest fidelity page", () => {
    const plan = planRequests(laneTexts("meditation app paywall", "x", [], "k", { platform: "mobile" }), undefined, { zone: "ui" });
    expect(plan[0]).toMatchObject({ lane: "taste", site: "pinterest" });
    const pins = plan.filter((r) => r.site === "pinterest");
    expect(pins.map((r) => `${r.lane}:${r.query.split(" -")[0]}`)).toEqual(["taste:dark paywall subscription ui ios app", "fidelity:paywall subscription ui ios app"]);
  });

  it("keeps P0-05: no two directions of a mobile or web app bend share a query", () => {
    const rng = mulberry32(17);
    const briefs: [string, "mobile" | "webapp"][] = [
      ["meditation app paywall", "mobile"],
      ["eSIM plan picker for a GCC travel app", "mobile"],
      ["banking onboarding", "mobile"],
      ["logistics fleet management dashboard", "webapp"],
    ];
    for (const [brief, platform] of briefs) {
      for (let seed = 0; seed < 40; seed++) {
        const r = bendBrief({ brief, platform, wildness: (1 + Math.floor(rng() * 5)) as Wildness, count: 4 });
        const seen = new Set<string>();
        for (const d of r.directions) {
          for (const q of d.searchQueries) {
            expect(seen.has(queryKey(q)), `${brief}: ${q}`).toBe(false);
            seen.add(queryKey(q));
            expect(q).not.toMatch(/single screen/);
          }
        }
      }
    }
  });
});

describe("source routing", () => {
  it("mobile never picks ScreensDesign without a tag; web app never picks SaaSFrame", () => {
    for (const key of KEYS) {
      for (const styleWords of [[], ["minimal"], ["dark mode", "motion"]]) {
        expect(pickGalleries({ platform: "mobile", key, styleWords, brief: "meditation app onboarding" }).ui).not.toContain("screensdesign");
        const web = pickGalleries({ platform: "webapp", key, styleWords, brief: "analytics dashboard" });
        expect(web.ui).not.toContain("saasframe");
        expect(web.baseline).not.toContain("saasframe");
      }
    }
  });

  it("mobile picks 60fps for pay, card, checkout and wallet pages only", () => {
    for (const key of KEYS) {
      expect(pickGalleries({ platform: "mobile", key, brief: "flight checkout for a GCC OTA" }).ui).toContain("60fps");
      expect(pickGalleries({ platform: "mobile", key, brief: "crypto wallet home screen" }).ui).toContain("60fps");
      expect(pickGalleries({ platform: "mobile", key, brief: "meditation app onboarding", styleWords: ["motion"] }).ui).not.toContain("60fps");
    }
    expect(galleryWords("60fps", "flight checkout")).toBe("pay");
    expect(galleryWords("60fps", "crypto wallet")).toBe("card");
  });

  it("Nicelydone and Refero: one head word, only in the baseline lane", () => {
    expect(galleryWords("nicelydone", "analytics dashboard ui")).toBe("analytics");
    expect(galleryWords("refero", "analytics dashboard ui")).toBe("analytics");
    expect(galleryWords("nicelydone", "admin data table")).toBe("data");
    for (const key of KEYS) {
      const pick = pickGalleries({ platform: "webapp", key, brief: "analytics dashboard" });
      expect(pick.ui).not.toContain("nicelydone");
      expect(pick.ui).not.toContain("refero");
      expect(pick.baseline).toEqual(["nicelydone", "refero"]);
    }
    const plan = planRequests(laneTexts("analytics dashboard for a fleet company", "x", [], "k", { platform: "webapp" }), undefined, { zone: "ui" });
    for (const r of plan.filter((x) => x.site === "nicelydone" || x.site === "refero")) expect(r.lane).toBe("fidelity");
    expect(plan[0]).toMatchObject({ lane: "taste", site: "dribbble" });
  });
});

describe("title rules", () => {
  const ref = (title: string, extra: Partial<Reference> = {}): Reference =>
    ({
      id: title,
      title,
      imageUrl: "https://i.pinimg.com/736x/a.jpg",
      thumbUrl: "https://i.pinimg.com/236x/a.jpg",
      sourceUrl: "https://www.pinterest.com/pin/1/",
      sourceSite: "pinterest.com",
      width: 1200,
      height: 900,
      ...extra,
    }) as Reference;

  it("drops listicles and promo pins as junk (title only)", () => {
    for (const t of [
      "40 Best Mobile App Onboarding UI Examples",
      "Onboarding design ideas | How to design app onboarding",
      "Data Table UI Design Guide & 30+ Examples",
      "Best Website Dashboard UI Examples for Design Inspiration #61",
      "Design Resource / Onboarding screens",
      "ScreensDesign - App Design Library & UI Inspiration from Top iOS Apps",
    ]) {
      expect(isListicleTitle(t), t).toBe(true);
      expect(isJunk({ title: t }), t).toBe(true);
    }
    expect(isJunk({ title: "Analytics dashboard", sourceUrl: "https://nicelydone.club/examples/screens/linear-analytics" })).toBe(false);
    expect(isListicleTitle("Wallet & Balance UI from Revolut iOS App")).toBe(false);
  });

  it("ranks shipped screens up and concept, exploration and challenge shots down", () => {
    const shipped = ref("Wallet & Balance UI from Revolut iOS App");
    const concept = ref("Wallet App Concept Design");
    expect(rankReferences([concept, shipped], { year: 2026 })[0]).toBe(shipped);
    const plain = ref("Credit card checkout app");
    const daily = ref("Daily UI #002 - Credit Card Checkout app");
    expect(qualityScore(daily, { year: 2026 })).toBeLessThan(qualityScore(plain, { year: 2026 }));
    for (const t of ["Exploration - Wallet App Dark Version", "Day 002 ( Credit Card Checkout ) app", "#DailyUI002 checkout app"]) {
      expect(qualityScore(ref(t), { year: 2026 }), t).toBeLessThan(qualityScore(ref("Wallet app"), { year: 2026 }));
    }
  });

  it("no longer scores 'concept' up", () => {
    expect(qualityScore(ref("Wallet app concept"), { year: 2026 })).toBeLessThan(qualityScore(ref("Wallet app"), { year: 2026 }));
  });

  it("applies the year-in-title age check to Pinterest pins", () => {
    const old = ref("Banking app UI 2019");
    const aging = ref("Banking app UI 2022");
    const fresh = ref("Banking app UI 2026");
    const none = ref("Banking app UI");
    const score = (r: Reference) => qualityScore(r, { year: 2026 });
    expect(score(old)).toBeLessThan(score(aging));
    expect(score(aging)).toBeLessThan(score(none));
    expect(score(none)).toBeLessThan(score(fresh));
  });
});
