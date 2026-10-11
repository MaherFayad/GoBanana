import { describe, expect, it } from "vitest";
import {
  FOUNDING_CAP,
  foundingSeatsLeft,
  hmacSha256Hex,
  isFoundingSoldOut,
  mapPaddleEvent,
  parseSignatureHeader,
  readPaddlePrices,
  signPaddlePayload,
  timingSafeEqual,
  verifyPaddleSignature,
  type PaddlePriceIds,
} from "@/lib/billing/paddle";

const SECRET = "pdl_ntfset_test_secret_123";
const NOW_MS = 1_760_000_000_000;
const NOW_S = NOW_MS / 1000;
const BODY = JSON.stringify({ event_id: "evt_1", event_type: "subscription.created", data: { id: "sub_1" } });

describe("Paddle signature", () => {
  it("matches a known HMAC-SHA256 hex vector", async () => {
    // RFC 4231 test case 2.
    expect(await hmacSha256Hex("Jefe", "what do ya want for nothing?")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });

  it("accepts a valid signature", async () => {
    const header = await signPaddlePayload(SECRET, BODY, NOW_S);
    expect(await verifyPaddleSignature({ rawBody: BODY, header, secret: SECRET, now: NOW_MS })).toEqual({ ok: true });
  });

  it("rejects a tampered body", async () => {
    const header = await signPaddlePayload(SECRET, BODY, NOW_S);
    const tampered = BODY.replace("sub_1", "sub_2");
    expect(await verifyPaddleSignature({ rawBody: tampered, header, secret: SECRET, now: NOW_MS })).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects re-serialized JSON (whitespace counts)", async () => {
    const header = await signPaddlePayload(SECRET, BODY, NOW_S);
    const reserialized = JSON.stringify(JSON.parse(BODY), null, 1);
    const result = await verifyPaddleSignature({ rawBody: reserialized, header, secret: SECRET, now: NOW_MS });
    expect(result.ok).toBe(false);
  });

  it("rejects the wrong secret", async () => {
    const header = await signPaddlePayload("another_secret", BODY, NOW_S);
    expect(await verifyPaddleSignature({ rawBody: BODY, header, secret: SECRET, now: NOW_MS })).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects an old timestamp even with a valid signature", async () => {
    const header = await signPaddlePayload(SECRET, BODY, NOW_S - 60);
    expect(await verifyPaddleSignature({ rawBody: BODY, header, secret: SECRET, now: NOW_MS })).toEqual({
      ok: false,
      reason: "stale_timestamp",
    });
  });

  it("rejects a timestamp far in the future", async () => {
    const header = await signPaddlePayload(SECRET, BODY, NOW_S + 60);
    const result = await verifyPaddleSignature({ rawBody: BODY, header, secret: SECRET, now: NOW_MS });
    expect(result).toEqual({ ok: false, reason: "stale_timestamp" });
  });

  it("accepts within the 5 second tolerance and honors a custom tolerance", async () => {
    const header = await signPaddlePayload(SECRET, BODY, NOW_S - 5);
    expect((await verifyPaddleSignature({ rawBody: BODY, header, secret: SECRET, now: NOW_MS })).ok).toBe(true);
    const older = await signPaddlePayload(SECRET, BODY, NOW_S - 30);
    expect((await verifyPaddleSignature({ rawBody: BODY, header: older, secret: SECRET, now: NOW_MS, toleranceSeconds: 60 })).ok).toBe(true);
  });

  it("accepts any matching h1 during secret rotation", async () => {
    const good = await signPaddlePayload(SECRET, BODY, NOW_S);
    const h1 = good.split("h1=")[1];
    const header = `ts=${NOW_S};h1=${"0".repeat(64)};h1=${h1}`;
    expect((await verifyPaddleSignature({ rawBody: BODY, header, secret: SECRET, now: NOW_MS })).ok).toBe(true);
  });

  it("rejects missing or malformed headers and a missing secret", async () => {
    const base = { rawBody: BODY, secret: SECRET, now: NOW_MS };
    expect(await verifyPaddleSignature({ ...base, header: null })).toEqual({ ok: false, reason: "missing_header" });
    expect(await verifyPaddleSignature({ ...base, header: "garbage" })).toEqual({ ok: false, reason: "malformed_header" });
    expect(await verifyPaddleSignature({ ...base, header: `ts=${NOW_S}` })).toEqual({ ok: false, reason: "malformed_header" });
    expect(await verifyPaddleSignature({ ...base, header: `ts=abc;h1=${"a".repeat(64)}` })).toEqual({
      ok: false,
      reason: "malformed_header",
    });
    expect(await verifyPaddleSignature({ ...base, header: `ts=${NOW_S};h1=zz` })).toEqual({ ok: false, reason: "malformed_header" });
    const header = await signPaddlePayload(SECRET, BODY, NOW_S);
    expect(await verifyPaddleSignature({ ...base, header, secret: "" })).toEqual({ ok: false, reason: "no_secret" });
  });

  it("parses the documented header example", () => {
    expect(parseSignatureHeader("ts=1671552777;h1=eb4d0dc8853be92b7f063b9f3ba5233eb920a09459b6e6b2c26705b4364db151")).toEqual({
      ts: 1671552777,
      h1: ["eb4d0dc8853be92b7f063b9f3ba5233eb920a09459b6e6b2c26705b4364db151"],
    });
  });

  it("timingSafeEqual compares exactly", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });
});

const PRICES: PaddlePriceIds = { proMonthly: "pri_month", proYearly: "pri_year", founding: "pri_found" };
const USER = "3f2b8c1e-8d7a-4a51-9c0e-2b6f4f1d9a77";

function evt(event_type: string, data: Record<string, unknown>) {
  return { event_id: "evt_123", event_type, occurred_at: "2026-12-04T10:00:00Z", data: { customer_id: "ctm_1", ...data } };
}

describe("Paddle event mapping", () => {
  it("transaction.completed with the founding price sets founding", () => {
    const action = mapPaddleEvent(
      evt("transaction.completed", { custom_data: { userId: USER }, items: [{ price: { id: "pri_found" }, quantity: 1 }] }),
      PRICES,
    );
    expect(action).toMatchObject({ kind: "set_plan", userId: USER, plan: "founding", paddleCustomerId: "ctm_1", eventId: "evt_123" });
    expect(action.kind === "set_plan" && action.onlyFrom).toBeFalsy();
  });

  it("accepts transaction items that only carry price_id", () => {
    const action = mapPaddleEvent(evt("transaction.completed", { custom_data: { userId: USER }, items: [{ price_id: "pri_found" }] }), PRICES);
    expect(action).toMatchObject({ kind: "set_plan", plan: "founding" });
  });

  it("ignores transaction.completed for subscription payments", () => {
    const action = mapPaddleEvent(
      evt("transaction.completed", { subscription_id: "sub_1", custom_data: { userId: USER }, items: [{ price: { id: "pri_month" } }] }),
      PRICES,
    );
    expect(action.kind).toBe("ignore");
  });

  it("subscription.created maps monthly and yearly prices", () => {
    const monthly = mapPaddleEvent(evt("subscription.created", { status: "active", custom_data: { userId: USER }, items: [{ price: { id: "pri_month" } }] }), PRICES);
    expect(monthly).toMatchObject({ kind: "set_plan", plan: "pro_monthly", onlyFrom: ["free", "pro_monthly", "pro_yearly"] });
    const yearly = mapPaddleEvent(evt("subscription.created", { status: "trialing", custom_data: { userId: USER }, items: [{ price: { id: "pri_year" } }] }), PRICES);
    expect(yearly).toMatchObject({ kind: "set_plan", plan: "pro_yearly" });
  });

  it("subscription.updated switches plan by price and keeps access while past_due", () => {
    const switched = mapPaddleEvent(evt("subscription.updated", { status: "active", custom_data: { userId: USER }, items: [{ price: { id: "pri_year" } }] }), PRICES);
    expect(switched).toMatchObject({ kind: "set_plan", plan: "pro_yearly" });
    const pastDue = mapPaddleEvent(evt("subscription.updated", { status: "past_due", custom_data: { userId: USER }, items: [{ price: { id: "pri_month" } }] }), PRICES);
    expect(pastDue).toMatchObject({ kind: "set_plan", plan: "pro_monthly" });
  });

  it("subscription.updated to canceled or paused drops to free, only from Pro", () => {
    for (const status of ["canceled", "paused"]) {
      const action = mapPaddleEvent(evt("subscription.updated", { status, custom_data: { userId: USER }, items: [{ price: { id: "pri_month" } }] }), PRICES);
      expect(action).toMatchObject({ kind: "set_plan", plan: "free", onlyFrom: ["pro_monthly", "pro_yearly"] });
    }
  });

  it("subscription.canceled drops to free and never touches founding", () => {
    const action = mapPaddleEvent(evt("subscription.canceled", { status: "canceled", custom_data: { userId: USER } }), PRICES);
    expect(action).toMatchObject({ kind: "set_plan", plan: "free", onlyFrom: ["pro_monthly", "pro_yearly"] });
    expect(action.kind === "set_plan" && action.onlyFrom?.includes("founding")).toBe(false);
  });

  it("ignores unknown prices, unknown events and missing or bad userId", () => {
    expect(mapPaddleEvent(evt("subscription.created", { status: "active", custom_data: { userId: USER }, items: [{ price: { id: "pri_other" } }] }), PRICES).kind).toBe("ignore");
    expect(mapPaddleEvent(evt("customer.updated", { custom_data: { userId: USER } }), PRICES).kind).toBe("ignore");
    expect(mapPaddleEvent(evt("subscription.created", { status: "active", items: [{ price: { id: "pri_month" } }] }), PRICES).kind).toBe("ignore");
    expect(mapPaddleEvent(evt("subscription.created", { status: "active", custom_data: { userId: "not-a-uuid" }, items: [{ price: { id: "pri_month" } }] }), PRICES).kind).toBe("ignore");
    expect(mapPaddleEvent(evt("subscription.created", { status: "incomplete", custom_data: { userId: USER }, items: [{ price: { id: "pri_month" } }] }), PRICES).kind).toBe("ignore");
    expect(mapPaddleEvent(null, PRICES).kind).toBe("ignore");
  });

  it("does not grant founding when the founding price is not configured", () => {
    const action = mapPaddleEvent(evt("transaction.completed", { custom_data: { userId: USER }, items: [{ price: { id: "pri_found" } }] }), {});
    expect(action.kind).toBe("ignore");
  });

  it("reads price ids from env", () => {
    expect(readPaddlePrices({ PADDLE_PRICE_PRO_MONTHLY: " pri_a ", PADDLE_PRICE_PRO_YEARLY: "", PADDLE_PRICE_FOUNDING: "pri_c" })).toEqual({
      proMonthly: "pri_a",
      proYearly: undefined,
      founding: "pri_c",
    });
  });
});

describe("founding cap", () => {
  it("counts seats down to zero at 100", () => {
    expect(FOUNDING_CAP).toBe(100);
    expect(foundingSeatsLeft(0)).toBe(100);
    expect(foundingSeatsLeft(99)).toBe(1);
    expect(isFoundingSoldOut(99)).toBe(false);
    expect(foundingSeatsLeft(100)).toBe(0);
    expect(isFoundingSoldOut(100)).toBe(true);
    expect(foundingSeatsLeft(140)).toBe(0);
    expect(foundingSeatsLeft(-1)).toBe(100);
  });
});
