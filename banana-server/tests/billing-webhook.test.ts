import { describe, expect, it, vi } from "vitest";
import { signPaddlePayload, type PlanChange } from "@/lib/billing/paddle";
import { BillingRepoNotWiredError, type BillingRepo } from "@/lib/billing/repo";
import { handlePaddleWebhook } from "@/lib/billing/webhook";
import { buildCheckoutOptions, readCheckoutConfig } from "@/lib/billing/checkout";

const SECRET = "pdl_ntfset_webhook_secret";
const NOW_MS = 1_760_000_000_000;
const NOW_S = NOW_MS / 1000;
const USER = "3f2b8c1e-8d7a-4a51-9c0e-2b6f4f1d9a77";
const PRICES = { proMonthly: "pri_month", proYearly: "pri_year", founding: "pri_found" };

function fakeRepo(overrides: Partial<BillingRepo> = {}) {
  const changes: PlanChange[] = [];
  const repo: BillingRepo = {
    applyPlanChange: async (c) => {
      changes.push(c);
      return "updated";
    },
    countFoundingUsers: async () => 1,
    ...overrides,
  };
  return { repo, changes };
}

async function post(body: string, header?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (header !== undefined) headers.set("paddle-signature", header);
  return new Request("https://example.com/api/paddle/webhook", { method: "POST", body, headers });
}

const subscriptionBody = JSON.stringify({
  event_id: "evt_1",
  event_type: "subscription.created",
  occurred_at: "2026-12-04T10:00:00Z",
  data: { status: "active", customer_id: "ctm_1", custom_data: { userId: USER }, items: [{ price: { id: "pri_year" } }] },
});

describe("POST /api/paddle/webhook handler", () => {
  it("applies a signed subscription event and returns 200", async () => {
    const { repo, changes } = fakeRepo();
    const log = vi.fn();
    const req = await post(subscriptionBody, await signPaddlePayload(SECRET, subscriptionBody, NOW_S));
    const res = await handlePaddleWebhook(req, { secret: SECRET, prices: PRICES, repo, now: NOW_MS, log });
    expect(res.status).toBe(200);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ userId: USER, plan: "pro_yearly", paddleCustomerId: "ctm_1" });
    // Logs never include the payload, secret or customer details.
    const logged = log.mock.calls.flat().join("\n");
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain(USER);
    expect(logged).not.toContain("ctm_1");
  });

  it("returns 400 for a bad signature and does not touch the repo", async () => {
    const { repo, changes } = fakeRepo();
    const req = await post(subscriptionBody, await signPaddlePayload("wrong", subscriptionBody, NOW_S));
    const res = await handlePaddleWebhook(req, { secret: SECRET, prices: PRICES, repo, now: NOW_MS, log: () => {} });
    expect(res.status).toBe(400);
    expect(changes).toHaveLength(0);
  });

  it("returns 400 when the header is missing or the timestamp is old", async () => {
    const { repo } = fakeRepo();
    const deps = { secret: SECRET, prices: PRICES, repo, now: NOW_MS, log: () => {} };
    expect((await handlePaddleWebhook(await post(subscriptionBody), deps)).status).toBe(400);
    const old = await signPaddlePayload(SECRET, subscriptionBody, NOW_S - 600);
    expect((await handlePaddleWebhook(await post(subscriptionBody, old), deps)).status).toBe(400);
  });

  it("returns 200 for an ignored event", async () => {
    const { repo, changes } = fakeRepo();
    const body = JSON.stringify({ event_id: "evt_2", event_type: "customer.updated", data: { id: "ctm_1" } });
    const res = await handlePaddleWebhook(await post(body, await signPaddlePayload(SECRET, body, NOW_S)), {
      secret: SECRET,
      prices: PRICES,
      repo,
      now: NOW_MS,
      log: () => {},
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ignored: true });
    expect(changes).toHaveLength(0);
  });

  it("returns 500 when storage fails so Paddle retries", async () => {
    const { repo } = fakeRepo({
      applyPlanChange: async () => {
        throw new BillingRepoNotWiredError();
      },
    });
    const req = await post(subscriptionBody, await signPaddlePayload(SECRET, subscriptionBody, NOW_S));
    const res = await handlePaddleWebhook(req, { secret: SECRET, prices: PRICES, repo, now: NOW_MS, log: () => {} });
    expect(res.status).toBe(500);
  });

  it("returns 500 when the secret is not configured and 400 for non-JSON bodies", async () => {
    const { repo } = fakeRepo();
    const res = await handlePaddleWebhook(await post(subscriptionBody, "ts=1;h1=" + "a".repeat(64)), {
      secret: undefined,
      prices: PRICES,
      repo,
      log: () => {},
    });
    expect(res.status).toBe(500);
    const notJson = "not json";
    const res2 = await handlePaddleWebhook(await post(notJson, await signPaddlePayload(SECRET, notJson, NOW_S)), {
      secret: SECRET,
      prices: PRICES,
      repo,
      now: NOW_MS,
      log: () => {},
    });
    expect(res2.status).toBe(400);
  });
});

describe("Paddle.js checkout options", () => {
  it("passes custom_data.userId and an overlay display", () => {
    const opts = buildCheckoutOptions({ priceId: "pri_found", userId: USER, email: "a@example.com", locale: "ar" });
    expect(opts.items).toEqual([{ priceId: "pri_found", quantity: 1 }]);
    expect(opts.customData).toEqual({ userId: USER });
    expect(opts.customer).toEqual({ email: "a@example.com" });
    expect(opts.settings).toMatchObject({ displayMode: "overlay", locale: "ar" });
  });

  it("detects the sandbox from env or a test_ token", () => {
    expect(readCheckoutConfig({ PADDLE_CLIENT_TOKEN: "test_abc" }).environment).toBe("sandbox");
    expect(readCheckoutConfig({ PADDLE_CLIENT_TOKEN: "live_abc" }).environment).toBe("production");
    expect(readCheckoutConfig({}).clientToken).toBeNull();
  });
});
