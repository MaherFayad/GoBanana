/**
 * Hard rule 2 for cut_parts `look` (P0-10, owner decision D4): the one larger image lives only in
 * the call's memory and in the tool result. Nothing is written to disk, the Cache API, the canvas
 * state or the logs, and the saved canvas and structured content carry no image bytes.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createCutPartsTool } from "@/lib/mcp/tools/cut_parts";
import type { FetchLike } from "@/lib/palette/fetch";
import { DEFAULT_IMAGE_HOSTS, parseAllowlist } from "@/lib/sources/allowlist";
import { lookBlocks } from "@/lib/vision/look";
import { thumbAllowlist } from "@/lib/vision/thumbs";
import { bandsRgba, encodeJpeg, hexToRgba } from "./fixtures/palette-images";
import { ALICE, imageNode, makeDeps, seedCanvas, state } from "./tools-fixtures";

const FS_WRITES = [
  "writeFile", "writeFileSync", "appendFile", "appendFileSync", "write", "writeSync", "writev", "writevSync",
  "createWriteStream", "copyFile", "copyFileSync", "cp", "cpSync", "mkdir", "mkdirSync", "mkdtemp", "mkdtempSync",
  "open", "openSync", "rename", "renameSync",
] as const;
const FSP_WRITES = ["writeFile", "appendFile", "copyFile", "cp", "mkdir", "mkdtemp", "open", "rename"] as const;
const CONSOLE = ["log", "info", "warn", "error", "debug", "trace", "dir", "table"] as const;
const allowlist = thumbAllowlist(parseAllowlist(DEFAULT_IMAGE_HOSTS));

describe("look no-storage", () => {
  const spies: MockInstance[] = [];
  const cachePut = vi.fn();
  const cacheMatch = vi.fn();
  const cachesOpen = vi.fn(async () => ({ put: cachePut, match: cacheMatch, add: cachePut, addAll: cachePut }));
  const originalCaches = (globalThis as { caches?: unknown }).caches;

  beforeEach(() => {
    for (const name of FS_WRITES) {
      if (typeof (fs as unknown as Record<string, unknown>)[name] === "function") spies.push(vi.spyOn(fs as unknown as Record<string, () => unknown>, name));
    }
    for (const name of FSP_WRITES) spies.push(vi.spyOn(fsp as unknown as Record<string, () => unknown>, name));
    for (const name of CONSOLE) spies.push(vi.spyOn(console, name).mockImplementation(() => undefined));
    spies.push(vi.spyOn(process.stdout, "write"), vi.spyOn(process.stderr, "write"));
    (globalThis as { caches?: unknown }).caches = { default: { put: cachePut, match: cacheMatch }, open: cachesOpen };
  });

  afterEach(() => {
    for (const s of spies.splice(0)) s.mockRestore();
    (globalThis as { caches?: unknown }).caches = originalCaches;
    cachePut.mockClear();
    cacheMatch.mockClear();
    cachesOpen.mockClear();
  });

  const expectNothingKept = () => {
    for (const s of spies) expect(s, s.getMockName()).not.toHaveBeenCalled();
    expect(cachesOpen).not.toHaveBeenCalled();
    expect(cachePut).not.toHaveBeenCalled();
    expect(cacheMatch).not.toHaveBeenCalled();
  };

  it("looks and cuts without writing, caching or logging, and saves no bytes", async () => {
    const { deps, repos } = makeDeps();
    // Seeded before the spies matter: the in-memory repos are the database, checked below.
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_1", 1)]));
    const jpg = encodeJpeg(bandsRgba([[hexToRgba("#1d3557"), 600], [hexToRgba("#f4a261"), 600]], 900));
    const fetchImpl = vi.fn<FetchLike>(async () => new Response(new Uint8Array(jpg), { headers: { "content-type": "image/jpeg" } }));

    const res = await createCutPartsTool({ ...deps, fetchImpl, allowlist: () => allowlist })(
      { canvasId: c.id, cuts: [{ itemId: "img_1", role: "hero", crop: { x: 0, y: 0, w: 1, h: 0.5 } }], look: { itemId: "img_1" } },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const image = res.content.find((b) => b.type === "image");
    expect(image).toBeDefined();
    const data = image!.type === "image" ? image!.data : "";
    expect(data.length).toBeGreaterThan(100);

    expectNothingKept();
    // The bytes go to the agent only: not in the structured content (the canvas app gets it) nor the saved canvas.
    expect(JSON.stringify(res.structuredContent)).not.toContain(data.slice(0, 64));
    expect(JSON.stringify(res.structuredContent).length).toBeLessThan(2_000);
    const saved = JSON.stringify((await repos.canvases.getOwned(ALICE, c.id))!.state);
    expect(saved).not.toContain(data.slice(0, 64));
    expect(saved).not.toMatch(/data:image|base64/);
  });

  it("does not write or log on failures either", async () => {
    await lookBlocks({ label: "L", imageUrl: "https://i.pinimg.com/originals/1.png" }, {
      allowlist,
      fetchImpl: async () => {
        throw new TypeError("network down");
      },
    });
    await lookBlocks({ label: "L", imageUrl: "https://cdn.dribbble.com/a.png" }, { allowlist, fetchImpl: async () => new Response("<html>", { headers: { "content-type": "text/html" } }) });
    expectNothingKept();
  });
});
