/**
 * The examples as a page may show them (server only): filtered by the live takedown list, or with
 * no images when the list cannot load (fail closed). The E2E sign-in bypass (never on in a
 * production build) has no database, so it checks against an empty list.
 */
import { getRepos } from "@/lib/db";
import { memoTakedowns } from "@/lib/db/takedowns";
import { compileTakedowns } from "@/lib/takedown";
import { e2eAuthBypass } from "@/lib/web-auth";
import { loadExamples, type Example } from "./examples";

export async function visibleExamples(): Promise<{ examples: Example[]; images: boolean }> {
  const loadMatcher =
    e2eAuthBypass() && !process.env.DATABASE_URL ? async () => compileTakedowns([]) : () => memoTakedowns(getRepos().takedowns)();
  return loadExamples({ loadMatcher });
}
