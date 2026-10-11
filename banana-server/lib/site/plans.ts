/**
 * Plan copy for the site (landing pricing section and the pricing page). Prices come from
 * lib/billing/plans.ts and limits from lib/quota.ts, so the site never disagrees with checkout
 * or the quota checks. Pure: Vitest covers it.
 */
import { PLAN_PRICES } from "@/lib/billing/plans";
import { PLAN_LIMITS, type Plan } from "@/lib/quota";
import type { Dict } from "./dict";
import { fmt } from "./i18n";

export function priceText(plan: Plan, t: Dict["pricing"]): { amount: string; period: string } {
  const p = PLAN_PRICES[plan];
  const period = { month: t.perMonth, year: t.perYear, once: t.once, free: t.free }[p.period];
  return { amount: `$${p.amountUsd}`, period };
}

/** What a plan line is about, so the site can draw an icon next to it. */
export type PlanFeatureKey = "searches" | "canvases" | "items" | "share" | "noShare" | "exports";

export function planFeatureItems(plan: Plan, t: Dict["pricing"]): { key: PlanFeatureKey; text: string }[] {
  const l = PLAN_LIMITS[plan];
  return [
    { key: "searches", text: fmt(t.features.searches, { n: l.searchesPerMonth }) },
    { key: "canvases", text: Number.isFinite(l.canvases) ? fmt(t.features.canvases, { n: l.canvases }) : t.features.canvasesUnlimited },
    { key: "items", text: fmt(t.features.items, { n: l.itemsPerCanvas }) },
    l.shareLinks ? { key: "share", text: t.features.share } : { key: "noShare", text: t.features.noShare },
    { key: "exports", text: plan === "free" ? t.features.exportsFree : t.features.exportsAll },
  ];
}

export function planFeatures(plan: Plan, t: Dict["pricing"]): string[] {
  return planFeatureItems(plan, t).map((f) => f.text);
}

/** Whole percent saved by paying yearly instead of 12 monthly payments (35 for $39 vs $5). */
export function yearlySavingPercent(): number {
  const monthly = PLAN_PRICES.pro_monthly.amountUsd * 12;
  const yearly = PLAN_PRICES.pro_yearly.amountUsd;
  return monthly > 0 ? Math.round((1 - yearly / monthly) * 100) : 0;
}
