import { reviewRoute } from "@/lib/review/live";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  return reviewRoute().GET(req, (await params).token);
}

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  return reviewRoute().POST(req, (await params).token);
}
