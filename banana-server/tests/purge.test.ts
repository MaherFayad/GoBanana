/** 30-day purge of references not placed on a canvas (spec section 11). Fakes only. */
import { drizzle } from "drizzle-orm/neon-http";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import {
  createDbPurgeStore,
  isImagePlaced,
  purgeBatchSql,
  purgeCutoff,
  purgeUnplacedReferences,
  type PurgeStore,
} from "@/lib/purge/references";
import {
  createDbFeedbackPurgeStore,
  FEEDBACK_RETENTION_MONTHS,
  feedbackCutoff,
  feedbackPurgeSql,
  purgeOldFeedback,
  type FeedbackPurgeStore,
} from "@/lib/purge/feedback";

const NOW = new Date("2026-11-20T03:17:00Z");
const DAY = 24 * 60 * 60 * 1000;

type Ref = { id: string; canvasId: string; imageUrl: string; createdAt: Date };

/** Same rule as the SQL: old, and no node on its own canvas shows its image URL. */
function memoryStore(refs: Ref[], states: Map<string, unknown>): PurgeStore & { refs: Ref[] } {
  return {
    refs,
    async deleteUnplacedBefore(cutoff, limit) {
      const doomed = refs
        .filter((r) => r.createdAt < cutoff && !isImagePlaced(states.get(r.canvasId), r.imageUrl))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, limit);
      for (const d of doomed) refs.splice(refs.indexOf(d), 1);
      return doomed.length;
    },
  };
}

const node = (imageUrl: string) => ({ id: "n", type: "image", x: 0, y: 0, w: 1, h: 1, data: { imageUrl, sourceUrl: "https://s.test" } });

describe("purgeUnplacedReferences", () => {
  it("deletes old unplaced rows and keeps placed or recent ones", async () => {
    const old = new Date(NOW.getTime() - 31 * DAY);
    const recent = new Date(NOW.getTime() - 29 * DAY);
    const states = new Map<string, unknown>([
      ["c1", { version: 1, nodes: [node("https://img.test/placed.jpg")], tray: [{ id: "ref_x", imageUrl: "https://img.test/tray.jpg" }] }],
      ["c2", { version: 1, nodes: [node("https://img.test/other-canvas.jpg")] }],
    ]);
    const store = memoryStore(
      [
        { id: "placed", canvasId: "c1", imageUrl: "https://img.test/placed.jpg", createdAt: old },
        { id: "tray-only", canvasId: "c1", imageUrl: "https://img.test/tray.jpg", createdAt: old },
        { id: "unplaced", canvasId: "c1", imageUrl: "https://img.test/gone.jpg", createdAt: old },
        // Placed only on a different canvas: not placed on its own.
        { id: "elsewhere", canvasId: "c1", imageUrl: "https://img.test/other-canvas.jpg", createdAt: old },
        { id: "recent", canvasId: "c1", imageUrl: "https://img.test/new.jpg", createdAt: recent },
      ],
      states,
    );
    const res = await purgeUnplacedReferences(store, { now: NOW });
    expect(res).toMatchObject({ deleted: 3, done: true });
    expect(store.refs.map((r) => r.id).sort()).toEqual(["placed", "recent"]);
  });

  it("works in batches and stops at maxBatches, leaving the rest for the next run", async () => {
    const old = new Date(NOW.getTime() - 40 * DAY);
    const refs = Array.from({ length: 25 }, (_, i) => ({ id: `r${i}`, canvasId: "c", imageUrl: `https://i.test/${i}`, createdAt: old }));
    const store = memoryStore(refs, new Map());
    const spy = vi.spyOn(store, "deleteUnplacedBefore");
    const first = await purgeUnplacedReferences(store, { now: NOW, batchSize: 10, maxBatches: 2 });
    expect(first).toMatchObject({ deleted: 20, batches: 2, done: false });
    const second = await purgeUnplacedReferences(store, { now: NOW, batchSize: 10, maxBatches: 2 });
    expect(second).toMatchObject({ deleted: 5, batches: 1, done: true });
    expect(store.refs).toHaveLength(0);
    expect(spy.mock.calls[0]![0]).toEqual(purgeCutoff(NOW));
  });

  it("uses a 30 day cutoff", () => {
    expect(purgeCutoff(NOW).toISOString()).toBe("2026-10-21T03:17:00.000Z");
  });

  it("matches placed images by node data only", () => {
    expect(isImagePlaced({ nodes: [node("a")] }, "a")).toBe(true);
    expect(isImagePlaced({ nodes: [node("a")], tray: [{ imageUrl: "b" }] }, "b")).toBe(false);
    expect(isImagePlaced({}, "a")).toBe(false);
    expect(isImagePlaced(null, "a")).toBe(false);
  });
});

describe("purge SQL", () => {
  it("is one batched delete with a jsonb containment check against the reference's own canvas", () => {
    const cutoff = purgeCutoff(NOW);
    const q = new PgDialect().sqlToQuery(purgeBatchSql(cutoff, 500));
    const sql = q.sql.replace(/\s+/g, " ");
    expect(sql).toMatch(/^ ?delete from "references" where "id" in \( select r\."id" from "references" r/);
    expect(sql).toContain('r."created_at" < $1');
    expect(sql).toContain('c."id" = r."canvas_id"');
    expect(sql).toContain(`coalesce(c."state" -> 'nodes', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('data', jsonb_build_object('imageUrl', r."image_url")))`);
    expect(sql).toContain("limit $2");
    expect(sql).toMatch(/returning "id"$/);
    expect(q.params).toEqual([cutoff.toISOString(), 500]);
  });

  it("counts deleted rows from the driver result", async () => {
    const calls: string[] = [];
    const query = vi.fn(async (sql: string) => {
      calls.push(sql);
      return { rows: [{ id: "a" }, { id: "b" }], fields: [], rowCount: 2, command: "DELETE" };
    });
    const store = createDbPurgeStore(drizzle({ client: { query } as never }));
    expect(await store.deleteUnplacedBefore(purgeCutoff(NOW), 100)).toBe(2);
    expect(calls[0]).toMatch(/delete from "references"/);
  });
});

describe("12-month purge of search ratings", () => {
  it("deletes ratings older than 12 calendar months in batches, keeps newer ones", async () => {
    const rows = [
      { id: "old1", createdAt: new Date("2025-11-19T00:00:00Z") },
      { id: "old2", createdAt: new Date("2025-11-20T03:16:59Z") },
      { id: "edge", createdAt: new Date("2025-11-20T03:17:00Z") },
      { id: "new", createdAt: new Date("2026-06-01T00:00:00Z") },
    ];
    const store: FeedbackPurgeStore = {
      async deleteBefore(cutoff, limit) {
        const doomed = rows.filter((r) => r.createdAt < cutoff).slice(0, limit);
        for (const d of doomed) rows.splice(rows.indexOf(d), 1);
        return doomed.length;
      },
    };
    expect(feedbackCutoff(NOW).toISOString()).toBe("2025-11-20T03:17:00.000Z");
    expect(FEEDBACK_RETENTION_MONTHS).toBe(12);
    const res = await purgeOldFeedback(store, { now: NOW, batchSize: 1 });
    expect(res).toMatchObject({ deleted: 2, done: true });
    expect(rows.map((r) => r.id)).toEqual(["edge", "new"]);
  });

  it("is one batched delete on search_feedback by created_at", async () => {
    const cutoff = feedbackCutoff(NOW);
    const q = new PgDialect().sqlToQuery(feedbackPurgeSql(cutoff, 1000));
    const sql = q.sql.replace(/\s+/g, " ");
    expect(sql).toMatch(/^ ?delete from "search_feedback" where "id" in \( select "id" from "search_feedback" where "created_at" < \$1 order by "created_at" limit \$2 \) returning "id"$/);
    expect(q.params).toEqual([cutoff.toISOString(), 1000]);
    const query = vi.fn(async () => ({ rows: [{ id: "a" }], fields: [], rowCount: 1, command: "DELETE" }));
    expect(await createDbFeedbackPurgeStore(drizzle({ client: { query } as never })).deleteBefore(cutoff, 10)).toBe(1);
  });

  it("runs from the daily cron next to the reference purge", async () => {
    const { readFileSync } = await import("node:fs");
    const worker = readFileSync(new URL("../custom-worker.ts", import.meta.url), "utf8");
    expect(worker).toContain("purgeOldFeedback");
    expect(worker).toContain('from "./lib/purge/feedback"');
  });
});
