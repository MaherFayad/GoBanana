/**
 * Hard rule 2: extract_palette may hold thumbnail bytes in memory only.
 * Fetch + decode + extract must not write to disk, the Cache API or logs.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { extractPalette } from "@/lib/palette";
import { fetchThumbIntoMemory, type FetchLike } from "@/lib/palette/fetch";
import { bandsRgba, encodeJpeg, encodePng, hexToRgba } from "./fixtures/palette-images";

const FS_WRITES = [
  "writeFile",
  "writeFileSync",
  "appendFile",
  "appendFileSync",
  "write",
  "writeSync",
  "writev",
  "writevSync",
  "createWriteStream",
  "copyFile",
  "copyFileSync",
  "cp",
  "cpSync",
  "mkdir",
  "mkdirSync",
  "mkdtemp",
  "mkdtempSync",
  "open",
  "openSync",
  "rename",
  "renameSync",
] as const;
const FSP_WRITES = ["writeFile", "appendFile", "copyFile", "cp", "mkdir", "mkdtemp", "open", "rename"] as const;
const CONSOLE = ["log", "info", "warn", "error", "debug", "trace", "dir", "table"] as const;

describe("palette no-storage", () => {
  const spies: MockInstance[] = [];
  const cachePut = vi.fn();
  const cacheMatch = vi.fn();
  const cachesOpen = vi.fn(async () => ({ put: cachePut, match: cacheMatch, add: cachePut, addAll: cachePut }));
  const originalCaches = (globalThis as { caches?: unknown }).caches;

  beforeEach(() => {
    for (const name of FS_WRITES) {
      if (typeof (fs as unknown as Record<string, unknown>)[name] === "function") {
        spies.push(vi.spyOn(fs as unknown as Record<string, () => unknown>, name));
      }
    }
    for (const name of FSP_WRITES) {
      spies.push(vi.spyOn(fsp as unknown as Record<string, () => unknown>, name));
    }
    for (const name of CONSOLE) spies.push(vi.spyOn(console, name).mockImplementation(() => undefined));
    const stdout = vi.spyOn(process.stdout, "write");
    const stderr = vi.spyOn(process.stderr, "write");
    spies.push(stdout, stderr);
    (globalThis as { caches?: unknown }).caches = {
      default: { put: cachePut, match: cacheMatch },
      open: cachesOpen,
    };
  });

  afterEach(() => {
    for (const s of spies.splice(0)) s.mockRestore();
    (globalThis as { caches?: unknown }).caches = originalCaches;
    cachePut.mockClear();
    cacheMatch.mockClear();
    cachesOpen.mockClear();
  });

  it("fetches, decodes and extracts without writing or logging anything", async () => {
    const png = encodePng(bandsRgba([[hexToRgba("#ffffff"), 32], [hexToRgba("#e63946"), 32]], 32));
    const jpg = encodeJpeg(bandsRgba([[hexToRgba("#1d3557"), 32], [hexToRgba("#f4a261"), 32]], 32));
    const served: Record<string, Uint8Array> = {
      "https://i.pinimg.com/a.png": png,
      "https://cdn.dribbble.com/b.jpg": jpg,
    };
    const fetchImpl = vi.fn<FetchLike>(async (url) => {
      const bytes = served[url];
      return bytes
        ? new Response(new Uint8Array(bytes), { headers: { "content-type": "image/png" } })
        : new Response("no", { status: 404 });
    });
    const allowedHosts = ["i.pinimg.com", "cdn.dribbble.com"];

    const fetched = await Promise.all(
      [...Object.keys(served), "https://example.com/c.png"].map((url) =>
        fetchThumbIntoMemory(url, { allowedHosts, fetchImpl }),
      ),
    );
    expect(fetched[2]).toEqual({ ok: false, reason: "host_not_allowed" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const images = fetched.flatMap((r) => (r.ok ? [r.bytes] : []));
    expect(images).toHaveLength(2);
    const result = extractPalette({ images, size: 6 });
    expect(result.palette.length).toBeGreaterThanOrEqual(4);

    for (const s of spies) expect(s, s.getMockName()).not.toHaveBeenCalled();
    expect(cachesOpen).not.toHaveBeenCalled();
    expect(cachePut).not.toHaveBeenCalled();
    expect(cacheMatch).not.toHaveBeenCalled();

    // The result carries colors only, never image bytes.
    const json = JSON.stringify(result);
    expect(json.length).toBeLessThan(10_000);
    expect(Object.values(result).flat().some((v) => v instanceof Uint8Array)).toBe(false);
  });

  it("does not write or log on failures either", async () => {
    await fetchThumbIntoMemory("https://i.pinimg.com/a.png", {
      allowedHosts: ["i.pinimg.com"],
      fetchImpl: async () => {
        throw new TypeError("network down");
      },
    });
    extractPalette({ images: [new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])] });
    extractPalette({ images: [new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01])] });
    for (const s of spies) expect(s, s.getMockName()).not.toHaveBeenCalled();
    expect(cachePut).not.toHaveBeenCalled();
  });
});
