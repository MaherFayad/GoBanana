/**
 * HTTP handlers for /api/uploads (POST) and /api/uploads/:id (GET, DELETE), kept
 * outside `app/` so tests can call them with fakes. The route files only wire deps.
 *
 * POST takes either multipart form data with a `file` field or the raw image bytes
 * with an image Content-Type. It never takes a URL: we do not fetch images for anyone
 * (hard rule 2). Bodies are read with a hard byte cap before parsing.
 */
import { applyNoindex } from "@/lib/share";
import { MAX_UPLOAD_BYTES, UPLOAD_FIELD, UPLOAD_MESSAGES, UPLOAD_STATUS, type UploadErrorCode } from "./rules";
import { createUpload, deleteUpload, readUpload, type UploadDeps } from "./service";

/** Who is calling. `via: "cookie"` requests must also pass the same-origin check. */
export type UploadCaller = { userId: string; via: "bearer" | "cookie" };

export type UploadsRouteDeps = UploadDeps & {
  /** Resolves the caller from a bearer token or the web session; null when signed out. */
  authenticate: (req: Request) => Promise<UploadCaller | null>;
  log?: (message: string) => void;
};

/** Room for multipart boundaries and headers around one file. */
const MULTIPART_OVERHEAD = 64 * 1024;

function headers(extra: Record<string, string> = {}): Headers {
  return applyNoindex(new Headers({ "cache-control": "no-store", ...extra }));
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: headers({ "content-type": "application/json" }) });
}

function error(code: UploadErrorCode): Response {
  return json(UPLOAD_STATUS[code], { error: code, message: UPLOAD_MESSAGES[code] });
}

/** Cookie-authenticated writes must come from our own pages (CSRF). Bearer calls carry no ambient credentials. */
export function isSameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

/** Reads at most `limit` bytes. Returns null when the body is larger. */
export async function readBounded(req: Request, limit: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

type ParsedBody = { ok: true; bytes: Uint8Array<ArrayBuffer>; declaredType: string | null } | { ok: false; error: UploadErrorCode };

async function parseBody(req: Request): Promise<ParsedBody> {
  const type = (req.headers.get("content-type") ?? "").toLowerCase();
  const multipart = type.startsWith("multipart/form-data");
  const raw = await readBounded(req, MAX_UPLOAD_BYTES + (multipart ? MULTIPART_OVERHEAD : 0));
  if (!raw) return { ok: false, error: "too_large" };
  if (!multipart) return { ok: true, bytes: raw, declaredType: type || null };

  let form: FormData;
  try {
    form = await new Response(raw, { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData();
  } catch {
    return { ok: false, error: "bad_request" };
  }
  const file = form.get(UPLOAD_FIELD);
  if (!file || typeof file === "string") return { ok: false, error: "bad_request" };
  return { ok: true, bytes: new Uint8Array(await file.arrayBuffer()), declaredType: file.type || null };
}

/** Share token from `?share=` or, for <img> requests from a share page, the same-origin Referer `/s/<token>`. */
export function shareTokenFrom(req: Request): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("share");
  if (fromQuery) return fromQuery;
  const referer = req.headers.get("referer");
  if (!referer) return null;
  try {
    const ref = new URL(referer);
    if (ref.origin !== url.origin) return null;
    const match = /^\/s\/([^/?#]+)/.exec(ref.pathname);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function buildUploadsRoute(deps: UploadsRouteDeps) {
  const log = deps.log ?? ((m: string) => console.warn(m));

  async function caller(req: Request, write: boolean): Promise<UploadCaller | UploadErrorCode> {
    const who = await deps.authenticate(req);
    if (!who) return "not_signed_in";
    if (write && who.via === "cookie" && !isSameOrigin(req)) return "forbidden_origin";
    return who;
  }

  return {
    async POST(req: Request): Promise<Response> {
      try {
        const who = await caller(req, true);
        if (typeof who === "string") return error(who);
        const body = await parseBody(req);
        if (!body.ok) return error(body.error);
        const result = await createUpload(deps, who.userId, body);
        if (!result.ok) return error(result.error);
        return json(201, result.value);
      } catch (err) {
        log(`[uploads] upload failed: ${err instanceof Error ? err.name : "Error"}`);
        return error("storage_unavailable");
      }
    },

    async GET(req: Request, id: string): Promise<Response> {
      try {
        const who = await deps.authenticate(req).catch(() => null);
        const result = await readUpload(deps, id, { userId: who?.userId, shareToken: shareTokenFrom(req) });
        if (!result.ok) return error(result.error);
        const file = result.value;
        const h = headers({
          "content-type": file.mime,
          "content-length": String(file.size),
          "content-disposition": "inline",
          "cache-control": file.owner ? "private, max-age=3600" : "private, max-age=300",
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; sandbox",
          "cross-origin-resource-policy": "same-origin",
        });
        if (file.etag) h.set("etag", file.etag);
        return new Response(file.body, { status: 200, headers: h });
      } catch (err) {
        log(`[uploads] read failed: ${err instanceof Error ? err.name : "Error"}`);
        return error("storage_unavailable");
      }
    },

    async DELETE(req: Request, id: string): Promise<Response> {
      try {
        const who = await caller(req, true);
        if (typeof who === "string") return error(who);
        const result = await deleteUpload(deps, who.userId, id);
        if (!result.ok) return error(result.error);
        return json(200, { ok: true, id: result.value.id });
      } catch (err) {
        log(`[uploads] delete failed: ${err instanceof Error ? err.name : "Error"}`);
        return error("storage_unavailable");
      }
    },
  };
}
