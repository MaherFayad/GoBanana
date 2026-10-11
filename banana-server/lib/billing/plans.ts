/**
 * Display prices for the pricing page (spec section 12). Limits come from
 * lib/quota.ts so the page and the quota checks never disagree.
 * Changing a price here changes pricing; ask the owner first (CLAUDE.md).
 */
import type { Plan } from "@/lib/quota";
import type { PaddlePriceIds } from "./paddle";

export type PriceDisplay = { amountUsd: number; period: "month" | "year" | "once" | "free" };

export const PLAN_PRICES: Readonly<Record<Plan, PriceDisplay>> = {
  free: { amountUsd: 0, period: "free" },
  pro_monthly: { amountUsd: 5, period: "month" },
  pro_yearly: { amountUsd: 39, period: "year" },
  founding: { amountUsd: 29, period: "once" },
};

export const PLAN_ORDER: readonly Plan[] = ["free", "pro_monthly", "pro_yearly", "founding"];

export function paddlePriceIdFor(plan: Plan, prices: PaddlePriceIds): string | null {
  switch (plan) {
    case "pro_monthly":
      return prices.proMonthly ?? null;
    case "pro_yearly":
      return prices.proYearly ?? null;
    case "founding":
      return prices.founding ?? null;
    default:
      return null;
  }
}
