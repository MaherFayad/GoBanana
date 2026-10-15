/**
 * HTTP handlers for /api/review/:token (VAL-04), kept outside `app/` so tests call them with
 * fakes. No sign in: the share token is the credential. POST saves one reviewer's keep or drop vote
 * and comment on one direction; GET returns that reviewer's own votes and the directions.
 *
 * Every answer is `no-store` and `noindex`. A bad token, a lapsed plan and an unknown canvas all
 * answer the same 404, so tokens cannot be probed. Cross-site browser posts are refused by the
 * Origin check; limits live in lib/review/index.ts and the repo.
 */
import { limitsFor } from "@/lib/quota";
import { isSameOrigin } from "@/lib/request-auth";
import { isValidShareToken, applyNoindex } from "@/lib/share";
import { readBounded } from "@/lib/uploads/http";
import { MAX_BODY_BYTES, REVIEWER_KEY_RE, REVIEW_STATUS, parseReviewBody, type ReviewErrorCode, type ReviewRepo, type ReviewTarget } from "./index";

export type ReviewRouteDeps = {
  repo(): ReviewRepo;
  appUrl?(): string | undefined;
};

export const REVIEW_MESSAGES: Record<ReviewErrorCode, string> = {
  bad_request: "Send a JSON body with reviewerKey, directionKey and a verdict of keep or drop, or a comment.",
  bad_reviewer: "reviewerKey must be 16 to 64 letters, digits, dashes or underscores.",
  bad_direction: "That direction is not on this canvas.",
  bad_verdict: "verdict must be keep or drop.",
  too_large: "That request is too large.",
  forbidden_origin: "Reviews can only be sent from the shared page.",
  not_found: "This review link is not available.",
  rate_limited: "Too many changes too fast. Wait a minute and try again.",
  full: "This canvas has reached its review limit.",
  unavailable: "Reviews could not be saved right now. Try again in a minute.",
};

function headers(extra: Record<string, string> = {}): Headers {
  return applyNoindex(new Headers({ "cache-control": "no-store", "referrer-policy": "no-referrer", ...extra }));
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: headers({ "content-type": "application/json" }) });
}

function fail(code: ReviewErrorCode): Response {
  return json(REVIEW_STATUS[code], { error: code, message: REVIEW_MESSAGES[code] });
}

/** A browser post must come from this site: with an Origin header it has to match (Authorization does not excuse it). */
function sameOrigin(req: Request, appUrl: string | undefined): boolean {
  const copy = new Request(req.url, { method: req.method, headers: new Headers([...req.headers].filter(([k]) => k.toLowerCase() !== "authorization")) });
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  return isSameOrigin(copy, appUrl);
}

export function buildReviewRoute(deps: ReviewRouteDeps) {
  /** The shared canvas, or null for an unknown token or a lapsed plan (same answer for both). */
  async function targetOf(token: string): Promise<ReviewTarget | null> {
    if (!isValidShareToken(token)) return null;
    const target = await deps.repo().target(token);
    return target && limitsFor(target.ownerPlan).shareLinks ? target : null;
  }

  return {
    async GET(req: Request, token: string): Promise<Response> {
      try {
        const target = await targetOf(token);
        if (!target) return fail("not_found");
        const reviewer = new URL(req.url).searchParams.get("reviewer") ?? "";
        const votes = REVIEWER_KEY_RE.test(reviewer) ? await deps.repo().mine(target.canvasId, reviewer) : [];
        return json(200, { directions: target.directions, votes });
      } catch {
        console.error("[review] could not load");
        return fail("unavailable");
      }
    },

    async POST(req: Request, token: string): Promise<Response> {
      if (!sameOrigin(req, deps.appUrl?.())) return fail("forbidden_origin");
      try {
        const target = await targetOf(token);
        if (!target) return fail("not_found");
        const bytes = await readBounded(req, MAX_BODY_BYTES);
        if (!bytes) return fail("too_large");
        let body: unknown;
        try {
          body = JSON.parse(new TextDecoder().decode(bytes));
        } catch {
          return fail("bad_request");
        }
        const parsed = parseReviewBody(body);
        if (!parsed.ok) return fail(parsed.error);
        if (!target.directions.some((d) => d.key === parsed.value.directionKey)) return fail("bad_direction");
        const result = await deps.repo().save(target.canvasId, parsed.value);
        if (result === "rate_limited") return fail("rate_limited");
        if (result === "full" || result === "too_many_reviewers") return fail("full");
        return json(200, { ok: true, cleared: result === "cleared" });
      } catch {
        console.error("[review] could not save");
        return fail("unavailable");
      }
    },
  };
}
