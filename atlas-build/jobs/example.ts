/**
 * Example job: the infra test. Two IngredientCard records from two words, on Haiku, through the
 * batch path, with computed shipPairs and the Google Fonts check. Copy this file to start a real job.
 *
 *   npx tsx run.ts example --dry
 *   npx tsx run.ts example --limit 2
 *
 * Its output kind is "example", which the upload script skips.
 */
import { HAIKU } from "../config.ts";
import { checkCardFonts, defineJob, withShipPairs } from "../lib/job.ts";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";
import { IngredientCardSchema, type IngredientCard } from "../schema.ts";
import { TYPE_VOICES } from "../../banana-server/lib/direction-detail.ts";

type Input = { word: string; kind: IngredientCard["kind"] };

const SYSTEM = `You write ingredient cards for GoBanana, a tool that bends one app or web page into a wild but buildable design direction. A card turns one surprising word into a complete visual system a designer can use alone: palette, type, texture and motion that belong together.

${PROMPT_RULES}

Type voices you may use: ${TYPE_VOICES.join(", ")}.
Leave shipPairs as an empty array.

The record type:

${typeText("IngredientCard")}`;

export default defineJob<Input, IngredientCard>({
  id: "example",
  kind: "example",
  model: HAIKU,
  mode: "batch",
  schema: IngredientCardSchema,
  system: SYSTEM,
  maxTokens: 4000,
  expectedOutputTokens: 1500,
  effort: "low",

  loadInputs: () => [
    { word: "terrazzo", kind: "material" },
    { word: "brass compass", kind: "object" },
    { word: "sadu weaving", kind: "tradition" },
  ],
  requestId: (input) => `example-${input.word.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
  buildPrompt: (input) => `Write one IngredientCard for the ${input.kind} "${input.word}". Its id is "${input.word.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}".`,

  prepare: (raw) => withShipPairs(raw),
  check: (card, ctx) => [...checkCardFonts(card, ctx), ...(card.shipPairs.length === 0 ? ["no palette pair passes 4.5:1, so nothing can ship"] : [])],
  shardOf: (card) => card.kind,
});
