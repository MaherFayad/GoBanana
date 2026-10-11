/**
 * POST /api/takedown: takedown request from the site form.
 * - JSON (the enhanced client form): 200 { ok: true } or 422 { ok: false, errors }.
 * - Plain HTML form post (no JavaScript): 303 back to /{locale}/takedown?status=sent|invalid.
 * Never logs the request content (it holds names and emails).
 */
import { isLocale } from "@/lib/site/i18n";
import { formDataToObject, parseTakedownForm } from "@/lib/site/takedown-form";
import { getTakedownRepo } from "@/lib/site/takedown-repo";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "too_large" });
  }
  const isJson = (request.headers.get("content-type") ?? "").includes("application/json");

  let input: Record<string, unknown>;
  try {
    input = isJson ? ((await request.json()) as Record<string, unknown>) : formDataToObject(await request.formData());
  } catch {
    return json(400, { ok: false, error: "bad_body" });
  }

  const locale = isLocale(input.locale) ? input.locale : "en";
  const back = (status: string) =>
    new Response(null, { status: 303, headers: { location: `/${locale}/takedown?status=${status}` } });

  const parsed = parseTakedownForm(input);
  if (!parsed.ok) return isJson ? json(422, { ok: false, errors: parsed.errors }) : back("invalid");

  try {
    await getTakedownRepo().save(parsed.data);
  } catch (err) {
    console.warn(`[takedown] could not save request: ${err instanceof Error ? err.name : "Error"}`);
    return isJson ? json(500, { ok: false, error: "save_failed" }) : back("failed");
  }
  return isJson ? json(200, { ok: true }) : back("sent");
}
