/**
 * Plans and quotas (spec section 12). Pure: limits are data, usage storage is injected.
 * Changing a number here changes pricing; ask the owner first (CLAUDE.md).
 */

export const PLANS = ["free", "pro_monthly", "pro_yearly", "founding"] as const;
export type Plan = (typeof PLANS)[number];

export const EXPORT_FORMATS = [
  "design_md",
  "agents_md",
  "tokens",
  "tailwind",
  "figjam_spec",
  "html_board",
  "brief",
  "direction_md",
  "build_prompt",
  "review",
  "cursor_rules",
  "copilot",
  "claude_md",
  "stitch_md",
  "wireframe_html",
  "pitch_md",
  "experiment_md",
] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type PlanLimits = {
  /** Searches per calendar month (UTC). */
  searchesPerMonth: number;
  /** Canvases a user may own. `Infinity` means unlimited. */
  canvases: number;
  itemsPerCanvas: number;
  shareLinks: boolean;
  uploads: boolean;
  /** Upload storage in bytes (0 when uploads are off). */
  uploadBytes: number;
  exportFormats: readonly ExportFormat[];
};

const ONE_GB = 1024 * 1024 * 1024;

/** Upload storage per user while BETA_PLAN lifts free users (owner decision D3, 2026-10-15). */
export const BETA_UPLOAD_BYTES = 50 * 1024 * 1024;

export const PLAN_LIMITS: Readonly<Record<Plan, PlanLimits>> = {
  free: {
    searchesPerMonth: 30,
    canvases: 3,
    itemsPerCanvas: 40,
    shareLinks: false,
    uploads: false,
    uploadBytes: 0,
    // Free keeps the scoped DESIGN.md and brief, plus the two files that make one wild page buildable.
    // stitch_md (FRANKENSTEIN.md) is Free; wireframe_html is Pro (owner to confirm, 2026-10-12).
    exportFormats: ["design_md", "brief", "direction_md", "build_prompt", "stitch_md"],
  },
  pro_monthly: {
    searchesPerMonth: 300,
    canvases: Infinity,
    itemsPerCanvas: 300,
    shareLinks: true,
    uploads: true,
    uploadBytes: ONE_GB,
    exportFormats: EXPORT_FORMATS,
  },
  pro_yearly: {
    searchesPerMonth: 300,
    canvases: Infinity,
    itemsPerCanvas: 300,
    shareLinks: true,
    uploads: true,
    uploadBytes: ONE_GB,
    exportFormats: EXPORT_FORMATS,
  },
  founding: {
    searchesPerMonth: 200,
    canvases: Infinity,
    itemsPerCanvas: 300,
    shareLinks: true,
    uploads: true,
    uploadBytes: ONE_GB,
    exportFormats: EXPORT_FORMATS,
  },
};

/** Unknown or missing plan values are treated as free. */
export function planOf(value: string | null | undefined): Plan {
  return (PLANS as readonly string[]).includes(value ?? "") ? (value as Plan) : "free";
}

/**
 * Beta override while payments are off: BETA_PLAN=pro (or any plan id) gives every
 * free user that plan's limits. Stored plans are never changed. Remove the env var
 * when billing goes live. Read per call because Workers fill process.env per request.
 */
export function betaPlan(env: Record<string, string | undefined> = process.env): Plan | null {
  const raw = env.BETA_PLAN?.trim().toLowerCase();
  if (!raw) return null;
  const plan = raw === "pro" ? "pro_monthly" : planOf(raw);
  return plan === "free" ? null : plan;
}

/** The plan whose limits apply: the stored plan, upgraded by BETA_PLAN when that is set. */
export function effectivePlan(plan: Plan | string | null | undefined): Plan {
  const stored = planOf(plan);
  return stored === "free" ? (betaPlan() ?? stored) : stored;
}

export function limitsFor(plan: Plan | string | null | undefined): PlanLimits {
  const limits = PLAN_LIMITS[effectivePlan(plan)];
  // A free user lifted by BETA_PLAN gets the plan's limits, but uploads stay at 50 MB: beta
  // storage is paid by the owner. Paid plans keep their own limits.
  if (planOf(plan) !== "free" || betaPlan() === null) return limits;
  return { ...limits, uploadBytes: Math.min(limits.uploadBytes, BETA_UPLOAD_BYTES) };
}

export function isPaid(plan: Plan | string | null | undefined): boolean {
  return effectivePlan(plan) !== "free";
}

/** Usage period key `YYYY-MM` in UTC (spec section 11 `usage.period`). */
export function currentPeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** First day of the next UTC month, for "resets on" copy. */
export function nextPeriodStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function resetDate(now: Date): string {
  const d = nextPeriodStart(now);
  return `${MONTHS[d.getUTCMonth()]} 1`;
}

export type QuotaCheck =
  | { ok: true; limit: number; remaining: number }
  | { ok: false; limit: number; remaining: 0; message: string };

export type MessageOptions = {
  /** Pricing or account link shown in upgrade messages. */
  upgradeUrl: string;
  now?: Date;
};

/** Plain upgrade or reset message for an exhausted search quota. */
export function searchLimitMessage(plan: Plan | string | null | undefined, opts: MessageOptions): string {
  const p = planOf(plan);
  const limit = PLAN_LIMITS[p].searchesPerMonth;
  if (p === "free") {
    return `You have used your ${limit} free searches this month. Upgrade: ${opts.upgradeUrl}`;
  }
  return `You have used your ${limit} searches this month. They reset on ${resetDate(opts.now ?? new Date())}.`;
}

export function canvasLimitMessage(plan: Plan | string | null | undefined, opts: MessageOptions): string {
  const limit = limitsFor(plan).canvases;
  return `You have used your ${limit} free canvases. Upgrade for unlimited canvases: ${opts.upgradeUrl}`;
}

export function itemLimitMessage(plan: Plan | string | null | undefined, opts: MessageOptions): string {
  const p = planOf(plan);
  const limit = PLAN_LIMITS[p].itemsPerCanvas;
  if (p === "free") {
    return `This canvas has reached the ${limit} item limit on the free plan. Upgrade: ${opts.upgradeUrl}`;
  }
  return `This canvas has reached the ${limit} item limit. Remove some items or start a new canvas.`;
}

export function exportLimitMessage(blocked: readonly string[], opts: MessageOptions): string {
  return `These formats need Pro: ${blocked.join(", ")}. Upgrade: ${opts.upgradeUrl}`;
}

/**
 * Global monthly guard on Serper credits (owner decision D2, 2026-10-15): SERPER_MONTHLY_CREDIT_CAP
 * is the most credits all users together may spend in one UTC month. Unset, empty or not a
 * positive whole number means no cap. Read per call because Workers fill process.env per request.
 */
export function serperCreditCap(env: Record<string, string | undefined> = process.env): number | null {
  const raw = env.SERPER_MONTHLY_CREDIT_CAP?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const cap = Number(raw);
  return cap > 0 ? cap : null;
}

/** Plain message when the shared monthly search budget is spent. Same shape as the user quota message. */
export function creditCapMessage(opts: Pick<MessageOptions, "now">): string {
  return `The shared search budget for this month is used up, so searches are paused until ${resetDate(opts.now ?? new Date())}. Your directions and canvases are kept.`;
}

/** Is there credit left under the global cap? `spent` is credits all users spent this period. */
export function canSpendCredits(spent: number, cap: number | null, opts: Pick<MessageOptions, "now"> = {}): QuotaCheck {
  if (cap === null) return { ok: true, limit: Infinity, remaining: Infinity };
  const remaining = Math.max(0, cap - Math.max(0, spent));
  if (remaining > 0) return { ok: true, limit: cap, remaining };
  return { ok: false, limit: cap, remaining: 0, message: creditCapMessage(opts) };
}

/** Can the user run one more search? `used` is searches already counted this period. */
export function canSearch(
  plan: Plan | string | null | undefined,
  used: number,
  opts: MessageOptions,
): QuotaCheck {
  const limit = limitsFor(plan).searchesPerMonth;
  const remaining = Math.max(0, limit - Math.max(0, used));
  if (remaining > 0) return { ok: true, limit, remaining };
  return { ok: false, limit, remaining: 0, message: searchLimitMessage(plan, opts) };
}

/** Can the user create one more canvas? `owned` is canvases the user has now. */
export function canCreateCanvas(
  plan: Plan | string | null | undefined,
  owned: number,
  opts: MessageOptions,
): QuotaCheck {
  const limit = limitsFor(plan).canvases;
  if (limit === Infinity) return { ok: true, limit, remaining: Infinity };
  const remaining = Math.max(0, limit - Math.max(0, owned));
  if (remaining > 0) return { ok: true, limit, remaining };
  return { ok: false, limit, remaining: 0, message: canvasLimitMessage(plan, opts) };
}

/**
 * Can `adding` items go on a canvas that holds `current` items?
 * All or nothing: a batch that would cross the cap is refused whole.
 */
export function canAddItems(
  plan: Plan | string | null | undefined,
  current: number,
  adding: number,
  opts: MessageOptions,
): QuotaCheck {
  const limit = limitsFor(plan).itemsPerCanvas;
  const room = Math.max(0, limit - Math.max(0, current));
  if (Math.max(0, adding) <= room) return { ok: true, limit, remaining: room - Math.max(0, adding) };
  return { ok: false, limit, remaining: 0, message: itemLimitMessage(plan, opts) };
}

export function allowedExportFormats(plan: Plan | string | null | undefined): readonly ExportFormat[] {
  return limitsFor(plan).exportFormats;
}

/** Split requested formats into allowed and blocked for the plan. */
export function splitExportFormats(
  plan: Plan | string | null | undefined,
  requested: readonly ExportFormat[],
): { allowed: ExportFormat[]; blocked: ExportFormat[] } {
  const ok = new Set(allowedExportFormats(plan));
  const allowed: ExportFormat[] = [];
  const blocked: ExportFormat[] = [];
  for (const f of requested) (ok.has(f) ? allowed : blocked).push(f);
  return { allowed, blocked };
}

/** Usage row for one user and period (spec section 11 `usage`). */
export type Usage = { searches: number; canvases: number };

/** Usage storage, injected so this file never imports `db/`. */
export interface UsageStore {
  get(userId: string, period: string): Promise<Usage>;
  /** Add `by` searches to the period row, creating it when missing. */
  addSearches(userId: string, period: string, by: number): Promise<void>;
  /** Add `by` Serper credits (provider requests sent) to the period row, creating it when missing. */
  addCredits(userId: string, period: string, by: number): Promise<void>;
  /** Serper credits spent by everyone in the period (the global guard reads this). */
  creditsUsed(period: string): Promise<number>;
}

/** In-memory store for tests and local runs. Not shared across Workers isolates. */
export function createMemoryUsageStore(): UsageStore & { rows: Map<string, Usage>; credits: Map<string, number> } {
  const rows = new Map<string, Usage>();
  const credits = new Map<string, number>();
  const key = (u: string, p: string) => `${u}|${p}`;
  return {
    rows,
    credits,
    async get(userId, period) {
      return { ...(rows.get(key(userId, period)) ?? { searches: 0, canvases: 0 }) };
    },
    async addSearches(userId, period, by) {
      const row = rows.get(key(userId, period)) ?? { searches: 0, canvases: 0 };
      rows.set(key(userId, period), { ...row, searches: row.searches + by });
    },
    async addCredits(userId, period, by) {
      credits.set(key(userId, period), (credits.get(key(userId, period)) ?? 0) + Math.max(0, Math.floor(by)));
    },
    async creditsUsed(period) {
      let total = 0;
      for (const [k, n] of credits) if (k.endsWith(`|${period}`)) total += n;
      return total;
    },
  };
}

/** Read this period's usage and check the search quota in one step. */
export async function checkSearchQuota(
  store: UsageStore,
  userId: string,
  plan: Plan | string | null | undefined,
  opts: MessageOptions,
): Promise<QuotaCheck & { period: string }> {
  const period = currentPeriod(opts.now);
  const usage = await store.get(userId, period);
  return { ...canSearch(plan, usage.searches, opts), period };
}
