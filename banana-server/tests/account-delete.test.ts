/**
 * Account deletion (spec M7 "Done when": account deletion removes all data and R2
 * objects). Fake R2 with real pagination and a fake database that cascades the way
 * the schema's foreign keys do; the schema itself is checked so the cascade is real.
 */
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { createDbAccountRepo } from "@/lib/account/db";
import { deleteAccountData, deleteR2Prefix, type AccountRepo } from "@/lib/account/delete";
import { fakeR2 } from "./fake-r2";
import { ALICE, BOB } from "./tools-fixtures";

type Row = { userId: string; table: string };

/** A tiny database: rows for each user-owned table, removed by user like ON DELETE CASCADE. */
function fakeDatabase(users: string[]) {
  const userRows = new Map(users.map((u) => [u, { workosId: `user_${u.slice(0, 4)}` }]));
  const rows: Row[] = [];
  for (const u of users) {
    for (const table of ["canvases", "directions", "references", "palettes", "uploads", "usage", "search_feedback", "blocked_items"]) {
      for (let i = 0; i < 3; i++) rows.push({ userId: u, table });
    }
  }
  const repo: AccountRepo = {
    async deleteUser(userId) {
      const row = userRows.get(userId);
      if (!row) return null;
      userRows.delete(userId);
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.userId === userId) rows.splice(i, 1);
      return row;
    },
  };
  return { repo, userRows, rows };
}

function seed(bucket: ReturnType<typeof fakeR2>, userId: string, n: number) {
  for (let i = 0; i < n; i++) bucket.objects.set(`u/${userId}/${String(i).padStart(6, "0")}`, { bytes: new Uint8Array([i % 256]) });
}

describe("deleteAccountData", () => {
  it("removes every R2 object under u/<userId>/ across many pages, and every row", async () => {
    const bucket = fakeR2();
    seed(bucket, ALICE, 2500);
    seed(bucket, BOB, 7);
    bucket.objects.set(`u/${ALICE}-other/keep`, { bytes: new Uint8Array([1]) });
    const db = fakeDatabase([ALICE, BOB]);

    const res = await deleteAccountData({ bucket, repo: db.repo }, ALICE);

    expect(res).toEqual({ ok: true, objectsDeleted: 2500, workosId: `user_${ALICE.slice(0, 4)}` });
    expect([...bucket.objects.keys()].filter((k) => k.startsWith(`u/${ALICE}/`))).toEqual([]);
    // Bob and a look-alike prefix are untouched.
    expect([...bucket.objects.keys()].filter((k) => k.startsWith(`u/${BOB}/`))).toHaveLength(7);
    expect(bucket.objects.has(`u/${ALICE}-other/keep`)).toBe(true);
    expect(db.userRows.has(ALICE)).toBe(false);
    expect(db.rows.filter((r) => r.userId === ALICE)).toEqual([]);
    expect(db.rows.filter((r) => r.userId === BOB)).toHaveLength(24);
    // Three list pages of 1000 for the first sweep, one empty page for the second.
    expect(bucket.calls.list).toBe(4);
    expect(bucket.calls.delete).toBe(3);
  });

  it("catches an upload that lands while the account is being deleted", async () => {
    const bucket = fakeR2();
    seed(bucket, ALICE, 3);
    const db = fakeDatabase([ALICE]);
    let raced = false;
    const deleteUser = db.repo.deleteUser;
    db.repo.deleteUser = async (id) => {
      if (!raced) {
        raced = true;
        bucket.objects.set(`u/${ALICE}/late`, { bytes: new Uint8Array([9]) });
      }
      return deleteUser(id);
    };
    const res = await deleteAccountData({ bucket, repo: db.repo }, ALICE);
    expect(res.ok && res.objectsDeleted).toBe(4);
    expect(bucket.objects.size).toBe(0);
  });

  it("keeps the account when R2 is missing or fails, so the user can try again", async () => {
    const db = fakeDatabase([ALICE]);
    expect(await deleteAccountData({ bucket: null, repo: db.repo }, ALICE)).toEqual({ ok: false, reason: "storage_unavailable" });
    const failing = fakeR2({ failDelete: true });
    seed(failing, ALICE, 2);
    await expect(deleteAccountData({ bucket: failing, repo: db.repo }, ALICE)).rejects.toThrow();
    expect(db.userRows.has(ALICE)).toBe(true);
    expect(db.rows).toHaveLength(24);
  });

  it("refuses ids that are not uuids, so a prefix can never widen", async () => {
    const bucket = fakeR2();
    seed(bucket, ALICE, 2);
    const db = fakeDatabase([ALICE]);
    expect(await deleteAccountData({ bucket, repo: db.repo }, "")).toEqual({ ok: false, reason: "invalid_user" });
    expect(await deleteAccountData({ bucket, repo: db.repo }, "*")).toEqual({ ok: false, reason: "invalid_user" });
    expect(bucket.objects.size).toBe(2);
    await expect(deleteR2Prefix(bucket, "")).rejects.toThrow();
  });

  it("works for a user with no uploads", async () => {
    const bucket = fakeR2();
    const db = fakeDatabase([ALICE]);
    expect(await deleteAccountData({ bucket, repo: db.repo }, ALICE)).toMatchObject({ ok: true, objectsDeleted: 0 });
    expect(db.userRows.size).toBe(0);
  });
});

describe("schema cascades from users", () => {
  const tables: PgTable[] = [
    schema.canvases,
    schema.directions,
    schema.references,
    schema.palettes,
    schema.uploads,
    schema.usage,
    // Search ratings and the blocklist are personal data: they go with the user (PDPL).
    schema.searchFeedback,
    schema.blockedItems,
  ];

  it("every user-owned table is reached from users by ON DELETE CASCADE", () => {
    const reaches = new Set(["users"]);
    // Walk until stable: a table is covered when one of its cascading FKs points at a covered table.
    for (let pass = 0; pass < tables.length; pass++) {
      for (const t of tables) {
        const cfg = getTableConfig(t);
        for (const fk of cfg.foreignKeys) {
          const ref = fk.reference();
          if (fk.onDelete === "cascade" && reaches.has(getTableConfig(ref.foreignTable).name)) reaches.add(cfg.name);
        }
      }
    }
    for (const t of tables) expect(reaches.has(getTableConfig(t).name)).toBe(true);
  });
});

describe("account repo SQL", () => {
  it("deletes the users row by id and returns the WorkOS id", async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return { rows: [["user_abc"]], fields: [], rowCount: 1, command: "" };
    });
    const db = drizzle({ client: { query } as never, schema }) as unknown as Db;
    const repo = createDbAccountRepo(() => db);
    expect(await repo.deleteUser(ALICE)).toEqual({ workosId: "user_abc" });
    expect(calls[0]!.sql).toMatch(/^delete from "users" where "users"\."id" = \$1 returning "workos_id"$/);
    expect(calls[0]!.params).toEqual([ALICE]);
    expect(await repo.deleteUser("x")).toBeNull();
    expect(calls).toHaveLength(1);
  });
});
