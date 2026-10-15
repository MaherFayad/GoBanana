/**
 * P0-10 (owner decision D4): cut_parts `look` returns one image at the source CDN's cut size (at
 * most 1200 px wide, 1.5 MB) with its pixel size. fetch is always mocked here; the variants were
 * checked against real URLs on 2026-10-15 (DECISIONS.md).
 */
import { describe, expect, it, vi } from "vitest";
import type { CanvasState } from "@/canvas/types";
import { createCutPartsTool, inputSchema, TOOL_DESCRIPTION } from "@/lib/mcp/tools/cut_parts";
import type { FetchLike } from "@/lib/palette/fetch";
import { DEFAULT_IMAGE_HOSTS, parseAllowlist } from "@/lib/sources/allowlist";
import { cutVariant, imageSize, lookBlocks, MAX_CUT_BYTES } from "@/lib/vision/look";
import { thumbAllowlist, type McpContent } from "@/lib/vision/thumbs";
import { bandsRgba, encodeJpeg, encodePng, hexToRgba } from "./fixtures/palette-images";
import { ALICE, imageNode, makeDeps, ref, seedCanvas, state, text } from "./tools-fixtures";

const allowlist = thumbAllowlist(parseAllowlist(DEFAULT_IMAGE_HOSTS));
const png = (w: number, h: number) => encodePng(bandsRgba([[hexToRgba("#e63946"), w]], h));
const serve = (bytes: Uint8Array, type = "image/png") =>
  vi.fn<FetchLike>(async () => new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": type } }));
const images = (c: McpContent[]) => c.filter((b) => b.type === "image");

describe("cut size variants (checked against real URLs on 2026-10-15)", () => {
  it.each([
    ["https://i.pinimg.com/originals/aa/c2/63/aac26356e5383a1db8c8bf3931fd6a88.jpg", "https://i.pinimg.com/1200x/aa/c2/63/aac26356e5383a1db8c8bf3931fd6a88.jpg"],
    ["https://i.pinimg.com/originals/a8/69/10/a86910be197c8b23660e0ffa50436eeb.png", "https://i.pinimg.com/1200x/a8/69/10/a86910be197c8b23660e0ffa50436eeb.jpg"],
    ["https://i.pinimg.com/236x/ab/cd/x.jpg", "https://i.pinimg.com/1200x/ab/cd/x.jpg"],
    [
      "https://cdn.dribbble.com/userupload/49326451/file/eff7dbe1daaed2778ca93ac3b19716c0.jpg?format=webp&resize=400x300&vertical=center",
      "https://cdn.dribbble.com/userupload/49326451/file/eff7dbe1daaed2778ca93ac3b19716c0.jpg?format=webp&resize=1200x900",
    ],
    ["https://cdn.dribbble.com/userupload/1/file/a.png", "https://cdn.dribbble.com/userupload/1/file/a.png?resize=1200x900"],
    ["https://mir-s3-cdn-cf.behance.net/project_modules/1400/b5a123185280943.6560c317d97b3.jpg", "https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/b5a123185280943.6560c317d97b3.jpg"],
    ["https://framerusercontent.com/images/2HcMn3WE6ABg2DKf1egvCVZpn6s.jpg", "https://framerusercontent.com/images/2HcMn3WE6ABg2DKf1egvCVZpn6s.jpg?scale-down-to=1024"],
    ["https://cdn.cosmos.so/a.png", "https://cdn.cosmos.so/a.png"],
    ["not a url", "not a url"],
  ])("%s", (from, to) => {
    expect(cutVariant(from)).toBe(to);
  });
});

describe("imageSize", () => {
  it("reads PNG, JPEG, GIF and WebP headers", () => {
    expect(imageSize(png(37, 21))).toEqual({ width: 37, height: 21 });
    expect(imageSize(encodeJpeg(bandsRgba([[hexToRgba("#1d3557"), 50]], 30)))).toEqual({ width: 50, height: 30 });
    expect(imageSize(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x01, 0x20, 0x00]))).toEqual({ width: 272, height: 32 });
    const vp8x = new Uint8Array(30);
    vp8x.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58]);
    vp8x.set([0xaf, 0x04, 0x00, 0x83, 0x03, 0x00], 24); // 1200 x 900
    expect(imageSize(vp8x)).toEqual({ width: 1200, height: 900 });
    expect(imageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("lookBlocks", () => {
  it("fetches the cut size and gives the pixel size and the crop math", async () => {
    const fetchImpl = serve(png(1200, 900));
    const r = await lookBlocks({ label: "Look at item img_1", imageUrl: "https://cdn.dribbble.com/a.png" }, { fetchImpl, allowlist });
    expect(r.ok).toBe(true);
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(["https://cdn.dribbble.com/a.png?resize=1200x900"]);
    expect(r.blocks.map((b) => b.type)).toEqual(["text", "image", "text"]);
    expect(r.blocks[0]).toMatchObject({ text: "Look at item img_1: 1200 x 900 px." });
    expect(r.blocks[2]).toMatchObject({ text: expect.stringContaining("x = left edge px / 1200") });
  });

  it("falls back to the small thumbnail when no size is at most 1200 px wide", async () => {
    const wide = png(1600, 10);
    const small = png(236, 200);
    const fetchImpl = vi.fn<FetchLike>(async (url) => new Response(new Uint8Array(url.includes("/236x/") ? small : wide), { headers: { "content-type": "image/png" } }));
    const r = await lookBlocks({ label: "L", imageUrl: "https://i.pinimg.com/originals/1.png", thumbUrl: "https://i.pinimg.com/236x/1.png" }, { fetchImpl, allowlist });
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(["https://i.pinimg.com/1200x/1.jpg", "https://i.pinimg.com/originals/1.png", "https://i.pinimg.com/236x/1.png"]);
    expect(r).toMatchObject({ ok: true, width: 236, height: 200, size: "small" });
  });

  it("caps bytes at 1.5 MB and never fetches hosts off the allowlist", async () => {
    const big = vi.fn<FetchLike>(async () => new Response(new Uint8Array(MAX_CUT_BYTES + 10), { headers: { "content-type": "image/png" } }));
    const over = await lookBlocks({ label: "L", imageUrl: "https://cdn.cosmos.so/a.png" }, { fetchImpl: big, allowlist });
    expect(over.ok).toBe(false);
    expect(over.blocks[0]).toMatchObject({ text: expect.stringContaining("over 1.5 MB") });

    const never = serve(png(10, 10));
    const off = await lookBlocks({ label: "L", imageUrl: "https://evil.example/a.png" }, { fetchImpl: never, allowlist });
    expect(off.ok).toBe(false);
    expect(never).not.toHaveBeenCalled();
    expect(off.blocks[0]).toMatchObject({ text: expect.stringContaining("not on the image allowlist") });
  });
});

describe("cut_parts look", () => {
  it("is in the tool copy and the input schema", () => {
    expect(TOOL_DESCRIPTION).toContain("look { itemId }");
    expect(TOOL_DESCRIPTION.length).toBeLessThan(400);
    expect(TOOL_DESCRIPTION).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
    expect(inputSchema.safeParse({ canvasId: "c", look: { itemId: "img_1" } }).success).toBe(true);
    expect(inputSchema.safeParse({ canvasId: "c" }).success).toBe(false);
    expect(inputSchema.safeParse({ canvasId: "c", look: { itemId: "a", referenceId: "b" } }).success).toBe(false);
  });

  it("look alone returns one image with its pixel size and cuts nothing", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_1", 1)]));
    const fetchImpl = serve(png(1066, 1116));
    const res = await createCutPartsTool({ ...deps, fetchImpl, allowlist: () => allowlist })({ canvasId: c.id, look: { itemId: "img_1" } }, ALICE);
    expect(res.isError).toBeFalsy();
    expect(images(res.content)).toHaveLength(1);
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(["https://i.pinimg.com/1200x/1.jpg"]);
    expect(text(res)).toMatch(/Look at item img_1 "Pin 1" from pinterest\.com https:\/\/www\.pinterest\.com\/pin\/1\/: 1066 x 1116 px/);
    expect(text(res)).toContain("Next: cut_parts with cuts");
    expect(res.structuredContent).toMatchObject({ look: { itemId: "img_1", width: 1066, height: 1116, size: "cut" }, parts: [] });
    const stored = (await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState;
    expect(stored.parts ?? []).toHaveLength(0);
  });

  it("cuts and looks in one call, a search result too, and fails cleanly on a bad id", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_1", 1)], [ref(2)]));
    const tool = createCutPartsTool({ ...deps, fetchImpl: serve(png(400, 300)), allowlist: () => allowlist });
    const both = await tool({ canvasId: c.id, cuts: [{ itemId: "img_1", role: "nav" }], look: { referenceId: ref(2).id } }, ALICE);
    expect(text(both)).toMatch(/^Cut 1 part/);
    expect(text(both)).toContain("call cut_parts with look on that image");
    expect(images(both.content)).toHaveLength(1);

    const bad = await tool({ canvasId: c.id, cuts: [{ itemId: "img_1", role: "hero" }], look: { itemId: "nope" } }, ALICE);
    expect(bad.isError).toBe(true);
    expect(text(bad)).toContain("Nothing was cut");
    expect(((await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState).parts).toHaveLength(1);
  });

  it("does not look at an image removed after a takedown", async () => {
    const { deps, repos } = makeDeps({ takedowns: [ref(1).imageUrl] });
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_1", 1)]));
    const fetchImpl = serve(png(10, 10));
    const res = await createCutPartsTool({ ...deps, fetchImpl, allowlist: () => allowlist })({ canvasId: c.id, look: { itemId: "img_1" } }, ALICE);
    expect(res.isError).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
