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
import { findDirectionForUser, upsertDirections } from "@/lib/db/directions";
import { isUuid, referenceRowId, uuidFromName } from "@/lib/db/ids";
import { createMemoryRepos } from "@/lib/db/memory";
import { getReferencesByIds, insertReferences } from "@/lib/db/references";
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

  it("stores reference URLs only, with deterministic ids, and ignores repeats", async () => {
    const { db, calls } = fakeDb();
    await insertReferences(db, CANVAS, [ref(1)]);
    const sql = calls[0]!.sql;
    expect(sql).toMatch(/insert into "references"/);
    expect(sql).toMatch(/on conflict \("id"\) do nothing/);
    expect(calls[0]!.params).toContain(await referenceRowId(CANVAS, ref(1).id));
    expect(calls[0]!.params).toContain(ref(1).sourceUrl);
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
