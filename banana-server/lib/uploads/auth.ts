/**
 * Caller for the uploads routes: an AuthKit bearer token (same verifier as the MCP
 * endpoint and the canvas API) or the signed-in web session (getWebUser()).
 */
import { authkitOptionsFromEnv, verifyAuthKitToken, type AuthExtra } from "@/lib/auth";
import { getWebUser } from "@/lib/web-session";
import type { UploadCaller } from "./http";

export async function authenticateUploadCaller(req: Request): Promise<UploadCaller | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match?.[1]) {
    if (!authkitOptionsFromEnv()) return null;
    const info = await verifyAuthKitToken(req, match[1].trim());
    const userId = (info?.extra as AuthExtra | undefined)?.userId;
    return userId ? { userId, via: "bearer" } : null;
  }
  const user = await getWebUser();
  return user?.userId ? { userId: user.userId, via: "cookie" } : null;
}
