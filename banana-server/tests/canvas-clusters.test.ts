/**
 * V4.2 canvas side: clusters on image items (add_to_canvas), the by_cluster layout
 * (arrange_canvas, lib/layout, canvas labels), the raised tray cap, the state size of a
 * 150 reference board, and the mechanic kept through exports.
 */
import { describe, expect, it } from "vitest";
import { parseState, serializeState, stateToItems, stateToNodes } from "@/canvas/state";
import { arrangeNodes } from "@/canvas/layout-adapter";
import { clusterLabelKey, zoneLabelKey } from "@/canvas/nodes/SectionNode";
import { nodeLabel } from "@/canvas/labels";
import type { CanvasState, StoredNode, TrayReference } from "@/canvas/types";
import { arrangeState, MAX_STATE_BYTES, MAX_TRAY } from "@/lib/canvas/store";
import { buildKitModel, exportKit } from "@/lib/export";
import { cleanDetail } from "@/lib/export/model";
import {
  arrange,
  byCluster,
  clusterGroups,
  hasOverlap,
  MAX_CLUSTER,
  OTHER_CLUSTER,
  SECTION_HEADER,
  ZONE_LABEL_SPACE,
  type LayoutItem,
} from "@/lib/layout";
import { createAddToCanvasTool } from "@/lib/mcp/tools/add_to_canvas";
import { createArrangeCanvasTool } from "@/lib/mcp/tools/arrange_canvas";
import { checkoutCanvas } from "./export-fixtures";
import { ALICE, imageNode, makeDeps, ref, sectionNode, seedCanvas, state, text } from "./tools-fixtures";

function clustered(id: string, i: number, cluster: string | undefined, over: Partial<StoredNode> = {}): StoredNode {
  const n = imageNode(id, i, { parentId: "sec_1", ...over });
  if (n.type === "image" && cluster) n.data = { ...n.data, cluster };
  return n;
}

describe("add_to_canvas cluster", () => {
  async function setup() {
    const { deps, repos } = makeDeps();
    const tray: TrayReference[] = [{ ...ref(1) }, { ...ref(2), zone: "art" }, { ...ref(3) }];
    const c = await seedCanvas(repos, ALICE, state([], tray));
    return { repos, canvasId: c.id, add: createAddToCanvasTool(deps) };
  }

  it("accepts a cluster on references and screens, trims it and stores it on the node", async () => {
    const s = await setup();
    const res = await s.add(
      {
        canvasId: s.canvasId,
        items: [
          { type: "reference", referenceId: ref(1).id, note: "steal: the grid", cluster: "  layout  " },
          { type: "reference", referenceId: ref(2).id, cluster: "art", stealAxis: "pattern", becomes: "the divider pattern" },
          { type: "reference", referenceId: ref(3).id },
          {
            type: "screen",
            imageUrl: "https://bytescale.mobbin.com/FW25bBB/image/mobbin.com/prod/file.webp",
            sourceUrl: "https://mobbin.com/screens/0b6b5c8e-1111-4c2a-9a55-3f0f7f1d2e3a",
            app: "Linear",
            cluster: "component: approval gate",
          },
        ],
      },
      ALICE,
    );
    expect(res.isError).toBeFalsy();
    const saved = parseState((await s.repos.canvases.getOwned(ALICE, s.canvasId))!.state);
    const images = saved.nodes.filter((n) => n.type === "image");
    expect(images.map((n) => (n.type === "image" ? n.data.cluster : null))).toEqual(["layout", "art", undefined, "component: approval gate"]);
    // Art stays art; the cluster rides along to get_canvas items and survives a save round trip.
    expect(images[1]!.type === "image" && images[1]!.data.zone).toBe("art");
    expect(stateToItems(saved).find((i) => i.type === "image" && i.title === "Pin 1")).toMatchObject({ cluster: "layout", note: "steal: the grid" });
    expect(serializeState(stateToNodes(saved), saved.viewport, saved.tray)).toEqual(saved);
  });

  it(`rejects a cluster over ${MAX_CLUSTER} characters with a plain message`, async () => {
    const s = await setup();
    const res = await s.add({ canvasId: s.canvasId, items: [{ type: "reference", referenceId: ref(1).id, cluster: "x".repeat(41) }] }, ALICE);
    expect(res.isError).toBeTruthy();
    expect(text(res)).toBe('Item 1: cluster must be 1 to 40 characters, for example "layout", "component: nav" or "color". This one has 41.');
    expect(text(res)).not.toMatch(/—/);
    const ok = await s.add({ canvasId: s.canvasId, items: [{ type: "reference", referenceId: ref(1).id, cluster: "x".repeat(40) }] }, ALICE);
    expect(ok.isError).toBeFalsy();
  });

  it("rejects an empty cluster", async () => {
    const s = await setup();
    const res = await s.add({ canvasId: s.canvasId, items: [{ type: "reference", referenceId: ref(1).id, cluster: "   " }] }, ALICE);
    expect(res.isError).toBeTruthy();
    expect(text(res)).toMatch(/^Item 1: cluster must be 1 to 40 characters/);
  });

  it("names the cluster in the tile's accessible name", () => {
    const [node] = stateToNodes(state([clustered("img_1", 1, "type", { parentId: undefined })]));
    expect(nodeLabel(node!)).toBe("Image: Pin 1, from pinterest.com, cluster type");
  });
});

describe("by_cluster order (lib/layout)", () => {
  const item = (id: string, cluster?: string, zone?: "art"): LayoutItem => ({ id, aspectRatio: 4 / 3, sectionId: "s1", ...(cluster ? { cluster } : {}), ...(zone ? { zone } : {}) });

  it("orders layout, components A to Z, type, color, motion, art, other labels as first seen, then Other", () => {
    const input = [
      item("a", "art", "art"),
      item("n", undefined),
      item("m", "motion"),
      item("ct", "component: timeline"),
      item("w", "weird stuff"),
      item("c", "Color"),
      item("t", "type"),
      item("ca", "component: approval gate"),
      item("l", "layout"),
      item("e", "adjacent"),
      item("l2", "Layout"),
    ];
    expect(clusterGroups(input).map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["layout", ["l", "l2"]],
      ["component: approval gate", ["ca"]],
      ["component: timeline", ["ct"]],
      ["type", ["t"]],
      ["Color", ["c"]],
      ["motion", ["m"]],
      ["art", ["a"]],
      ["weird stuff", ["w"]],
      ["adjacent", ["e"]],
      [OTHER_CLUSTER, ["n"]],
    ]);
  });

  it("puts one labelled row per cluster, best first as given, with room for each label", () => {
    const input = [item("t1", "type"), item("l1", "layout"), item("t2", "type"), item("x", undefined), item("l2", "layout"), item("l3", "layout")];
    const out = byCluster(input, { sections: [{ id: "s1" }] });
    const r = Object.fromEntries(out.items.map((i) => [i.id, i]));
    expect(out.labels?.map((l) => l.label)).toEqual(["layout", "type", OTHER_CLUSTER]);
    expect(out.labels![0]!.y).toBe(SECTION_HEADER);
    // Same row, input order left to right.
    expect([r.l1!.y, r.l2!.y, r.l3!.y]).toEqual([SECTION_HEADER + ZONE_LABEL_SPACE, SECTION_HEADER + ZONE_LABEL_SPACE, SECTION_HEADER + ZONE_LABEL_SPACE]);
    expect(r.l1!.x).toBeLessThan(r.l2!.x);
    expect(r.l2!.x).toBeLessThan(r.l3!.x);
    expect(r.t1!.y).toBe(out.labels![1]!.y + ZONE_LABEL_SPACE);
    expect(out.labels![1]!.y).toBeGreaterThanOrEqual(r.l1!.y + r.l1!.h);
    expect(r.x!.y).toBe(out.labels![2]!.y + ZONE_LABEL_SPACE);
    expect(hasOverlap(out.items)).toBe(false);
    expect(out.sections[0]!.h).toBeGreaterThan(r.x!.y + r.x!.h - out.sections[0]!.y);
  });

  it("wraps a long cluster row and keeps sections side by side in the given order", () => {
    const input = [...Array.from({ length: 8 }, (_, i) => item(`l${i}`, "layout")), { ...item("b1", "type"), sectionId: "s0" }];
    const out = arrange("by_cluster", input, { sections: [{ id: "s0" }, { id: "s1" }] });
    expect(out.sections.map((s) => s.id)).toEqual(["s0", "s1"]);
    expect(out.sections[0]!.x).toBeLessThan(out.sections[1]!.x);
    const ys = new Set(out.items.filter((i) => i.id.startsWith("l")).map((i) => i.y));
    expect(ys.size).toBe(2);
    expect(hasOverlap(out.sections)).toBe(false);
    expect(arrange("by_cluster", input, { sections: [{ id: "s0" }, { id: "s1" }] })).toEqual(out);
  });
});

describe("arrange_canvas by_cluster", () => {
  function board(): CanvasState {
    return state([
      sectionNode("sec_1", { title: "Stamped", directionId: "bd-a" }),
      sectionNode("sec_2", { title: "Space", x: 900 }),
      clustered("img_t", 1, "type"),
      clustered("img_l1", 2, "layout"),
      clustered("img_a", 3, "art", { data: { ...imageNode("x", 3).data, zone: "art", cluster: "art" } } as Partial<StoredNode>),
      clustered("img_n", 4, undefined),
      clustered("img_l2", 5, "layout"),
      clustered("img_c", 6, "component: nav"),
      clustered("img_s1", 7, "outliers", { parentId: "sec_2" }),
      clustered("img_s2", 8, "category", { parentId: "sec_2" }),
    ]);
  }

  it("lays each section out in labelled cluster rows and the canvas draws those labels", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, board());
    const res = await createArrangeCanvasTool(deps)({ canvasId: c.id, layout: "by_cluster" }, ALICE);
    expect(res.isError).toBeFalsy();
    expect(text(res)).toContain("with the by_cluster layout");
    const saved = parseState((await repos.canvases.getOwned(ALICE, c.id))!.state);
    const at = (id: string) => saved.nodes.find((n) => n.id === id)!;
    // Rows top to bottom: layout, component: nav, type, art, Other.
    const order = ["img_l1", "img_c", "img_t", "img_a", "img_n"];
    for (let i = 1; i < order.length; i++) expect(at(order[i]!).y).toBeGreaterThan(at(order[i - 1]!).y);
    expect(at("img_l2").y).toBe(at("img_l1").y);
    expect(at("img_l2").x).toBeGreaterThan(at("img_l1").x);
    expect(at("img_l1").y).toBe(SECTION_HEADER + ZONE_LABEL_SPACE);
    // Art stays art.
    const art = at("img_a");
    expect(art.type === "image" && art.data.zone).toBe("art");
    // Sections keep the by_direction order (left to right) and do not overlap.
    expect(at("sec_1").x).toBeLessThan(at("sec_2").x);
    expect(at("sec_1").x + at("sec_1").w).toBeLessThanOrEqual(at("sec_2").x);
    // Space section: other labels in first seen order (outliers was placed before category).
    expect(at("img_s2").y).toBeGreaterThan(at("img_s1").y);

    const nodes = stateToNodes(saved);
    const labels = JSON.parse(clusterLabelKey(nodes, "sec_1")) as [number, string][];
    expect(labels.map(([, l]) => l)).toEqual(["layout", "component: nav", "type", "art", "Other"]);
    expect(labels[0]![0]).toBe(SECTION_HEADER);
    expect(labels[4]![0]).toBe(at("img_n").y - ZONE_LABEL_SPACE);
    expect(JSON.parse(clusterLabelKey(nodes, "sec_2"))).toEqual([
      [SECTION_HEADER, "outliers"],
      [at("img_s2").y - ZONE_LABEL_SPACE, "category"],
    ]);
  });

  it("puts items with no cluster under Other, last", () => {
    const s = state([sectionNode("sec_1"), clustered("img_1", 1, undefined), clustered("img_2", 2, "color"), clustered("img_3", 3, undefined)]);
    const out = arrangeState(s, "by_cluster", "sec_1");
    if ("error" in out) throw new Error("no section");
    const y = (id: string) => out.items.find((i) => i.id === id)!.y;
    expect(y("img_1")).toBe(y("img_3"));
    expect(y("img_1")).toBeGreaterThan(y("img_2"));
    const labels = JSON.parse(clusterLabelKey(stateToNodes(out.state), "sec_1")) as [number, string][];
    expect(labels.map(([, l]) => l)).toEqual(["color", "Other"]);
  });

  it("by_direction behaves as before on a clustered board, and the zone labels come back", () => {
    const strip = (s: CanvasState): CanvasState => ({
      ...s,
      nodes: s.nodes.map((n) => (n.type === "image" ? ({ ...n, data: { ...n.data, cluster: undefined } } as StoredNode) : n)),
    });
    const plain = arrangeNodes(stateToNodes(parseState(strip(board()))), "by_direction");
    const afterCluster = arrangeNodes(arrangeNodes(stateToNodes(board()), "by_cluster"), "by_direction");
    const geo = (ns: typeof plain) => ns.map((n) => [n.id, n.position.x, n.position.y, n.width, n.height, n.parentId]).sort();
    // Same geometry as an unclustered board, whatever came before (by_direction keeps no memory).
    expect(geo(afterCluster)).toEqual(geo(arrangeNodes(stateToNodes(board()), "by_direction")));
    expect(geo(arrangeNodes(stateToNodes(board()), "by_direction"))).toEqual(geo(plain));
    expect(clusterLabelKey(afterCluster, "sec_1")).toBe("");
    expect(zoneLabelKey(afterCluster, "sec_1")).not.toBe("");
  });

  it("every layout name is accepted by the tool", async () => {
    const { deps, repos } = makeDeps();
    const c = await seedCanvas(repos, ALICE, board());
    const res = await createArrangeCanvasTool(deps)({ canvasId: c.id, layout: "sideways" }, ALICE);
    expect(text(res)).toBe("layout must be one of: by_direction, by_cluster, masonry, grid, hero.");
  });
});

// ---------------------------------------------------------------------------
// State size: a 150 reference board with steal notes and clusters, 8 sections and notes,
// plus a full tray, as JSON the web canvas saves (PUT body { state }).

const CLUSTERS = ["layout", "component: approval gate", "component: run timeline", "type", "color", "motion", "art", "category", "adjacent", "outliers"];

function bigBoard(): CanvasState {
  const nodes: StoredNode[] = [];
  for (let s = 0; s < 8; s++) {
    nodes.push(sectionNode(`sec_${crypto.randomUUID()}`, { title: s === 7 ? "Space" : `Direction ${s + 1}: approvals as an air traffic strip board`, directionId: `bd_${crypto.randomUUID()}`, x: s * 2000, w: 1800, h: 3200 }));
  }
  const sections = nodes.map((n) => n.id);
  for (let i = 0; i < 150; i++) {
    const mobbin = i % 5 === 0;
    nodes.push({
      id: `img_${crypto.randomUUID()}`,
      type: "image",
      x: 16 + (i % 6) * 296,
      y: 76 + Math.floor(i / 6) * 260,
      w: 280,
      h: 373.33,
      parentId: sections[i % 8],
      data: {
        imageUrl: mobbin
          ? `https://bytescale.mobbin.com/FW25bBB/image/mobbin.com/prod/content/app_screens/${crypto.randomUUID()}.png?f=webp&w=1920&q=85&fit=shrink-cover`
          : `https://cdn.dribbble.com/userupload/${10000000 + i}/file/original-${crypto.randomUUID().replace(/-/g, "")}.png?resize=1600x1200&vertical=center`,
        thumbUrl: mobbin ? null : `https://cdn.dribbble.com/userupload/${10000000 + i}/file/still-${crypto.randomUUID().replace(/-/g, "")}.png?resize=400x300`,
        sourceUrl: mobbin
          ? `https://mobbin.com/screens/${crypto.randomUUID()}`
          : `https://dribbble.com/shots/${20000000 + i}-Agent-Supervision-Dashboard-Approval-Queue-Concept-for-Ops-Teams`,
        sourceSite: mobbin ? "mobbin.com" : "dribbble.com",
        title: "Agent supervision dashboard, approval queue concept with run timeline and status chips",
        // A full length steal note (MAX_NOTE 280 characters).
        note: `steal: ${"the stacked approval strips with a hard left status rail and mono timestamps, ".repeat(4)}`.slice(0, 280),
        tag: i % 3 === 0 ? "ship" : null,
        ...(i % 8 === 6 ? { zone: "art" as const } : {}),
        cluster: CLUSTERS[i % CLUSTERS.length]!,
        ...(mobbin ? { mobbinId: crypto.randomUUID(), placedAt: "2026-10-17T12:00:00.000Z" } : {}),
        width: 1600,
        height: 1200,
      },
    } as StoredNode);
  }
  for (let i = 0; i < 24; i++) {
    nodes.push({
      id: `note_${crypto.randomUUID()}`,
      type: "note",
      x: 16,
      y: 3000,
      w: 280,
      h: 240,
      parentId: sections[i % 8],
      data: {
        text: `IDEA: approvals as an air traffic strip board. BUILD ON: [Linear, inbox](https://mobbin.com/screens/${crypto.randomUUID()}). ${"Keep the queue readable at a glance, one loud accent for blocked runs, everything else calm. ".repeat(5)}`,
        color: "yellow",
      },
    } as StoredNode);
  }
  for (let i = 0; i < 8; i++) {
    nodes.push({ id: `sw_${crypto.randomUUID()}`, type: "swatch", x: 0, y: 0, w: 220, h: 250, parentId: sections[i], data: { hex: "#1f3a5f", oklch: "oklch(0.34 0.07 255)", role: "primary", tag: "ship" } } as StoredNode);
  }
  const tray: TrayReference[] = Array.from({ length: MAX_TRAY }, (_, i) => ({
    id: `ref_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    thumbUrl: `https://i.pinimg.com/236x/${crypto.randomUUID().replace(/-/g, "")}.jpg`,
    imageUrl: `https://i.pinimg.com/736x/${crypto.randomUUID().replace(/-/g, "")}.jpg`,
    sourceUrl: `https://www.pinterest.com/pin/${412783122093847261n + BigInt(i)}/`,
    sourceSite: "pinterest.com",
    title: "Queue management app ui, dark mode dashboard with status lanes and filters",
    width: 736,
    height: 1104,
    directionId: `bd_${crypto.randomUUID()}`,
    ...(i % 4 === 0 ? { zone: "art" as const } : {}),
  }));
  return parseState({ version: 1, viewport: { x: -1200.5, y: -340.25, zoom: 0.35 }, nodes, tray, taste: ["brutalist", "editorial"] });
}

describe("state size", () => {
  it("a 150 reference board with notes, clusters, 8 sections and a full tray fits MAX_STATE_BYTES with 30% headroom", () => {
    const s = bigBoard();
    expect(s.nodes.filter((n) => n.type === "image")).toHaveLength(150);
    expect(s.tray).toHaveLength(MAX_TRAY);
    const board = new TextEncoder().encode(JSON.stringify({ state: { ...s, tray: [] } })).length;
    const withTray = new TextEncoder().encode(JSON.stringify({ state: s })).length;
    console.info(`[state size] 150 references: ${board} bytes; with a full tray of ${MAX_TRAY}: ${withTray} bytes; cap ${MAX_STATE_BYTES}`);
    expect(withTray).toBeLessThanOrEqual(MAX_STATE_BYTES * 0.7);
  });
});

// ---------------------------------------------------------------------------
// Exports keep the mechanic (and the V4.1 language and source).

describe("exports keep the mechanic", () => {
  const mechanic = { element: "progress bar", how: "The booking steps read as a strip of ticket stubs torn off one by one" };
  const language = { typeVoice: "condensed", colorStrategy: "committed", ground: "light", density: "dense", composition: "poster", material: "print", motion: "snap" };
  const snapshot = {
    ...checkoutCanvas,
    directions: checkoutCanvas.directions.map((d, i) => (i === 1 ? { ...d, detail: { verdict: "keep" as const, mechanic, source: "candidate" as const } } : d)),
  };

  it("cleanDetail keeps mechanic, language and source", () => {
    const d = cleanDetail({ mechanic, source: "challenger", language, verdict: "keep" });
    expect(d?.mechanic).toEqual(mechanic);
    expect(d?.source).toBe("challenger");
    expect(d?.language).toEqual(language);
    expect(cleanDetail({ mechanic: { element: "", how: "x" } })?.mechanic).toBeUndefined();
    expect(cleanDetail({ mechanic: "progress bar" })?.mechanic).toBeUndefined();
  });

  it("DIRECTION.md and BUILD-PROMPT.md show the exported direction's mechanic", () => {
    const m = buildKitModel(snapshot, { directionId: "d2" });
    expect(m.focus[0]?.detail?.mechanic).toEqual(mechanic);
    const files = exportKit(snapshot, ["direction_md", "build_prompt"], { directionId: "d2" });
    const line = "Mechanic: build it around the progress bar. The booking steps read as a strip of ticket stubs torn off one by one.";
    expect(files).toHaveLength(2);
    for (const f of files) expect(f.content).toContain(line);
  });
});
