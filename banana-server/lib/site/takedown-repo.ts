/**
 * Storage for takedown requests. Stub until the db layer is final.
 *
 * TODO(db): the `takedowns` table (spec section 11) is the live block list, which
 * search and canvas loads check. A request should be reviewed before it blocks
 * anything, so either add a `takedown_requests` table (name, email, target, reason,
 * role, details, locale, status, created_at) or insert straight into `takedowns`
 * if the owner wants requests to block at once. Also notify the owner by email.
 * TODO(abuse): rate limit by IP (Cloudflare rate limiting rule on /api/takedown).
 */
import type { TakedownRequest } from "./takedown-form";

export interface TakedownRepo {
  save(request: TakedownRequest): Promise<void>;
}

export class TakedownRepoNotWiredError extends Error {
  constructor() {
    super("Takedown repository is not wired to the database yet");
    this.name = "TakedownRepoNotWiredError";
  }
}

export const stubTakedownRepo: TakedownRepo = {
  async save() {
    // Never accept a request in production that would then be dropped.
    if (process.env.NODE_ENV === "production") throw new TakedownRepoNotWiredError();
  },
};

let current: TakedownRepo = stubTakedownRepo;
export const getTakedownRepo = (): TakedownRepo => current;
export const setTakedownRepo = (repo: TakedownRepo): void => {
  current = repo;
};
