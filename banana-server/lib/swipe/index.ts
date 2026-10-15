/**
 * The swipe file (VAL-09): a personal library of parts and great references saved across boards.
 * URLs, source links, roles and crop rectangles only. Never image bytes (hard rule 2), and every
 * item keeps its source link (hard rule 3). Pure helpers plus the repo port; the Drizzle and
 * in-memory repos live in ./repo.ts.
 */
import { isPartRole } from "@/lib/stitch/types";
import { hostMatchesDomain } from "@/lib/sources/url";

/** Items one user may keep. Past it, saves are skipped and the agent is told. */
export const MAX_SWIPE_ITEMS = 500;
/** Most items one read returns. */
export const MAX_SWIPE_LIMIT = 50;
export const DEFAULT_SWIPE_LIMIT = 20;
export const MAX_SWIPE_NOTE = 300;

export const SWIPE_KINDS = ["part", "reference"] as const;
export type SwipeKind = (typeof SWIPE_KINDS)[number];

export type SwipeCrop = { x: number; y: number; w: number; h: number };

/** What a save carries. */
export interface NewSwipe {
  kind: SwipeKind;
  /** Stitch part role; parts only. */
  role?: string | null;
  cardId?: string | null;
  sourceSite: string;
  sourceUrl: string;
  imageUrl: string;
  thumbUrl?: string | null;
  title?: string | null;
  crop?: SwipeCrop | null;
  note?: string | null;
  fromCanvasId?: string | null;
}

export interface SwipeItem {
  id: string;
  kind: SwipeKind;
  role: string | null;
  cardId: string | null;
  sourceSite: string;
  sourceUrl: string;
  imageUrl: string;
  thumbUrl: string;
  title: string | null;
  crop: SwipeCrop | null;
  note: string | null;
  fromCanvasId: string | null;
  createdAt: Date;
}

export interface SwipeQuery {
  role?: string;
  cardId?: string;
  /** Words matched against title, site and note (case blind). */
  query?: string;
  kind?: SwipeKind;
  limit?: number;
  offset?: number;
}

export interface SwipeRepo {
  /** Saves items, skipping ones already saved (same kind, source link and crop) and anything past the cap. */
  addMany(userId: string, items: readonly NewSwipe[]): Promise<{ added: number; skipped: number; full: boolean }>;
  /** Newest first. */
  search(userId: string, q?: SwipeQuery): Promise<SwipeItem[]>;
  count(userId: string): Promise<number>;
  /** False when the item is not this user's. */
  remove(userId: string, id: string): Promise<boolean>;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * One piece of work, whatever its address: Dribbble shot id, Pinterest pin id, Behance gallery id,
 * else the lower cased link. Same rule as itemKey in lib/sources/web-search.ts, kept here so the
 * swipe file (loaded by every canvas tool) does not pull the whole search code in.
 */
function referenceKey(sourceUrl: string): string {
  try {
    const u = new URL(sourceUrl);
    const host = u.hostname.toLowerCase();
    const shot = /^\/shots\/(\d+)/.exec(u.pathname);
    if (shot && hostMatchesDomain(host, "dribbble.com")) return `dribbble:${shot[1]}`;
    const pin = /^\/pin\/([A-Za-z0-9_-]+)/.exec(u.pathname);
    if (pin && hostMatchesDomain(host, "pinterest.com")) return `pinterest:${pin[1]}`;
    const gallery = /^\/gallery\/(\d+)/.exec(u.pathname);
    if (gallery && hostMatchesDomain(host, "behance.net")) return `behance:${gallery[1]}`;
    u.hash = "";
    return u.toString().toLowerCase().replace(/\/+$/, "");
  } catch {
    return sourceUrl.toLowerCase();
  }
}

/** Stable key for dedupe: kind, the source link's item key and the crop to three decimals. */
export function swipeItemKey(item: Pick<NewSwipe, "kind" | "sourceUrl" | "crop" | "role">): string {
  const crop = item.crop ? `${round(item.crop.x)},${round(item.crop.y)},${round(item.crop.w)},${round(item.crop.h)}` : "";
  return `${item.kind}|${referenceKey(item.sourceUrl)}|${item.kind === "part" ? (item.role ?? "") : ""}|${crop}`;
}

const clip = (s: string | null | undefined, max: number): string | null => {
  const t = (s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

/** Only absolute http(s) links are kept. */
function httpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Clean a save: drop it (null) when a link is not http(s) or a part has no known role. */
export function cleanNewSwipe(raw: NewSwipe): NewSwipe | null {
  if (raw.kind !== "part" && raw.kind !== "reference") return null;
  const sourceUrl = httpUrl(raw.sourceUrl);
  const imageUrl = httpUrl(raw.imageUrl);
  if (!sourceUrl || !imageUrl) return null;
  const role = raw.kind === "part" ? (raw.role ?? "").trim().toLowerCase() : "";
  if (raw.kind === "part" && !isPartRole(role)) return null;
  const crop = raw.kind === "part" && raw.crop ? raw.crop : null;
  return {
    kind: raw.kind,
    role: raw.kind === "part" ? role : null,
    cardId: clip(raw.cardId, 60),
    sourceSite: clip(raw.sourceSite, 60) ?? "web",
    sourceUrl,
    imageUrl,
    thumbUrl: httpUrl(raw.thumbUrl) ?? imageUrl,
    title: clip(raw.title, 160),
    crop,
    note: clip(raw.note, MAX_SWIPE_NOTE),
    fromCanvasId: raw.fromCanvasId ?? null,
  };
}

/** Escape `%`, `_` and `\` so a user's search words match literally in LIKE. */
export function likePattern(words: string): string {
  return `%${words.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function clampLimit(limit: number | undefined): number {
  return Math.min(MAX_SWIPE_LIMIT, Math.max(1, Math.floor(limit ?? DEFAULT_SWIPE_LIMIT)));
}

/** Plain lines for the agent: id, role, title, source link. */
export function swipeLines(items: readonly SwipeItem[]): string[] {
  return items.map((i) => {
    const where = i.kind === "part" ? `part ${i.role ?? "other"}` : "reference";
    const crop = i.crop ? ` crop ${i.crop.x},${i.crop.y},${i.crop.w},${i.crop.h}` : "";
    return `- ${i.id} (${where}${i.cardId ? `, card ${i.cardId}` : ""}): ${i.title ?? "Untitled"} (${i.sourceSite}) ${i.sourceUrl}${crop}${i.note ? ` note: ${i.note}` : ""}`;
  });
}
