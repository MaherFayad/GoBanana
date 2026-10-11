"use client";

/**
 * Monthly / Yearly switch for the Pro price (landing pricing section and the pricing page).
 * A segmented control of two buttons with aria-pressed (the pressed one also gets the inner bar
 * and weight from .st-btn, so the state is not color alone). It sets data-period on the wrapper;
 * CSS shows the matching price. Monthly is the server default.
 */
import { useState, type ReactNode } from "react";

type Labels = { period: string; monthly: string; yearly: string; save: string };

export function PricingToggle({ labels, children, className }: { labels: Labels; children: ReactNode; className?: string }) {
  const [period, setPeriod] = useState<"month" | "year">("month");
  return (
    <div className={className ? `period-scope ${className}` : "period-scope"} data-period={period}>
      <div className="period-toggle" role="group" aria-label={labels.period}>
        <button type="button" className="st-btn" data-variant="ghost" data-size="md" aria-pressed={period === "month"} onClick={() => setPeriod("month")}>
          {labels.monthly}
        </button>
        <button type="button" className="st-btn" data-variant="ghost" data-size="md" aria-pressed={period === "year"} onClick={() => setPeriod("year")}>
          {labels.yearly}
          <span className="period-save">{labels.save}</span>
        </button>
      </div>
      {children}
    </div>
  );
}
