/**
 * `takedowns` table: the live block list (spec section 2 rule 5). Read on every search
 * and canvas load. `memoTakedowns` shares one read across a single request or tool call;
 * nothing is cached across requests, so a new entry blocks at once.
 */
import type { Db } from "@/db/client";
import { takedowns } from "@/db/schema";
import { compileTakedowns, type TakedownMatcher } from "@/lib/takedown";
import type { TakedownRepo } from "./types";

export async function listTakedowns(db: Db): Promise<string[]> {
  const rows = await db.select({ value: takedowns.urlOrDomain }).from(takedowns);
  return rows.map((r) => r.value);
}

export function takedownRepo(db: Db): TakedownRepo {
  return { list: () => listTakedowns(db) };
}

/** One list read per request: call once per request or tool call, then reuse the returned loader. */
export function memoTakedowns(repo: TakedownRepo): () => Promise<TakedownMatcher> {
  let pending: Promise<TakedownMatcher> | undefined;
  return () => {
    pending ??= repo.list().then((entries) => compileTakedowns(entries));
    // A failed read is not kept, so a retry in the same request can try again.
    pending.catch(() => {
      pending = undefined;
    });
    return pending;
  };
}
