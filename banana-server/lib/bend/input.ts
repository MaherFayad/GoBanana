import { z } from "zod";
import { PLATFORMS } from "@/lib/direction-detail";
import { LENS_IDS } from "./lists";
import { MOVES, type BendInput, type Wildness } from "./types";

export const MAX_BRIEF = 500;
export const DEFAULT_COUNT = 6;
export const MAX_COUNT = 8;
export const MAX_PAGES = 3;
export const MAX_PAGE_LENGTH = 60;
export const MAX_MUST_KEEPS = 6;
export const MIN_CANDIDATES = 5;
export const MAX_CANDIDATES = 10;
export const MAX_CANDIDATE_NAME = 60;
export const MAX_CANDIDATE_LINE = 160;
export const MAX_CANDIDATE_FAMILY = 40;

/** One grounded idea the agent writes from the audience's world. The server rolls which ones lead. */
export const candidateSchema = z.object({
  name: z.string().trim().min(1).max(MAX_CANDIDATE_NAME).describe('The thing itself, like "Riyadh metro map" or "falconry hood".'),
  why: z.string().trim().min(1).max(MAX_CANDIDATE_LINE).describe("Why this audience knows it by heart."),
  looks: z.string().trim().min(1).max(MAX_CANDIDATE_LINE).describe("How it looks: type, color, material, layout."),
  family: z.string().trim().min(1).max(MAX_CANDIDATE_FAMILY).describe('Its material family, like "textile", "signage" or "print".'),
});

/** Strict input schema. Also advertised to agents as the tool's JSON schema. */
export const bendInputSchema = z.object({
  brief: z
    .string()
    .trim()
    .min(1)
    .max(MAX_BRIEF)
    .describe('What is being designed, in a few words. Example: "flight checkout screen".'),
  wildness: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("1 Fresh, 2 Bold, 3 Weird, 4 Wild, 5 Bananas. Higher combines more moves."),
  moves: z
    .array(z.enum(MOVES))
    .min(1)
    .optional()
    .describe("Limit which moves are used. Leave out to use all six."),
  lens: z
    .enum(LENS_IDS as [string, ...string[]])
    .optional()
    .describe("Culture lens preset. Every direction then pulls from that visual tradition."),
  count: z
    .number()
    .int()
    .min(1)
    .max(MAX_COUNT)
    .default(DEFAULT_COUNT)
    .describe("How many directions to return, 1 to 8. Default 6."),
  platform: z
    .enum(PLATFORMS)
    .optional()
    .describe("mobile, tablet, website, webapp or any. Leave out to detect it from the brief."),
  pages: z
    .array(z.string().trim().min(1).max(MAX_PAGE_LENGTH))
    .min(1)
    .max(MAX_PAGES)
    .optional()
    .describe('Up to 3 pages the wild idea is for, like "pricing page" or "onboarding". Leave out to get suggestions.'),
  mustKeep: z
    .array(z.string().trim().min(1).max(MAX_PAGE_LENGTH))
    .min(1)
    .max(MAX_MUST_KEEPS)
    .optional()
    .describe('Patterns users rely on that no direction may break, like "clear total" or "one primary action". Checkout briefs keep both by default.'),
  candidates: z
    .array(candidateSchema)
    .min(MIN_CANDIDATES)
    .max(MAX_CANDIDATES)
    .optional()
    .describe(
      "5 to 10 grounded ideas from the audience's world (objects, places, rituals, graphic traditions), at least 3 families, never the audience's own tools. The server rolls which lead (at most 2 per family) and adds 1 or 2 challengers.",
    ),
});

const MESSAGES: Record<string, string> = {
  brief: `brief must be 1 to ${MAX_BRIEF} characters, for example "flight checkout screen".`,
  wildness: "wildness must be a whole number from 1 (Fresh) to 5 (Bananas).",
  moves: `moves can only include: ${MOVES.join(", ")}.`,
  lens: `lens must be one of: ${LENS_IDS.join(", ")}.`,
  count: `count must be a whole number from 1 to ${MAX_COUNT}.`,
  platform: `platform must be one of: ${PLATFORMS.join(", ")}.`,
  pages: `pages must be 1 to ${MAX_PAGES} page names, each up to ${MAX_PAGE_LENGTH} characters.`,
  mustKeep: `mustKeep must be 1 to ${MAX_MUST_KEEPS} short patterns, each up to ${MAX_PAGE_LENGTH} characters, like "clear total".`,
  candidates: `candidates must be ${MIN_CANDIDATES} to ${MAX_CANDIDATES} ideas, each with a name (up to ${MAX_CANDIDATE_NAME} characters), why and looks (up to ${MAX_CANDIDATE_LINE} each) and a family (up to ${MAX_CANDIDATE_FAMILY}).`,
};

/** Plain message for one bad candidate field, so the agent knows exactly what to fix. */
function candidateMessage(path: readonly PropertyKey[]): string | undefined {
  const [, index, field] = path;
  if (typeof index !== "number" || typeof field !== "string") return undefined;
  const limits: Record<string, number> = { name: MAX_CANDIDATE_NAME, why: MAX_CANDIDATE_LINE, looks: MAX_CANDIDATE_LINE, family: MAX_CANDIDATE_FAMILY };
  const max = limits[field];
  if (!max) return undefined;
  return `candidates item ${index + 1}: ${field} must be 1 to ${max} characters.`;
}

export type ParseResult =
  | { ok: true; input: Required<Pick<BendInput, "brief" | "wildness" | "count">> & BendInput }
  | { ok: false; message: string };

/** Validate raw tool input. Never throws; returns a plain message the agent can act on. */
export function parseBendInput(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, message: "Send a brief and a wildness from 1 to 5." };
  }
  const result = bendInputSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = String(issue?.path[0] ?? "");
    const specific = field === "candidates" && issue ? candidateMessage(issue.path) : undefined;
    return { ok: false, message: specific ?? MESSAGES[field] ?? "Send a brief and a wildness from 1 to 5." };
  }
  const { brief, wildness, moves, lens, count, platform, pages, mustKeep, candidates } = result.data;
  return {
    ok: true,
    input: {
      brief,
      wildness: wildness as Wildness,
      count,
      ...(moves ? { moves: [...new Set(moves)] } : {}),
      ...(lens ? { lens } : {}),
      ...(platform ? { platform } : {}),
      ...(pages ? { pages } : {}),
      ...(mustKeep ? { mustKeep } : {}),
      ...(candidates ? { candidates } : {}),
    },
  };
}

export class BendInputError extends Error {
  override name = "BendInputError";
}
