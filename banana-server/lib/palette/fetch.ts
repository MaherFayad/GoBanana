/**
 * Fetch a thumbnail into memory for palette extraction (hard rule 2 exception).
 *
 * The bytes live only in the returned Uint8Array. This module never writes to disk,
 * R2, the Cache API or logs, and it never logs anything (not even errors), so callers
 * cannot leak bytes or URLs through it. Callers must drop the bytes after use.
 */

export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
export const DEFAULT_TIMEOUT_MS = 8_000;
export const MAX_REDIRECTS = 3;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface FetchThumbOptions {
  /** Hosts allowed to serve thumbnails. "example.com" also allows its subdomains. */
  allowedHosts: readonly string[];
  /** Injected fetch (tests, Workers). Defaults to the global fetch. */
  fetchImpl?: FetchLike;
  maxBytes?: number;
  timeoutMs?: number;
}

export type FetchThumbFailure =
  | "invalid_url"
  | "host_not_allowed"
  | "http_error"
  | "not_an_image"
  | "too_large"
  | "timeout"
  | "network_error"
  | "too_many_redirects";

export type FetchThumbResult =
  | { ok: true; bytes: Uint8Array; contentType: string | null }
  | { ok: false; reason: FetchThumbFailure; status?: number };

/** True when the URL is https on a host in the allowlist (exact match or a subdomain). */
export function isAllowedUrl(url: string, allowedHosts: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  return allowedHosts.some((entry) => {
    const allowed = entry.toLowerCase().replace(/^\*\./, "").replace(/\.$/, "");
    return allowed.length > 0 && (host === allowed || host.endsWith(`.${allowed}`));
  });
}

async function readCapped(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function fetchThumbIntoMemory(
  url: string,
  opts: FetchThumbOptions,
): Promise<FetchThumbResult> {
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    new URL(url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      // Check every hop so a redirect cannot leave the allowlist.
      if (!isAllowedUrl(current, opts.allowedHosts)) return { ok: false, reason: "host_not_allowed" };
      const res = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "image/jpeg,image/png,image/*;q=0.8" },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel().catch(() => undefined);
        if (!location) return { ok: false, reason: "http_error", status: res.status };
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => undefined);
        return { ok: false, reason: "http_error", status: res.status };
      }
      const contentType = res.headers.get("content-type");
      if (contentType && !contentType.toLowerCase().startsWith("image/")) {
        await res.body?.cancel().catch(() => undefined);
        return { ok: false, reason: "not_an_image" };
      }
      const declared = Number(res.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > maxBytes) {
        await res.body?.cancel().catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      if (!res.body) return { ok: true, bytes: new Uint8Array(0), contentType };
      const bytes = await readCapped(res.body, maxBytes);
      if (!bytes) return { ok: false, reason: "too_large" };
      return { ok: true, bytes, contentType };
    }
    return { ok: false, reason: "too_many_redirects" };
  } catch {
    return { ok: false, reason: controller.signal.aborted ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
