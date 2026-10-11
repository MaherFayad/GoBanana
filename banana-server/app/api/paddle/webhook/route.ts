/**
 * POST /api/paddle/webhook: verifies the Paddle-Signature header and sets
 * `users.plan` (spec section 12, flow step 3). Logic lives in lib/billing.
 */
import { readPaddlePrices } from "@/lib/billing/paddle";
import { getBillingRepo } from "@/lib/billing/repo";
import { handlePaddleWebhook } from "@/lib/billing/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handlePaddleWebhook(request, {
    secret: process.env.PADDLE_WEBHOOK_SECRET?.trim() || undefined,
    prices: readPaddlePrices(),
    repo: getBillingRepo(),
  });
}
