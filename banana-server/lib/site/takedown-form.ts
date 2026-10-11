/**
 * Takedown request form (spec section 3, hard rule 5). Shared by the client form
 * and POST /api/takedown so both validate the same way. Error messages are codes;
 * the page maps them to English or Arabic text.
 */
import { z } from "zod";
import { LOCALES } from "./i18n";

export const TAKEDOWN_REASONS = ["copyright", "trademark", "privacy", "other"] as const;
export const TAKEDOWN_ROLES = ["owner", "agent"] as const;

export type TakedownErrorCode =
  | "required"
  | "too_long"
  | "too_short"
  | "invalid_email"
  | "invalid_target"
  | "must_confirm";

/** Accepts `https://site.com/page`, `site.com/page` or a bare domain like `site.com`. */
export function isUrlOrDomain(value: string): boolean {
  const raw = value.trim();
  if (!raw || /\s/.test(raw)) return false;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname;
  return host.includes(".") && !host.startsWith(".") && !host.endsWith(".") && /[a-z]/i.test(host.split(".").pop() ?? "");
}

const checkbox = z.preprocess(
  (v) => v === true || v === "on" || v === "true" || v === "1",
  z.literal(true, { error: "must_confirm" }),
);

const text = (max: number, min = 1) =>
  z
    .string({ error: "required" })
    .trim()
    .min(1, { error: "required" })
    .min(min, { error: "too_short" })
    .max(max, { error: "too_long" });

export const takedownSchema = z.object({
  name: text(200),
  email: text(320).pipe(z.email({ error: "invalid_email" })),
  target: text(2048).refine(isUrlOrDomain, { error: "invalid_target" }),
  reason: z.enum(TAKEDOWN_REASONS, { error: "required" }),
  role: z.enum(TAKEDOWN_ROLES, { error: "required" }),
  details: text(5000, 10),
  confirm: checkbox,
  locale: z.enum(LOCALES).catch("en"),
});

export type TakedownRequest = z.infer<typeof takedownSchema>;
export type TakedownField = Exclude<keyof TakedownRequest, "locale">;
export const TAKEDOWN_FIELDS: readonly TakedownField[] = ["name", "email", "target", "reason", "role", "details", "confirm"];

export type TakedownParse =
  | { ok: true; data: TakedownRequest }
  | { ok: false; errors: Partial<Record<TakedownField, TakedownErrorCode>> };

const KNOWN_CODES = new Set<TakedownErrorCode>(["required", "too_long", "too_short", "invalid_email", "invalid_target", "must_confirm"]);

/** Validates JSON or form values. Returns one error code per field (the first one). */
export function parseTakedownForm(input: unknown): TakedownParse {
  const result = takedownSchema.safeParse(input ?? {});
  if (result.success) return { ok: true, data: result.data };
  const errors: Partial<Record<TakedownField, TakedownErrorCode>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || !(TAKEDOWN_FIELDS as readonly string[]).includes(field)) continue;
    const key = field as TakedownField;
    if (errors[key]) continue;
    errors[key] = KNOWN_CODES.has(issue.message as TakedownErrorCode) ? (issue.message as TakedownErrorCode) : "required";
  }
  return { ok: false, errors };
}

/** FormData to a plain object (last value wins). */
export function formDataToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") out[key] = value;
  });
  return out;
}
