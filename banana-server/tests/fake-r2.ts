/** In-memory R2 bucket for tests: real list pagination (limit + cursor), batch delete, no network. */
import type { R2Like, R2ListResult } from "@/lib/uploads/types";

export type FakeR2 = R2Like & {
  objects: Map<string, { bytes: Uint8Array; contentType?: string }>;
  calls: { list: number; delete: number; put: number; get: number };
  /** Called once before each list(); lets a test add objects mid-run. */
  beforeList?: () => void;
};

export function fakeR2(opts: { failDelete?: boolean; failPut?: boolean } = {}): FakeR2 {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  const calls = { list: 0, delete: 0, put: 0, get: 0 };
  const bucket: FakeR2 = {
    objects,
    calls,
    async put(key, value, options) {
      calls.put++;
      if (opts.failPut) throw new Error("put failed");
      const bytes = value instanceof Uint8Array ? new Uint8Array(value) : new Uint8Array(value.slice(0));
      objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
      return {};
    },
    async get(key) {
      calls.get++;
      const o = objects.get(key);
      if (!o) return null;
      const bytes = o.bytes;
      return {
        key,
        size: bytes.byteLength,
        httpEtag: `"etag-${bytes.byteLength}"`,
        body: new ReadableStream({
          start(c) {
            c.enqueue(bytes);
            c.close();
          },
        }),
      };
    },
    async delete(keys) {
      calls.delete++;
      if (opts.failDelete) throw new Error("delete failed");
      const list = Array.isArray(keys) ? keys : [keys];
      if (list.length > 1000) throw new Error("R2 deletes at most 1000 keys per call");
      for (const k of list) objects.delete(k);
    },
    async list(options = {}): Promise<R2ListResult> {
      calls.list++;
      bucket.beforeList?.();
      const limit = Math.min(options.limit ?? 1000, 1000);
      const sorted = [...objects.keys()].filter((k) => k.startsWith(options.prefix ?? "")).sort();
      // Cursor = last key returned, like a start-after marker.
      const start = options.cursor ? sorted.findIndex((k) => k > options.cursor!) : 0;
      const from = start < 0 ? sorted.length : start;
      const page = sorted.slice(from, from + limit);
      const truncated = from + limit < sorted.length;
      return { objects: page.map((key) => ({ key })), truncated, cursor: truncated ? page[page.length - 1] : undefined };
    },
  };
  return bucket;
}
