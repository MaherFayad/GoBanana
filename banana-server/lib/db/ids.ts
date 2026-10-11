/**
 * Id helpers for the repositories. Pure, Web Crypto only (works on Workers and Node).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a canonical uuid string (any version). Postgres rejects anything else in a uuid column. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Fixed namespace for our name-based ids (RFC 9562 uuid v5). Never change it: stored ids depend on it. */
const NAMESPACE = "6f1c4a52-9b3e-4d8a-a6c1-2f7e0b5d9c31";

function uuidBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function formatUuid(bytes: Uint8Array): string {
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Deterministic uuid (v5) for a name. Used for `references.id` so the stable search
 * result id (`ref_...`) plus the canvas id always map to the same row.
 */
export async function uuidFromName(name: string): Promise<string> {
  const ns = uuidBytes(NAMESPACE);
  const data = new TextEncoder().encode(name);
  const buf = new Uint8Array(ns.length + data.length);
  buf.set(ns, 0);
  buf.set(data, ns.length);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", buf)).slice(0, 16);
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;
  return formatUuid(hash);
}

/** Row id of a search result saved for a canvas. */
export function referenceRowId(canvasId: string, referenceId: string): Promise<string> {
  return uuidFromName(`reference|${canvasId}|${referenceId}`);
}
