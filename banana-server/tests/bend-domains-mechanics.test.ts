/** AI agent and travel briefs get their own domain, and a screen with no total never gets a total mechanic. */
import { describe, expect, it } from "vitest";
import { bendBrief, detectDomain, isTransaction, type BendInput } from "@/lib/bend";

const AI_DASHBOARD = { brief: "AI agent dashboard where teams supervise autonomous support agents", platform: "webapp", pages: ["agent activity view"] } as const;
const AI_ONBOARDING = { brief: "AI writing assistant chat app onboarding", platform: "mobile", pages: ["onboarding"] } as const;
const AI_LAUNCH = { brief: "Launch page for an AI coding agent startup", platform: "website", pages: ["launch page"] } as const;
const FLIGHT = { brief: "Flight checkout for a Saudi travel app", platform: "mobile", pages: ["checkout"] } as const;

const bend = (b: { brief: string; platform: BendInput["platform"]; pages: readonly string[] }) =>
  bendBrief({ brief: b.brief, platform: b.platform, pages: [...b.pages], wildness: 3, count: 8 });

describe("domains: ai-agents and travel", () => {
  it("detects ai-agents for AI briefs and travel for a flight brief", () => {
    for (const b of [AI_DASHBOARD, AI_ONBOARDING, AI_LAUNCH]) expect(detectDomain(b.brief)?.id).toBe("ai-agents");
    expect(detectDomain(FLIGHT.brief)?.id).toBe("travel");
    expect(detectDomain("AI-powered notes")?.id).toBe("ai-agents");
  });

  it("matches whole words only", () => {
    expect(detectDomain("rain gauge for a maid service")).toBeNull();
    expect(detectDomain("podcast player")).toBeNull();
  });

  it("leaves hotels with luxury and verticals ahead of AI", () => {
    expect(detectDomain("luxury hotel booking")?.id).toBe("luxury");
    expect(detectDomain("AI budgeting app for families")?.id).toBe("money");
  });
});

describe("mechanic: total and main button only on transactions", () => {
  it("counts pages, not only the brief", () => {
    expect(isTransaction("podcast player stats")).toBe(false);
    expect(isTransaction("podcast player stats", ["Plans"])).toBe(true);
    expect(isTransaction("music app paywall")).toBe(true);
  });

  it.each([AI_DASHBOARD, AI_ONBOARDING])("never lands on the total or main button for $brief", (b) => {
    const ds = bend(b).directions;
    expect(ds.length).toBeGreaterThan(0);
    for (const d of ds) expect(["total", "cta"]).not.toContain(d.mechanic.element);
  });

  it("still bends a flight checkout", () => {
    expect(bend(FLIGHT).directions.length).toBeGreaterThan(0);
  });
});
