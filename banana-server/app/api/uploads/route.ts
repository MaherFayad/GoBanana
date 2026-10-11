/**
 * POST /api/uploads: store one of the user's own images in R2 (Pro only, spec section 12).
 * Multipart (`file` field) or raw image bytes. Never takes a URL to fetch (hard rule 2).
 * Logic lives in lib/uploads.
 */
import { uploadsRoute } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return uploadsRoute().POST(request);
}
