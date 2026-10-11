/**
 * Uploads (spec section 12): Pro only, PNG/JPEG/WebP/GIF only, 10 MB per file,
 * 1 GB per user, R2 key u/<userId>/<uuid>, owner and share-link access only.
 * Fake repo and fake R2; no network, no database.
 */
import { drizzle } from "drizzle-orm/neon-http";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import type { Plan } from "@/lib/quota";
import { createDbUploadRepo } from "@/lib/uploads/db";
import { buildUploadsRoute, isSameOrigin, readBounded, shareTokenFrom, type UploadCaller } from "@/lib/uploads/http";
import {
  checkUploadFile,
  MAX_UPLOAD_BYTES,
  sniffImageType,
  UPLOAD_MESSAGES,
  uploadKey,
  uploadPath,
} from "@/lib/uploads/rules";
import { createUpload, deleteUpload, readUpload, stateShowsUpload, type UploadDeps } from "@/lib/uploads/service";
import type { UploadRecord, UploadRepo } from "@/lib/uploads/types";
import { fakeR2, type FakeR2 } from "./fake-r2";
import { ALICE, BOB } from "./tools-fixtures";

const ORIGIN = "https://app.example.test";
const TOKEN = "abcdefghijklmnopqrstuvwx";
const GB = 1024 * 1024 * 1024;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 1, 2]);
const GIF = new TextEncoder().encode("GIF89a\x01\x00\x01\x00");
const WEBP = new Uint8Array([...new TextEncoder().encode("RIFF"), 1, 0, 0, 0, ...new TextEncoder().encode("WEBPVP8 ")]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

type MemoryUploads = UploadRepo & { rows: Map<string, UploadRecord>; shared: Map<string, { userId: string; state: unknown }> };

function memoryUploads(failInsert = false): MemoryUploads {
  const rows = new Map<string, UploadRecord>();
  const shared = new Map<string, { userId: string; state: unknown }>();
  return {
    rows,
    shared,
    async totalBytes(userId) {
      return [...rows.values()].filter((r) => r.userId === userId).reduce((n, r) => n + r.bytes, 0);
    },
    async insert(row) {
      if (failInsert) throw new Error("insert failed");
      rows.set(row.id, { ...row });
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async deleteOwned(userId, id) {
      const r = rows.get(id);
      if (!r || r.userId !== userId) return false;
      rows.delete(id);
      return true;
    },
    async findSharedCanvas(token) {
      return shared.get(token) ?? null;
    },
  };
}

let ids = 0;
function setup(opts: { plans?: Record<string, Plan>; failInsert?: boolean; bucket?: FakeR2 | null } = {}) {
  const repo = memoryUploads(opts.failInsert);
  const bucket = opts.bucket === undefined ? fakeR2() : opts.bucket;
  const plans = opts.plans ?? { [ALICE]: "pro_monthly", [BOB]: "pro_yearly" };
  const deps: UploadDeps = {
    repo,
    bucket: () => bucket,
    getPlan: async (u) => plans[u] ?? "free",
    newId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`,
  };
  return { repo, bucket: bucket as FakeR2, deps };
}

function bytes(n: number, head: Uint8Array = PNG): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n));
  out.set(head.slice(0, Math.min(n, head.length)));
  return out;
}

async function streamToBytes(stream: ReadableStream | null): Promise<number[]> {
  return [...new Uint8Array(await new Response(stream).arrayBuffer())];
}

describe("upload rules", () => {
  it("sniffs only the four allowed image types", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(GIF)).toBe("image/gif");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(SVG)).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });

  it("builds per-user keys and same-origin paths", () => {
    expect(uploadKey(ALICE, "abc")).toBe(`u/${ALICE}/abc`);
    expect(uploadPath("abc")).toBe("/api/uploads/abc");
  });

  it("checks files on the client with the same limits", () => {
    expect(checkUploadFile({ size: 10, type: "image/png" })).toBeNull();
    expect(checkUploadFile({ size: 0, type: "image/png" })).toBe("empty");
    expect(checkUploadFile({ size: MAX_UPLOAD_BYTES + 1, type: "image/png" })).toBe("too_large");
    expect(checkUploadFile({ size: 10, type: "image/svg+xml" })).toBe("unsupported_type");
  });

  it("uses plain words and no em dashes in messages", () => {
    for (const m of Object.values(UPLOAD_MESSAGES)) expect(m).not.toMatch(/—/);
  });
});

describe("createUpload", () => {
  it("stores a Pro user's image under u/<userId>/<uuid> and records the row", async () => {
    const { deps, repo, bucket } = setup();
    const res = await createUpload(deps, ALICE, { bytes: bytes(100), declaredType: "image/png" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { id } = res.value;
    expect(res.value).toMatchObject({ url: `/api/uploads/${id}`, mime: "image/png", bytes: 100, usedBytes: 100, limitBytes: GB });
    expect([...bucket.objects.keys()]).toEqual([`u/${ALICE}/${id}`]);
    expect(bucket.objects.get(`u/${ALICE}/${id}`)?.contentType).toBe("image/png");
    expect(repo.rows.get(id)).toEqual({ id, userId: ALICE, r2Key: `u/${ALICE}/${id}`, mime: "image/png", bytes: 100 });
  });

  it("refuses free users before reading anything", async () => {
    const { deps, bucket } = setup({ plans: { [ALICE]: "free" } });
    expect(await createUpload(deps, ALICE, { bytes: bytes(100) })).toEqual({ ok: false, error: "plan_required" });
    expect(bucket.calls.put).toBe(0);
  });

  it("allows founding buyers", async () => {
    const { deps } = setup({ plans: { [ALICE]: "founding" } });
    expect((await createUpload(deps, ALICE, { bytes: bytes(50, JPEG) })).ok).toBe(true);
  });

  it("refuses empty, oversized and non-image files", async () => {
    const { deps, bucket } = setup();
    expect(await createUpload(deps, ALICE, { bytes: new Uint8Array(new ArrayBuffer(0)) })).toEqual({ ok: false, error: "empty" });
    expect(await createUpload(deps, ALICE, { bytes: bytes(MAX_UPLOAD_BYTES + 1) })).toEqual({ ok: false, error: "too_large" });
    const svg = new Uint8Array(new ArrayBuffer(SVG.length));
    svg.set(SVG);
    expect(await createUpload(deps, ALICE, { bytes: svg, declaredType: "image/png" })).toEqual({ ok: false, error: "unsupported_type" });
    expect(await createUpload(deps, ALICE, { bytes: bytes(20), declaredType: "text/html" })).toEqual({ ok: false, error: "unsupported_type" });
    expect(bucket.calls.put).toBe(0);
  });

  it("stores the sniffed type, not the declared one", async () => {
    const { deps, repo } = setup();
    const res = await createUpload(deps, ALICE, { bytes: bytes(30, GIF), declaredType: "image/png" });
    expect(res.ok && res.value.mime).toBe("image/gif");
    expect([...repo.rows.values()][0]?.mime).toBe("image/gif");
  });

  it("enforces the 1 GB total per user", async () => {
    const { deps, repo, bucket } = setup();
    repo.rows.set("x", { id: "x", userId: ALICE, r2Key: `u/${ALICE}/x`, mime: "image/png", bytes: GB - 50 });
    expect(await createUpload(deps, ALICE, { bytes: bytes(51) })).toEqual({ ok: false, error: "storage_full" });
    expect((await createUpload(deps, ALICE, { bytes: bytes(50) })).ok).toBe(true);
    // Bob's space is his own.
    expect((await createUpload(deps, BOB, { bytes: bytes(51) })).ok).toBe(true);
    expect(bucket.calls.put).toBe(2);
  });

  it("removes the object when the row cannot be saved", async () => {
    const { deps, bucket } = setup({ failInsert: true });
    await expect(createUpload(deps, ALICE, { bytes: bytes(10) })).rejects.toThrow();
    expect(bucket.objects.size).toBe(0);
  });

  it("answers storage_unavailable without a bucket", async () => {
    const { deps } = setup({ bucket: null });
    expect(await createUpload(deps, ALICE, { bytes: bytes(10) })).toEqual({ ok: false, error: "storage_unavailable" });
  });
});

describe("readUpload and deleteUpload", () => {
  async function stored() {
    const s = setup();
    const res = await createUpload(s.deps, ALICE, { bytes: bytes(16) });
    if (!res.ok) throw new Error("setup failed");
    return { ...s, id: res.value.id };
  }

  it("streams the image to its owner", async () => {
    const { deps, id } = await stored();
    const res = await readUpload(deps, id, { userId: ALICE });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.mime).toBe("image/png");
    expect(await streamToBytes(res.value.body)).toEqual([...bytes(16)]);
  });

  it("hides it from other users and from unknown ids", async () => {
    const { deps, id } = await stored();
    expect(await readUpload(deps, id, { userId: BOB })).toEqual({ ok: false, error: "not_found" });
    expect(await readUpload(deps, id, {})).toEqual({ ok: false, error: "not_found" });
    expect(await readUpload(deps, "../../etc", { userId: ALICE })).toEqual({ ok: false, error: "not_found" });
  });

  it("shows it to share-link viewers only when the owner's shared canvas shows it", async () => {
    const { deps, repo, id } = await stored();
    const shows = { nodes: [{ id: "n1", type: "upload", data: { imageUrl: uploadPath(id), sourceUrl: uploadPath(id) } }] };
    repo.shared.set(TOKEN, { userId: ALICE, state: shows });
    expect((await readUpload(deps, id, { shareToken: TOKEN })).ok).toBe(true);

    repo.shared.set(TOKEN, { userId: ALICE, state: { nodes: [] } });
    expect(await readUpload(deps, id, { shareToken: TOKEN })).toEqual({ ok: false, error: "not_found" });

    // A canvas of another user cannot pull in Alice's upload by naming it.
    repo.shared.set(TOKEN, { userId: BOB, state: shows });
    expect(await readUpload(deps, id, { shareToken: TOKEN })).toEqual({ ok: false, error: "not_found" });
    expect(await readUpload(deps, id, { shareToken: "short" })).toEqual({ ok: false, error: "not_found" });
  });

  it("deletes the object and the row for the owner only", async () => {
    const { deps, repo, bucket, id } = await stored();
    expect(await deleteUpload(deps, BOB, id)).toEqual({ ok: false, error: "not_found" });
    expect(bucket.objects.size).toBe(1);
    expect(await deleteUpload(deps, ALICE, id)).toEqual({ ok: true, value: { id } });
    expect(bucket.objects.size).toBe(0);
    expect(repo.rows.size).toBe(0);
  });

  it("keeps the row when R2 refuses the delete", async () => {
    const bucket = fakeR2({ failDelete: true });
    const s = setup({ bucket });
    const res = await createUpload(s.deps, ALICE, { bytes: bytes(16) });
    if (!res.ok) throw new Error("setup failed");
    expect(await deleteUpload(s.deps, ALICE, res.value.id)).toEqual({ ok: false, error: "storage_unavailable" });
    expect(s.repo.rows.size).toBe(1);
  });

  it("matches upload nodes by path", () => {
    expect(stateShowsUpload({ nodes: [{ data: { imageUrl: "/api/uploads/a" } }] }, "a")).toBe(true);
    expect(stateShowsUpload({ nodes: [{ data: { imageUrl: "/api/uploads/ab" } }] }, "a")).toBe(false);
    expect(stateShowsUpload(null, "a")).toBe(false);
  });
});

describe("uploads HTTP handlers", () => {
  afterEach(() => vi.unstubAllGlobals());

  function route(who: UploadCaller | null, s = setup()) {
    return { ...s, route: buildUploadsRoute({ ...s.deps, authenticate: async () => who, log: () => {} }) };
  }

  function multipart(file: Blob, name = "a.png", headers: Record<string, string> = {}) {
    const form = new FormData();
    form.append("file", file, name);
    return new Request(`${ORIGIN}/api/uploads`, { method: "POST", body: form, headers });
  }

  it("accepts multipart uploads from the web session", async () => {
    const { route: r, bucket } = route({ userId: ALICE, via: "cookie" });
    const res = await r.POST(multipart(new Blob([bytes(40)], { type: "image/png" }), "a.png", { origin: ORIGIN, "sec-fetch-site": "same-origin" }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; url: string };
    expect(body.url).toBe(`/api/uploads/${body.id}`);
    expect(bucket.objects.has(`u/${ALICE}/${body.id}`)).toBe(true);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("accepts raw image bytes with a bearer token", async () => {
    const { route: r } = route({ userId: ALICE, via: "bearer" });
    const res = await r.POST(
      new Request(`${ORIGIN}/api/uploads`, { method: "POST", body: bytes(40, JPEG), headers: { "content-type": "image/jpeg", origin: "https://elsewhere.test" } }),
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as { mime: string }).mime).toBe("image/jpeg");
  });

  it("answers 401 signed out and 403 for cross-site cookie posts", async () => {
    expect((await route(null).route.POST(multipart(new Blob([bytes(10)])))).status).toBe(401);
    const cross = await route({ userId: ALICE, via: "cookie" }).route.POST(multipart(new Blob([bytes(10)]), "a.png", { origin: "https://evil.test" }));
    expect(cross.status).toBe(403);
    expect(((await cross.json()) as { error: string }).error).toBe("forbidden_origin");
  });

  it("gives free users the plain upgrade message", async () => {
    const { route: r } = route({ userId: ALICE, via: "cookie" }, setup({ plans: {} }));
    const res = await r.POST(multipart(new Blob([bytes(10)])));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "plan_required", message: UPLOAD_MESSAGES.plan_required });
  });

  it("refuses bodies over the cap before reading them", async () => {
    const { route: r, bucket } = route({ userId: ALICE, via: "bearer" });
    const req = new Request(`${ORIGIN}/api/uploads`, {
      method: "POST",
      body: bytes(16),
      headers: { "content-type": "image/png", "content-length": String(MAX_UPLOAD_BYTES + 1) },
    });
    expect((await r.POST(req)).status).toBe(413);
    const big = await r.POST(new Request(`${ORIGIN}/api/uploads`, { method: "POST", body: bytes(MAX_UPLOAD_BYTES + 1), headers: { "content-type": "image/png" } }));
    expect(big.status).toBe(413);
    expect(bucket.calls.put).toBe(0);
  });

  it("never fetches a URL it is given (hard rule 2)", async () => {
    const fetchSpy = vi.fn(async () => new Response(bytes(10)));
    vi.stubGlobal("fetch", fetchSpy);
    const { route: r, bucket } = route({ userId: ALICE, via: "bearer" });
    const asJson = await r.POST(
      new Request(`${ORIGIN}/api/uploads`, { method: "POST", body: JSON.stringify({ url: "https://i.pinimg.com/x.png" }), headers: { "content-type": "application/json" } }),
    );
    expect(asJson.status).toBe(415);
    const form = new FormData();
    form.append("file", "https://i.pinimg.com/x.png");
    const asField = await r.POST(new Request(`${ORIGIN}/api/uploads`, { method: "POST", body: form }));
    expect(asField.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(bucket.calls.put).toBe(0);
  });

  it("streams GET responses with safe headers and 404s for others", async () => {
    const s = setup();
    const created = await createUpload(s.deps, ALICE, { bytes: bytes(24) });
    if (!created.ok) throw new Error("setup failed");
    const id = created.value.id;

    const owner = await route({ userId: ALICE, via: "cookie" }, s).route.GET(new Request(`${ORIGIN}/api/uploads/${id}`), id);
    expect(owner.status).toBe(200);
    expect(owner.headers.get("content-type")).toBe("image/png");
    expect(owner.headers.get("x-content-type-options")).toBe("nosniff");
    expect(owner.headers.get("content-security-policy")).toContain("sandbox");
    expect(owner.headers.get("x-robots-tag")).toBe("noindex");
    expect(await streamToBytes(owner.body)).toEqual([...bytes(24)]);

    const other = await route({ userId: BOB, via: "cookie" }, s).route.GET(new Request(`${ORIGIN}/api/uploads/${id}`), id);
    expect(other.status).toBe(404);

    s.repo.shared.set(TOKEN, { userId: ALICE, state: { nodes: [{ data: { imageUrl: uploadPath(id) } }] } });
    const viewer = route(null, s).route;
    const viaReferer = await viewer.GET(new Request(`${ORIGIN}/api/uploads/${id}`, { headers: { referer: `${ORIGIN}/s/${TOKEN}` } }), id);
    expect(viaReferer.status).toBe(200);
    expect(viaReferer.headers.get("cache-control")).toBe("private, max-age=300");
    const viaQuery = await viewer.GET(new Request(`${ORIGIN}/api/uploads/${id}?share=${TOKEN}`), id);
    expect(viaQuery.status).toBe(200);
  });

  it("deletes through DELETE for the owner", async () => {
    const s = setup();
    const created = await createUpload(s.deps, ALICE, { bytes: bytes(24) });
    if (!created.ok) throw new Error("setup failed");
    const id = created.value.id;
    const req = () => new Request(`${ORIGIN}/api/uploads/${id}`, { method: "DELETE", headers: { origin: ORIGIN } });
    expect((await route({ userId: BOB, via: "cookie" }, s).route.DELETE(req(), id)).status).toBe(404);
    expect((await route({ userId: ALICE, via: "cookie" }, s).route.DELETE(req(), id)).status).toBe(200);
    expect(s.bucket.objects.size).toBe(0);
    expect(s.repo.rows.size).toBe(0);
  });

  it("parses share tokens only from same-origin share pages", () => {
    expect(shareTokenFrom(new Request(`${ORIGIN}/api/uploads/x`, { headers: { referer: `${ORIGIN}/s/${TOKEN}` } }))).toBe(TOKEN);
    expect(shareTokenFrom(new Request(`${ORIGIN}/api/uploads/x`, { headers: { referer: `https://evil.test/s/${TOKEN}` } }))).toBeNull();
    expect(shareTokenFrom(new Request(`${ORIGIN}/api/uploads/x`, { headers: { referer: `${ORIGIN}/c/abc` } }))).toBeNull();
  });

  it("checks same-origin writes", () => {
    expect(isSameOrigin(new Request(`${ORIGIN}/x`, { headers: { origin: ORIGIN } }))).toBe(true);
    expect(isSameOrigin(new Request(`${ORIGIN}/x`, { headers: { origin: "https://evil.test" } }))).toBe(false);
    expect(isSameOrigin(new Request(`${ORIGIN}/x`, { headers: { "sec-fetch-site": "cross-site" } }))).toBe(false);
    expect(isSameOrigin(new Request(`${ORIGIN}/x`))).toBe(true);
  });

  it("reads bodies up to a cap", async () => {
    expect((await readBounded(new Request(ORIGIN, { method: "POST", body: bytes(10) }), 10))?.byteLength).toBe(10);
    expect(await readBounded(new Request(ORIGIN, { method: "POST", body: bytes(11) }), 10)).toBeNull();
  });
});

describe("upload repo SQL", () => {
  function fakeDb(answers: unknown[][] = []) {
    const calls: { sql: string; params: unknown[] }[] = [];
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return { rows: answers.shift() ?? [], fields: [], rowCount: 0, command: "" };
    });
    return { db: drizzle({ client: { query } as never, schema }) as unknown as Db, calls };
  }

  it("sums bytes per user and scopes deletes to the owner", async () => {
    const { db, calls } = fakeDb([[["1048576"]], []]);
    const repo = createDbUploadRepo(() => db);
    expect(await repo.totalBytes(ALICE)).toBe(1048576);
    expect(calls[0]!.sql).toMatch(/coalesce\(sum\("bytes"\), 0\) from "uploads" where "uploads"\."user_id" = \$1/);
    expect(calls[0]!.params).toEqual([ALICE]);
    expect(await repo.deleteOwned(ALICE, BOB)).toBe(false);
    expect(calls[1]!.sql).toMatch(/delete from "uploads" where \("uploads"\."id" = \$1 and "uploads"\."user_id" = \$2\)/);
  });

  it("finds a shared canvas by token and skips bad input without a query", async () => {
    const { db, calls } = fakeDb();
    const repo = createDbUploadRepo(() => db);
    expect(await repo.findSharedCanvas("x")).toBeNull();
    expect(await repo.get("nope")).toBeNull();
    expect(await repo.totalBytes("nope")).toBe(0);
    expect(calls).toHaveLength(0);
    await repo.findSharedCanvas(TOKEN);
    expect(calls[0]!.sql).toMatch(/where "canvases"\."share_token" = \$1/);
  });
});
