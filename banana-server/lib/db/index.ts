/**
 * Repositories over Drizzle + Neon HTTP. `createDbRepos(db)` takes any Drizzle db (tests
 * can pass a fake); `getRepos()` builds them over the shared client from db/client.ts,
 * reading DATABASE_URL at call time (OpenNext fills process.env per request).
 */
import { getDb, type Db } from "@/db/client";
import { canvasRepo } from "./canvases";
import { directionRepo } from "./directions";
import { blocklistRepo, feedbackRepo } from "./feedback";
import { paletteRepo } from "./palettes";
import { referenceRepo } from "./references";
import { takedownRepo } from "./takedowns";
import type { Repos } from "./types";
import { usageRepo } from "./usage";
import { userRepo } from "./users";

export type * from "./types";
export { memoTakedowns } from "./takedowns";
export { isUuid, referenceRowId, uuidFromName } from "./ids";

export function createDbRepos(db: Db): Repos {
  return {
    canvases: canvasRepo(db),
    directions: directionRepo(db),
    references: referenceRepo(db),
    palettes: paletteRepo(db),
    usage: usageRepo(db),
    takedowns: takedownRepo(db),
    users: userRepo(db),
    feedback: feedbackRepo(db),
    blocklist: blocklistRepo(db),
  };
}

let cached: { db: Db; repos: Repos } | undefined;

/** Repos over the live database. Throws when DATABASE_URL is not set; callers turn that into a plain message. */
export function getRepos(): Repos {
  const db = getDb();
  if (cached?.db !== db) cached = { db, repos: createDbRepos(db) };
  return cached.repos;
}
