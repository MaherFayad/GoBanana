/** Drizzle billing repo (plan changes, founding count) and takedown request storage over a fake Neon client. */
import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import type { PlanChange } from "@/lib/billing/paddle";
import { createDbBillingRepo } from "@/lib/billing/repo";
import { createDbTakedownRepo, takedownRequestRow } from "@/lib/site/takedown-repo";
import { ALICE } from "./tools-fixtures";

function fakeDb(answers: unknown[][] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = vi.fn(async (sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    return { rows: answers.shift() ?? [], fields: [], rowCount: 0, command: "" };
  });
  return { db: drizzle({ client: { query } as never, schema }) as unknown as Db, calls };
}

const change = (over: Partial<PlanChange> = {}): PlanChange => ({
  kind: "set_plan",
  userId: ALICE,
  plan: "pro_monthly",
  eventId: "evt_1",
  eventType: "subscription.created",
  ...over,
});

describe("createDbBillingRepo.applyPlanChange", () => {
  it("sets the plan and customer id with the plan guard in the same update", async () => {
    const { db, calls } = fakeDb([[["user_alice"]]]);
    const onPlanChanged = vi.fn();
    const repo = createDbBillingRepo(() => db, { onPlanChanged });
    const out = await repo.applyPlanChange(change({ onlyFrom: ["free", "pro_monthly", "pro_yearly"], paddleCustomerId: "ctm_1" }));
    expect(out).toBe("updated");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.sql).toMatch(/^update "users" set "plan" = \$1, "paddle_customer_id" = \$2 where \("users"\."id" = \$3 and "users"\."plan" in \(\$4, \$5, \$6\)\) returning "workos_id"$/);
    expect(calls[0]!.params).toEqual(["pro_monthly", "ctm_1", ALICE, "free", "pro_monthly", "pro_yearly"]);
    expect(onPlanChanged).toHaveBeenCalledWith("user_alice");
  });

  it("applies founding from any plan and leaves the customer id alone when missing", async () => {
    const { db, calls } = fakeDb([[["user_alice"]]]);
    await createDbBillingRepo(() => db).applyPlanChange(change({ plan: "founding" }));
    expect(calls[0]!.sql).toMatch(/^update "users" set "plan" = \$1 where "users"\."id" = \$2 returning/);
  });

  it("tells a missing user from a plan guard skip and an unchanged plan", async () => {
    const guarded = change({ plan: "free", onlyFrom: ["pro_monthly", "pro_yearly"] });

    const missing = fakeDb([[], []]);
    expect(await createDbBillingRepo(() => missing.db).applyPlanChange(guarded)).toBe("user_not_found");
    expect(missing.calls[1]!.sql).toMatch(/select "plan" from "users" where "users"\."id" = \$1 limit \$2/);

    const founding = fakeDb([[], [["founding"]]]);
    expect(await createDbBillingRepo(() => founding.db).applyPlanChange(guarded)).toBe("skipped_plan_guard");

    const already = fakeDb([[], [["free"]]]);
    expect(await createDbBillingRepo(() => already.db).applyPlanChange(guarded)).toBe("unchanged");
  });

  it("never queries for a user id that is not a uuid", async () => {
    const { db, calls } = fakeDb();
    expect(await createDbBillingRepo(() => db).applyPlanChange(change({ userId: "nope" }))).toBe("user_not_found");
    expect(calls).toHaveLength(0);
  });

  it("lets storage errors through so the webhook answers 500 and Paddle retries", async () => {
    const repo = createDbBillingRepo(() => {
      throw new Error("DATABASE_URL is not set");
    });
    await expect(repo.applyPlanChange(change())).rejects.toThrow();
    await expect(repo.countFoundingUsers()).rejects.toThrow();
  });
});

describe("createDbBillingRepo.countFoundingUsers", () => {
  it("counts users on the founding plan", async () => {
    const { db, calls } = fakeDb([[["42"]]]);
    expect(await createDbBillingRepo(() => db).countFoundingUsers()).toBe(42);
    expect(calls[0]!.sql).toMatch(/^select count\(\*\) from "users" where "users"\."plan" = \$1$/);
    expect(calls[0]!.params).toEqual(["founding"]);
  });
});

describe("takedown request storage", () => {
  const request = {
    name: "Rights Holder",
    email: "legal@example.test",
    target: "https://example.test/page",
    reason: "copyright" as const,
    role: "owner" as const,
    details: "This page shows my photo without permission.",
    confirm: true as const,
    locale: "ar" as const,
  };

  it("maps the form to a takedown_requests row with status open", () => {
    expect(takedownRequestRow(request)).toEqual({
      url: "https://example.test/page",
      reason: "copyright",
      name: "Rights Holder",
      contactEmail: "legal@example.test",
      role: "owner",
      details: "This page shows my photo without permission.",
      locale: "ar",
      status: "open",
    });
  });

  it("inserts into takedown_requests, never into the live takedowns list", async () => {
    const { db, calls } = fakeDb();
    await createDbTakedownRepo(() => db).save(request);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.sql).toMatch(/^insert into "takedown_requests"/);
    expect(calls[0]!.sql).not.toMatch(/"takedowns"/);
  });
});
