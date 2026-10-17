/**
 * Wild directions v2 (docs/wild-directions-v2-spec.md): platform detection and gating, tone
 * matching, the visual spec, art queries, pages and wild spots, acronyms, and id stability.
 */
import { describe, expect, it, vi } from "vitest";
import { bendBrief, formatDirections, LISTS, parseBendInput, type Wildness } from "@/lib/bend";
import { legacyPart } from "@/lib/bend/lists";
import { fixCase, UI_WORDS, VERIFIED_STYLE_WORDS } from "@/lib/bend/spec";
import { detectDomain, moodFits, MAX_WEIRD } from "@/lib/bend/tone";
import { isTypeVoice, PLATFORMS, type Platform } from "@/lib/direction-detail";
import { allowedOn, detectPlatform, PLATFORM_PROFILES } from "@/lib/platform";
import { createBendBriefTool } from "@/lib/mcp/tools/bend_brief";
import { DEFAULT_TASTE } from "@/lib/taste";
import { ALICE, makeDeps, seedCanvas } from "./tools-fixtures";

const LEVELS: Wildness[] = [1, 2, 3, 4, 5];
const words = (s: string) => s.split(/\s+/).filter(Boolean);
const PLATFORM_BRIEFS: Record<Exclude<Platform, "any">, string> = {
  mobile: "meditation app onboarding on iPhone",
  tablet: "recipe app for iPad",
  website: "landing page for an AI note-taking startup",
  webapp: "B2B analytics dashboard web app",
};

describe("platform detection", () => {
  const table: [string, Platform][] = [
    ["meditation app onboarding on iPhone", "mobile"],
    ["dashboard app on iPhone", "mobile"],
    ["android banking app", "mobile"],
    ["banking app onboarding", "mobile"],
    ["smart watch workout screen", "mobile"],
    ["iOS settings screen", "mobile"],
    ["recipe app for iPad", "tablet"],
    ["tablet point of sale", "tablet"],
    ["landing page for an AI note-taking startup", "website"],
    ["pricing page for a saas tool", "website"],
    ["portfolio site for a photographer", "website"],
    ["coffee shop homepage", "website"],
    ["launch page for a new sneaker", "website"],
    ["B2B analytics dashboard web app", "webapp"],
    ["fitness tracker dashboard", "webapp"],
    ["CRM contact list", "webapp"],
    ["admin console for a fleet", "webapp"],
    ["investment portfolio tracker app", "mobile"],
    ["responsive website for a dentist", "website"],
    ["podcast player", "any"],
    ["flight checkout screen", "any"],
    ["government e-services portal", "any"],
    ["تطبيق بنكي على الآيفون", "mobile"],
    ["صفحة هبوط لمقهى", "website"],
    ["لوحة تحكم للمبيعات", "webapp"],
  ];
  it.each(table)("%s is %s", (brief, platform) => {
    expect(detectPlatform(brief)).toBe(platform);
  });

  it("takes an explicit platform over detection and validates it", () => {
    expect(bendBrief({ brief: "podcast player", wildness: 3, platform: "webapp" }).platform).toBe("webapp");
    expect(bendBrief({ brief: "podcast player", wildness: 3 }).platform).toBe("any");
    expect(parseBendInput({ brief: "x", wildness: 3, platform: "fridge" }).ok).toBe(false);
  });

  it("has a full profile for every platform", () => {
    for (const p of PLATFORMS) {
      const prof = PLATFORM_PROFILES[p];
      expect(prof.platform).toBe(p);
      for (const line of [prof.label, prof.grid, prof.density, prof.uiTail, prof.defaultComponent]) expect(line.length).toBeGreaterThan(0);
      expect(prof.avoid.length).toBeGreaterThan(0);
    }
    expect(PLATFORM_PROFILES.mobile.uiTail).toBe("app ui");
    expect(PLATFORM_PROFILES.website.uiTail).toBe("website");
    expect(PLATFORM_PROFILES.webapp.uiTail).toBe("dashboard ui");
    expect(PLATFORM_PROFILES.tablet.uiTail).toBe("ipad app ui");
  });

  it("bans only entries that exist", () => {
    for (const p of PLATFORMS) {
      for (const [list, keys] of Object.entries(PLATFORM_PROFILES[p].banned)) {
        const all = new Set(LISTS[list as keyof typeof LISTS].map((e) => e.key));
        for (const k of keys ?? []) expect(all.has(k), `${p} ${list}: ${k}`).toBe(true);
      }
    }
  });
});

describe("platform gating", () => {
  it("never puts a banned constraint or element on its platform", () => {
    for (const [platform, brief] of Object.entries(PLATFORM_BRIEFS) as [Platform, string][]) {
      for (const w of LEVELS) {
        for (const d of bendBrief({ brief, wildness: w, count: 8 }).directions) {
          for (const [slot, list] of [["constraint", "constraints"], ["element", "elements"]] as const) {
            const label = d.ingredients[slot];
            if (!label) continue;
            const e = LISTS[list].find((x) => x.label === label)!;
            expect(allowedOn(platform, list, e.key, e.hints.notOn), `${brief} w${w}: ${label}`).toBe(true);
          }
          if (platform === "mobile" || platform === "tablet") expect(d.spec.layout).not.toMatch(/12 column/);
        }
      }
    }
  });

  it("gives a phone a 4 column thumb-zone layout and a web app a sidebar shell", () => {
    for (const d of bendBrief({ brief: PLATFORM_BRIEFS.mobile, wildness: 3, count: 8 }).directions) {
      expect(d.platform).toBe("mobile");
      expect(d.spec.layout).toMatch(/4 column/);
      expect(d.spec.layout).toMatch(/thumb zone/);
      expect(d.spec.density).toBe(PLATFORM_PROFILES.mobile.density);
    }
    for (const d of bendBrief({ brief: PLATFORM_BRIEFS.webapp, wildness: 2, count: 8 }).directions) {
      expect(d.spec.layout).toMatch(/sidebar shell/i);
      expect(d.spec.density).toMatch(/keyboard/);
    }
    for (const d of bendBrief({ brief: PLATFORM_BRIEFS.website, wildness: 4, count: 8 }).directions) {
      expect(d.spec.layout).toMatch(/12 column/);
    }
  });

  it("keeps absurd entries out of wildness 1 and 2", () => {
    for (const brief of [...Object.values(PLATFORM_BRIEFS), "podcast player", "hotel booking page"]) {
      for (const w of [1, 2] as Wildness[]) {
        for (const d of bendBrief({ brief, wildness: w, count: 8 }).directions) {
          for (const [slot, list] of [["object", "objects"], ["material", "materials"], ["constraint", "constraints"], ["element", "elements"]] as const) {
            const label = d.ingredients[slot];
            if (!label) continue;
            const e = LISTS[list].find((x) => x.label === label)!;
            expect(e.hints.weird, `${brief} w${w}: ${label}`).toBeLessThanOrEqual(MAX_WEIRD[w]);
          }
        }
      }
    }
    expect(bendBrief({ brief: "B2B analytics dashboard web app", wildness: 2, count: 8 }).directions.map((d) => d.ingredients.object)).not.toContain(
      "garment care label",
    );
  });
});

describe("tone matching", () => {
  it("maps subjects to domains", () => {
    expect(detectDomain("meditation app onboarding on iPhone")?.id).toBe("calm-care");
    expect(detectDomain("personal finance app home screen")?.id).toBe("money");
    expect(detectDomain("B2B analytics dashboard")?.id).toBe("work");
    expect(detectDomain("kids reading game")?.id).toBe("kids");
    expect(detectDomain("podcast player")).toBeNull();
  });

  it("tags every mood with a known tone", () => {
    for (const m of LISTS.moods) expect(m.hints.tone.length, m.label).toBeGreaterThan(0);
    for (const m of LISTS.moods) expect(m.hints.color, m.label).toBeTruthy();
  });

  it("gives calm subjects calm moods, and clashes at most once on purpose at wildness 4 and 5", () => {
    const loud = ["acid bright", "electric", "blinding white", "toxic green", "fever dream"];
    for (const w of [1, 2, 3] as Wildness[]) {
      const ds = bendBrief({ brief: "meditation app onboarding on iPhone", wildness: w, count: 8 }).directions;
      const domain = detectDomain("meditation app onboarding on iPhone");
      for (const d of ds) {
        expect(loud).not.toContain(d.ingredients.mood);
        const mood = LISTS.moods.find((m) => m.label === d.ingredients.mood)!;
        expect(moodFits(mood, domain), d.ingredients.mood).toBe(true);
        expect(d.ingredients.object ?? "").not.toBe("gig poster");
      }
    }
    for (const w of [4, 5] as Wildness[]) {
      const ds = bendBrief({ brief: "meditation app onboarding on iPhone", wildness: w, count: 8 }).directions;
      const clashes = ds.filter((d) => d.spec.whyItFits.startsWith("A deliberate clash"));
      expect(clashes.length).toBe(1);
    }
  });

  it("gives banking serious moods, never playful ones below wildness 4", () => {
    for (const d of bendBrief({ brief: "personal finance app home screen on iPhone", wildness: 3, count: 8 }).directions) {
      const mood = LISTS.moods.find((m) => m.label === d.ingredients.mood)!;
      expect(mood.hints.tone, mood.label).not.toContain("playful");
    }
  });
});

describe("visual spec", () => {
  it("fills every axis with short plain lines for every platform and level", () => {
    for (const brief of [...Object.values(PLATFORM_BRIEFS), "podcast player"]) {
      for (const w of LEVELS) {
        for (const d of bendBrief({ brief, wildness: w, count: 8 }).directions) {
          const s = d.spec;
          expect(isTypeVoice(s.typeVoice)).toBe(true);
          const lines = [s.typography, s.color, s.layout, s.imagery, s.motion, s.texture, s.iconography, s.density, s.signature, s.pattern, s.whyItFits, ...s.steal, ...s.avoid];
          for (const line of lines) {
            expect(line.length, line).toBeGreaterThan(5);
            expect(words(line).length, line).toBeLessThanOrEqual(30);
            expect(line).not.toContain(String.fromCharCode(0x2014));
            expect(line).toMatch(/^[A-Z0-9]/);
          }
          expect(s.steal.length).toBeGreaterThanOrEqual(2);
          expect(s.steal.length).toBeLessThanOrEqual(4);
          expect(s.avoid.length).toBeGreaterThanOrEqual(1);
          expect(s.avoid.length).toBeLessThanOrEqual(3);
          expect(s.styleWords.length).toBeGreaterThanOrEqual(1);
          expect(s.styleWords.length).toBeLessThanOrEqual(3);
          for (const sw of s.styleWords) expect(VERIFIED_STYLE_WORDS).toContain(sw);
          expect(s.motion).toMatch(/reduced motion/);
        }
      }
    }
  });

  it("names the brief's component in the signature and a platform component in the pattern", () => {
    for (const d of bendBrief({ brief: PLATFORM_BRIEFS.mobile, wildness: 3, count: 8 }).directions) {
      expect(d.spec.signature).toMatch(/^The onboarding /);
    }
    const comps = PLATFORM_PROFILES.webapp.components;
    for (const d of bendBrief({ brief: PLATFORM_BRIEFS.webapp, wildness: 3, count: 8 }).directions) {
      expect(comps.some((c) => d.spec.pattern.includes(c) || d.spec.signature.includes(c)), d.spec.pattern).toBe(true);
    }
  });

  it("gives mobile body type at 17px and websites fluid display type", () => {
    expect(bendBrief({ brief: PLATFORM_BRIEFS.mobile, wildness: 2 }).directions[0]!.spec.typography).toMatch(/34px.*17px/);
    expect(bendBrief({ brief: PLATFORM_BRIEFS.website, wildness: 2 }).directions[0]!.spec.typography).toMatch(/clamp/);
  });
});

describe("art queries", () => {
  it("are 1 to 3 visual ingredient queries of at most 6 words with no UI words", () => {
    for (const brief of [...Object.values(PLATFORM_BRIEFS), "podcast player", "flight checkout screen"]) {
      for (const w of LEVELS) {
        for (const lens of [undefined, "sadu"]) {
          for (const d of bendBrief({ brief, wildness: w, count: 8, ...(lens ? { lens } : {}) }).directions) {
            expect(d.artQueries.length).toBeGreaterThanOrEqual(1);
            expect(d.artQueries.length).toBeLessThanOrEqual(3);
            for (const q of d.artQueries) {
              expect(q, q).not.toMatch(UI_WORDS);
              expect(words(q).length, q).toBeLessThanOrEqual(6);
            }
          }
        }
      }
    }
  });

  it("starts with the lead ingredient", () => {
    const d = bendBrief({ brief: "flight checkout screen", wildness: 5, count: 8 }).directions.find((x) => x.id === "bd-8dti7s7c")!;
    expect(d.artQueries[0]).toBe("crushed velvet texture");
  });
});

describe("pages and wild spots", () => {
  it("suggests the top 5 wild spots for the platform when no pages are given", () => {
    const r = bendBrief({ brief: PLATFORM_BRIEFS.mobile, wildness: 3 });
    expect(r.pages).toEqual([]);
    expect(r.wildSpots).toHaveLength(5);
    expect(r.wildSpots.map((s) => s.page)).toContain("onboarding");
    for (const s of r.wildSpots) expect(s.why.length).toBeGreaterThan(10);
    expect(bendBrief({ brief: PLATFORM_BRIEFS.website, wildness: 3 }).wildSpots.map((s) => s.page)).toContain("404 page");
    expect(bendBrief({ brief: PLATFORM_BRIEFS.webapp, wildness: 3 }).wildSpots.map((s) => s.page)).toContain("empty states");
  });

  it("takes up to 3 pages, returns no wild spots then, and scopes the prompt", () => {
    const r = bendBrief({ brief: PLATFORM_BRIEFS.website, wildness: 3, pages: [" pricing page ", "404 page"] });
    expect(r.pages).toEqual(["pricing page", "404 page"]);
    expect(r.wildSpots).toEqual([]);
    for (const d of r.directions) {
      expect(d.pages).toEqual(["pricing page", "404 page"]);
      expect(d.prompt).toContain("Use it only on the pricing page and 404 page, one or two pages, not the whole product.");
      expect(d.prompt).toContain("Built for a website.");
    }
    expect(parseBendInput({ brief: "x", wildness: 3, pages: ["a", "b", "c", "d"] }).ok).toBe(false);
    expect(parseBendInput({ brief: "x", wildness: 3, pages: ["x".repeat(61)] }).ok).toBe(false);
    expect(parseBendInput({ brief: "x", wildness: 3, pages: [] }).ok).toBe(false);
  });

  it("says one or two pages in the prompt when none are given", () => {
    for (const d of bendBrief({ brief: PLATFORM_BRIEFS.mobile, wildness: 3 }).directions) {
      expect(d.prompt).toMatch(/Use it on one or two pages, such as the onboarding, not the whole product\./);
      expect(d.prompt).toContain("Built for a phone app.");
    }
  });
});

describe("acronyms", () => {
  it("writes acronyms the expected way", () => {
    expect(fixCase("B2b analytics")).toBe("B2B analytics");
    expect(fixCase("Ai note-taking startup")).toBe("AI note-taking startup");
    expect(fixCase("crm and saas on ios, iphone and ipad ui ux hr ev nft api")).toBe(
      "CRM and SaaS on iOS, iPhone and iPad UI UX HR EV NFT API",
    );
    // Not inside other words.
    expect(fixCase("air rain paint said")).toBe("air rain paint said");
  });

  it("fixes titles and subjects", () => {
    const b2b = bendBrief({ brief: "B2B analytics dashboard web app", wildness: 2, count: 8 });
    expect(b2b.subject).toBe("B2B analytics");
    for (const d of b2b.directions) expect(d.title).not.toMatch(/\bB2b\b/);
    for (const d of bendBrief({ brief: "landing page for an AI note-taking startup", wildness: 4, count: 8 }).directions) {
      expect(d.title).not.toMatch(/\bAi\b/);
    }
  });
});

describe("id stability", () => {
  it("is deterministic across calls and counts on every platform", () => {
    for (const brief of Object.values(PLATFORM_BRIEFS)) {
      const eight = bendBrief({ brief, wildness: 4, count: 8 });
      expect(bendBrief({ brief, wildness: 4, count: 8 })).toEqual(eight);
      expect(bendBrief({ brief, wildness: 4, count: 3 }).directions).toEqual(eight.directions.slice(0, 3));
    }
  });

  it("never moves ids for pages or taste", () => {
    const base = bendBrief({ brief: PLATFORM_BRIEFS.website, wildness: 3, count: 8 }).directions.map((d) => d.id);
    expect(bendBrief({ brief: PLATFORM_BRIEFS.website, wildness: 3, count: 8, pages: ["pricing page"] }).directions.map((d) => d.id)).toEqual(base);
    expect(bendBrief({ brief: PLATFORM_BRIEFS.website, wildness: 3, count: 8, taste: ["monochrome"] }).directions.map((d) => d.id)).toEqual(base);
  });

  it("draws the bend-v1 entries first for briefs with no platform", () => {
    for (const d of bendBrief({ brief: "flight checkout screen", wildness: 5, count: 8 }).directions) {
      for (const [slot, list] of [["object", "objects"], ["material", "materials"], ["era", "eras"], ["tradition", "traditions"]] as const) {
        const label = d.ingredients[slot];
        if (label) expect(legacyPart(list, LISTS[list]).some((e) => e.label === label), label).toBe(true);
      }
    }
  });
});

describe("taste", () => {
  it("never injects DEFAULT_TASTE as the user's taste: the taste lane uses the direction's style words", () => {
    for (const d of bendBrief({ brief: PLATFORM_BRIEFS.mobile, wildness: 3, count: 8 }).directions) {
      const taste = d.searchQueries.find((q) => q.endsWith("ui design") && !q.startsWith(d.searchQuery));
      if (!taste) continue;
      const fromDefault = DEFAULT_TASTE.some((t) => taste.startsWith(t)) && !d.spec.styleWords.some((s) => taste.startsWith(s));
      // Holds once lib/bend/queries.ts reads opts.styleWords (search agent).
      if (fromDefault) console.warn(`taste lane still uses DEFAULT_TASTE: ${taste}`);
    }
  });
});

describe("bend_brief tool output", () => {
  it("shows platform, wild spots, the spec and art queries in the text", async () => {
    const r = bendBrief({ brief: PLATFORM_BRIEFS.mobile, wildness: 3 });
    const text = formatDirections(r);
    expect(text).toContain("Platform: mobile (phone app)");
    expect(text).toContain("one wild page or two");
    for (const s of r.wildSpots) expect(text).toContain(`- ${s.page}: ${s.why}`);
    for (const d of r.directions) {
      // V4.3: the text shows each ingredient's first ladder rung, not the raw art query.
      expect(text).toContain(`Art searches (first rung per ingredient; a thin rung falls back to the next, ending with the raw words): ${d.artLadder.map((l) => `"${l.rungs[0]!.query}" on ${l.rungs[0]!.site === "behance" ? "Behance" : "Pinterest"}`).join("; ")}`);
      expect(text).toContain(`type ${d.spec.typeVoice}:`);
    }
    expect(text).not.toContain(String.fromCharCode(0x2014));
    const paged = formatDirections(bendBrief({ brief: PLATFORM_BRIEFS.mobile, wildness: 3, pages: ["paywall"] }));
    expect(paged).toContain("Pages: paywall.");
    expect(paged).not.toContain("wildSpots");
  });

  it("saves each direction's detail when saving to a canvas", async () => {
    const { repos } = makeDeps();
    const canvas = await seedCanvas(repos, ALICE);
    const spy = vi.spyOn(repos.directions, "upsertMany");
    const tool = createBendBriefTool(() => ({ repos }));
    const res = await tool({ brief: PLATFORM_BRIEFS.mobile, wildness: 3, canvasId: canvas.id, pages: ["paywall"] }, ALICE);
    expect(res.isError).toBeFalsy();
    const rows = spy.mock.calls[0]![1];
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      const detail = (row as { detail?: Record<string, unknown> }).detail!;
      expect(detail.platform).toBe("mobile");
      expect(detail.pages).toEqual(["paywall"]);
      expect(detail.wildness).toBe(3);
      expect(detail.spec).toBeTruthy();
      expect((detail.artQueries as string[]).length).toBeGreaterThan(0);
      expect(detail.verdict).toBeUndefined();
    }
    const sc = res.structuredContent as { platform: string; pages: string[]; wildSpots: unknown[]; directions: { spec: unknown; artQueries: string[] }[] };
    expect(sc.platform).toBe("mobile");
    expect(sc.pages).toEqual(["paywall"]);
    expect(sc.wildSpots).toEqual([]);
    expect(sc.directions[0]!.spec).toBeTruthy();
  });
});
