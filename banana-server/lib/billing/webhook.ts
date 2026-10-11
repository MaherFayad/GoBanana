/**
 * Paddle webhook request handler, kept outside `app/` so tests can call it with
 * a fake repo. The route file only passes env values in.
 *
 * Responses: 400 bad or missing signature (or bad JSON), 413 oversized body,
 * 500 missing secret or storage failure (Paddle retries), 200 handled or ignored.
 * Logs carry the event type, event id and outcome only: never the payload,
 * the header or the secret.
 */
import { FOUNDING_CAP, mapPaddleEvent, PADDLE_SIGNATURE_HEADER, verifyPaddleSignature, type PaddlePriceIds } from "./paddle";
import type { BillingRepo } from "./repo";

/** Paddle payloads are a few KB; anything far larger is not from Paddle. */
export const MAX_BODY_BYTES = 256 * 1024;

export type WebhookDeps = {
  secret: string | undefined;
  prices: PaddlePriceIds;
  repo: BillingRepo;
  now?: number;
  log?: (message: string) => void;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function handlePaddleWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  const log = deps.log ?? ((m: string) => console.info(m));

  if (!deps.secret) {
    log("[paddle] webhook secret is not configured");
    return json(500, { error: "not configured" });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json(413, { error: "too large" });
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return json(413, { error: "too large" });

  const verified = await verifyPaddleSignature({
    rawBody,
    header: request.headers.get(PADDLE_SIGNATURE_HEADER),
    secret: deps.secret,
    now: deps.now,
  });
  if (!verified.ok) {
    log(`[paddle] rejected webhook: ${verified.reason}`);
    return json(400, { error: "invalid signature" });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    log("[paddle] rejected webhook: body is not JSON");
    return json(400, { error: "invalid body" });
  }

  const action = mapPaddleEvent(event, deps.prices);
  if (action.kind === "ignore") {
    log(`[paddle] ignored ${action.eventType}: ${action.reason}`);
    return json(200, { ok: true, ignored: true });
  }

  try {
    const outcome = await deps.repo.applyPlanChange(action);
    log(`[paddle] ${action.eventType} ${action.eventId} -> ${action.plan}: ${outcome}`);
    if (action.plan === "founding") {
      // The cap is enforced at checkout; a buyer who already paid keeps the plan.
      const sold = await deps.repo.countFoundingUsers().catch(() => null);
      if (sold !== null && sold > FOUNDING_CAP) log(`[paddle] founding sold ${sold}, over the cap of ${FOUNDING_CAP}`);
    }
    return json(200, { ok: true, outcome });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    log(`[paddle] storage failed for ${action.eventType} ${action.eventId}: ${name}`);
    return json(500, { error: "storage failed" });
  }
}
