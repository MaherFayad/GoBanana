import { afterEach, describe, expect, it, vi } from "vitest";
import { betaPlan, effectivePlan, isPaid, limitsFor, PLAN_LIMITS } from "@/lib/quota";

afterEach(() => vi.unstubAllEnvs());

describe("BETA_PLAN override", () => {
  it("is off by default: free stays free", () => {
    vi.stubEnv("BETA_PLAN", "");
    expect(effectivePlan("free")).toBe("free");
    expect(limitsFor("free")).toBe(PLAN_LIMITS.free);
    expect(isPaid("free")).toBe(false);
  });

  it("BETA_PLAN=pro gives free users Pro monthly limits", () => {
    vi.stubEnv("BETA_PLAN", "pro");
    expect(betaPlan()).toBe("pro_monthly");
    expect(effectivePlan("free")).toBe("pro_monthly");
    expect(effectivePlan(null)).toBe("pro_monthly");
    expect(limitsFor("free")).toBe(PLAN_LIMITS.pro_monthly);
    expect(isPaid("free")).toBe(true);
  });

  it("never changes a paid plan", () => {
    vi.stubEnv("BETA_PLAN", "pro");
    expect(effectivePlan("founding")).toBe("founding");
    expect(limitsFor("founding")).toBe(PLAN_LIMITS.founding);
  });

  it("ignores unknown or free values", () => {
    vi.stubEnv("BETA_PLAN", "platinum");
    expect(betaPlan()).toBeNull();
    vi.stubEnv("BETA_PLAN", "free");
    expect(betaPlan()).toBeNull();
  });
});
