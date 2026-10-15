/**
 * VAL-03 taste import, first slice: the user picks 5 to 20 of their own favourite images, uploaded
 * through the normal upload route (Pro plan, size rules and the 1 GB quota all apply there). This
 * reads each one from R2 into memory, runs the extract_palette pipeline on it, turns the palette
 * into style words and drops the bytes. Only words reach `user_taste`.
 */
import { isUuid } from "@/lib/db/ids";
import { extractPalette } from "@/lib/palette";
import type { R2Like, UploadRepo } from "@/lib/uploads/types";
import { mergeStyleWords, styleWordsFromPalettes } from "./index";
import type { TasteStore } from "./store";

import { MAX_IMPORT_IMAGES, MIN_IMPORT_IMAGES } from "./import-limits";

export { MAX_IMPORT_IMAGES, MIN_IMPORT_IMAGES };
/** Images that must decode (WebP and GIF do not) for the words to mean anything. */
export const MIN_DECODED_IMAGES = 3;

export type TasteImportError = "bad_count" | "not_found" | "storage_unavailable" | "too_few_decoded";
export type TasteImportOutcome =
  | { ok: true; words: string[]; used: number; skipped: number }
  | { ok: false; error: TasteImportError };

export type TasteImportDeps = {
  uploads: UploadRepo;
  bucket: R2Like | null;
  store: TasteStore;
};

export async function importTasteFromUploads(
  deps: TasteImportDeps,
  userId: string,
  uploadIds: readonly string[],
): Promise<TasteImportOutcome> {
  const ids = [...new Set(uploadIds)];
  if (ids.length < MIN_IMPORT_IMAGES || ids.length > MAX_IMPORT_IMAGES || !ids.every(isUuid)) {
    return { ok: false, error: "bad_count" };
  }
  if (!deps.bucket) return { ok: false, error: "storage_unavailable" };

  const palettes: string[][] = [];
  let skipped = 0;
  for (const id of ids) {
    const row = await deps.uploads.get(id);
    // Only the user's own uploads; a missing one and someone else's look the same.
    if (!row || row.userId !== userId) return { ok: false, error: "not_found" };
    const obj = await deps.bucket.get(row.r2Key);
    if (!obj) return { ok: false, error: "not_found" };
    const bytes = new Uint8Array(await new Response(obj.body).arrayBuffer());
    const result = extractPalette({ images: [bytes], size: 5 });
    if (result.palette.length === 0) skipped++;
    else palettes.push(result.palette.map((c) => c.hex));
  }
  if (palettes.length < MIN_DECODED_IMAGES) return { ok: false, error: "too_few_decoded" };

  const words = styleWordsFromPalettes(palettes);
  const current = await deps.store.get(userId);
  await deps.store.save(userId, {
    likedCardIds: current.likedCardIds,
    styleWords: mergeStyleWords(words, current.styleWords),
    sourceUrls: current.sourceUrls,
  });
  return { ok: true, words, used: palettes.length, skipped };
}

export const TASTE_IMPORT_MESSAGES: Readonly<Record<TasteImportError, string>> = {
  bad_count: `Choose ${MIN_IMPORT_IMAGES} to ${MAX_IMPORT_IMAGES} images.`,
  not_found: "One of the images was not found. Upload it again.",
  storage_unavailable: "Storage is not working right now. Try again in a minute.",
  too_few_decoded: `Fewer than ${MIN_DECODED_IMAGES} images could be read. Use PNG or JPEG images.`,
};
