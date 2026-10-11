/**
 * extract_palette with in-memory repos and a fake fetch. Hard rule 2: thumbnail bytes stay
 * in memory. Nothing is written to disk, the Cache API or logs, and only colors reach the repos.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createExtractPaletteTool } from "@/lib/mcp/tools/extract_palette";
import type { FetchLike } from "@/lib/palette/fetch";
import type { CanvasState } from "@/canvas/types";
import { bandsRgba, encodeJpeg, encodePng, hexToRgba } from "./fixtures/palette-images";
import { ALICE, BOB, imageNode, makeDeps, sectionNode, seedCanvas, state, text } from "./tools-fixtures";

const FS_WRITES = ["writeFile", "writeFileSync", "appendFile", "appendFileSync", "createWriteStream", "copyFile", "mkdir", "open", "openSync", "rename"] as const;
const FSP_WRITES = ["writeFile", "appendFile", "copyFile", "mkdir", "open", "rename"] as const;
const CONSOLE = ["log", "info", "warn", "error", "debug", "trace"] as const;

const png = encodePng(bandsRgba([[hexToRgba("#ffffff"), 32], [hexToRgba("#e63946"), 32]], 32));
const jpg = encodeJpeg(bandsRgba([[hexToRgba("#1d3557"), 32], [hexToRgba("#f4a261"), 32]], 32));

function canvasWithImages(): CanvasState {
  const a = imageNode("a", 1, { parentId: "s", x: 16, y: 48 });
  const b = imageNode("b", 2, { parentId: "s", x: 312, y: 48 });
  (b.data as { thumbUrl: string }).thumbUrl = "https://cdn.dribbble.com/b.jpg";
  const c = imageNode("c", 3);
  (c.data as { thumbUrl: string }).thumbUrl = "https://evil.example.com/c.png";
  return state([sectionNode("s"), a, b, c]);
}

function fetchFor(served: Record<string, Uint8Array>) {
  return vi.fn<FetchLike>(async (url) => {
    const bytes = served[url];
    return bytes ? new Response(new Uint8Array(bytes), { headers: { "content-type": "image/png" } }) : new Response("no", { status: 404 });
  });
}

describe("extract_palette", () => {
  const spies: MockInstance[] = [];
  const cachePut = vi.fn();
  const originalCaches = (globalThis as { caches?: unknown }).caches;

  beforeEach(() => {
    for (const name of FS_WRITES) {
      if (typeof (fs as unknown as Record<string, unknown>)[name] === "function") {
        spies.push(vi.spyOn(fs as unknown as Record<string, () => unknown>, name));
      }
    }
    for (const name of FSP_WRITES) spies.push(vi.spyOn(fsp as unknown as Record<string, () => unknown>, name));
    for (const name of CONSOLE) spies.push(vi.spyOn(console, name).mockImplementation(() => undefined));
    (globalThis as { caches?: unknown }).caches = { default: { put: cachePut, match: cachePut }, open: vi.fn(async () => ({ put: cachePut })) };
  });

  afterEach(() => {
    for (const s of spies.splice(0)) s.mockRestore();
    (globalThis as { caches?: unknown }).caches = originalCaches;
    cachePut.mockClear();
  });

  it("extracts colors in memory, saves only colors, and never writes or logs bytes", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, canvasWithImages());
    const fetchImpl = fetchFor({ "https://i.pinimg.com/236x/1.png": png, "https://cdn.dribbble.com/b.jpg": jpg });
    const tool = createExtractPaletteTool({ ...deps, fetchImpl });

    const res = await tool({ canvasId: c.id, itemIds: ["a", "b", "c", "missing"], size: 6, addSwatches: true }, ALICE);
    expect(res.isError).toBeFalsy();
    const out = res.structuredContent as {
      palette: { hex: string; role: string }[];
      contrast: { tag: string }[];
      skipped: { itemId: string; reason: string }[];
      swatches: { id: string }[];
    };
    expect(out.palette.length).toBeGreaterThanOrEqual(4);
    expect(out.contrast.length).toBeGreaterThan(0);
    // The non-allowlisted host is never fetched.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(out.skipped.map((s) => s.itemId).sort()).toEqual(["c", "missing"]);

    // Only hex colors and ratios are stored: no bytes in the palette row or the canvas state.
    expect(repos.data.palettes).toHaveLength(1);
    const savedJson = JSON.stringify([repos.data.palettes, [...repos.data.canvases.values()]]);
    expect(savedJson).not.toMatch(/data:|base64|"0":\d+,"1":\d+/);
    expect(savedJson.length).toBeLessThan(20_000);
    expect(JSON.stringify(res).length).toBeLessThan(20_000);

    // Swatches land in the shared section of the source images.
    const s = (await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState;
    const swatches = s.nodes.filter((n) => n.type === "swatch");
    expect(swatches).toHaveLength(out.palette.length);
    expect(swatches.every((n) => n.parentId === "s")).toBe(true);

    for (const spy of spies) expect(spy, spy.getMockName()).not.toHaveBeenCalled();
    expect(cachePut).not.toHaveBeenCalled();
  });

  it("does not write or log when every image fails", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, canvasWithImages());
    const tool = createExtractPaletteTool({ ...deps, fetchImpl: fetchFor({}) });
    const res = await tool({ canvasId: c.id, itemIds: ["a", "b"] }, ALICE);
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("No image could be read");
    expect(repos.data.palettes).toHaveLength(0);
    for (const spy of spies) expect(spy, spy.getMockName()).not.toHaveBeenCalled();
  });

  it("denies other users and never fetches for them", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, canvasWithImages());
    const fetchImpl = fetchFor({ "https://i.pinimg.com/236x/1.png": png });
    const res = await createExtractPaletteTool({ ...deps, fetchImpl })({ canvasId: c.id, itemIds: ["a"] }, BOB);
    expect(res.isError).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips taken down images (they are hidden on load)", async () => {
    const { deps, repos } = makeDeps({ takedowns: ["pinterest.com/pin/1"] });
    const c = await seedCanvas(repos, ALICE, canvasWithImages());
    const fetchImpl = fetchFor({ "https://i.pinimg.com/236x/1.png": png, "https://cdn.dribbble.com/b.jpg": jpg });
    const res = await createExtractPaletteTool({ ...deps, fetchImpl })({ canvasId: c.id, itemIds: ["a", "b"] }, ALICE);
    expect(res.isError).toBeFalsy();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((res.structuredContent as { skipped: { itemId: string }[] }).skipped.map((s) => s.itemId)).toEqual(["a"]);
  });

  it("checks size", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    expect(text(await createExtractPaletteTool(deps)({ canvasId: c.id, itemIds: ["a"], size: 12 }, ALICE))).toBe(
      "size must be a whole number from 5 to 9.",
    );
  });
});
