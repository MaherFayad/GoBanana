/** P2-01 nightly weights and the cron handler, with a fake database. No network. */
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import {
  runNightlyWeights,
  weightCountsSql,
  weightsFromCounts,
  WEIGHT_K_ANON,
  type WeightCount,
  type WeightsStore,
} from "@/lib/learning/nightly";
import { handleScheduled, jobsFor, PURGE_CRON, WEIGHTS_CRON, type CronDb } from "@/lib/cron/scheduled";

const dialect = new PgDialect();
const NOW = new Date("2026-11-20T03:37:00Z");

const count = (over: Partial<WeightCount>): WeightCount => ({ kind: "ingredient", id: "direction|limestone", great: 3, bad: 1, users: 4, ...over });

describe("weightsFromCounts", () => {
  it("turns counts into Beta(2 + keeps, 2 + drops)", () => {
    expect(weightsFromCounts([count({ great: 5, bad: 2 })])).toEqual([{ kind: "ingredient", id: "direction|limestone", alpha: 7, beta: 4 }]);
  });

  it("drops ids that fewer than K_ANON users rated, or with no verdict", () => {
    const rows = weightsFromCounts([
      count({ id: "few", users: WEIGHT_K_ANON - 1 }),
      count({ id: "none", great: 0, bad: 0, users: 5 }),
      count({ id: "ok", users: WEIGHT_K_ANON }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["ok"]);
  });
});

describe("runNightlyWeights", () => {
  it("reads, then replaces all rows in one run", async () => {
    const written: unknown[] = [];
    const store: WeightsStore = {
      readCounts: async () => [count({}), count({ kind: "arm", id: "fidelity|flight app ui#core", great: 1, bad: 3, users: 3 })],
      replaceAll: async (rows, now) => void written.push({ rows, now }),
    };
    const result = await runNightlyWeights(store, { now: NOW });
    expect(result).toEqual({ written: 2, ingredients: 1, arms: 1, atlas: 0 });
    expect(written).toHaveLength(1);
  });
});

/** A fake Drizzle db: records each statement's SQL and answers the grouped read. */
function fakeDb(rows: Record<string, unknown>[]) {
  const statements: string[] = [];
  const db = {
    async execute(query: Parameters<typeof dialect.sqlToQuery>[0]) {
      statements.push(dialect.sqlToQuery(query).sql);
      return { rows: statements.length === 1 ? rows : [] };
    },
  };
  return { db: db as unknown as CronDb, statements };
}

describe("cron handler", () => {
  it("the weights trigger reads feedback, upserts atlas_weights and deletes stale rows", async () => {
    const { db, statements } = fakeDb([
      { kind: "ingredient", id: "direction|limestone", great: 4, bad: 0, users: 4 },
      { kind: "arm", id: "taste|dark ui#core", great: 0, bad: 3, users: 3 },
    ]);
    const jobs: Promise<unknown>[] = [];
    handleScheduled({ cron: WEIGHTS_CRON }, { DATABASE_URL: "postgres://fake" }, { waitUntil: (p) => void jobs.push(p) }, () => db);
    await Promise.all(jobs);
    expect(jobs).toHaveLength(1);
    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain('from "search_feedback"');
    expect(statements[1]).toContain('insert into "atlas_weights"');
    expect(statements[2]).toContain('delete from "atlas_weights"');
  });

  it("writes nothing but the stale sweep when no id has enough raters", async () => {
    const { db, statements } = fakeDb([{ kind: "ingredient", id: "x", great: 1, bad: 0, users: 1 }]);
    const jobs: Promise<unknown>[] = [];
    handleScheduled({ cron: WEIGHTS_CRON }, { DATABASE_URL: "postgres://fake" }, { waitUntil: (p) => void jobs.push(p) }, () => db);
    await Promise.all(jobs);
    expect(statements.some((s) => s.includes("insert into"))).toBe(false);
    expect(statements.at(-1)).toContain('delete from "atlas_weights"');
  });

  it("the purge trigger still runs both purges and not the weights", () => {
    const names = jobsFor(PURGE_CRON, fakeDb([]).db).map((j) => j.name);
    expect(names).toEqual(["purge", "ratings purge"]);
    expect(jobsFor(WEIGHTS_CRON, fakeDb([]).db).map((j) => j.name)).toEqual(["weights"]);
  });

  it("skips without DATABASE_URL and keeps a failing job from throwing", async () => {
    const waitUntil = vi.fn();
    handleScheduled({ cron: WEIGHTS_CRON }, {}, { waitUntil });
    expect(waitUntil).not.toHaveBeenCalled();

    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = { execute: async () => Promise.reject(new TypeError("secret postgres://u:p@h")) } as unknown as CronDb;
    const jobs: Promise<unknown>[] = [];
    handleScheduled({ cron: WEIGHTS_CRON }, { DATABASE_URL: "postgres://fake" }, { waitUntil: (p) => void jobs.push(p) }, () => broken);
    await expect(Promise.all(jobs)).resolves.toBeDefined();
    expect(err).toHaveBeenCalledWith("[cron] weights failed: TypeError");
    err.mockRestore();
  });

  it("groups each user once and applies the K_ANON floor in SQL", () => {
    const q = dialect.sqlToQuery(weightCountsSql(3));
    expect(q.sql).toContain("group by 1, 2, user_id");
    expect(q.sql).toContain("having count(*) >=");
    expect(q.params).toContain(3);
  });
});
