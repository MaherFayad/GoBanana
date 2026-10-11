/**
 * Billing storage port. The webhook handler talks to this interface only, so
 * tests inject a fake and the database wiring lives in one place.
 *
 * The default implementation is Drizzle over `users`. Any storage error is thrown,
 * so the webhook answers 500 and Paddle retries the event later instead of a
 * purchase being dropped silently.
 *
 * Founding count: `count(*) from users where plan = 'founding'`. We do not ask
 * Paddle: that needs an API key and a network call on every pricing page view,
 * and our own table is what the webhook writes. A founding buyer who deletes their
 * account frees a seat (see DECISIONS.md).
 *
 * Out-of-order delivery: Paddle does not guarantee order. Plan guards (`onlyFrom`)
 * stop the harmful cases (a subscription event never overwrites founding, a cancel
 * only downgrades Pro). Event times are not stored per user yet.
 */
import { and, count, eq, inArray } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { users } from "@/db/schema";
import { isUuid } from "@/lib/db/ids";
import type { PlanChange } from "./paddle";

export type PlanChangeOutcome = "updated" | "unchanged" | "skipped_plan_guard" | "user_not_found";

export interface BillingRepo {
  /** Sets `users.plan` (and `paddle_customer_id` when given) for `change.userId`. Idempotent. */
  applyPlanChange(change: PlanChange): Promise<PlanChangeOutcome>;
  /** Number of users on the founding plan, for the 100 cap. */
  countFoundingUsers(): Promise<number>;
}

/** Thrown by callers or fakes when storage is not available. Kept for tests and older callers. */
export class BillingRepoNotWiredError extends Error {
  constructor() {
    super("Billing repository is not wired to the database yet");
    this.name = "BillingRepoNotWiredError";
  }
}

export type DbBillingRepoOptions = {
  /** Called with the WorkOS id after a plan change so cached user rows refresh. */
  onPlanChanged?: (workosId: string) => void;
};

/** Drizzle billing repo. `db` is read per call, so a missing DATABASE_URL surfaces inside the handler's try. */
export function createDbBillingRepo(db: () => Db = getDb, opts: DbBillingRepoOptions = {}): BillingRepo {
  return {
    async applyPlanChange(change) {
      if (!isUuid(change.userId)) return "user_not_found";
      const conn = db();
      const byId = eq(users.id, change.userId);
      const where = change.onlyFrom ? and(byId, inArray(users.plan, [...change.onlyFrom])) : byId;
      const rows = await conn
        .update(users)
        .set({ plan: change.plan, ...(change.paddleCustomerId ? { paddleCustomerId: change.paddleCustomerId } : {}) })
        .where(where)
        .returning({ workosId: users.workosId });
      const updated = rows[0];
      if (updated) {
        opts.onPlanChanged?.(updated.workosId);
        return "updated";
      }
      const [row] = await conn.select({ plan: users.plan }).from(users).where(byId).limit(1);
      if (!row) return "user_not_found";
      return row.plan === change.plan ? "unchanged" : "skipped_plan_guard";
    },
    async countFoundingUsers() {
      const [row] = await db().select({ n: count() }).from(users).where(eq(users.plan, "founding"));
      return Number(row?.n ?? 0);
    },
  };
}

let current: BillingRepo | undefined;

export function getBillingRepo(): BillingRepo {
  current ??= createDbBillingRepo(getDb, {
    onPlanChanged: (workosId) => {
      // lib/users.ts caches rows per isolate; drop this one so the new plan shows at once.
      void import("@/lib/users").then((m) => m.forgetUser(workosId)).catch(() => undefined);
    },
  });
  return current;
}

/** For wiring at startup or in tests. */
export function setBillingRepo(repo: BillingRepo): void {
  current = repo;
}
