/**
 * Plan lookup. Always read from the database: lib/users.ts caches rows per isolate,
 * so a plan change from the Paddle webhook would otherwise show up late.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import { planOf, type Plan } from "@/lib/quota";
import { isUuid } from "./ids";
import type { UserRepo } from "./types";

export async function getUserPlan(db: Db, userId: string): Promise<Plan> {
  if (!isUuid(userId)) return "free";
  const [row] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId)).limit(1);
  return planOf(row?.plan);
}

export function userRepo(db: Db): UserRepo {
  return { getPlan: (userId) => getUserPlan(db, userId) };
}
