/**
 * VAL-03: import taste from the user's own Pinterest boards. OFF by default behind the env flag
 * TASTE_IMPORT_PINTEREST ("on" to enable); the owner has no Pinterest developer app yet (see
 * DECISIONS.md for the steps).
 *
 * Rules: the official Pinterest API v5 with the user's OAuth consent, read only scopes
 * (boards:read, pins:read). We keep words (matched against a style vocabulary) and pin page links.
 * Image fields of the API are never read, fetched or stored; nothing is scraped. The access token
 * is used for one import and dropped: it is never stored or logged.
 */
import { matchStyleVocabulary, MAX_PROFILE_URLS } from "./index";

export const PINTEREST_AUTHORIZE_URL = "https://www.pinterest.com/oauth/";
export const PINTEREST_API = "https://api.pinterest.com/v5";
export const PINTEREST_SCOPES = ["boards:read", "pins:read"] as const;
/** Boards read, and pins read per board. */
const MAX_BOARDS = 10;
const PINS_PER_BOARD = 25;

/** process.env, or any object with the keys TASTE_IMPORT_PINTEREST, PINTEREST_APP_ID, PINTEREST_APP_SECRET. */
export type PinterestEnv = Readonly<Record<string, string | undefined>>;

/** True only when the flag is "on" and the app credentials are set. */
export function pinterestImportEnabled(env: PinterestEnv): boolean {
  return env.TASTE_IMPORT_PINTEREST?.trim().toLowerCase() === "on" && !!env.PINTEREST_APP_ID?.trim() && !!env.PINTEREST_APP_SECRET?.trim();
}

export function pinterestAuthorizeUrl(env: PinterestEnv, redirectUri: string, state: string): string {
  const url = new URL(PINTEREST_AUTHORIZE_URL);
  url.searchParams.set("client_id", env.PINTEREST_APP_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", PINTEREST_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Code for an access token. Returns null on any failure. */
export async function exchangePinterestCode(env: PinterestEnv, code: string, redirectUri: string, fetchImpl: Fetch = fetch): Promise<string | null> {
  const basic = btoa(`${env.PINTEREST_APP_ID ?? ""}:${env.PINTEREST_APP_SECRET ?? ""}`);
  try {
    const res = await fetchImpl(`${PINTEREST_API}/oauth/token`, {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }).toString(),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token?: unknown };
    return typeof body.access_token === "string" && body.access_token ? body.access_token : null;
  } catch {
    return null;
  }
}

type Page<T> = { items?: T[] };
type Board = { id?: string; name?: string; description?: string };
type Pin = { id?: string; title?: string; description?: string };

export type PinterestTaste = { words: string[]; sourceUrls: string[] };

async function getJson<T>(fetchImpl: Fetch, token: string, path: string): Promise<T | null> {
  try {
    const res = await fetchImpl(`${PINTEREST_API}${path}`, { headers: { authorization: `Bearer ${token}` } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Reads the user's boards and pins (text fields only) and returns style words and pin page links.
 * Returns null when the boards cannot be read.
 */
export async function readPinterestTaste(token: string, fetchImpl: Fetch = fetch): Promise<PinterestTaste | null> {
  const boards = await getJson<Page<Board>>(fetchImpl, token, `/boards?page_size=${MAX_BOARDS}`);
  if (!boards) return null;
  const texts: string[] = [];
  const sourceUrls: string[] = [];
  for (const board of (boards.items ?? []).slice(0, MAX_BOARDS)) {
    texts.push(board.name ?? "", board.description ?? "");
    if (!board.id || !/^[0-9]+$/.test(board.id)) continue;
    const pins = await getJson<Page<Pin>>(fetchImpl, token, `/boards/${board.id}/pins?page_size=${PINS_PER_BOARD}`);
    for (const pin of pins?.items ?? []) {
      texts.push(pin.title ?? "", pin.description ?? "");
      if (pin.id && /^[0-9]+$/.test(pin.id) && sourceUrls.length < MAX_PROFILE_URLS) {
        sourceUrls.push(`https://www.pinterest.com/pin/${pin.id}/`);
      }
    }
  }
  return { words: matchStyleVocabulary(texts), sourceUrls };
}
