/** Regressions from live boards (2026-10-11): wrong domain on long briefs, raw ideas (suzani jackets) on boards, repeated ideas. */
import { describe, expect, it } from "vitest";
import { fidelityQuery, laneTexts } from "@/lib/bend/queries";
import { planRequests } from "@/lib/sources/plan";
import { hasUiWord } from "@/lib/sources/quality";
import { createBendBriefTool } from "@/lib/mcp/tools/bend_brief";

const BANKING =
  "Retail banking mobile app homepage: balance, accounts, quick actions (transfer, pay bills, cards), recent transactions, spending insight. GCC market, Arabic RTL and English. Push past the standard card-stack-plus-list layout into bold, unexpected territory.";

describe("domain comes from the opening clause", () => {
  it("long banking brief searches banking, not the last sentence", () => {
    expect(fidelityQuery(BANKING)).toBe("retail banking app ui");
    const lanes = laneTexts(BANKING, "city pop 1985", ["minimal"], "k");
    expect(lanes.taste).toContain("banking");
    expect(lanes.hero).toContain("banking");
    expect(JSON.stringify(lanes)).not.toContain("territory");
  });

  it("core noun skips generic last words", () => {
    expect(laneTexts("Ramadan prayer times widget for a Saudi banking app", "x", ["minimal"], "k").fidelityCore).toBe("prayer app ui");
  });
});

describe("wild ideas never become raw searches", () => {
  it("every request of a direction is a UI form; the idea only reaches the title-filtered bridge lane", () => {
    for (const idea of ["Uzbek suzani", "gas station sign", "teletext 1980s", "airline logo"]) {
      const plan = planRequests(laneTexts(BANKING, idea, [], "k"));
      expect(plan.length).toBeGreaterThan(0);
      for (const r of plan) expect(hasUiWord(r.query), r.query).toBe(true);
      expect(plan.some((r) => r.site === "behance")).toBe(false);
      const withIdea = plan.filter((r) => r.query.toLowerCase().includes(idea.split(" ")[0]!.toLowerCase()));
      expect(withIdea.every((r) => r.lane === "bridge" && r.titleWord)).toBe(true);
    }
  });
});

describe("new boards do not repeat the ideas of the user's last boards", () => {
  it("a lead used on a recent canvas sinks on the next bend", async () => {
    const { makeDeps, seedCanvas, ALICE } = await import("./tools-fixtures");
    const { bendBrief } = await import("@/lib/bend");
    const { repos } = makeDeps();
    const brief = { brief: "Retail banking mobile app homepage", wildness: 4 as const, count: 6 };
    const first = bendBrief(brief).directions.map((d) => d.searchQuery);
    const old = await seedCanvas(repos, ALICE);
    await repos.directions.upsertMany(old.id, first.map((q, i) => ({ bendId: `bd-old${i}`, move: "material", title: q, searchQuery: q })));
    const bend = createBendBriefTool(() => ({ repos }));
    const res = await bend(brief, ALICE);
    const next = (res.structuredContent as { directions: { searchQuery: string }[] }).directions.map((d) => d.searchQuery);
    const repeats = next.filter((q) => first.includes(q)).length;
    expect(repeats).toBeLessThanOrEqual(1);
  });
});
