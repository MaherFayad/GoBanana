/** Small URL helpers shared by the source adapters and the takedown matcher. */

/** Parse an absolute http(s) URL. Returns null for anything else (data:, javascript:, relative, junk). */
export function parseHttpUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

/** Lowercase host without a trailing dot. URL already lowercases and punycodes hosts. */
export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, "");
}

/** Host without a leading `www.`. */
export function stripWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

/** True when `host` equals `domain` or is a subdomain of it. Never a loose substring match. */
export function hostMatchesDomain(host: string, domain: string): boolean {
  const h = normalizeHost(host);
  const d = normalizeHost(domain);
  if (!h || !d) return false;
  return h === d || h.endsWith(`.${d}`);
}
