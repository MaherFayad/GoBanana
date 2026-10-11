/**
 * GET /api/uploads/:id streams the image to its owner, or to a share link viewer when a
 * shared canvas of the same owner shows it. DELETE removes it (owner only).
 */
import { uploadsRoute } from "@/lib/uploads";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return uploadsRoute().GET(request, (await params).id);
}

export async function DELETE(request: Request, { params }: Ctx): Promise<Response> {
  return uploadsRoute().DELETE(request, (await params).id);
}
