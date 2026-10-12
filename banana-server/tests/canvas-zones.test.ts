/**
 * Wild directions v2, canvas side: directions.detail (schema, migration, repos), zones on tray
 * and image items, "what to steal" notes, the art row in layouts and placement, verdicts and
 * get_canvas output, links in note text.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { directions } from "@/db/schema";
import { parseState, serializeState, stateToNodes, stateToItems } from "@/canvas/state";
import { linkParts } from "@/canvas/linkify";
import { zoneLabelKey } from "@/canvas/nodes/SectionNode";
import { addToTray, appendNodes, arrangeState, toSnapshot, type NewNode } from "@/lib/canvas/store";
import { parseDirectionDetail } from "@/lib/db/detail";
import type { DirectionDetail, VisualSpec } from "@/lib/direction-detail";
import { arrangeZoned, byDirection, hasOverlap, SECTION_HEADER, ZONE_LABEL_SPACE } from "@/lib/layout";
import { createAddToCanvasTool, MAX_NOTE } from "@/lib/mcp/tools/add_to_canvas";
import { createArrangeCanvasTool } from "@/lib/mcp/tools/arrange_canvas";
import { createGetCanvasTool } from "@/lib/mcp/tools/get_canvas";
import type { CanvasState, StoredNode } from "@/canvas/types";
import { ALICE, imageNode, makeDeps, ref, sectionNode, seedCanvas, state, text } from "./tools-fixtures";

const SPEC: VisualSpec = {
  typography: "Condensed caps for headings, a plain grotesk for body.",
  typeVoice: "condensed",
  color: "Paper white base, one stamp red accent.",
  layout: "Single column, 4 columns on a phone.",
  imagery: "Scanned tickets.",
  motion: "Stamps land in 120ms.",
  texture: "Paper grain.",
  iconography: "Thin line icons.",
  density: "Roomy.",
  signature: "Balance shown as a stamped ticket.",
  pattern: "Stamped date as a section divider.",
  steal: ["stamp edges"],
  avoid: ["tiny type"],
  styleWords: ["retro"],
  whyItFits: "Travel feels physical.",
};

const DETAIL: DirectionDetail = { platform: "mobile", pages: ["onboarding"], spec: SPEC, artQueries: ["ticket stamps"], prompt: "Build it." };

describe("directions.detail schema and migration", () => {
  it("is a nullable jsonb column", () => {
    const col = getTableColumns(directions).detail;
    expect(col.name).toBe("detail");
    expect(col.columnType).toBe("PgJsonb");
    expect(col.notNull).toBe(false);
  });

  it("ships as migration 0004 in the journal", () => {
    const sql = readFileSync(new URL("../db/migrations/0004_directions_detail.sql", import.meta.url), "utf8");
    expect(sql.trim()).toBe('ALTER TABLE "directions" ADD COLUMN "detail" jsonb;');
    const journal = JSON.parse(readFileSync(new URL("../db/migrations/meta/_journal.json", import.meta.url), "utf8"));
    expect(journal.entries.map((e: { tag: string }) => e.tag)).toContain("0004_directions_detail");
    const snap = JSON.parse(readFileSync(new URL("../db/migrations/meta/0004_snapshot.json", import.meta.url), "utf8"));
    expect(snap.tables["public.directions"].columns.detail).toMatchObject({ type: "jsonb", notNull: false });
  });
});

describe("parseDirectionDetail", () => {
  it("keeps a valid detail and drops junk", () => {
    expect(parseDirectionDetail(DETAIL)).toEqual(DETAIL);
    expect(parseDirectionDetail(null)).toBeNull();
    expect(parseDirectionDetail("x")).toBeNull();
    expect(parseDirectionDetail([1])).toBeNull();
    expect(parseDirectionDetail({ junk: 1 })).toBeNull();
    expect(parseDirectionDetail({ platform: "fridge", verdict: "maybe", pages: "home", spec: { typeVoice: "comic" } })).toBeNull();
    expect(parseDirectionDetail({ platform: "webapp", pages: ["", 3, "pricing"], verdict: "keep" })).toEqual({
      platform: "webapp",
      pages: ["pricing"],
      verdict: "keep",
    });
  });
});

describe("direction repo detail", () => {
  it("saves, reads, keeps the verdict on refresh, and sets verdicts", async () => {
    const { repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    await repos.directions.upsertMany(c.id, [
      { bendId: "bd-a", move: "era", title: "A", searchQuery: "a", detail: DETAIL },
      { bendId: "bd-b", move: "era", title: "B", searchQuery: "b" },
    ]);
    let list = await repos.directions.listForCanvas(c.id);
    const a = list.find((d) => d.bendId === "bd-a")!;
    const b = list.find((d) => d.bendId === "bd-b")!;
    expect(a.detail).toEqual(DETAIL);
    expect(b.detail ?? null).toBeNull();

    expect(await repos.directions.setVerdict(c.id, [a.id], "keep")).toBe(1);
    // A later bend refreshes the detail but keeps the verdict; no detail leaves it alone.
    await repos.directions.upsertMany(c.id, [{ bendId: "bd-a", move: "era", title: "A2", searchQuery: "a", detail: { platform: "website" } }]);
    await repos.directions.upsertMany(c.id, [{ bendId: "bd-a", move: "era", title: "A3", searchQuery: "a" }]);
    list = await repos.directions.listForCanvas(c.id);
    expect(list.find((d) => d.bendId === "bd-a")!.detail).toEqual({ platform: "website", verdict: "keep" });
    expect(list.find((d) => d.bendId === "bd-b")!.detail?.verdict).toBeUndefined();
  });
});

describe("zone and note in canvas state", () => {
  it("round trips zone on tray results and image nodes, and the note", () => {
    const raw = state(
      [imageNode("img_1", 1, { data: { ...imageNode("x", 1).data, zone: "art", note: "steal: the stamp" } } as Partial<StoredNode>)],
      [{ ...ref(2), zone: "art" }, { ...ref(3), zone: "ui" }, { ...ref(4), zone: "bogus" } as never],
    );
    const parsed = parseState(JSON.parse(JSON.stringify(raw)));
    const node = parsed.nodes[0]!;
    expect(node.type === "image" && node.data.zone).toBe("art");
    expect(node.type === "image" && node.data.note).toBe("steal: the stamp");
    expect(parsed.tray.map((t) => t.zone)).toEqual(["art", "ui", undefined]);
    const again = serializeState(stateToNodes(parsed), parsed.viewport, parsed.tray);
    expect(again).toEqual(parsed);
    const items = stateToItems(parsed);
    expect(items[0]).toMatchObject({ type: "image", zone: "art", note: "steal: the stamp" });
  });

  it("keeps the search's zone when results go to the tray", () => {
    const next = addToTray(state(), [{ ...ref(1), zone: "art" } as never, ref(2)], "bd-a");
    expect(next.tray.map((t) => [t.zone, t.directionId])).toEqual([
      ["art", "bd-a"],
      [undefined, "bd-a"],
    ]);
  });
});

const artRef = (i: number) => ({ ...ref(i), zone: "art" as const });

describe("add_to_canvas notes and zones", () => {
  async function setup(tray: CanvasState["tray"], nodes: StoredNode[] = []) {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, state(nodes, tray));
    await repos.directions.upsertMany(c.id, [{ bendId: "bd-a", move: "era", title: "Stamped", searchQuery: "q" }]);
    return { deps, repos, canvasId: c.id, add: createAddToCanvasTool(deps) };
  }

  it("saves the note and the zone, and puts art above UI in the direction section", async () => {
    const s = await setup([
      { ...ref(1), directionId: "bd-a" },
      { ...artRef(2), directionId: "bd-a" },
      { ...ref(3), directionId: "bd-a" },
    ]);
    const res = await s.add(
      {
        canvasId: s.canvasId,
        items: [
          { type: "reference", referenceId: ref(1).id, note: "steal: the date stamp https://example.com/x." },
          { type: "reference", referenceId: ref(2).id, note: "steal: ink texture" },
          { type: "reference", referenceId: ref(3).id },
        ],
      },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const saved = parseState((await s.repos.canvases.getOwned(ALICE, s.canvasId))!.state);
    const imgs = saved.nodes.filter((n) => n.type === "image");
    const byUrl = (i: number) => imgs.find((n) => n.type === "image" && n.data.imageUrl === ref(i).imageUrl)!;
    const [ui1, art, ui2] = [byUrl(1), byUrl(2), byUrl(3)];
    expect(ui1.type === "image" && ui1.data.note).toBe("steal: the date stamp https://example.com/x.");
    expect(art.type === "image" && art.data.zone).toBe("art");
    expect(ui1.type === "image" && ui1.data.zone).toBeUndefined();
    expect(art.y).toBe(SECTION_HEADER + ZONE_LABEL_SPACE);
    expect(ui1.y).toBeGreaterThanOrEqual(art.y + art.h + ZONE_LABEL_SPACE);
    expect(ui2.y).toBe(ui1.y);
    expect(art.parentId).toBe(ui1.parentId);
    // The section frame holds everything.
    const sec = saved.nodes.find((n) => n.type === "section")!;
    expect(sec.h).toBeGreaterThanOrEqual(ui1.y + ui1.h);
  });

  it("moves existing UI items down when the first art item arrives", async () => {
    const sec = sectionNode("sec_1", { directionId: "bd-a", title: "Stamped" });
    const ui = imageNode("img_ui", 5, { parentId: "sec_1", x: 16, y: SECTION_HEADER });
    const s = await setup([{ ...artRef(6), directionId: "bd-a" }], [sec, ui]);
    await s.add({ canvasId: s.canvasId, items: [{ type: "reference", referenceId: ref(6).id }] }, ALICE);
    const saved = parseState((await s.repos.canvases.getOwned(ALICE, s.canvasId))!.state);
    const moved = saved.nodes.find((n) => n.id === "img_ui")!;
    const art = saved.nodes.find((n) => n.type === "image" && n.id !== "img_ui")!;
    expect(art.y).toBe(SECTION_HEADER + ZONE_LABEL_SPACE);
    expect(moved.y).toBe(art.y + art.h + 16 + ZONE_LABEL_SPACE);
  });

  it("takes the zone from the saved search row when the tray no longer has it", async () => {
    const s = await setup([]);
    await s.repos.references.insertMany(s.canvasId, [{ ...ref(7), lane: "art" as never }]);
    await s.add({ canvasId: s.canvasId, items: [{ type: "reference", referenceId: ref(7).id }] }, ALICE);
    const saved = parseState((await s.repos.canvases.getOwned(ALICE, s.canvasId))!.state);
    const n = saved.nodes.find((x) => x.type === "image")!;
    expect(n.type === "image" && n.data.zone).toBe("art");
  });

  it("refuses notes over the limit", async () => {
    const s = await setup([ref(1)]);
    const res = await s.add({ canvasId: s.canvasId, items: [{ type: "reference", referenceId: ref(1).id, note: "x".repeat(MAX_NOTE + 1) }] }, ALICE);
    expect(res.isError).toBe(true);
  });
});

describe("art row in layouts", () => {
  it("byDirection puts art items first in a section column, with label room", () => {
    const r = byDirection(
      [
        { id: "u1", w: 4, h: 3, sectionId: "s" },
        { id: "a1", w: 4, h: 3, sectionId: "s", zone: "art" },
        { id: "u2", w: 4, h: 3, sectionId: "s" },
      ],
      { rowGap: 16 },
    );
    const y = Object.fromEntries(r.items.map((i) => [i.id, i.y]));
    expect(y.a1).toBe(SECTION_HEADER + ZONE_LABEL_SPACE);
    expect(y.u1).toBe(y.a1! + 210 + 16 + ZONE_LABEL_SPACE);
    expect(y.u2).toBe(y.u1! + 210 + 16);
    expect(hasOverlap(r.items)).toBe(false);
  });

  it("byDirection is unchanged without art", () => {
    const r = byDirection([{ id: "u1", w: 4, h: 3, sectionId: "s" }]);
    expect(r.items[0]!.y).toBe(SECTION_HEADER);
  });

  it("arrangeZoned stacks the art block above the UI block", () => {
    const r = arrangeZoned("grid", [
      { id: "u1", sectionId: "s" },
      { id: "a1", sectionId: "s", zone: "art" },
      { id: "a2", sectionId: "s", zone: "art" },
    ], { origin: { x: 16, y: 48 } });
    const y = Object.fromEntries(r.items.map((i) => [i.id, i.y]));
    expect(y.a1).toBe(48 + ZONE_LABEL_SPACE);
    expect(y.a2).toBe(48 + ZONE_LABEL_SPACE);
    expect(y.u1).toBe(48 + ZONE_LABEL_SPACE + 280 + 16 + ZONE_LABEL_SPACE);
    expect(hasOverlap(r.items)).toBe(false);
  });

  it("arrange_canvas keeps the art row on top, for the whole board and one section", async () => {
    const { deps, repos } = makeDeps();
    const art = imageNode("img_a", 2, { parentId: "sec_1", y: 300, data: { ...imageNode("x", 2).data, zone: "art" } } as Partial<StoredNode>);
    const ui = imageNode("img_u", 1, { parentId: "sec_1", y: 48 });
    const c = await seedCanvas(repos, ALICE, state([sectionNode("sec_1", { directionId: "bd-a" }), ui, art]));
    const arrange = createArrangeCanvasTool(deps);
    for (const input of [{ layout: "by_direction" }, { layout: "masonry", sectionId: "sec_1" }]) {
      const res = await arrange({ canvasId: c.id, ...input }, ALICE);
      expect(res.isError).toBeFalsy();
      const saved = parseState((await repos.canvases.getOwned(ALICE, c.id))!.state);
      const a = saved.nodes.find((n) => n.id === "img_a")!;
      const u = saved.nodes.find((n) => n.id === "img_u")!;
      expect(a.y).toBe(SECTION_HEADER + ZONE_LABEL_SPACE);
      expect(u.y).toBeGreaterThanOrEqual(a.y + a.h + ZONE_LABEL_SPACE);
      // The canvas draws the two labels where the layout left room.
      const key = zoneLabelKey(stateToNodes(saved), "sec_1");
      expect(key).toBe(`${SECTION_HEADER}|${u.y - ZONE_LABEL_SPACE}`);
    }
  });

  it("appendNodes without art keeps the old placement", () => {
    const s = state([sectionNode("sec_1")]);
    const node: NewNode = { type: "note", data: { text: "hi", color: "yellow" } };
    const { placed } = appendNodes(s, [node], () => "sec_1", (p) => `${p}_1`);
    expect(placed[0]!.y).toBe(SECTION_HEADER);
  });

  it("arrangeState leaves sections without art as before", () => {
    const s = state([sectionNode("sec_1"), imageNode("img_u", 1, { parentId: "sec_1", y: 300 })]);
    const out = arrangeState(s, "masonry", "sec_1");
    if ("error" in out) throw new Error("no section");
    expect(out.state.nodes.find((n) => n.id === "img_u")!.y).toBe(SECTION_HEADER);
    expect(zoneLabelKey(stateToNodes(out.state), "sec_1")).toBe("");
  });
});

describe("snapshot and get_canvas", () => {
  it("snapshot directions carry the detail", async () => {
    const { repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE);
    await repos.directions.upsertMany(c.id, [{ bendId: "bd-a", move: "era", title: "A", searchQuery: "a", detail: DETAIL }]);
    const snap = toSnapshot({ canvas: c, state: state(), directions: await repos.directions.listForCanvas(c.id) });
    expect(snap.directions[0]).toEqual({ id: "bd-a", move: "era", title: "A", searchQuery: "a", detail: DETAIL });
  });

  it("get_canvas shows platform, pages, verdict and a compact spec, without the prompt", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(
      repos,
      ALICE,
      state([imageNode("img_1", 1, { data: { ...imageNode("x", 1).data, zone: "art", note: "steal: stamps" } } as Partial<StoredNode>)]),
    );
    await repos.directions.upsertMany(c.id, [
      { bendId: "bd-a", move: "era", title: "Stamped", searchQuery: "a", detail: DETAIL },
      { bendId: "bd-b", move: "era", title: "Plain", searchQuery: "b" },
    ]);
    const a = (await repos.directions.listForCanvas(c.id)).find((d) => d.bendId === "bd-a")!;
    await repos.directions.setVerdict(c.id, [a.id], "keep");
    const res = await createGetCanvasTool(deps)({ canvasId: c.id }, ALICE);
    const t = text(res);
    expect(t).toContain("platform mobile; pages: onboarding; kept");
    expect(t).toContain("spec: type condensed | signature: Balance shown as a stamped ticket.");
    expect(t).toContain("not rated");
    expect(t).toContain("[art direction]");
    expect(t).toContain("note: steal: stamps");
    const out = res.structuredContent as { canvas: { directions: { id: string; detail?: DirectionDetail | null }[] } };
    const d = out.canvas.directions.find((x) => x.id === "bd-a")!;
    expect(d.detail).toMatchObject({ platform: "mobile", pages: ["onboarding"], verdict: "keep", spec: SPEC });
    expect(d.detail?.prompt).toBeUndefined();
  });
});

describe("links in note text", () => {
  it("splits http and https URLs and trims sentence punctuation", () => {
    expect(linkParts("see https://a.example/x?y=1. and http://b.example)")).toEqual([
      { text: "see " },
      { text: "https://a.example/x?y=1", href: "https://a.example/x?y=1" },
      { text: ". and " },
      { text: "http://b.example", href: "http://b.example/" },
      { text: ")" },
    ]);
  });

  it("never links other schemes or markup", () => {
    expect(linkParts("javascript:alert(1) <b>x</b> data:text/html,hi")).toEqual([{ text: "javascript:alert(1) <b>x</b> data:text/html,hi" }]);
    expect(linkParts('https://a.example/"><img src=x>')).toEqual([
      { text: "https://a.example/", href: "https://a.example/" },
      { text: '"><img src=x>' },
    ]);
    expect(linkParts("plain")).toEqual([{ text: "plain" }]);
  });
});
