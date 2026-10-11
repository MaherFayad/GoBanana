/** Shared fixtures for the canvas tool tests: in-memory repos, deps and a sample canvas. */
import { createMemoryRepos, type MemoryRepos } from "@/lib/db/memory";
import type { CanvasState, StoredNode } from "@/canvas/types";
import type { CanvasToolDeps } from "@/lib/mcp/tools/canvas-shared";
import type { Plan } from "@/lib/quota";
import type { Reference } from "@/lib/sources/types";

export const ALICE = "11111111-1111-4111-8111-111111111111";
export const BOB = "22222222-2222-4222-8222-222222222222";
export const APP = "https://app.example.test";
export const NOW = new Date("2026-10-15T12:00:00Z");

export function makeDeps(opts: { plans?: Record<string, Plan>; takedowns?: string[] } = {}): {
  deps: CanvasToolDeps;
  repos: MemoryRepos;
} {
  const repos = createMemoryRepos({ plans: opts.plans, takedowns: opts.takedowns });
  let n = 0;
  const deps: CanvasToolDeps = {
    repos,
    appUrl: () => APP,
    makeId: (prefix) => `${prefix}_${++n}`,
    now: () => NOW,
  };
  return { deps, repos };
}

export function ref(i: number, over: Partial<Reference> = {}): Reference {
  return {
    id: `ref_${String(i).padStart(16, "0")}`,
    thumbUrl: `https://i.pinimg.com/236x/${i}.png`,
    imageUrl: `https://i.pinimg.com/originals/${i}.png`,
    sourceUrl: `https://www.pinterest.com/pin/${i}/`,
    sourceSite: "pinterest.com",
    title: `Pin ${i}`,
    width: 400,
    height: 300,
    ...over,
  };
}

export function imageNode(id: string, i: number, over: Partial<StoredNode> = {}): StoredNode {
  const r = ref(i);
  return {
    id,
    type: "image",
    x: 0,
    y: 0,
    w: 280,
    h: 210,
    data: {
      imageUrl: r.imageUrl,
      thumbUrl: r.thumbUrl,
      sourceUrl: r.sourceUrl,
      sourceSite: r.sourceSite,
      title: r.title ?? null,
      note: null,
      tag: null,
      width: 400,
      height: 300,
    },
    ...over,
  } as StoredNode;
}

export function sectionNode(id: string, over: Partial<StoredNode> & { title?: string; directionId?: string } = {}): StoredNode {
  const { title, directionId, ...rest } = over;
  return {
    id,
    type: "section",
    x: 0,
    y: 0,
    w: 616,
    h: 420,
    data: { title: title ?? "Section", ...(directionId ? { directionId } : {}) },
    ...rest,
  } as StoredNode;
}

export function state(nodes: StoredNode[] = [], tray: CanvasState["tray"] = []): CanvasState {
  return { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, nodes, tray };
}

export async function seedCanvas(repos: MemoryRepos, userId: string, s: CanvasState = state(), title = "Board") {
  return repos.canvases.create({ userId, title, brief: "flight checkout screen", state: s });
}

export function text(res: { content: { text?: string }[] }): string {
  return res.content.map((c) => c.text ?? "").join("\n");
}
