export type TasteGenre = { id: string; label: string; aim: [number, number]; note: string };
export const GENRES: readonly TasteGenre[];
export const GENRE_IDS: readonly string[];
export function genreOf(item: { genre?: unknown; platform?: unknown } | null | undefined): string;
export function picksOfGenre<T extends { genre?: unknown; platform?: unknown }>(picks: readonly T[], genre?: string): T[];
