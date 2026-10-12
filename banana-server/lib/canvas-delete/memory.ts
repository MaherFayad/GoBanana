/**
 * In-memory canvas deletion over lib/db/memory.ts data, for tests and local runs. Mirrors the
 * schema: removing a canvas removes its directions, references and palettes (ON DELETE CASCADE).
 */
import type { MemoryRepos } from "@/lib/db/memory";
import { uploadPath } from "@/lib/uploads/rules";
import type { UploadRecord } from "@/lib/uploads/types";
import type { CanvasDeleteRepo, UploadRowRepo } from "./delete";

export function memoryCanvasDeleteRepo(data: MemoryRepos["data"]): CanvasDeleteRepo {
  const owned = (userId: string, canvasId: string) => {
    const c = data.canvases.get(canvasId);
    return c && c.userId === userId ? c : null;
  };
  return {
    async findOwned(userId, canvasId) {
      const c = owned(userId, canvasId);
      return c ? { title: c.title, state: JSON.parse(JSON.stringify(c.state)) as unknown } : null;
    },
    async uploadsShownElsewhere(userId, canvasId, uploadIds) {
      const found = new Set<string>();
      for (const c of data.canvases.values()) {
        if (c.userId !== userId || c.id === canvasId) continue;
        const text = JSON.stringify(c.state);
        for (const id of uploadIds) if (text.includes(uploadPath(id))) found.add(id);
      }
      return found;
    },
    async deleteOwned(userId, canvasId) {
      if (!owned(userId, canvasId)) return false;
      data.canvases.delete(canvasId);
      data.directions = data.directions.filter((d) => d.canvasId !== canvasId);
      for (const [id, r] of data.references) if (r.canvasId === canvasId) data.references.delete(id);
      data.palettes = data.palettes.filter((p) => p.canvasId !== canvasId);
      return true;
    },
  };
}

/** Upload rows in a Map, for tests. */
export function memoryUploadRows(rows: Map<string, UploadRecord> = new Map()): UploadRowRepo & { rows: Map<string, UploadRecord> } {
  return {
    rows,
    async get(id) {
      return rows.get(id) ?? null;
    },
    async deleteOwned(userId, id) {
      const row = rows.get(id);
      if (!row || row.userId !== userId) return false;
      rows.delete(id);
      return true;
    },
  };
}
