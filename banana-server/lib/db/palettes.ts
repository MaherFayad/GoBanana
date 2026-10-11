/** `palettes` table: colors and contrast results from extract_palette. No image bytes. */
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { palettes } from "@/db/schema";
import { isUuid } from "./ids";
import type { PaletteRecord, PaletteRepo } from "./types";

export async function insertPalette(db: Db, canvasId: string, colors: unknown, contrast: unknown): Promise<string> {
  const [row] = await db.insert(palettes).values({ canvasId, colors, contrast }).returning({ id: palettes.id });
  if (!row) throw new Error("Could not save palette");
  return row.id;
}

export async function listPalettes(db: Db, canvasId: string): Promise<PaletteRecord[]> {
  if (!isUuid(canvasId)) return [];
  return db
    .select({ id: palettes.id, canvasId: palettes.canvasId, colors: palettes.colors, contrast: palettes.contrast })
    .from(palettes)
    .where(eq(palettes.canvasId, canvasId));
}

export function paletteRepo(db: Db): PaletteRepo {
  return {
    insert: (canvasId, colors, contrast) => insertPalette(db, canvasId, colors, contrast),
    listForCanvas: (canvasId) => listPalettes(db, canvasId),
  };
}
