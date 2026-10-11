/** Drizzle side of account deletion. Foreign keys cascade from `users` to every other table the user owns. */
import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { users } from "@/db/schema";
import { isUuid } from "@/lib/db/ids";
import type { AccountRepo } from "./delete";

export function createDbAccountRepo(db: () => Db = getDb): AccountRepo {
  return {
    async deleteUser(userId) {
      if (!isUuid(userId)) return null;
      const [row] = await db().delete(users).where(eq(users.id, userId)).returning({ workosId: users.workosId });
      return row ?? null;
    },
  };
}
