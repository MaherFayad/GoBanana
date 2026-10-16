export type TasteGenre = { id: string; label: string; aim: [number, number]; note: string };
export const GENRES: readonly TasteGenre[];
export const GENRE_IDS: readonly string[];
export function genreOf(item: { genre?: unknown; platform?: unknown } | null | undefined): string;
export function picksOfGenre<T extends { genre?: unknown; platform?: unknown }>(picks: readonly T[], genre?: string): T[];
export const NO_MODEL_SITES: readonly string[];
export const NO_MODEL_HOSTS: readonly string[];
export function modelInputOk(item: { id?: unknown; group?: unknown; sourceUrl?: unknown; foundOn?: unknown; imageUrl?: unknown; thumbUrl?: unknown } | null | undefined): boolean;
