/**
 * Repository layer: Drizzle queries checked against a fake Neon HTTP client (no network,
 * no database), plus the in-memory repos the tool tests rely on.
 */
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { countCanvases, getCanvasForOwner, saveCanvasState, updateCanvas } from "@/lib/db/canvases";
import { deleteDirections, findDirectionForUser, upsertDirections } from "@/lib/db/directions";
import { isUuid, referenceRowId, uuidFromName } from "@/lib/db/ids";
import { createMemoryRepos } from "@/lib/db/memory";
import { findOwnedReferences, getReferencesByIds, insertReferences } from "@/lib/db/references";
import { armStatsSql, blocklistRepo, directionStatsSql, insertFeedback, readArmStats, readDirectionStats } from "@/lib/db/feedback";
import { PgDialect } from "drizzle-orm/pg-core";
import { listTakedowns, memoTakedowns } from "@/lib/db/takedowns";
import { incrementUsage, readUsage } from "@/lib/db/usage";
import { getUserPlan } from "@/lib/db/users";
import { ALICE, BOB, ref } from "./tools-fixtures";

type Call = { sql: string; params: unknown[] };

/** Drizzle over a fake Neon client that records SQL and answers from a queue. */
function fakeDb(answers: unknown[][] = []) {
  const calls: Call[] = [];
  const query = vi.fn(async (sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    return { rows: answers.shift() ?? [], fields: [], rowCount: 0, command: "" };
  });
  const db = drizzle({ client: { query } as never, schema }) as unknown as Db;
  return { db, calls, query };
}

const CANVAS = "33333333-3333-4333-8333-333333333333";

describe("ids", () => {
  it("recognizes uuids", () => {
    expect(isUuid(ALICE)).toBe(true);
    expect(isUuid("ref_0000000000000001")).toBe(false);
    expect(isUuid("bd-3kq9x1ma")).toBe(false);
  });

  it("builds RFC 9562 v5 uuids that match a reference implementation", async () => {
    const ns = Buffer.from("6f1c4a529b3e4d8aa6c12f7e0b5d9c31", "hex");
    const hash = createHash("sha1").update(Buffer.concat([ns, Buffer.from("hello")])).digest().subarray(0, 16);
    hash[6] = (hash[6]! & 0x0f) | 0x50;
    hash[8] = (hash[8]! & 0x3f) | 0x80;
    const hex = hash.toString("hex");
    const expected = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    expect(await uuidFromName("hello")).toBe(expected);
    expect(isUuid(expected)).toBe(true);
  });

  it("gives each canvas its own reference row id", async () => {
    const a = await referenceRowId(CANVAS, "ref_1");
    expect(await referenceRowId(CANVAS, "ref_1")).toBe(a);
    expect(await referenceRowId(ALICE, "ref_1")).not.toBe(a);
  });
});

describe("drizzle repositories", () => {
  it("increments usage with one atomic upsert", async () => {
    const { db, calls } = fakeDb();
    await incrementUsage(db, ALICE, "2026-10", { searches: 1 });
    expect(calls).toHaveLength(1);
    const sql = calls[0]!.sql;
    expect(sql).toMatch(/insert into "usage"/i);
    expect(sql).toMatch(/on conflict \("user_id","period"\) do update/i);
    expect(sql).toMatch(/"searches" = "usage"\."searches" \+ \$\d/);
    expect(calls[0]!.params).toContain(ALICE);
  });

  it("skips no-op increments and bad ids without a query", async () => {
    const { db, calls } = fakeDb();
    await incrementUsage(db, ALICE, "2026-10", {});
    await incrementUsage(db, "not-a-uuid", "2026-10", { searches: 1 });
    expect(await readUsage(db, "nope", "2026-10")).toEqual({ searches: 0, canvases: 0 });
    expect(calls).toHaveLength(0);
  });

  it("reads usage for the user and period", async () => {
    const { db, calls } = fakeDb([[[4, 1]]]);
    expect(await readUsage(db, ALICE, "2026-10")).toEqual({ searches: 4, canvases: 1 });
    expect(calls[0]!.sql).toMatch(/where \("usage"\."user_id" = \$1 and "usage"\."period" = \$2\)/);
  });

  it("scopes canvas reads and writes to the owner", async () => {
    const { db, calls } = fakeDb();
    expect(await getCanvasForOwner(db, BOB, CANVAS)).toBeNull();
    expect(calls[0]!.sql).toMatch(/"canvases"\."id" = \$1 and "canvases"\."user_id" = \$2/);
    expect(calls[0]!.params).toEqual([CANVAS, BOB, 1]);
    expect(await updateCanvas(db, BOB, CANVAS, { title: "x" })).toBe(false);
    expect(calls[1]!.sql).toMatch(/update "canvases" set "title" = \$1 where/);
    expect(calls[1]!.sql).toMatch(/"canvases"\."user_id" = \$3/);
  });

  it("never queries for ids that are not uuids", async () => {
    const { db, calls } = fakeDb();
    expect(await getCanvasForOwner(db, ALICE, "../etc")).toBeNull();
    expect(await saveCanvasState(db, ALICE, "abc", {})).toEqual({ ok: false, reason: "not_found" });
    expect(await findDirectionForUser(db, ALICE, "bd-1", "abc")).toBeNull();
    expect((await getReferencesByIds(db, "abc", ["ref_1"])).size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("saves with an optimistic check and reports a conflict", async () => {
    const at = new Date("2026-10-15T10:00:00.123Z");
    // update returns no row, then the owner check finds the canvas.
    const row = [CANVAS, ALICE, "T", null, null, null, {}, null, at];
    const { db, calls } = fakeDb([[], [row]]);
    const res = await saveCanvasState(db, ALICE, CANVAS, { nodes: [] }, { ifUpdatedAt: at });
    expect(res).toEqual({ ok: false, reason: "conflict" });
    expect(calls[0]!.sql).toMatch(/date_trunc\('milliseconds', "canvases"\."updated_at"\) = \$\d/);
    expect(calls[0]!.params).toContain(at.toISOString());
  });

  it("returns ok with the new timestamp when the save lands", async () => {
    const { db } = fakeDb([[[CANVAS]]]);
    const res = await saveCanvasState(db, ALICE, CANVAS, { nodes: [] });
    expect(res.ok).toBe(true);
  });

  it("keeps the stored taste and parts when a save does not set them, in the same statement", async () => {
    const { db, calls } = fakeDb([[[CANVAS]], [[CANVAS]], [[CANVAS]]]);
    await saveCanvasState(db, ALICE, CANVAS, { nodes: [] });
    expect(calls[0]!.sql).toMatch(
      /\$\d+::jsonb \|\| \(SELECT coalesce\(jsonb_object_agg\(kept\.key, kept\.value\), '\{\}'::jsonb\) FROM jsonb_each\("canvases"\."state"\) AS kept WHERE kept\.key IN \('taste', 'parts'\)\)/,
    );
    // The new state goes in once, not once per kept key.
    expect(calls[0]!.params.filter((p) => typeof p === "string" && p.startsWith("{")).length).toBe(1);
    // A save that sets taste (even to an empty list) writes it as given; parts still kept.
    await saveCanvasState(db, ALICE, CANVAS, { nodes: [], taste: [] });
    expect(calls[1]!.sql).toContain("IN ('parts')");
    await saveCanvasState(db, ALICE, CANVAS, { nodes: [], taste: [], parts: [] });
    expect(calls[2]!.sql).not.toContain("jsonb_each");
  });

  it("counts canvases", async () => {
    const { db } = fakeDb([[["2"]]]);
    expect(await countCanvases(db, ALICE)).toBe(2);
  });

  it("upserts directions by canvas and bend id", async () => {
    const { db, calls } = fakeDb();
    await upsertDirections(db, CANVAS, [{ bendId: "bd-1", move: "era", title: "T", searchQuery: "q" }]);
    expect(calls[0]!.sql).toMatch(/on conflict \("canvas_id","bend_id"\) do update set "move" = excluded\.move/);
  });

  it("finds directions through the owner's canvas, by bend id or uuid", async () => {
    const { db, calls } = fakeDb();
    await findDirectionForUser(db, ALICE, "bd-3kq9x1ma");
    expect(calls[0]!.sql).toMatch(/inner join "canvases" on "directions"\."canvas_id" = "canvases"\."id"/);
    expect(calls[0]!.sql).toMatch(/"canvases"\."user_id" = \$1 and "directions"\."bend_id" = \$2/);
    await findDirectionForUser(db, ALICE, CANVAS, CANVAS);
    expect(calls[1]!.sql).toMatch(/"directions"\."id" = \$2 and "directions"\."canvas_id" = \$3/);
  });

  it("stores reference URLs only, with deterministic ids; a repeat only refreshes how it was found", async () => {
    const { db, calls } = fakeDb();
    await insertReferences(db, CANVAS, [{ ...ref(1), lane: "taste", query: "minimal card ui", termKey: "taste|minimal card ui", arm: "default" }]);
    const sql = calls[0]!.sql;
    expect(sql).toMatch(/insert into "references"/);
    expect(sql).toMatch(/on conflict \("id"\) do update set/);
    // URLs are never overwritten; search details keep the stored value when the new search has none.
    expect(sql).not.toMatch(/"(source_url|image_url|thumb_url)" = /);
    expect(sql).toContain(`"lane" = coalesce(excluded."lane", "references"."lane")`);
    expect(sql).toContain(`"arm" = coalesce(excluded."arm", "references"."arm")`);
    expect(calls[0]!.params).toContain(await referenceRowId(CANVAS, ref(1).id));
    expect(calls[0]!.params).toContain(ref(1).sourceUrl);
    expect(calls[0]!.params).toEqual(expect.arrayContaining([ref(1).id, "taste", "minimal card ui", "taste|minimal card ui", "default"]));
  });

  it("maps reference lookups back to the ids the caller passed", async () => {
    const rowId = await referenceRowId(CANVAS, "ref_1");
    const row = [rowId, CANVAS, "pinterest.com", "https://p/1", "https://i/1", "https://t/1", "T", 1, 1];
    const { db } = fakeDb([[row]]);
    const map = await getReferencesByIds(db, CANVAS, ["ref_1", "ref_2"]);
    expect([...map.keys()]).toEqual(["ref_1"]);
    expect(map.get("ref_1")?.sourceUrl).toBe("https://p/1");
  });

  it("reads the plan from the users table and defaults to free", async () => {
    expect(await getUserPlan(fakeDb([[["pro_yearly"]]]).db, ALICE)).toBe("pro_yearly");
    expect(await getUserPlan(fakeDb([[]]).db, ALICE)).toBe("free");
  });

  it("lists takedowns", async () => {
    const { db } = fakeDb([[["example.com"], ["https://www.pinterest.com/pin/9/"]]]);
    expect(await listTakedowns(db)).toEqual(["example.com", "https://www.pinterest.com/pin/9/"]);
  });
});

describe("memoTakedowns", () => {
  it("reads the list once per request and retries after a failure", async () => {
    const list = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(["example.com"]);
    const load = memoTakedowns({ list });
    await expect(load()).rejects.toThrow();
    const m = await load();
    await load();
    expect(list).toHaveBeenCalledTimes(2);
    expect(m.isBlocked("https://sub.example.com/x")).toBe(true);
  });
});

describe("memory repos", () => {
  it("checks ownership and optimistic saves like the database", async () => {
    const repos = createMemoryRepos();
    const c = await repos.canvases.create({ userId: ALICE, title: "A", state: {} });
    expect(await repos.canvases.getOwned(BOB, c.id)).toBeNull();
    expect(await repos.canvases.saveState(BOB, c.id, {})).toEqual({ ok: false, reason: "not_found" });
    const first = await repos.canvases.saveState(ALICE, c.id, { n: 1 }, { ifUpdatedAt: c.updatedAt });
    expect(first.ok).toBe(true);
    expect(await repos.canvases.saveState(ALICE, c.id, { n: 2 }, { ifUpdatedAt: c.updatedAt })).toEqual({
      ok: false,
      reason: "conflict",
    });
  });

  it("upserts usage counts", async () => {
    const repos = createMemoryRepos();
    await repos.usage.addSearches(ALICE, "2026-10", 1);
    await repos.usage.addSearches(ALICE, "2026-10", 2);
    await repos.usage.addCanvases(ALICE, "2026-10", 1);
    expect(await repos.usage.get(ALICE, "2026-10")).toEqual({ searches: 3, canvases: 1 });
  });
});

describe("search learning repositories", () => {
  const fb = (userId: string, verdict: "great" | "bad", arm = "agent:film strip", termKey = "inspiration|film frames") => ({
    userId,
    itemKey: `pinterest:${Math.random()}`,
    sourceSite: "pinterest.com",
    lane: "inspiration",
    query: "film strip",
    termKey,
    arm,
    verdict,
    reasons: [],
    creator: null,
  });

  it("groups arm stats so each user counts once, and returns no user ids", () => {
    const q = new PgDialect().sqlToQuery(armStatsSql(ALICE, ["inspiration|film frames", "taste|x"]));
    const sql = q.sql.replace(/\s+/g, " ");
    expect(sql).toContain("group by term_key, arm, user_id ) per_user group by term_key, arm");
    expect(sql).toContain("count(*) filter (where g > b)::int as great");
    expect(sql).toContain("count(*) filter (where b > g)::int as bad");
    expect(sql).toContain("where term_key in ($3, $4) and arm is not null");
    expect(sql).not.toMatch(/select[^(]*\buser_id\b[^(]*from \(/);
    expect(q.params).toEqual([ALICE, ALICE, "inspiration|film frames", "taste|x"]);
  });

  it("groups direction stats per ingredient in one query, each user once, no user ids out", async () => {
    const q = new PgDialect().sqlToQuery(directionStatsSql(ALICE, 3));
    const sql = q.sql.replace(/\s+/g, " ");
    expect(sql).toContain("where lane = 'direction' and term_key like 'direction|%' group by term_key, user_id ) per_user group by term_key");
    expect(sql).toContain("having count(*) >= $3 or bool_or(user_id = $4::uuid)");
    expect(sql).not.toMatch(/select[^(]*\buser_id\b[^(]*from \(/);
    expect(q.params).toEqual([ALICE, ALICE, 3, ALICE, 5000]);
    const { db, calls } = fakeDb([[{ term_key: "direction|x", great: 1, bad: 2, users: 3, own_great: 0, own_bad: 1 }]]);
    expect(await readDirectionStats(db, ALICE, 3)).toEqual([{ termKey: "direction|x", great: 1, bad: 2, users: 3, ownGreat: 0, ownBad: 1 }]);
    expect(await readDirectionStats(db, "x", 3)).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("deletes directions of one canvas by row uuid only", async () => {
    const { db, calls } = fakeDb([[{ id: BOB }]]);
    expect(await deleteDirections(db, CANVAS, [BOB, "bd-1", BOB])).toBe(1);
    expect(calls[0]!.sql).toMatch(/^delete from "directions" where \("directions"\."canvas_id" = \$1 and "directions"\."id" in \(\$2\)\) returning "id"$/);
    expect(calls[0]!.params).toEqual([CANVAS, BOB]);
    expect(await deleteDirections(db, CANVAS, ["bd-1"])).toBe(0);
    expect(await deleteDirections(db, "x", [BOB])).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it("maps arm stats rows and skips bad input without a query", async () => {
    const { db, calls } = fakeDb([[{ term_key: "t", arm: "a", great: 2, bad: 1, users: 3, own_great: 4, own_bad: 0 }]]);
    expect(await readArmStats(db, ALICE, ["t"])).toEqual([{ termKey: "t", arm: "a", great: 2, bad: 1, users: 3, ownGreat: 4, ownBad: 0 }]);
    expect(await readArmStats(db, "x", ["t"])).toEqual([]);
    expect(await readArmStats(db, ALICE, [])).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("inserts ratings and blocked items for real user ids only", async () => {
    const { db, calls } = fakeDb();
    await insertFeedback(db, [fb(ALICE, "bad"), fb("not-a-uuid", "bad")]);
    expect(calls[0]!.sql).toMatch(/^insert into "search_feedback"/);
    expect(calls[0]!.params).toContain(ALICE);
    expect(calls[0]!.params).not.toContain("not-a-uuid");
    await blocklistRepo(db).add(ALICE, ["dribbble:1", "dribbble:1", "pinterest:2"]);
    expect(calls[1]!.sql).toMatch(/^insert into "blocked_items" .* on conflict do nothing$/);
    expect(calls[1]!.params.filter((p) => p === "dribbble:1")).toHaveLength(1);
    await blocklistRepo(db).add("x", ["dribbble:1"]);
    expect(calls).toHaveLength(2);
  });

  it("looks up references on the user's own canvases only", async () => {
    const { db, calls } = fakeDb([[]]);
    await findOwnedReferences(db, ALICE, ["ref_1", CANVAS]);
    expect(calls[0]!.sql).toContain('inner join "canvases" on "canvases"."id" = "references"."canvas_id"');
    expect(calls[0]!.sql).toContain('"canvases"."user_id" = $1');
    expect(calls[0]!.params).toEqual(expect.arrayContaining([ALICE, "ref_1", CANVAS]));
  });

  it("memory repos: one vote per user per term and arm, own raw counts, blocklist per user", async () => {
    const repos = createMemoryRepos();
    const C = "44444444-4444-4444-8444-444444444444";
    await repos.feedback.insertMany([
      fb(ALICE, "great"), fb(ALICE, "great"), fb(ALICE, "great"), fb(ALICE, "bad"),
      fb(BOB, "bad"),
      fb(C, "great"), fb(C, "bad"),
      fb(BOB, "great", "default"),
      fb(BOB, "great", "agent:film strip", "other|term"),
    ]);
    const stats = await repos.feedback.armStats(ALICE, ["inspiration|film frames"]);
    expect(stats).toEqual(
      expect.arrayContaining([
        { termKey: "inspiration|film frames", arm: "agent:film strip", great: 1, bad: 1, users: 3, ownGreat: 3, ownBad: 1 },
        { termKey: "inspiration|film frames", arm: "default", great: 1, bad: 0, users: 1, ownGreat: 0, ownBad: 0 },
      ]),
    );
    expect(stats).toHaveLength(2);
    await repos.blocklist.add(ALICE, ["dribbble:1", "dribbble:1"]);
    expect(await repos.blocklist.list(ALICE)).toEqual(["dribbble:1"]);
    expect(await repos.blocklist.list(BOB)).toEqual([]);
  });
});

