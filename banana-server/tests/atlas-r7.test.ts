/**
 * Refinement R7: expected leads give way on wild briefs, Atlas directions spread their searches over
 * sources with Dribbble capped, and Frankenstein pages made for a direction say where the idea goes.
 */
import { describe, expect, it } from "vitest";
import { EXPECTED_BASE, EXPECTED_STEP, expectedPenalty, isExpectedCard, spreadByStyle } from "@/lib/atlas/bend";
import { DRIBBBLE_CAP, spreadSources } from "@/lib/atlas/search";
import type { StitchRowSnapshot } from "@/lib/canvas/types";
import { mergeLanes, type PlannedRequest } from "@/lib/sources/plan";
import type { LaneName, Reference } from "@/lib/sources/types";
import { bendLines } from "@/lib/stitch/bend-lines";

describe("expected leads (R7)", () => {
  it("marks screen-native families and default main styles, not cards from outside the design canon", () => {
    expect(isExpectedCard({ family: "data marks", region: "global" })).toBe(true); // Ruler Ticks, Tally Marks
    expect(isExpectedCard({ family: "digital and internet", region: "global" })).toBe(true); // Dark Mode SaaS 2021
    expect(isExpectedCard({ family: "early modernism and avant-garde", region: "europe", styles: ["minimal-mono-light"] })).toBe(true); // Swiss Style 1960s
    expect(isExpectedCard({ family: "glyphs and punctuation", region: "mena" })).toBe(false); // Eastern Arabic Digits
    expect(isExpectedCard({ family: "board or sign", region: "global", styles: ["hero-numeral", "dark-luminous"] })).toBe(false); // second style only
    expect(isExpectedCard({ family: "dial, panel or machine", region: "global", styles: ["retro-pixel-halftone"] })).toBe(false);
  });

  it("costs more on a wilder brief", () => {
    const c = { family: "marks and stamps", region: "global" };
    expect(expectedPenalty(c, 1)).toBeCloseTo(EXPECTED_BASE);
    expect(expectedPenalty(c, 5)).toBeCloseTo(EXPECTED_BASE + 4 * EXPECTED_STEP);
    expect(expectedPenalty({ family: "metal", region: "global" }, 5)).toBe(0);
  });

  it("never takes a front place for its style when demoted", () => {
    const leads = [
      { id: "a", styles: ["hero-numeral"] },
      { id: "b", styles: ["hero-numeral"] },
      { id: "dark", styles: ["dark-luminous"] },
      { id: "c", styles: ["dark-quiet-matte"] },
    ];
    expect(spreadByStyle(leads, 3).slice(0, 3).map((l) => l.id)).toEqual(["a", "dark", "c"]);
    expect(spreadByStyle(leads, 3, (l) => l.id === "dark").slice(0, 3).map((l) => l.id)).toEqual(["a", "c", "b"]);
  });
});

const req = (lane: LaneName, query: string, site: PlannedRequest["site"], page?: number): PlannedRequest => ({ lane, query, site, ...(page ? { page } : {}) });

describe("source spread (R7)", () => {
  it("keeps at most 40% of the UI requests on Dribbble, moving deep pages and component lanes to Pinterest first", () => {
    const plan = [
      req("taste", "dark esim plan ui ios app", "pinterest"),
      req("art", "gas station price sign", "pinterest"),
      req("bridge", "gas station price sign plan cards app ui", "dribbble"),
      req("art", "gas station price sign", "behance"),
      req("fidelity", "esim plan app ui", "dribbble"),
      req("fidelity", "esim plan app ui", "dribbble", 2),
      req("component", "esim plan cards app ui", "dribbble"),
    ];
    const out = spreadSources(plan, { art: ["gas station price sign", "lit price tiles"] });
    const ui = out.filter((r) => r.lane !== "art");
    expect(ui.filter((r) => r.site === "dribbble").length).toBeLessThanOrEqual(Math.floor(5 * 0.4));
    expect(out.find((r) => r.lane === "bridge")!.site).toBe("dribbble");
    expect(out.find((r) => r.lane === "component")!.site).toBe("pinterest");
    expect(out.some((r) => r.lane === "fidelity" && r.site === "pinterest" && !r.page)).toBe(true);
    // Art: the same two places, both art queries on Pinterest before Behance.
    expect(out.filter((r) => r.lane === "art").map((r) => [r.site, r.query.split(" -")[0]])).toEqual([
      ["pinterest", "gas station price sign"],
      ["pinterest", "lit price tiles"],
    ]);
    expect(out.length).toBeLessThanOrEqual(plan.length);
  });

  it("leaves a request out rather than send the same Pinterest request twice", () => {
    const plan = [req("fidelity", "banking onboarding app ui", "dribbble"), req("fidelity", "banking onboarding app ui", "pinterest"), req("component", "banking onboarding app ui", "dribbble")];
    const out = spreadSources(plan, {});
    expect(out.filter((r) => r.site === "pinterest" && r.query === "banking onboarding app ui")).toHaveLength(1);
  });
});

describe("Dribbble cap in the merge (R7)", () => {
  const ref = (lane: LaneName, site: string, i: number): Reference =>
    ({ id: `${lane}-${site}-${i}`, lane, zone: lane === "art" ? "art" : "ui", sourceSite: site, sourceUrl: `https://${site}/${lane}/${i}`, imageUrl: `https://img.test/${lane}/${site}/${i}.png`, thumbUrl: "" }) as Reference;
  const keyOf = (r: Reference) => [r.sourceUrl];

  it("fills the UI places from other sources once Dribbble has its share", () => {
    const lists = new Map<LaneName, Reference[]>([
      ["fidelity", [0, 1, 2, 3, 4, 5].map((i) => ref("fidelity", "dribbble.com", i))],
      ["taste", [0, 1, 2, 3, 4, 5].map((i) => ref("taste", "pinterest.com", i))],
    ]);
    const quotas = new Map<LaneName, number>([["fidelity", 4], ["taste", 4]]);
    const out = mergeLanes(lists, quotas, 8, keyOf, { siteCap: DRIBBBLE_CAP });
    expect(out).toHaveLength(8);
    expect(out.filter((r) => r.sourceSite === "dribbble.com")).toHaveLength(3);
    expect(mergeLanes(lists, quotas, 8, keyOf).filter((r) => r.sourceSite === "dribbble.com")).toHaveLength(4);
  });

  it("lets Dribbble fill UI places nothing else can, before art takes them", () => {
    const lists = new Map<LaneName, Reference[]>([
      ["fidelity", [0, 1, 2, 3, 4, 5, 6].map((i) => ref("fidelity", "dribbble.com", i))],
      ["taste", [0].map((i) => ref("taste", "pinterest.com", i))],
      ["art", [0, 1, 2, 3, 4, 5].map((i) => ref("art", "pinterest.com", i))],
    ]);
    const quotas = new Map<LaneName, number>([["fidelity", 4], ["taste", 4], ["art", 4]]);
    const out = mergeLanes(lists, quotas, 12, keyOf, { siteCap: DRIBBBLE_CAP });
    expect(out.filter((r) => r.zone === "ui")).toHaveLength(8);
    expect(out.filter((r) => r.zone === "art")).toHaveLength(4);
  });
});

describe("Bend it lines on a Frankenstein page (R7)", () => {
  const row = (i: number, role: StitchRowSnapshot["slots"][number]["role"]): StitchRowSnapshot => ({
    id: `rw-${i}`,
    slots: [{ id: `sl-${i}`, role, partId: `pt-${i}`, imageUrl: "https://img.test/a.png", sourceUrl: "https://dribbble.com/shots/1-a", sourceSite: "dribbble.com", crop: { x: 0, y: 0, w: 1, h: 1 } }],
  });
  const rows = [row(1, "status-header"), row(2, "hero"), row(3, "cards"), row(4, "cta")];

  it("points each page part of the idea at its slot, and names the slot to add", () => {
    const lines = bendLines(
      {
        element: "plan",
        how: "Plan is a tall price tile",
        parts: [
          { element: "paywall-plan", label: "plan cards", how: "Plan is a tall price tile, big price in white" },
          { element: "hero", label: "destination", how: "Hero is one lightbox panel" },
          { element: "list-row", label: "plan details", how: "Each row is a slim lit tile" },
        ],
        task: "The main task now runs through the plan cards",
      },
      rows,
    );
    expect(lines[0]).toMatch(/^ +Bend it/);
    expect(lines).toContain("    - plan cards: slot sl-3 (cards). Rebuild it as: Plan is a tall price tile, big price in white.");
    expect(lines).toContain("    - destination: slot sl-2 (hero). Rebuild it as: Hero is one lightbox panel.");
    expect(lines.some((l) => l.includes("plan details: no slot holds it yet; add a list slot"))).toBe(true);
    expect(lines.at(-1)).toBe("    - The main task now runs through the plan cards.");
  });

  it("says nothing without a direction", () => {
    expect(bendLines(undefined, rows)).toEqual([]);
  });
});
