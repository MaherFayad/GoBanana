/**
 * Caller for the uploads routes. Same rules as the canvas API (lib/request-auth.ts): an
 * AuthKit bearer token when an Authorization header is sent, else the web session
 * (getWebUser()). `via` tells the handler whether the same-origin check applies.
 */
import { authenticateRequest } from "@/lib/request-auth";
import type { UploadCaller } from "./http";

export async function authenticateUploadCaller(req: Request): Promise<UploadCaller | null> {
  const userId = await authenticateRequest(req);
  if (!userId) return null;
  return { userId, via: req.headers.has("authorization") ? "bearer" : "cookie" };
}
