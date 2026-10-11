/**
 * Billing storage port. The webhook handler talks to this interface only, so
 * tests inject a fake and the database wiring lives in one place.
 *
 * The default implementation is a stub until the db layer is final. In
 * production it throws, so the webhook answers 500 and Paddle retries the event
 * later instead of a purchase being dropped silently.
 */
import type { PlanChange } from "./paddle";

export type PlanChangeOutcome = "updated" | "unchanged" | "skipped_plan_guard" | "user_not_found";

export interface BillingRepo {
  /** Sets `users.plan` (and `paddle_customer_id` when given) for `change.userId`. Idempotent. */
  applyPlanChange(change: PlanChange): Promise<PlanChangeOutcome>;
  /** Number of users on the founding plan, for the 100 cap. */
  countFoundingUsers(): Promise<number>;
}

export class BillingRepoNotWiredError extends Error {
  constructor() {
    super("Billing repository is not wired to the database yet");
    this.name = "BillingRepoNotWiredError";
  }
}

function notWiredInProduction(): void {
  if (process.env.NODE_ENV === "production") throw new BillingRepoNotWiredError();
}

/**
 * TODO(db): replace with Drizzle once db/schema.ts is final. Sketch:
 *
 *   import { and, eq, inArray, count } from "drizzle-orm";
 *   import { getDb } from "@/db/client";
 *   import { users } from "@/db/schema";
 *
 *   applyPlanChange: const where = change.onlyFrom
 *       ? and(eq(users.id, change.userId), inArray(users.plan, [...change.onlyFrom]))
 *       : eq(users.id, change.userId);
 *     const rows = await getDb().update(users)
 *       .set({ plan: change.plan, ...(change.paddleCustomerId ? { paddleCustomerId: change.paddleCustomerId } : {}) })
 *       .where(where).returning({ id: users.id });
 *     if (rows.length) return "updated";
 *     // tell "user_not_found" from "skipped_plan_guard" with a select on users.id
 *     // then call forgetUser(workosId) from lib/users.ts so the cached plan refreshes.
 *
 *   countFoundingUsers: select count(*) from users where plan = 'founding'.
 *
 * Out-of-order delivery: Paddle does not guarantee order. If that matters, store
 * the last applied `occurredAt` per user and skip older events.
 */
export const stubBillingRepo: BillingRepo = {
  async applyPlanChange() {
    notWiredInProduction();
    return "unchanged";
  },
  async countFoundingUsers() {
    notWiredInProduction();
    return 0;
  },
};

let current: BillingRepo = stubBillingRepo;

export function getBillingRepo(): BillingRepo {
  return current;
}

/** For wiring at startup or in tests. */
export function setBillingRepo(repo: BillingRepo): void {
  current = repo;
}
