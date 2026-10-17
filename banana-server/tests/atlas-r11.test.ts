/**
 * R11 region rule: a regional card leads only a brief in its region or one that names its culture.
 * Global cards lead anywhere; any card may still be the second card (the twist).
 */
import { describe, expect, it } from "vitest";
import { briefRegions, regionLeadOk } from "@/lib/atlas/brief-fit";
import { briefMarket } from "@/lib/bend/market";

const regionsOf = (brief: string) => briefRegions(brief, briefMarket(brief));
const leads = (region: string | undefined, brief: string) => regionLeadOk({ region }, regionsOf(brief));

describe("R11 region rule for leads", () => {
  it("keeps a Gulf or Arab card off the lead of a global brief", () => {
    expect(leads("mena", "pricing page for a B2B analytics SaaS")).toBe(false);
    expect(leads("gulf", "coffee shop landing page")).toBe(false);
  });

  it("lets Gulf and Arab cards lead a Gulf brief", () => {
    expect(leads("mena", "prepaid telecom app home screen for Saudi users")).toBe(true);
    expect(leads("gulf", "food delivery app home for Riyadh")).toBe(true);
  });

  it("keeps an unrelated foreign culture off the lead of a Gulf brief", () => {
    expect(leads("east-asia", "food delivery app home for Riyadh: browse nearby restaurants")).toBe(false);
    expect(leads("europe", "villa developer home page in Dammam")).toBe(false);
  });

  it("lets a card lead when the brief is in its region or names its culture", () => {
    expect(leads("europe", "property portal home page for buyers in London")).toBe(true);
    expect(leads("east-asia", "menu page for a Japanese ramen bar")).toBe(true);
    expect(leads("east-asia", "Japanese restaurant delivery app home for Riyadh")).toBe(true);
    expect(leads("east-africa", "Ethiopian coffee roaster landing page")).toBe(true);
    expect(leads("east-africa", "coffee shop landing page")).toBe(false);
  });

  it("lets global cards lead anywhere", () => {
    for (const brief of ["coffee shop landing page", "food delivery app home for Riyadh", "pricing page for a B2B analytics SaaS"]) {
      expect(leads("global", brief)).toBe(true);
      expect(leads(undefined, brief)).toBe(true);
    }
  });

  it("is deterministic and reads whole words only", () => {
    expect([...regionsOf("food delivery app home for Riyadh")].sort()).toEqual(["gulf", "mena"]);
    expect([...regionsOf("coffee shop landing page")]).toEqual([]);
    // "used" and "bus" are not "us"; "parish" is not "paris".
    expect(regionsOf("a parish newsletter used by bus riders").size).toBe(0);
  });
});
