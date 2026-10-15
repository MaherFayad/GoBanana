import { describe, expect, it } from "vitest";
import {
  EXPORT_FORMATS,
  PLAN_LIMITS,
  allowedExportFormats,
  canAddItems,
  canCreateCanvas,
  canSearch,
  checkSearchQuota,
  createMemoryUsageStore,
  currentPeriod,
  exportLimitMessage,
  nextPeriodStart,
  planOf,
  splitExportFormats,
} from "@/lib/quota";

const opts = { upgradeUrl: "https://example.test/pricing", now: new Date("2026-10-31T23:59:59Z") };

describe("plan table (spec section 12)", () => {
  it.each([
    ["free", 30, 3, 40],
    ["pro_monthly", 300, Infinity, 300],
    ["pro_yearly", 300, Infinity, 300],
    ["founding", 200, Infinity, 300],
  ] as const)("%s: %i searches, %s canvases, %i items", (plan, searches, canvases, items) => {
    expect(PLAN_LIMITS[plan].searchesPerMonth).toBe(searches);
    expect(PLAN_LIMITS[plan].canvases).toBe(canvases);
    expect(PLAN_LIMITS[plan].itemsPerCanvas).toBe(items);
    expect(PLAN_LIMITS[plan].shareLinks).toBe(plan !== "free");
    expect(PLAN_LIMITS[plan].uploads).toBe(plan !== "free");
  });

  it("treats unknown plans as free", () => {
    expect(planOf("enterprise")).toBe("free");
    expect(planOf(undefined)).toBe("free");
    expect(planOf("founding")).toBe("founding");
  });
});

describe("canSearch", () => {
  it.each([
    ["free", 30],
    ["pro_monthly", 300],
    ["pro_yearly", 300],
    ["founding", 200],
  ] as const)("%s allows %i searches a month", (plan, limit) => {
    expect(canSearch(plan, 0, opts)).toEqual({ ok: true, limit, remaining: limit });
    expect(canSearch(plan, limit - 1, opts)).toEqual({ ok: true, limit, remaining: 1 });
    const over = canSearch(plan, limit, opts);
    expect(over.ok).toBe(false);
    expect(canSearch(plan, limit + 5, opts).ok).toBe(false);
  });

  it("uses the plain upgrade message on free", () => {
    const r = canSearch("free", 30, opts);
    expect(r.ok === false && r.message).toBe(
      "You have used your 30 free searches this month. Upgrade: https://example.test/pricing",
    );
  });

  it("tells paid users when searches reset", () => {
    const r = canSearch("founding", 200, opts);
    expect(r.ok === false && r.message).toBe("You have used your 200 searches this month. They reset on November 1.");
    const dec = canSearch("pro_yearly", 300, { ...opts, now: new Date("2026-12-10T00:00:00Z") });
    expect(dec.ok === false && dec.message).toContain("January 1");
  });
});

describe("canCreateCanvas", () => {
  it("caps free at 3", () => {
    expect(canCreateCanvas("free", 2, opts)).toEqual({ ok: true, limit: 3, remaining: 1 });
    const r = canCreateCanvas("free", 3, opts);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toBe(
      "You have used your 3 free canvases. Upgrade for unlimited canvases: https://example.test/pricing",
    );
  });

  it.each(["pro_monthly", "pro_yearly", "founding"] as const)("%s is unlimited", (plan) => {
    expect(canCreateCanvas(plan, 10_000, opts).ok).toBe(true);
  });
});

describe("canAddItems", () => {
  it("caps free at 40 per canvas, all or nothing", () => {
    expect(canAddItems("free", 30, 10, opts)).toEqual({ ok: true, limit: 40, remaining: 0 });
    const r = canAddItems("free", 30, 11, opts);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toBe(
      "This canvas has reached the 40 item limit on the free plan. Upgrade: https://example.test/pricing",
    );
  });

  it.each(["pro_monthly", "pro_yearly", "founding"] as const)("%s caps at 300", (plan) => {
    expect(canAddItems(plan, 299, 1, opts).ok).toBe(true);
    const r = canAddItems(plan, 300, 1, opts);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).not.toContain("Upgrade");
  });
});

describe("export formats", () => {
  it("free gets design_md, brief, direction_md, build_prompt and stitch_md only", () => {
    expect(allowedExportFormats("free")).toEqual(["design_md", "brief", "direction_md", "build_prompt", "stitch_md", "culture_md"]);
    expect(splitExportFormats("free", ["design_md", "tokens", "brief", "html_board", "direction_md", "build_prompt", "review", "cursor_rules", "copilot", "claude_md", "agents_md", "stitch_md", "wireframe_html"])).toEqual({
      allowed: ["design_md", "brief", "direction_md", "build_prompt", "stitch_md"],
      blocked: ["tokens", "html_board", "review", "cursor_rules", "copilot", "claude_md", "agents_md", "wireframe_html"],
    });
    expect(exportLimitMessage(["tokens", "html_board"], opts)).toBe(
      "These formats need Pro: tokens, html_board. Upgrade: https://example.test/pricing",
    );
  });

  it.each(["pro_monthly", "pro_yearly", "founding"] as const)("%s gets every format", (plan) => {
    expect(allowedExportFormats(plan)).toEqual(EXPORT_FORMATS);
    expect(splitExportFormats(plan, [...EXPORT_FORMATS]).blocked).toEqual([]);
  });
});

describe("periods and usage", () => {
  it("uses YYYY-MM in UTC", () => {
    expect(currentPeriod(new Date("2026-10-31T23:59:59Z"))).toBe("2026-10");
    expect(currentPeriod(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11");
    // 23:30 on Oct 31 in UTC-5 is already November in UTC.
    expect(currentPeriod(new Date("2026-10-31T23:30:00-05:00"))).toBe("2026-11");
    expect(currentPeriod(new Date("2027-01-05T00:00:00Z"))).toBe("2027-01");
    expect(nextPeriodStart(new Date("2026-12-15T00:00:00Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("checks quota against the injected store for the current period", async () => {
    const store = createMemoryUsageStore();
    await store.addSearches("u1", "2026-09", 30); // last month does not count
    expect((await checkSearchQuota(store, "u1", "free", opts)).ok).toBe(true);
    await store.addSearches("u1", "2026-10", 30);
    const r = await checkSearchQuota(store, "u1", "free", opts);
    expect(r).toMatchObject({ ok: false, period: "2026-10" });
    expect((await checkSearchQuota(store, "u2", "free", opts)).ok).toBe(true);
  });
});

describe("copy", () => {
  it("has no em dashes", () => {
    const messages = [
      canSearch("free", 99, opts),
      canSearch("pro_monthly", 999, opts),
      canCreateCanvas("free", 9, opts),
      canAddItems("free", 99, 1, opts),
      canAddItems("founding", 999, 1, opts),
    ].map((r) => (r.ok ? "" : r.message));
    for (const m of messages) expect(m).not.toMatch(/[\u2014\u2013]/);
  });
});
