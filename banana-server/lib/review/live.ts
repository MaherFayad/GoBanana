/**
 * Live wiring for client review: the Drizzle repo, or, under the test-only sign-in bypass with no
 * database (never in a production build), an in-memory repo that knows the demo share page.
 */
import { getConfig } from "@/lib/config";
import { DEMO_REVIEW_TARGET, DEMO_SHARE_TOKEN } from "@/lib/site/share-demo";
import { e2eAuthBypass } from "@/lib/web-auth";
import { buildReviewRoute } from "./http";
import type { ReviewRepo } from "./index";
import { getReviewRepo, memoryReviewRepo } from "./repo";

let demo: ReviewRepo | undefined;

/** The review repo for this request. */
export function liveReviewRepo(): ReviewRepo {
  if (e2eAuthBypass() && !process.env.DATABASE_URL) {
    demo ??= memoryReviewRepo(new Map([[DEMO_SHARE_TOKEN, DEMO_REVIEW_TARGET]]));
    return demo;
  }
  return getReviewRepo();
}

let route: ReturnType<typeof buildReviewRoute> | undefined;

export function reviewRoute(): ReturnType<typeof buildReviewRoute> {
  route ??= buildReviewRoute({ repo: liveReviewRepo, appUrl: () => getConfig().appUrl });
  return route;
}
