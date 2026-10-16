/**
 * X post items (DECISIONS.md 2026-10-16): oEmbed parsing and cache with a mocked fetch (no live
 * calls), the canvas item type, add_to_canvas, search links, attach_screenshot with its caps and
 * ownership checks, cut_parts on the screenshot, exports and the no-model-input guarantee.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { cleanData, filterBlocked, parseState, stateToItems } from "@/canvas/state";
import { DEFAULT_SIZE, NODE_TYPES, type CanvasState, type StoredNode } from "@/canvas/types";
import { toSnapshot } from "@/lib/canvas/store";
import { buildKitModel } from "@/lib/export/model";
import { figjamSpec } from "@/lib/export/figjam-spec";
import { htmlBoard } from "@/lib/export/html-board";
import { createAddToCanvasTool, type AddToCanvasOutput } from "@/lib/mcp/tools/add_to_canvas";
import {
  createAttachScreenshotTool,
  decodeImage,
  MAX_IMAGE_CHARS,
  TOOL_DESCRIPTION as ATTACH_DESC,
} from "@/lib/mcp/tools/attach_screenshot";
import { createCutPartsTool, NEEDS_SCREENSHOT } from "@/lib/mcp/tools/cut_parts";
import { createGetCanvasTool } from "@/lib/mcp/tools/get_canvas";
import { xPostLine } from "@/lib/mcp/tools/search_references";
import { boardView } from "@/lib/vision/snapshot";
import { placedWithThumbs } from "@/lib/vision/wrap";
import { noModelInputHosts } from "@/lib/sources/registry";
import { collectXPosts, MAX_X_POSTS } from "@/lib/sources/web-search";
import { compileTakedowns, EMPTY_TAKEDOWNS } from "@/lib/takedown";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads/rules";
import { stateShowsUpload, type UploadDeps } from "@/lib/uploads/service";
import type { UploadRecord, UploadRepo } from "@/lib/uploads/types";
import {
  clearPostCache,
  fetchXPost,
  isPostUrl,
  OEMBED_ENDPOINT,
  parseOembed,
  parsePostUrl,
  postCredit,
  postTextFromHtml,
  type FetchLike,
  type FetchPostOutcome,
} from "@/lib/xpost";
import { fakeR2, type FakeR2 } from "./fake-r2";
import { ALICE, BOB, imageNode, makeDeps, seedCanvas, state, text } from "./tools-fixtures";

/** X's real answer for https://x.com/jack/status/20 (publish.x.com, 2026-10-16). */
const JACK = {
  url: "https://x.com/jack/status/20",
  author_name: "jack",
  author_url: "https://x.com/jack",
  html: '<blockquote class="twitter-tweet" data-dnt="true"><p lang="en" dir="ltr">just setting up my twttr</p>&mdash; jack (@jack) <a href="https://x.com/jack/status/20?ref_src=twsrc%5Etfw">March 21, 2006</a></blockquote>\n\n',
  width: 550,
  height: null,
  type: "rich",
  cache_age: "3153600000",
  provider_name: "X",
  provider_url: "https://x.com",
  version: "1.0",
};

const POST = "https://x.com/jack/status/20";

function mockFetch(answer: (url: string) => Response | Promise<Response>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    return answer(url);
  }) as FetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => clearPostCache());

describe("post links", () => {
  it("reads x.com and twitter.com post links into one canonical link", () => {
    expect(parsePostUrl("https://x.com/jack/status/20")).toEqual({ postId: "20", handle: "jack", url: POST });
    expect(parsePostUrl("https://twitter.com/jack/status/20?s=20&t=abc")).toEqual({ postId: "20", handle: "jack", url: POST });
    expect(parsePostUrl("https://mobile.twitter.com/jack/statuses/20/photo/1")).toMatchObject({ url: POST });
    expect(parsePostUrl("https://www.x.com/i/web/status/1849")).toEqual({ postId: "1849", url: "https://x.com/i/web/status/1849" });
  });

  it("refuses anything that is not one post", () => {
    for (const bad of [
      "https://x.com/jack",
      "https://x.com/jack/status/abc",
      "https://x.com/search?q=ui",
      "https://notx.com/jack/status/20",
      "https://x.com.evil.com/jack/status/20",
      "https://user:pw@x.com/jack/status/20",
      "javascript:alert(1)",
      "https://x.com/bad-handle!/status/20",
      `https://x.com/jack/status/${"9".repeat(21)}`,
      42,
    ]) {
      expect(parsePostUrl(bad), String(bad)).toBeNull();
    }
    expect(isPostUrl(POST)).toBe(true);
  });
});

describe("oEmbed", () => {
  it("parses X's answer into the stored fields only", () => {
    const link = parsePostUrl(POST)!;
    expect(parseOembed(JACK, link)).toEqual({ postId: "20", url: POST, authorName: "jack", authorHandle: "jack", text: "just setting up my twttr" });
  });

  it("keeps the text plain: line breaks, entities and links as text", () => {
    expect(postTextFromHtml('<blockquote><p dir="ltr">New <b>toggle</b> &amp; slider<br>v2 &#8594; <a href="https://t.co/x">pic.x.com/abc</a></p>&mdash; A</blockquote>')).toBe(
      "New toggle & slider\nv2 → pic.x.com/abc",
    );
    expect(postTextFromHtml("<blockquote>no paragraph</blockquote>")).toBe("");
    expect(postTextFromHtml(null)).toBe("");
    expect(postTextFromHtml(`<p>${"a".repeat(2000)}</p>`)).toHaveLength(1000);
  });

  it("refuses an answer that is not from X", () => {
    const link = parsePostUrl(POST)!;
    expect(parseOembed({ ...JACK, author_url: "https://evil.example/jack" }, link)).toBeNull();
    expect(parseOembed({ ...JACK, author_url: "https://x.com/" }, link)).toBeNull();
    expect(parseOembed("nope", link)).toBeNull();
  });

  it("asks X's documented endpoint with the post URL only, no script and do not track, and caches by post id", async () => {
    const f = mockFetch(() => json(JACK));
    const a = await fetchXPost("https://twitter.com/jack/status/20?s=46", { fetchImpl: f });
    expect(a).toMatchObject({ ok: true, cached: false, post: { authorHandle: "jack" } });
    expect(f.calls).toHaveLength(1);
    const asked = new URL(f.calls[0]!);
    expect(`${asked.origin}${asked.pathname}`).toBe(OEMBED_ENDPOINT);
    expect(Object.fromEntries(asked.searchParams)).toEqual({ url: POST, omit_script: "1", dnt: "true" });
    // Same post by another link: from the cache, no second call.
    const b = await fetchXPost("https://x.com/jack/status/20/photo/1", { fetchImpl: f });
    expect(b).toMatchObject({ ok: true, cached: true });
    expect(f.calls).toHaveLength(1);
    // A day later it asks again (edits and deletions show up).
    await fetchXPost(POST, { fetchImpl: f, now: () => Date.now() + 25 * 60 * 60 * 1000 });
    expect(f.calls).toHaveLength(2);
  });

  it("answers not_found for a deleted post (cached briefly) and unavailable when X fails", async () => {
    const gone = mockFetch(() => new Response("<html>", { status: 404 }));
    expect(await fetchXPost("https://x.com/a/status/1", { fetchImpl: gone })).toEqual({ ok: false, reason: "not_found" });
    expect(await fetchXPost("https://x.com/a/status/1", { fetchImpl: gone })).toEqual({ ok: false, reason: "not_found" });
    expect(gone.calls).toHaveLength(1);
    const down = mockFetch(() => new Response("", { status: 503 }));
    expect(await fetchXPost("https://x.com/a/status/2", { fetchImpl: down })).toEqual({ ok: false, reason: "unavailable" });
    expect(await fetchXPost("https://x.com/a/status/2", { fetchImpl: down })).toEqual({ ok: false, reason: "unavailable" });
    expect(down.calls).toHaveLength(2);
    const broken = mockFetch(() => Promise.reject(new Error("offline")));
    expect(await fetchXPost("https://x.com/a/status/3", { fetchImpl: broken })).toEqual({ ok: false, reason: "unavailable" });
    expect(await fetchXPost("https://x.com/a", { fetchImpl: broken })).toEqual({ ok: false, reason: "bad_url" });
    expect(broken.calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------- item type

function xNode(id = "xp_1", over: Record<string, unknown> = {}): StoredNode {
  return {
    id,
    type: "xpost",
    x: 0,
    y: 0,
    w: DEFAULT_SIZE.xpost.w,
    h: DEFAULT_SIZE.xpost.h,
    data: { sourceUrl: POST, sourceSite: "x.com", postId: "20", authorName: "jack", authorHandle: "jack", text: "just setting up my twttr", note: null, tag: null, ...over },
  } as StoredNode;
}

describe("x post item", () => {
  it("is a canvas node type that keeps the link, id, author, text, note and tag, never media", () => {
    expect(NODE_TYPES).toContain("xpost");
    const clean = cleanData("xpost", {
      sourceUrl: "https://twitter.com/jack/status/20?s=1",
      postId: "999",
      authorName: "jack",
      authorHandle: "jack",
      text: "  hi  ",
      note: "steal the toggle",
      tag: "ship",
      imageUrl: "https://pbs.twimg.com/media/a.jpg",
      thumbUrl: "https://pbs.twimg.com/media/a.jpg",
      videoUrl: "https://video.twimg.com/a.mp4",
      screenshotUrl: "https://pbs.twimg.com/media/a.jpg",
    });
    expect(clean).toEqual({ sourceUrl: POST, sourceSite: "x.com", postId: "20", authorName: "jack", authorHandle: "jack", text: "hi", note: "steal the toggle", tag: "ship" });
    expect(cleanData("xpost", { ...clean, screenshotUrl: "/api/uploads/00000000-0000-4000-8000-000000000001", screenshotWidth: 600, screenshotHeight: 800 })).toMatchObject({
      screenshotUrl: "/api/uploads/00000000-0000-4000-8000-000000000001",
      screenshotWidth: 600,
    });
    expect(cleanData("xpost", { ...clean, sourceUrl: "https://example.com/jack/status/20" })).toBeNull();
    expect(cleanData("xpost", { ...clean, authorHandle: "" })).toBeNull();
  });

  it("round trips through the stored state, follows takedowns and leaves the text out of snapshots", () => {
    const s = parseState(state([xNode()]));
    expect(s.nodes[0]!.type).toBe("xpost");
    const items = stateToItems(s);
    expect(items[0]).toMatchObject({ type: "xpost", sourceUrl: POST, authorHandle: "jack" });
    expect(JSON.stringify(items)).not.toContain("twttr");
    expect(filterBlocked(s, compileTakedowns(["x.com/jack/status/20"]).isBlocked).removed).toBe(1);
  });

  it("credits the author", () => {
    expect(postCredit({ authorName: "Jane Doe", authorHandle: "jane" })).toBe("Post by Jane Doe (@jane) on X");
    expect(postCredit({ authorName: "jack", authorHandle: "jack" })).toBe("Post by @jack on X");
  });
});

// ---------------------------------------------------------------------------- add_to_canvas

function lookupOf(post: Partial<FetchPostOutcome> | ((url: string) => FetchPostOutcome)) {
  const calls: string[] = [];
  const fn = async (url: string): Promise<FetchPostOutcome> => {
    calls.push(url);
    if (typeof post === "function") return post(url);
    return post as FetchPostOutcome;
  };
  return Object.assign(fn, { calls });
}
const FOUND: FetchPostOutcome = { ok: true, cached: false, post: { postId: "20", url: POST, authorName: "jack", authorHandle: "jack", text: "just setting up my twttr" } };

describe("add_to_canvas xpost", () => {
  it("places an X post from its link with the oEmbed fields and no image", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    const lookup = lookupOf(FOUND);
    const res = await createAddToCanvasTool({ ...deps, fetchXPost: lookup })(
      { canvasId: c.id, items: [{ type: "xpost", url: "https://twitter.com/jack/status/20", note: "steal: the reply chip" }] },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    expect(lookup.calls).toEqual(["https://twitter.com/jack/status/20"]);
    const saved = (await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState;
    expect(saved.nodes).toHaveLength(1);
    expect(saved.nodes[0]).toMatchObject({ type: "xpost", w: DEFAULT_SIZE.xpost.w, data: { sourceUrl: POST, postId: "20", authorHandle: "jack", text: "just setting up my twttr", note: "steal: the reply chip" } });
    const out = res.structuredContent as AddToCanvasOutput;
    expect(out.items[0]).toEqual({ id: expect.any(String), type: "xpost", x: expect.any(Number), y: expect.any(Number), sectionId: null });
    // No model input: no thumbnail goes back with the result, and no post text in it.
    const wrapped = await placedWithThumbs(res, { canvasId: c.id, items: [{ type: "xpost", url: POST }] });
    expect(wrapped.content.every((b) => b.type === "text")).toBe(true);
    expect(text(res)).not.toContain("twttr");
  });

  it("skips bad links, deleted posts, duplicates and takedowns", async () => {
    const { deps, repos } = makeDeps({ takedowns: ["https://x.com/blocked"] });
    const c = await seedCanvas(repos, ALICE, state([xNode()]));
    const lookup = lookupOf((url) =>
      url.includes("/gone/")
        ? { ok: false, reason: "not_found" }
        : url.includes("/blocked/")
          ? { ok: true, cached: false, post: { postId: "7", url: "https://x.com/blocked/status/7", authorName: "B", authorHandle: "blocked", text: "" } }
          : FOUND,
    );
    const res = await createAddToCanvasTool({ ...deps, fetchXPost: lookup })(
      {
        canvasId: c.id,
        items: [
          { type: "xpost", url: "https://x.com/jack" },
          { type: "xpost", url: "https://x.com/gone/status/5" },
          { type: "xpost", url: POST },
          { type: "xpost", url: "https://x.com/blocked/status/7" },
          { type: "note", text: "kept" },
        ],
      },
      ALICE,
    );
    const t = text(res);
    expect(t).toContain("Skipped item 1: that is not a link to one X post");
    expect(t).toContain("Skipped item 2: X says that post does not exist");
    expect(t).toContain("Skipped item 3: Post by @jack on X is already on this canvas.");
    expect(t).toContain("Skipped item 4: that post was removed after a takedown request.");
    // The bad link never reached X.
    expect(lookup.calls).not.toContain("https://x.com/jack");
  });
});

describe("search_references X links", () => {
  it("collects X post links from results as canonical links, capped and takedown checked", () => {
    const found = new Map<string, string>();
    const images = [
      { link: "https://twitter.com/jane/status/1?s=20", imageUrl: "https://pbs.twimg.com/media/1.jpg" },
      { link: "https://x.com/jane/status/1/photo/1" },
      { link: "https://x.com/blocked/status/2" },
      { link: "https://x.com/jane" },
      { link: "https://dribbble.com/shots/3" },
      ...Array.from({ length: 10 }, (_, i) => ({ link: `https://x.com/kim/status/${100 + i}` })),
    ];
    collectXPosts(images, compileTakedowns(["x.com/blocked"]), found);
    const links = [...found.values()];
    expect(links[0]).toBe("https://x.com/jane/status/1");
    expect(links).toHaveLength(MAX_X_POSTS);
    expect(links.some((l) => l.includes("blocked"))).toBe(false);
    expect(JSON.stringify(links)).not.toContain("twimg");
    collectXPosts("nope", EMPTY_TAKEDOWNS, found);
  });

  it("tells the agent to place them by link", () => {
    expect(xPostLine(undefined)).toBe("");
    expect(xPostLine([POST])).toContain('add_to_canvas { type: "xpost", url }');
  });
});

// ---------------------------------------------------------------------------- get_canvas, snapshot, exports

describe("reading and exporting", () => {
  it("get_canvas lists the post with its credit and link, never its text", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state([xNode("xp_1", { note: "steal: chip" })]));
    for (const summary of [false, true]) {
      const res = await createGetCanvasTool(deps)({ canvasId: c.id, summary }, ALICE);
      const all = text(res) + JSON.stringify(res.structuredContent);
      expect(all).toContain("Post by @jack on X");
      expect(all).not.toContain("twttr");
    }
    const full = text(await createGetCanvasTool(deps)({ canvasId: c.id }, ALICE));
    expect(full).toContain(`X post xp_1: Post by @jack on X ${POST} [no screenshot: attach_screenshot before cut_parts]`);
  });

  it("get_snapshot has no picture of a post", async () => {
    const s = parseState(state([xNode(), imageNode("img_1", 1)]));
    const view = boardView(toSnapshot({ canvas: { id: "c1", title: "B", brief: "", wildness: 3, lens: null, state: s, updatedAt: new Date() } as never, state: s }));
    expect(view.targets.map((t) => t.imageUrl)).toEqual(["https://i.pinimg.com/originals/1.png"]);
    expect(view.head.join("\n")).toContain(`X post xp_1 at (0, 0), 340 x 420: Post by @jack on X ${POST}`);
  });

  it("exports the post as a link with the author credit, no picture and no text", () => {
    const s = parseState(state([xNode("xp_1", { note: "steal: chip", tag: "ship" })]));
    const snap = toSnapshot({ canvas: { id: "c1", title: "B", brief: "", wildness: 3, lens: null, state: s, updatedAt: new Date() } as never, state: s });
    const m = buildKitModel(snap);
    expect(m.references).toEqual([expect.objectContaining({ type: "xpost", title: "Post by @jack on X", url: POST, imageUrl: null, site: "x.com", note: "steal: chip", tag: "ship" })]);
    const html = htmlBoard(m);
    expect(html).toContain(`href="${POST}"`);
    expect(html).toContain("Post by @jack on X");
    expect(html).not.toContain("twttr");
    expect(html).not.toContain("<img");
    const fig = JSON.stringify(figjamSpec(m));
    expect(fig).toContain(POST);
    expect(fig).not.toContain("imageUrl");
  });

  it("stays out of every model input: X hosts remain on the no model input list", () => {
    expect(noModelInputHosts()).toEqual(expect.arrayContaining(["x.com", "www.x.com"]));
  });
});

// ---------------------------------------------------------------------------- attach_screenshot

function pngBytes(width: number, height: number, extra = 0): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(33 + extra));
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const GIF = new TextEncoder().encode("GIF89a\x01\x00\x01\x00");

function memoryUploads(): UploadRepo & { rows: Map<string, UploadRecord> } {
  const rows = new Map<string, UploadRecord>();
  return {
    rows,
    async totalBytes(userId) {
      return [...rows.values()].filter((r) => r.userId === userId).reduce((n, r) => n + r.bytes, 0);
    },
    async insert(row) {
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
    async findSharedCanvas() {
      return null;
    },
  };
}

async function attachSetup(opts: { plan?: "free" | "pro_monthly"; nodes?: StoredNode[]; used?: number } = {}) {
  const { deps, repos } = makeDeps({ plans: { [ALICE]: opts.plan ?? "pro_monthly", [BOB]: "pro_monthly" } });
  const c = await seedCanvas(repos, ALICE, state(opts.nodes ?? [xNode()]));
  const uploads = memoryUploads();
  if (opts.used) uploads.rows.set("00000000-0000-4000-8000-0000000000ff", { id: "00000000-0000-4000-8000-0000000000ff", userId: ALICE, r2Key: "k", mime: "image/png", bytes: opts.used });
  const bucket: FakeR2 = fakeR2();
  let n = 0;
  const up: UploadDeps = { repo: uploads, bucket: () => bucket, getPlan: async (u) => (u === ALICE ? (opts.plan ?? "pro_monthly") : "pro_monthly"), newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` };
  const tool = createAttachScreenshotTool({ ...deps, uploads: () => up });
  return { deps, repos, c, uploads, bucket, tool };
}

describe("attach_screenshot", () => {
  it("has a short plain description", () => {
    expect(ATTACH_DESC.length).toBeLessThan(300);
    expect(ATTACH_DESC).not.toMatch(/[—–]/);
  });

  it("decodes base64 with or without a data URL prefix and refuses junk", () => {
    const png = pngBytes(10, 20);
    expect(decodeImage(b64(png))!.bytes).toEqual(png);
    expect(decodeImage(`data:image/png;base64,${b64(png)}`)).toMatchObject({ declared: "image/png" });
    expect(decodeImage("not base64!!")).toBeNull();
    expect(decodeImage("")).toBeNull();
  });

  it("stores the screenshot as the user's upload and links it to the post", async () => {
    const { repos, c, uploads, bucket, tool } = await attachSetup();
    const res = await tool({ canvasId: c.id, itemId: "xp_1", image: `data:image/png;base64,${b64(pngBytes(600, 900))}`, sourceUrl: "https://twitter.com/jack/status/20" }, ALICE);
    expect(res.isError).toBeFalsy();
    expect(uploads.rows.size).toBe(1);
    const row = [...uploads.rows.values()][0]!;
    expect(row).toMatchObject({ userId: ALICE, mime: "image/png" });
    expect(bucket.objects.has(row.r2Key)).toBe(true);
    const saved = (await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState;
    expect(saved.nodes[0]!.data).toMatchObject({ screenshotUrl: `/api/uploads/${row.id}`, screenshotWidth: 600, screenshotHeight: 900, sourceUrl: POST });
    expect(stateShowsUpload(saved, row.id)).toBe(true);
    expect(text(res)).toContain("Post by @jack on X https://x.com/jack/status/20");
    expect(text(res)).toContain('cut_parts { cuts: [{ itemId: "xp_1"');
  });

  it("checks the input, the item, the post, the owner and the type", async () => {
    const { c, uploads, tool } = await attachSetup({ nodes: [xNode(), imageNode("img_1", 1)] });
    const png = b64(pngBytes(10, 10));
    const ok = { canvasId: c.id, itemId: "xp_1", image: png, sourceUrl: POST };
    expect(text(await tool(ok, undefined))).toContain("not signed in");
    expect(text(await tool({ ...ok, image: "@@@" }, ALICE))).toContain("base64 PNG, JPEG or WebP");
    expect(text(await tool({ ...ok, image: b64(GIF) }, ALICE))).toContain("base64 PNG, JPEG or WebP");
    expect(text(await tool({ ...ok, image: b64(new TextEncoder().encode("<svg/>")) }, ALICE))).toContain("base64 PNG, JPEG or WebP");
    expect(text(await tool({ ...ok, sourceUrl: "https://x.com/jack" }, ALICE))).toContain("sourceUrl must be the X post link");
    expect(text(await tool({ ...ok, sourceUrl: "https://x.com/jack/status/21" }, ALICE))).toContain("sourceUrl is a different post");
    expect(text(await tool({ ...ok, itemId: "img_1" }, ALICE))).toContain("itemId must be the id of an X post item");
    expect(text(await tool({ ...ok, itemId: "nope" }, ALICE))).toContain("itemId must be the id of an X post item");
    // Another user's canvas looks like no canvas at all.
    expect(text(await tool(ok, BOB))).toContain("That canvas was not found");
    expect(uploads.rows.size).toBe(0);
  });

  it("keeps the upload caps: size, plan and storage", async () => {
    const big = await attachSetup();
    expect(MAX_IMAGE_CHARS).toBeGreaterThan(Math.ceil(MAX_UPLOAD_BYTES / 3) * 4);
    const tooBig = await big.tool({ canvasId: big.c.id, itemId: "xp_1", image: b64(pngBytes(10, 10, MAX_UPLOAD_BYTES)), sourceUrl: POST }, ALICE);
    expect(text(tooBig)).toContain("too big");
    const way = await big.tool({ canvasId: big.c.id, itemId: "xp_1", image: "A".repeat(MAX_IMAGE_CHARS + 1), sourceUrl: POST }, ALICE);
    expect(way.isError).toBe(true);
    expect(big.uploads.rows.size).toBe(0);

    const free = await attachSetup({ plan: "free" });
    expect(text(await free.tool({ canvasId: free.c.id, itemId: "xp_1", image: b64(pngBytes(10, 10)), sourceUrl: POST }, ALICE))).toContain("Uploads are part of Pro");

    const full = await attachSetup({ used: 1024 * 1024 * 1024 });
    expect(text(await full.tool({ canvasId: full.c.id, itemId: "xp_1", image: b64(pngBytes(10, 10)), sourceUrl: POST }, ALICE))).toContain("upload space is full");
  });

  it("replaces an earlier screenshot and frees its space", async () => {
    const { c, uploads, tool } = await attachSetup();
    await tool({ canvasId: c.id, itemId: "xp_1", image: b64(pngBytes(10, 10)), sourceUrl: POST }, ALICE);
    const first = [...uploads.rows.keys()][0]!;
    await tool({ canvasId: c.id, itemId: "xp_1", image: b64(pngBytes(20, 20)), sourceUrl: POST }, ALICE);
    expect(uploads.rows.has(first)).toBe(false);
    expect(uploads.rows.size).toBe(1);
  });

  it("then cut_parts works on it like an upload, with the post link and credit on every part", async () => {
    const { deps, repos, c, tool } = await attachSetup();
    const cut = createCutPartsTool(deps);
    const before = await cut({ canvasId: c.id, cuts: [{ itemId: "xp_1", role: "cards" }] }, ALICE);
    expect(before.isError).toBe(true);
    expect(text(before)).toContain(NEEDS_SCREENSHOT);
    expect(text(await cut({ canvasId: c.id, look: { itemId: "xp_1" } }, ALICE))).toContain("attach_screenshot");

    await tool({ canvasId: c.id, itemId: "xp_1", image: b64(pngBytes(1200, 900)), sourceUrl: POST }, ALICE);
    const res = await cut({ canvasId: c.id, cuts: [{ itemId: "xp_1", role: "cards", crop: { x: 0, y: 0.2, w: 1, h: 0.5 }, note: "the toggle row" }] }, ALICE);
    expect(res.isError).toBeFalsy();
    const saved = (await repos.canvases.getOwned(ALICE, c.id))!.state as CanvasState;
    expect(saved.parts![0]).toMatchObject({
      imageUrl: expect.stringMatching(/^\/api\/uploads\//),
      sourceUrl: POST,
      sourceSite: "x.com",
      title: "Post by @jack on X",
      imageWidth: 1200,
      imageHeight: 900,
      fromItemId: "xp_1",
    });
    expect(text(res)).toContain(`from x.com ${POST}`);
  });
});
