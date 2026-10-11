/**
 * Upload rules (spec section 12: Pro only, 1 GB per user). Pure and client safe:
 * the canvas UploadButton imports the same limits and messages as the server.
 *
 * These are the user's own images. We never accept a URL to fetch (hard rule 2:
 * no re-hosting of third-party images), only the file bytes the user sends.
 */

export const ALLOWED_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type UploadMime = (typeof ALLOWED_UPLOAD_TYPES)[number];

/** Per file cap. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Form field name for multipart uploads. */
export const UPLOAD_FIELD = "file";

/** `accept` attribute for the file input. */
export const UPLOAD_ACCEPT = ALLOWED_UPLOAD_TYPES.join(",");

export function isAllowedUploadType(value: unknown): value is UploadMime {
  return typeof value === "string" && (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(value.toLowerCase());
}

/** R2 object key for an upload. Every key for a user shares the `u/<userId>/` prefix (account deletion relies on it). */
export function uploadKey(userId: string, uploadId: string): string {
  return `${uploadKeyPrefix(userId)}${uploadId}`;
}

export function uploadKeyPrefix(userId: string): string {
  return `u/${userId}/`;
}

/** Same-origin path the canvas stores in an upload node (`imageUrl` and `sourceUrl`). */
export function uploadPath(uploadId: string): string {
  return `/api/uploads/${uploadId}`;
}

function startsWith(bytes: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (bytes[offset + i] !== sig[i]) return false;
  return true;
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/**
 * The real image type from the first bytes. The declared Content-Type is never
 * trusted on its own, so an SVG or HTML file renamed to .png is refused.
 */
export function sniffImageType(bytes: Uint8Array): UploadMime | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "image/gif";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  return null;
}

export type UploadErrorCode =
  | "not_signed_in"
  | "plan_required"
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "storage_full"
  | "storage_unavailable"
  | "bad_request"
  | "forbidden_origin"
  | "not_found";

/** Plain messages for each error, shown as is in the canvas. */
export const UPLOAD_MESSAGES: Readonly<Record<UploadErrorCode, string>> = {
  not_signed_in: "Sign in to upload images.",
  plan_required: "Uploads are part of Pro. Upgrade to add your own images.",
  empty: "This file is empty. Choose another image.",
  too_large: `This image is too big. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB per image.`,
  unsupported_type: "This file type is not supported. Use a PNG, JPEG, WebP or GIF image.",
  storage_full: "Your upload space is full (1 GB). Remove some uploads, then try again.",
  storage_unavailable: "Uploads are not working right now. Try again in a minute.",
  bad_request: "Could not read the upload. Try again.",
  forbidden_origin: "This request was blocked. Reload the page and try again.",
  not_found: "Image not found.",
};

export const UPLOAD_STATUS: Readonly<Record<UploadErrorCode, number>> = {
  not_signed_in: 401,
  plan_required: 403,
  empty: 400,
  too_large: 413,
  unsupported_type: 415,
  storage_full: 413,
  storage_unavailable: 503,
  bad_request: 400,
  forbidden_origin: 403,
  not_found: 404,
};

/** Checks a file before sending it (client) or before storing it (server, after sniffing). */
export function checkUploadFile(file: { size: number; type: string }): UploadErrorCode | null {
  if (file.size <= 0) return "empty";
  if (file.size > MAX_UPLOAD_BYTES) return "too_large";
  if (!isAllowedUploadType(file.type)) return "unsupported_type";
  return null;
}
