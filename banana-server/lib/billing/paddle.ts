/**
 * Paddle Billing webhooks (spec section 12, flow step 3). Pure: Web Crypto only,
 * no Node APIs, no network, no database, so it runs on Cloudflare Workers and in Vitest.
 *
 * Signature scheme (developer.paddle.com/webhooks/about/signature-verification):
 * - Header `Paddle-Signature: ts=1671552777;h1=<hex>`. During secret rotation Paddle
 *   may send more than one `h1`; any match is accepted.
 * - Signed payload is `${ts}:${rawBody}`, HMAC-SHA256 keyed with the endpoint secret,
 *   hex encoded. The raw body must be the exact bytes received (never re-serialized JSON).
 * - Paddle SDKs reject timestamps more than 5 seconds from now; we use the same default.
 */
import type { Plan } from "@/lib/quota";

export const PADDLE_SIGNATURE_HEADER = "paddle-signature";

/** Paddle's SDK default replay window. */
export const DEFAULT_TOLERANCE_SECONDS = 5;

/** Founding lifetime offer: stop selling after this many buyers (spec section 12). */
export const FOUNDING_CAP = 100;

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

export type ParsedSignature = { ts: number; h1: string[] };

/** Parses `ts=...;h1=...[;h1=...]`. Returns null on any malformed input. */
export function parseSignatureHeader(header: string | null | undefined): ParsedSignature | null {
  if (!header || header.length > 2048) return null;
  let ts: number | null = null;
  const h1: string[] = [];
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) return null;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "ts") {
      if (!/^\d{1,12}$/.test(value)) return null;
      ts = Number(value);
    } else if (key === "h1") {
      if (!/^[0-9a-f]{64}$/i.test(value)) return null;
      h1.push(value.toLowerCase());
    }
    // Unknown keys are ignored so a future scheme (h2, ...) does not break parsing.
  }
  if (ts === null || h1.length === 0) return null;
  return { ts, h1 };
}

const encoder = new TextEncoder();

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  let hex = "";
  for (const byte of sig) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

/**
 * Constant-time string compare. Runs over the longer input so timing does not
 * reveal where the first difference is; a length mismatch still returns false.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export type VerifyFailure = "missing_header" | "malformed_header" | "stale_timestamp" | "bad_signature" | "no_secret";
export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailure };

export type VerifyInput = {
  rawBody: string;
  header: string | null | undefined;
  secret: string | undefined;
  /** Unix ms, injectable for tests. */
  now?: number;
  toleranceSeconds?: number;
};

export async function verifyPaddleSignature(input: VerifyInput): Promise<VerifyResult> {
  if (!input.secret) return { ok: false, reason: "no_secret" };
  if (!input.header) return { ok: false, reason: "missing_header" };
  const parsed = parseSignatureHeader(input.header);
  if (!parsed) return { ok: false, reason: "malformed_header" };

  const nowSec = Math.floor((input.now ?? Date.now()) / 1000);
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(nowSec - parsed.ts) > tolerance) return { ok: false, reason: "stale_timestamp" };

  const expected = await hmacSha256Hex(input.secret, `${parsed.ts}:${input.rawBody}`);
  // Check every h1 without stopping early, so rotation does not change timing per position.
  let match = false;
  for (const candidate of parsed.h1) {
    if (timingSafeEqual(expected, candidate)) match = true;
  }
  return match ? { ok: true } : { ok: false, reason: "bad_signature" };
}

/** Builds a valid header for a body. Used by tests and local webhook simulation. */
export async function signPaddlePayload(secret: string, rawBody: string, tsSeconds: number): Promise<string> {
  return `ts=${tsSeconds};h1=${await hmacSha256Hex(secret, `${tsSeconds}:${rawBody}`)}`;
}

// ---------------------------------------------------------------------------
// Event mapping
// ---------------------------------------------------------------------------

export type PaddlePriceIds = {
  proMonthly?: string;
  proYearly?: string;
  founding?: string;
};

/** Reads PADDLE_PRICE_* at request time (Workers copy vars into process.env per request). */
export function readPaddlePrices(env: Record<string, string | undefined> = process.env): PaddlePriceIds {
  const pick = (name: string) => env[name]?.trim() || undefined;
  return {
    proMonthly: pick("PADDLE_PRICE_PRO_MONTHLY"),
    proYearly: pick("PADDLE_PRICE_PRO_YEARLY"),
    founding: pick("PADDLE_PRICE_FOUNDING"),
  };
}

export type PlanChange = {
  kind: "set_plan";
  /** `users.id` from checkout `custom_data.userId`. */
  userId: string;
  plan: Plan;
  /**
   * Apply only when the user's current plan is one of these. Keeps a founding
   * (lifetime) buyer from being downgraded by a subscription cancel, and keeps a
   * subscription event from overwriting a founding plan.
   * Undefined means apply from any plan.
   */
  onlyFrom?: readonly Plan[];
  paddleCustomerId?: string;
  eventId: string;
  eventType: string;
  /** ISO time Paddle says the event happened; use it to drop out-of-order updates. */
  occurredAt?: string;
};

export type IgnoredEvent = { kind: "ignore"; reason: string; eventType: string };
export type BillingAction = PlanChange | IgnoredEvent;

type Item = { price_id?: unknown; price?: { id?: unknown } | null };

type PaddleEvent = {
  event_id?: unknown;
  event_type?: unknown;
  occurred_at?: unknown;
  data?: {
    status?: unknown;
    customer_id?: unknown;
    subscription_id?: unknown;
    custom_data?: Record<string, unknown> | null;
    items?: unknown;
  } | null;
};

const SUBSCRIPTION_PLANS: readonly Plan[] = ["pro_monthly", "pro_yearly"];
/** Statuses that keep Pro access. `past_due` keeps access while Paddle retries payment. */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
/** Statuses that end access. */
const ENDED_STATUSES = new Set(["canceled", "paused"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `custom_data.userId` must look like a `users.id` uuid. */
export function userIdFrom(customData: unknown): string | null {
  if (!customData || typeof customData !== "object") return null;
  const value = (customData as Record<string, unknown>).userId;
  return typeof value === "string" && UUID_RE.test(value) ? value.toLowerCase() : null;
}

function priceIdsOf(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const ids: string[] = [];
  for (const raw of items as Item[]) {
    const id = raw?.price?.id ?? raw?.price_id;
    if (typeof id === "string") ids.push(id);
  }
  return ids;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/** Plan for a subscription's items, or null when no item is a known Pro price. */
export function subscriptionPlanFor(priceIds: readonly string[], prices: PaddlePriceIds): Plan | null {
  if (prices.proYearly && priceIds.includes(prices.proYearly)) return "pro_yearly";
  if (prices.proMonthly && priceIds.includes(prices.proMonthly)) return "pro_monthly";
  return null;
}

/**
 * Maps a parsed Paddle event to a plan change. Handled:
 * - `transaction.completed` with the founding price: plan `founding` (one-time).
 * - `subscription.created` / `subscription.updated`: Pro monthly or yearly by price id
 *   while active; free once the status is canceled or paused.
 * - `subscription.canceled`: free (only from a Pro plan).
 * Everything else is ignored with a reason.
 */
export function mapPaddleEvent(event: unknown, prices: PaddlePriceIds): BillingAction {
  const e = (event ?? {}) as PaddleEvent;
  const eventType = str(e.event_type) ?? "unknown";
  const ignore = (reason: string): IgnoredEvent => ({ kind: "ignore", reason, eventType });
  const data = e.data;
  if (!data || typeof data !== "object") return ignore("no data");

  const eventId = str(e.event_id) ?? "";
  const base = {
    eventId,
    eventType,
    occurredAt: str(e.occurred_at),
    paddleCustomerId: str(data.customer_id),
  };
  const priceIds = priceIdsOf(data.items);

  switch (eventType) {
    case "transaction.completed": {
      if (!prices.founding || !priceIds.includes(prices.founding)) {
        // Subscription payments also complete transactions; subscription events handle those.
        return ignore("not a founding purchase");
      }
      const userId = userIdFrom(data.custom_data);
      if (!userId) return ignore("missing custom_data.userId");
      return { kind: "set_plan", userId, plan: "founding", ...base };
    }
    case "subscription.created":
    case "subscription.updated": {
      const userId = userIdFrom(data.custom_data);
      if (!userId) return ignore("missing custom_data.userId");
      const status = str(data.status) ?? "";
      if (ENDED_STATUSES.has(status)) {
        return { kind: "set_plan", userId, plan: "free", onlyFrom: SUBSCRIPTION_PLANS, ...base };
      }
      if (!ACTIVE_STATUSES.has(status)) return ignore(`status ${status || "missing"}`);
      const plan = subscriptionPlanFor(priceIds, prices);
      if (!plan) return ignore("unknown price");
      return { kind: "set_plan", userId, plan, onlyFrom: ["free", ...SUBSCRIPTION_PLANS], ...base };
    }
    case "subscription.canceled": {
      const userId = userIdFrom(data.custom_data);
      if (!userId) return ignore("missing custom_data.userId");
      return { kind: "set_plan", userId, plan: "free", onlyFrom: SUBSCRIPTION_PLANS, ...base };
    }
    default:
      return ignore("event type not handled");
  }
}

// ---------------------------------------------------------------------------
// Founding cap
// ---------------------------------------------------------------------------

export function foundingSeatsLeft(sold: number, cap: number = FOUNDING_CAP): number {
  if (!Number.isFinite(sold) || sold < 0) return cap;
  return Math.max(0, cap - Math.floor(sold));
}

/** True once the cap is reached. The pricing page hides the founding checkout then. */
export function isFoundingSoldOut(sold: number, cap: number = FOUNDING_CAP): boolean {
  return foundingSeatsLeft(sold, cap) === 0;
}
