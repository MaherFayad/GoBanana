import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { bendBrief, bendInputSchema, formatDirections, parseBendInput } from "@/lib/bend";
import { toolMessage, type RegisterTool } from "./types";

export const BEND_BRIEF_DESCRIPTION =
  "Turn a plain design brief into wild, unexpected design directions. " +
  "Use it when the user wants fresh, bold or surprising ideas instead of the usual layout. " +
  "Each direction has a title, a search query and a prompt to riff on. " +
  "Wildness runs from 1 (Fresh) to 5 (Bananas). " +
  "Then call search_references with a direction's search query to pull image references.";

/**
 * Advertise the strict JSON schema to clients, but let every call through to the
 * handler so invalid input gets a plain message instead of the SDK's raw validation dump.
 */
const advertisedInput: StandardSchemaWithJSON<unknown, unknown> = {
  "~standard": {
    ...bendInputSchema["~standard"],
    validate: (value: unknown) => ({ value }),
  },
};

export const register: RegisterTool = (server) => {
  server.registerTool(
    "bend_brief",
    {
      title: "Bend a design brief",
      description: BEND_BRIEF_DESCRIPTION,
      inputSchema: advertisedInput,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const parsed = parseBendInput(args);
      if (!parsed.ok) return toolMessage(parsed.message);
      try {
        const result = bendBrief(parsed.input);
        return {
          content: [{ type: "text" as const, text: formatDirections(result) }],
          structuredContent: { ...result },
        };
      } catch {
        return toolMessage("Could not bend that brief. Try a shorter brief in plain words.");
      }
    },
  );
};
