/**
 * Storage for takedown requests from the public form (POST /api/takedown).
 *
 * Requests go to `takedown_requests`, never straight into `takedowns`: the live block
 * list that search and canvas loads check stays admin managed, so a request blocks
 * nothing until the owner reviews it (see DECISIONS.md for the SQL to accept one).
 * Rows hold names and emails: never log them.
 *
 * TODO(abuse): rate limit by IP (Cloudflare rate limiting rule on /api/takedown).
 * TODO(notify): email the owner when a request arrives.
 */
import { getDb, type Db } from "@/db/client";
import { takedownRequests } from "@/db/schema";
import type { TakedownRequest } from "./takedown-form";

export interface TakedownRepo {
  save(request: TakedownRequest): Promise<void>;
}

/** Kept for callers that still check for it; the Drizzle repo is the default now. */
export class TakedownRepoNotWiredError extends Error {
  constructor() {
    super("Takedown repository is not wired to the database yet");
    this.name = "TakedownRepoNotWiredError";
  }
}

/** Row values for a validated form request. Pure, so tests can check the mapping. */
export function takedownRequestRow(request: TakedownRequest): typeof takedownRequests.$inferInsert {
  return {
    url: request.target,
    reason: request.reason,
    name: request.name,
    contactEmail: request.email,
    role: request.role,
    details: request.details,
    locale: request.locale,
    status: "open",
  };
}

/** Drizzle repo. `db` is read per call so a missing DATABASE_URL fails the request (500), not the import. */
export function createDbTakedownRepo(db: () => Db = getDb): TakedownRepo {
  return {
    async save(request) {
      await db().insert(takedownRequests).values(takedownRequestRow(request));
    },
  };
}

let current: TakedownRepo | undefined;
export const getTakedownRepo = (): TakedownRepo => (current ??= createDbTakedownRepo());
export const setTakedownRepo = (repo: TakedownRepo): void => {
  current = repo;
};
