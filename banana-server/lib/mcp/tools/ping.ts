import { z } from "zod";
import { authExtra } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { recordFunnel } from "@/lib/funnel";
import { toolMessage, type RegisterTool } from "./types";

export const register: RegisterTool = (server) => {
  server.registerTool(
    "ping",
    {
      title: "Check connection",
      description: `Check that ${APP_NAME} is connected and see which account you are signed in with.`,
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.literal(true), app: z.string(), email: z.string() }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (_args, ctx) => {
      const auth = authExtra(ctx);
      if (!auth) return toolMessage("You are not signed in. Reconnect to sign in again.");
      if (!auth.email) {
        return toolMessage(`You are signed in, but ${APP_NAME} could not load your email yet. Try again in a minute.`);
      }
      // First connection per user (DIST-08 install funnel): the only write this tool makes, and it never fails the call.
      await recordFunnel(auth.userId, "ping");
      const structuredContent = { ok: true as const, app: APP_NAME, email: auth.email };
      return {
        content: [{ type: "text", text: `Connected to ${APP_NAME} as ${auth.email}.` }],
        structuredContent,
      };
    },
  );
};
