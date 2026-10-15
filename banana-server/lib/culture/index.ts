/**
 * Culture data on a canvas item (CULT-02): where a motif or tradition comes from, what it means,
 * how to credit it and how much care it needs. Plain text only, stored on the item in the canvas
 * state (no migration), returned by get_canvas and written into CULTURE.md and the Cultural brief.
 * Pure: shared by the tool, the state parser, the canvas chip and the exports.
 */
import { z } from "zod";

export const CULTURE_TIERS = ["open", "care", "sacred"] as const;
export type CultureTier = (typeof CULTURE_TIERS)[number];

export const CULTURE_LIMITS = { tradition: 80, region: 80, community: 80, meaning: 600, credit: 300, sourceUrl: 2048 } as const;

export interface Culture {
  tradition: string;
  region: string;
  community?: string;
  tier: CultureTier;
  meaning: string;
  credit: string;
  sourceUrl?: string;
}

const EM_DASH = new RegExp("\\s*" + String.fromCharCode(0x2014) + "\\s*", "g");
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;
const MARKUP = /[<>]/;

/** Plain text: trimmed, no markup characters, no control characters, no em dashes, within max. */
function plain(max: number, multiline = false) {
  return z
    .string()
    .transform((s) => s.replace(EM_DASH, ", ").trim())
    .pipe(
      z
        .string()
        .min(1)
        .max(max)
        .refine((s) => !CONTROL.test(s) && (multiline || !/[\n\r]/.test(s)), "no control characters or line breaks")
        .refine((s) => !MARKUP.test(s), "plain text only, no < or >"),
    );
}

const sourceUrl = z
  .string()
  .trim()
  .min(1)
  .max(CULTURE_LIMITS.sourceUrl)
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "must be an http or https link");

export const cultureSchema = z.object({
  tradition: plain(CULTURE_LIMITS.tradition),
  region: plain(CULTURE_LIMITS.region),
  community: plain(CULTURE_LIMITS.community).optional(),
  tier: z.enum(CULTURE_TIERS),
  meaning: plain(CULTURE_LIMITS.meaning, true),
  credit: plain(CULTURE_LIMITS.credit),
  sourceUrl: sourceUrl.optional(),
});

/** Message for a bad `culture` object, for the tool's error text. */
export const CULTURE_MESSAGE =
  `culture must be { tradition, region, community?, tier: "open" | "care" | "sacred", meaning, credit, sourceUrl? } in plain text ` +
  `(tradition, region and community up to ${CULTURE_LIMITS.region} characters, meaning up to ${CULTURE_LIMITS.meaning}, credit up to ${CULTURE_LIMITS.credit}, sourceUrl an http or https link).`;

/** Clean a stored value: the valid culture object, or undefined. Never throws. */
export function cleanCulture(raw: unknown): Culture | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const parsed = cultureSchema.safeParse(raw);
  return parsed.success ? (parsed.data as Culture) : undefined;
}

export const TIER_LABEL: Record<CultureTier, { en: string; ar: string }> = {
  open: { en: "Open", ar: "مفتوح" },
  care: { en: "Care", ar: "يحتاج عناية" },
  sacred: { en: "Sacred", ar: "مقدس" },
};
