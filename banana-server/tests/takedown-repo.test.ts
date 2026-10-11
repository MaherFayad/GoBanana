/** Takedown request storage over a fake Neon client: requests go to takedown_requests, never the live list. */
import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { createDbTakedownRepo, takedownRequestRow } from "@/lib/site/takedown-repo";

function fakeDb(answers: unknown[][] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = vi.fn(async (sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    return { rows: answers.shift() ?? [], fields: [], rowCount: 0, command: "" };
  });
  return { db: drizzle({ client: { query } as never, schema }) as unknown as Db, calls };
}

describe("takedown request storage", () => {
  const request = {
    name: "Rights Holder",
    email: "legal@example.test",
    target: "https://example.test/page",
    reason: "copyright" as const,
    role: "owner" as const,
    details: "This page shows my photo without permission.",
    confirm: true as const,
    locale: "ar" as const,
  };

  it("maps the form to a takedown_requests row with status open", () => {
    expect(takedownRequestRow(request)).toEqual({
      url: "https://example.test/page",
      reason: "copyright",
      name: "Rights Holder",
      contactEmail: "legal@example.test",
      role: "owner",
      details: "This page shows my photo without permission.",
      locale: "ar",
      status: "open",
    });
  });

  it("inserts into takedown_requests, never into the live takedowns list", async () => {
    const { db, calls } = fakeDb();
    await createDbTakedownRepo(() => db).save(request);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.sql).toMatch(/^insert into "takedown_requests"/);
    expect(calls[0]!.sql).not.toMatch(/"takedowns"/);
  });
});
