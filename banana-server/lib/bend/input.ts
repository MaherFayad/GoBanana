import { z } from "zod";
import { LENS_IDS } from "./lists";
import { MOVES, type BendInput, type Wildness } from "./types";

export const MAX_BRIEF = 500;
export const DEFAULT_COUNT = 6;
export const MAX_COUNT = 8;

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
});

const MESSAGES: Record<string, string> = {
  brief: `brief must be 1 to ${MAX_BRIEF} characters, for example "flight checkout screen".`,
  wildness: "wildness must be a whole number from 1 (Fresh) to 5 (Bananas).",
  moves: `moves can only include: ${MOVES.join(", ")}.`,
  lens: `lens must be one of: ${LENS_IDS.join(", ")}.`,
  count: `count must be a whole number from 1 to ${MAX_COUNT}.`,
};

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
    const field = String(result.error.issues[0]?.path[0] ?? "");
    return { ok: false, message: MESSAGES[field] ?? "Send a brief and a wildness from 1 to 5." };
  }
  const { brief, wildness, moves, lens, count } = result.data;
  return {
    ok: true,
    input: {
      brief,
      wildness: wildness as Wildness,
      count,
      ...(moves ? { moves: [...new Set(moves)] } : {}),
      ...(lens ? { lens } : {}),
    },
  };
}

export class BendInputError extends Error {
  override name = "BendInputError";
}
