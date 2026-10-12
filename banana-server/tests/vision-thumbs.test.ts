/**
 * Pass-through thumbnails (owner decision, 2026-10-12): small source-size images fetched per call,
 * handed to the agent as MCP image content, never stored or logged. Plus get_snapshot, Mobbin
 * refreshes and builds placed next to their Frankenstein page. fetch is always mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { CanvasState, StoredNode } from "@/canvas/types";
import type { FetchLike } from "@/lib/palette/fetch";
import { allowlistFromEnv, DEFAULT_IMAGE_HOSTS, isAllowedImageUrl, parseAllowlist } from "@/lib/sources/allowlist";
import { MOBBIN_REFRESH_DAYS, mobbinExpiryLines } from "@/lib/vision/board";
import { SNAPSHOT_END } from "@/lib/vision/snapshot";
import { LOOK_LINE, pickThumbUrl, smallVariant, sniffImageType, thumbAllowlist, thumbBlocks, withThumbs, type McpContent } from "@/lib/vision/thumbs";
import { canvasWithThumbs, searchWithThumbs } from "@/lib/vision/wrap";
import { createAddToCanvasTool } from "@/lib/mcp/tools/add_to_canvas";
import { createGetCanvasTool } from "@/lib/mcp/tools/get_canvas";
import { createGetSnapshotTool } from "@/lib/mcp/tools/get_snapshot";
import { SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";
import { exportKit } from "@/lib/export";
import { checkoutCanvas } from "./export-fixtures";
import { part } from "./stitch-fixtures";
import { ALICE, NOW, imageNode, makeDeps, ref, sectionNode, seedCanvas, state } from "./tools-fixtures";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]);

function okFetch(bytes: Uint8Array = PNG, type = "image/png") {
  return vi.fn<FetchLike>(async () => new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": type } }));
}

const images = (c: McpContent[]) => c.filter((b) => b.type === "image");
const texts = (c: McpContent[]) => c.flatMap((b) => (b.type === "text" ? [b.text] : []));

describe("small source sizes", () => {
  it("uses each CDN's own small variant", () => {
    expect(smallVariant("https://i.pinimg.com/originals/ab/cd/x.jpg")).toBe("https://i.pinimg.com/236x/ab/cd/x.jpg");
    expect(smallVariant("https://i.pinimg.com/736x/ab/x.jpg")).toBe("https://i.pinimg.com/236x/ab/x.jpg");
    expect(smallVariant("https://cdn.dribbble.com/userupload/1/file/original-a.png")).toBe("https://cdn.dribbble.com/userupload/1/file/original-a.png?resize=400x300");
    expect(smallVariant("https://cdn.dribbble.com/a.png?resize=1600x1200")).toBe("https://cdn.dribbble.com/a.png?resize=400x300");
    expect(smallVariant("https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/a.jpg")).toBe("https://mir-s3-cdn-cf.behance.net/project_modules/disp/a.jpg");
    expect(smallVariant("https://framerusercontent.com/images/a.png")).toBe("https://framerusercontent.com/images/a.png?scale-down-to=512");
    expect(smallVariant("https://cdn.cosmos.so/a.jpg")).toBe("https://cdn.cosmos.so/a.jpg");
  });

  it("fetches only allowlisted hosts: Mobbin, builds and unknown hosts are not fetched", () => {
    expect(pickThumbUrl({ imageUrl: "https://i.pinimg.com/originals/1.png" }, allowlist)).toBe("https://i.pinimg.com/236x/1.png");
    expect(pickThumbUrl({ imageUrl: "https://example.com/a.png", thumbUrl: "https://encrypted-tbn0.gstatic.com/images?q=1" }, allowlist)).toBe(
      "https://encrypted-tbn0.gstatic.com/images?q=1",
    );
    expect(pickThumbUrl({ imageUrl: "https://bytescale.mobbin.com/a.webp" }, allowlist)).toBeNull();
    expect(pickThumbUrl({ imageUrl: "https://my-app.vercel.app/shot.png" }, allowlist)).toBeNull();
    expect(pickThumbUrl({ imageUrl: "http://i.pinimg.com/236x/1.png" }, allowlist)).toBeNull();
  });

  it("fetches Mobbin screens for thumbnails only (thumbAllowlist), not for search", () => {
    const thumbs = thumbAllowlist(allowlist);
    expect(pickThumbUrl({ imageUrl: "https://mobbin.com/api/mcp/short/abc" }, thumbs)).toBe("https://mobbin.com/api/mcp/short/abc");
    expect(pickThumbUrl({ imageUrl: "https://bytescale.mobbin.com/a.webp" }, thumbs)).toBe("https://bytescale.mobbin.com/a.webp");
    expect(pickThumbUrl({ imageUrl: "https://my-app.vercel.app/shot.png" }, thumbs)).toBeNull();
    expect(isAllowedImageUrl("https://bytescale.mobbin.com/a.webp", allowlistFromEnv())).toBe(false);
  });

  it("sniffs the formats agents read", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });
});

describe("thumbBlocks", () => {
  it("puts a naming line before each image, as base64 with its type", async () => {
    const fetchImpl = okFetch();
    const { blocks, shown } = await thumbBlocks(
      [
        { label: "Reference ref_1: Pin 1", imageUrl: "https://i.pinimg.com/originals/1.png" },
        { label: "Reference ref_2: Pin 2", imageUrl: "https://i.pinimg.com/originals/2.png" },
      ],
      { fetchImpl, allowlist },
    );
    expect(shown).toBe(2);
    expect(blocks.map((b) => b.type)).toEqual(["text", "image", "text", "image"]);
    expect(blocks[0]).toEqual({ type: "text", text: "Reference ref_1: Pin 1" });
    expect(blocks[1]).toEqual({ type: "image", data: Buffer.from(PNG).toString("base64"), mimeType: "image/png" });
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(["https://i.pinimg.com/236x/1.png", "https://i.pinimg.com/236x/2.png"]);
  });

  it("caps images per call, fetches each URL once, and names what it skipped", async () => {
    const fetchImpl = okFetch();
    const targets = Array.from({ length: 14 }, (_, i) => ({ label: `R${i}`, imageUrl: `https://i.pinimg.com/originals/${i}.png` }));
    targets.push({ label: "again", imageUrl: "https://i.pinimg.com/originals/0.png" });
    targets.push({ label: "mobbin", imageUrl: "https://bytescale.mobbin.com/x.webp" });
    const { blocks, shown } = await thumbBlocks(targets, { fetchImpl, allowlist });
    expect(shown).toBe(12);
    expect(fetchImpl).toHaveBeenCalledTimes(12);
    const lines = texts(blocks);
    expect(lines).toContain("R12 (no thumbnail: over the 12 thumbnails per call)");
    expect(lines).toContain("again (same image as above)");
    expect(lines.find((l) => l.startsWith("mobbin"))).toMatch(/not on the image allowlist/);
  });

  it("skips images over the byte cap or a non image format, and keeps the total under budget", async () => {
    const big = new Uint8Array(400 * 1024);
    big.set(PNG);
    const fetchImpl = vi.fn<FetchLike>(async (url) => {
      if (url.includes("/big")) return new Response(big, { status: 200, headers: { "content-type": "image/png" } });
      if (url.includes("/svg")) return new Response("<svg/>", { status: 200, headers: { "content-type": "image/svg+xml" } });
      return new Response(new Uint8Array(PNG), { status: 200, headers: { "content-type": "image/png" } });
    });
    const { blocks } = await thumbBlocks(
      [
        { label: "big", imageUrl: "https://cdn.cosmos.so/big.png" },
        { label: "svg", imageUrl: "https://cdn.cosmos.so/svg.svg" },
        { label: "a", imageUrl: "https://cdn.cosmos.so/a.png" },
        { label: "b", imageUrl: "https://cdn.cosmos.so/b.png" },
      ],
      { fetchImpl, allowlist, totalBytes: PNG.length * 1.5 },
    );
    const lines = texts(blocks);
    expect(lines[0]).toBe("big (no thumbnail: it is over 300 KB and its source has no small size)");
    expect(lines[1]).toMatch(/svg \(no thumbnail: its format/);
    expect(lines[2]).toBe("a");
    expect(lines[3]).toBe("b (no thumbnail: over the size budget for one call)");
    expect(images(blocks)).toHaveLength(1);
  });

  it("times out slow images and never logs or caches bytes", async () => {
    const spies: MockInstance[] = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m));
    const fetchImpl = vi.fn<FetchLike>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const { blocks } = await thumbBlocks([{ label: "slow", imageUrl: "https://cdn.cosmos.so/a.png" }], { fetchImpl, allowlist, timeoutMs: 20 });
    expect(texts(blocks)).toEqual(["slow (no thumbnail: the image took too long to load)"]);
    for (const s of spies) expect(s).not.toHaveBeenCalled();
    for (const s of spies) s.mockRestore();
  });
});

describe("withThumbs and the tool wrappers", () => {
  it("asks the agent to look, and leaves errors alone", async () => {
    const out = await withThumbs({ content: [{ type: "text", text: "Found 1" }] }, [{ label: "x", imageUrl: "https://i.pinimg.com/236x/1.png" }], {
      fetchImpl: okFetch(),
      allowlist,
    });
    expect(texts(out.content).at(-1)).toBe(LOOK_LINE);
    const err = { content: [{ type: "text" as const, text: "no" }], isError: true };
    expect(await withThumbs(err, [{ label: "x", imageUrl: "https://i.pinimg.com/236x/1.png" }], { fetchImpl: okFetch(), allowlist })).toBe(err);
  });

  it("search_references results carry up to 12 thumbnails, UI first, unless thumbs is false", async () => {
    const references = Array.from({ length: 14 }, (_, i) => ref(i, i === 0 ? { zone: "art" } : {}));
    const base = { content: [{ type: "text" as const, text: "Found" }], structuredContent: { references } };
    const fetchImpl = okFetch();
    const out = await searchWithThumbs(base, {}, { fetchImpl, allowlist });
    expect(images(out.content)).toHaveLength(12);
    expect(texts(out.content)).toContain("2 more not shown (at most 12 per call).");
    expect(texts(out.content).find((t) => t.startsWith("Reference"))).toContain(references[1]!.id);
    expect(await searchWithThumbs(base, { thumbs: false }, { fetchImpl, allowlist })).toBe(base);
  });
});

describe("Mobbin expiry", () => {
  it("flags screens placed more than 25 days ago and tells the agent how to refresh", () => {
    const old = new Date(NOW.getTime() - (MOBBIN_REFRESH_DAYS + 3) * 86_400_000).toISOString();
    const fresh = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    const lines = mobbinExpiryLines(
      [
        { id: "img_old", type: "image", sourceSite: "mobbin.com", sourceUrl: "https://mobbin.com/screens/1", placedAt: old, mobbinId: "s1" },
        { id: "img_new", type: "image", sourceSite: "mobbin.com", sourceUrl: "https://mobbin.com/screens/2", placedAt: fresh },
        { id: "img_pin", type: "image", sourceSite: "pinterest.com", sourceUrl: "https://pinterest.com/pin/1", placedAt: old },
      ],
      NOW,
    ).join("\n");
    expect(lines).toMatch(/img_old/);
    expect(lines).toMatch(/screen id s1/);
    expect(lines).not.toMatch(/img_new|img_pin/);
    expect(lines).toMatch(/add_to_canvas with \{ type: 'screen', screenId/);
    expect(lines).toMatch(/Image expired, open on Mobbin/);
    expect(lines).not.toMatch(/[—–]/);
  });

  it("get_canvas shows thumbnails and the expiry lines", async () => {
    const { deps, repos } = makeDeps();
    const old = new Date(NOW.getTime() - 40 * 86_400_000).toISOString();
    const mobbin = imageNode("img_m", 9, {
      data: { imageUrl: "https://mobbin.com/a", sourceUrl: "https://mobbin.com/screens/9", sourceSite: "mobbin.com", title: "Luma: Pay", placedAt: old, mobbinId: "scr-9" },
    } as Partial<StoredNode>);
    const c = await seedCanvas(repos, ALICE, state([imageNode("img_1", 1), mobbin]));
    const raw = await createGetCanvasTool(deps)({ canvasId: c.id }, ALICE);
    const out = await canvasWithThumbs(raw, { canvasId: c.id }, { fetchImpl: okFetch(), allowlist, now: NOW });
    expect(images(out.content)).toHaveLength(1);
    const all = texts(out.content).join("\n");
    expect(all).toMatch(/Item img_1: Pin 1/);
    expect(all).toMatch(/img_m: Luma: Pay .*placed 40 days ago/);
  });
});

function stitchState(): CanvasState {
  const parts = [part("pt-nav1", "nav", 1), part("pt-hero2", "hero", 2, { crop: { x: 0, y: 0.1, w: 1, h: 0.35 }, note: "steal: the big date" })];
  const stitch = {
    id: "st_1",
    type: "stitch",
    x: 100,
    y: 50,
    w: 390,
    h: 844,
    data: { title: "Checkout A", platform: "mobile", mode: "collage", rows: [{ id: "r1", slots: [{ id: "sl1", role: "nav", partId: "pt-nav1" }] }, { id: "r2", slots: [{ id: "sl2", role: "hero", partId: "pt-hero2" }] }] },
  } as StoredNode;
  return { ...state([sectionNode("sec_1", { title: "Direction A" }), imageNode("img_a", 1, { parentId: "sec_1", x: 24, y: 60 }), stitch]), parts };
}

describe("get_snapshot", () => {
  it("shows a Frankenstein page as parts in row order with crop rects, ending with the build line", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, stitchState());
    const fetchImpl = okFetch();
    const res = await createGetSnapshotTool({ ...deps, fetchImpl, allowlist: () => allowlist })({ canvasId: c.id, stitchId: "st_1" }, ALICE);
    expect(res.isError).toBeFalsy();
    const t = texts(res.content);
    expect(t[0]).toMatch(/parts view, not a rendered composite/);
    const row1 = t.findIndex((l) => l.startsWith("Row 1"));
    const row2 = t.findIndex((l) => l.startsWith("Row 2"));
    expect(row1).toBeGreaterThan(0);
    expect(row2).toBeGreaterThan(row1);
    expect(t[row2]).toMatch(/Crop x 0\.00, y 0\.10, w 1\.00, h 0\.35/);
    expect(t[row2]).toMatch(/steal: the big date/);
    expect(images(res.content)).toHaveLength(2);
    // Each image right after its row line.
    const idx = res.content.findIndex((b) => b.type === "text" && b.text.startsWith("Row 1"));
    expect(res.content[idx + 1]!.type).toBe("image");
    expect(t.at(-1)).toContain(SNAPSHOT_END);
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(["https://cdn.dribbble.com/shot/1.png?resize=400x300", "https://cdn.dribbble.com/shot/2.png?resize=400x300"]);
  });

  it("shows a section's references with positions, and skips images when thumbs is false", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, stitchState());
    const fetchImpl = okFetch();
    const tool = createGetSnapshotTool({ ...deps, fetchImpl, allowlist: () => allowlist });
    const res = await tool({ canvasId: c.id, sectionId: "sec_1" }, ALICE);
    expect(texts(res.content).join("\n")).toMatch(/Item img_a \(ui\) at \(24, 60\)/);
    expect(images(res.content)).toHaveLength(1);
    const plain = await tool({ canvasId: c.id, sectionId: "sec_1", thumbs: false }, ALICE);
    expect(images(plain.content)).toHaveLength(0);
    expect((await tool({ canvasId: c.id, stitchId: "st_nope" }, ALICE)).isError).toBe(true);
    expect((await tool({ canvasId: c.id }, ALICE)).content[0]).toMatchObject({ text: expect.stringMatching(/Frankenstein page st_1/) });
  });
});

describe("add_to_canvas: builds and Mobbin refreshes", () => {
  let deps: ReturnType<typeof makeDeps>["deps"];
  let repos: ReturnType<typeof makeDeps>["repos"];
  beforeEach(() => {
    ({ deps, repos } = makeDeps());
  });
  afterEach(() => vi.restoreAllMocks());

  it("places a build screenshot link next to its Frankenstein page, never bytes", async () => {
    const c = await seedCanvas(repos, ALICE, stitchState());
    const add = createAddToCanvasTool(deps);
    const res = await add(
      { canvasId: c.id, items: [{ type: "build", imageUrl: "https://my-app.vercel.app/og/checkout.png", url: "https://my-app.vercel.app/checkout", stitchId: "st_1" }] },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const s = (await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState;
    const build = s.nodes.find((n) => n.type === "image" && n.data.kind === "build")!;
    expect(build).toMatchObject({ x: 100 + 390 + 48, y: 50 });
    expect(build.data).toMatchObject({ stitchId: "st_1", sourceUrl: "https://my-app.vercel.app/checkout", placedAt: NOW.toISOString() });
    // A second build stacks below the first.
    await add({ canvasId: c.id, items: [{ type: "build", imageUrl: "https://my-app.vercel.app/b.png", url: "https://my-app.vercel.app/b", stitchId: "st_1" }] }, ALICE);
    const s2 = (await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState;
    const builds = s2.nodes.filter((n) => n.type === "image" && n.data.kind === "build");
    expect(builds[1]!.y).toBe(50 + 844 + 48);

    const bytes = await add({ canvasId: c.id, items: [{ type: "build", imageUrl: "data:image/png;base64,AAAA", url: "https://my-app.vercel.app", stitchId: "st_1" }] }, ALICE);
    expect(bytes.isError).toBe(true);
    expect(bytes.content[0]!.text).toMatch(/not image bytes/);
    const missing = await add({ canvasId: c.id, items: [{ type: "build", imageUrl: "https://a.dev/x.png", url: "https://a.dev", stitchId: "st_9" }] }, ALICE);
    expect(missing.content[0]!.text).toMatch(/was not found/);
  });

  it("re-adding a screen with its screenId refreshes the image in place", async () => {
    const c = await seedCanvas(repos, ALICE);
    const add = createAddToCanvasTool(deps);
    const screen = { type: "screen", imageUrl: "https://mobbin.com/img/old", sourceUrl: "https://mobbin.com/screens/abc", screenId: "abc", title: "Pay" };
    await add({ canvasId: c.id, items: [screen] }, ALICE);
    const res = await add({ canvasId: c.id, items: [{ ...screen, imageUrl: "https://mobbin.com/img/new" }] }, ALICE);
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({ items: [], updated: [{ imageUrl: "https://mobbin.com/img/new" }] });
    const s = (await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState;
    const tiles = s.nodes.filter((n) => n.type === "image");
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.data).toMatchObject({ imageUrl: "https://mobbin.com/img/new", mobbinId: "abc" });
  });
});

describe("BUILD-PROMPT.md", () => {
  it("opens the prompt with a get_snapshot step, naming each Frankenstein page", () => {
    const stitch = { id: "st-9", title: "Pay", platform: "mobile" as const, mode: "collage" as const, x: 0, y: 0, w: 390, h: 800, sectionId: null, rows: [] };
    const md = exportKit({ ...checkoutCanvas, stitches: [stitch] }, ["build_prompt"])[0]!.content;
    const prompt = md.slice(md.indexOf("## Prompt"));
    expect(prompt.split("\n")[2]).toMatch(/^Step 1, look: .*get_snapshot.*`st-9`/);
    expect(exportKit(checkoutCanvas, ["build_prompt"])[0]!.content).toMatch(/Step 1, look: .*get_snapshot/);
  });
});

describe("instructions", () => {
  it("tell agents to look before building, under the cap", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/call get_snapshot on the board and each Frankenstein page before writing any screen/);
    expect(SERVER_INSTRUCTIONS.length).toBeLessThan(2500);
  });
});
