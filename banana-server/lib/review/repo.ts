/** Review repos: Drizzle over Neon (review_feedback, migration 0009) and an in-memory twin for tests and the E2E bypass. */
import { and, count, countDistinct, desc, eq, gt } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { canvases, directions, reviewFeedback, users } from "@/db/schema";
import { isUuid } from "@/lib/db/ids";
import { planOf } from "@/lib/quota";
import { isValidShareToken } from "@/lib/share";
import {
  CANVAS_WRITES_PER_MINUTE,
  MAX_REVIEWERS_PER_CANVAS,
  MAX_ROWS_PER_CANVAS,
  REVIEWER_WRITES_PER_MINUTE,
  SUMMARY_COMMENTS,
  type DirectionReview,
  type ReviewRepo,
  type ReviewSaveResult,
  type ReviewTarget,
  type ReviewVerdict,
  type ReviewVote,
} from "./index";

const MINUTE = 60_000;

const asVerdict = (v: string | null): ReviewVerdict | null => (v === "keep" || v === "drop" ? v : null);

export function reviewRepo(db: Db): ReviewRepo {
  return {
    async target(token) {
      if (!isValidShareToken(token)) return null;
      const [row] = await db
        .select({ id: canvases.id, plan: users.plan })
        .from(canvases)
        .innerJoin(users, eq(users.id, canvases.userId))
        .where(eq(canvases.shareToken, token))
        .limit(1);
      if (!row) return null;
      const dirs = await db
        .select({ id: directions.id, bendId: directions.bendId, title: directions.title })
        .from(directions)
        .where(eq(directions.canvasId, row.id));
      return { canvasId: row.id, ownerPlan: planOf(row.plan), directions: dirs.map((d) => ({ key: d.bendId ?? d.id, title: d.title })) };
    },

    async save(canvasId, input, now = new Date()) {
      if (!isUuid(canvasId)) return "full";
      const since = new Date(now.getTime() - MINUTE);
      const [existing] = await db
        .select({ id: reviewFeedback.id, updatedAt: reviewFeedback.updatedAt })
        .from(reviewFeedback)
        .where(
          and(
            eq(reviewFeedback.canvasId, canvasId),
            eq(reviewFeedback.directionKey, input.directionKey),
            eq(reviewFeedback.reviewerKey, input.reviewerKey),
          ),
        )
        .limit(1);

      const [mine] = await db
        .select({ n: count() })
        .from(reviewFeedback)
        .where(and(eq(reviewFeedback.canvasId, canvasId), eq(reviewFeedback.reviewerKey, input.reviewerKey), gt(reviewFeedback.updatedAt, since)));
      if (Number(mine?.n ?? 0) >= REVIEWER_WRITES_PER_MINUTE) return "rate_limited";
      const [all] = await db
        .select({ n: count() })
        .from(reviewFeedback)
        .where(and(eq(reviewFeedback.canvasId, canvasId), gt(reviewFeedback.updatedAt, since)));
      if (Number(all?.n ?? 0) >= CANVAS_WRITES_PER_MINUTE) return "rate_limited";

      const clearing = input.verdict === null && input.comment === null;
      if (clearing) {
        if (existing) await db.delete(reviewFeedback).where(eq(reviewFeedback.id, existing.id));
        return "cleared";
      }

      if (!existing) {
        const [totals] = await db
          .select({ rows: count(), reviewers: countDistinct(reviewFeedback.reviewerKey) })
          .from(reviewFeedback)
          .where(eq(reviewFeedback.canvasId, canvasId));
        if (Number(totals?.rows ?? 0) >= MAX_ROWS_PER_CANVAS) return "full";
        if (Number(totals?.reviewers ?? 0) >= MAX_REVIEWERS_PER_CANVAS) {
          const [known] = await db
            .select({ n: count() })
            .from(reviewFeedback)
            .where(and(eq(reviewFeedback.canvasId, canvasId), eq(reviewFeedback.reviewerKey, input.reviewerKey)));
          if (Number(known?.n ?? 0) === 0) return "too_many_reviewers";
        }
      }

      await db
        .insert(reviewFeedback)
        .values({
          canvasId,
          directionKey: input.directionKey,
          reviewerKey: input.reviewerKey,
          reviewerName: input.name,
          verdict: input.verdict,
          comment: input.comment,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [reviewFeedback.canvasId, reviewFeedback.directionKey, reviewFeedback.reviewerKey],
          set: { reviewerName: input.name, verdict: input.verdict, comment: input.comment, updatedAt: now },
        });
      return "saved";
    },

    async mine(canvasId, reviewerKey) {
      if (!isUuid(canvasId)) return [];
      const rows = await db
        .select({ directionKey: reviewFeedback.directionKey, verdict: reviewFeedback.verdict, comment: reviewFeedback.comment, name: reviewFeedback.reviewerName })
        .from(reviewFeedback)
        .where(and(eq(reviewFeedback.canvasId, canvasId), eq(reviewFeedback.reviewerKey, reviewerKey)));
      return rows.map((r) => ({ ...r, verdict: asVerdict(r.verdict) }));
    },

    async summary(canvasId) {
      if (!isUuid(canvasId)) return [];
      const rows = await db
        .select({
          directionKey: reviewFeedback.directionKey,
          verdict: reviewFeedback.verdict,
          comment: reviewFeedback.comment,
          name: reviewFeedback.reviewerName,
          updatedAt: reviewFeedback.updatedAt,
        })
        .from(reviewFeedback)
        .where(eq(reviewFeedback.canvasId, canvasId))
        .orderBy(desc(reviewFeedback.updatedAt))
        .limit(MAX_ROWS_PER_CANVAS);
      return summarize(rows.map((r) => ({ ...r, verdict: asVerdict(r.verdict) })));
    },
  };
}

type Row = { directionKey: string; verdict: ReviewVerdict | null; comment: string | null; name: string | null; updatedAt: Date };

/** Group rows (newest first) into one summary per direction. */
export function summarize(rows: readonly Row[]): DirectionReview[] {
  const by = new Map<string, DirectionReview>();
  for (const r of rows) {
    const s = by.get(r.directionKey) ?? { directionKey: r.directionKey, keep: 0, drop: 0, comments: [], commentCount: 0 };
    if (r.verdict === "keep") s.keep++;
    if (r.verdict === "drop") s.drop++;
    if (r.comment) {
      s.commentCount++;
      if (s.comments.length < SUMMARY_COMMENTS) s.comments.push({ name: r.name, verdict: r.verdict, comment: r.comment, at: r.updatedAt.toISOString() });
    }
    by.set(r.directionKey, s);
  }
  return [...by.values()];
}

/** In-memory repo with the same rules. `shared` maps a share token to its canvas for the target lookup. */
export function memoryReviewRepo(
  shared: Map<string, ReviewTarget> = new Map(),
): ReviewRepo & { rows: (Row & { canvasId: string; reviewerKey: string })[]; shared: Map<string, ReviewTarget> } {
  const rows: (Row & { canvasId: string; reviewerKey: string })[] = [];
  return {
    rows,
    shared,
    async target(token) {
      if (!isValidShareToken(token)) return null;
      const t = shared.get(token);
      return t ? { ...t, directions: t.directions.map((d) => ({ ...d })) } : null;
    },
    async save(canvasId, input, now = new Date()) {
      const since = now.getTime() - MINUTE;
      const ofCanvas = rows.filter((r) => r.canvasId === canvasId);
      const at = ofCanvas.findIndex((r) => r.directionKey === input.directionKey && r.reviewerKey === input.reviewerKey);
      if (ofCanvas.filter((r) => r.reviewerKey === input.reviewerKey && r.updatedAt.getTime() > since).length >= REVIEWER_WRITES_PER_MINUTE) return "rate_limited";
      if (ofCanvas.filter((r) => r.updatedAt.getTime() > since).length >= CANVAS_WRITES_PER_MINUTE) return "rate_limited";
      if (input.verdict === null && input.comment === null) {
        if (at >= 0) rows.splice(rows.indexOf(ofCanvas[at]!), 1);
        return "cleared";
      }
      if (at < 0) {
        if (ofCanvas.length >= MAX_ROWS_PER_CANVAS) return "full";
        const reviewers = new Set(ofCanvas.map((r) => r.reviewerKey));
        if (reviewers.size >= MAX_REVIEWERS_PER_CANVAS && !reviewers.has(input.reviewerKey)) return "too_many_reviewers";
        rows.push({ canvasId, reviewerKey: input.reviewerKey, directionKey: input.directionKey, verdict: input.verdict, comment: input.comment, name: input.name, updatedAt: now });
      } else {
        Object.assign(ofCanvas[at]!, { verdict: input.verdict, comment: input.comment, name: input.name, updatedAt: now });
      }
      return "saved" satisfies ReviewSaveResult;
    },
    async mine(canvasId, reviewerKey): Promise<ReviewVote[]> {
      return rows
        .filter((r) => r.canvasId === canvasId && r.reviewerKey === reviewerKey)
        .map((r) => ({ directionKey: r.directionKey, verdict: r.verdict, comment: r.comment, name: r.name }));
    },
    async summary(canvasId) {
      return summarize(rows.filter((r) => r.canvasId === canvasId).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
    },
  };
}

let cached: { db: Db; repo: ReviewRepo } | undefined;

/** Review repo over the live database. Throws when DATABASE_URL is not set. */
export function getReviewRepo(): ReviewRepo {
  const db = getDb();
  if (cached?.db !== db) cached = { db, repo: reviewRepo(db) };
  return cached.repo;
}
