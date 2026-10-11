/**
 * Worker entry (wrangler.jsonc `main`). Reuses the OpenNext fetch handler and adds the
 * daily cron (`triggers.crons`): the 30-day purge of unplaced references.
 * Pattern from https://opennext.js.org/cloudflare/howtos/custom-worker.
 * Run `npx opennextjs-cloudflare build` first: `.open-next/worker.js` is generated.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { createDbPurgeStore, purgeUnplacedReferences } from "./lib/purge/references";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

type Env = CloudflareEnv & { DATABASE_URL?: string };

async function runPurge(env: Env): Promise<void> {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    console.warn("[purge] DATABASE_URL is not set; skipped");
    return;
  }
  const result = await purgeUnplacedReferences(createDbPurgeStore(drizzle({ client: neon(url) })));
  console.info(`[purge] references deleted: ${result.deleted} in ${result.batches} batches${result.done ? "" : " (more left)"}`);
}

export default {
  fetch: (handler as ExportedHandler<Env>).fetch,

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      runPurge(env).catch((err: unknown) => {
        console.error(`[purge] failed: ${err instanceof Error ? err.name : "Error"}`);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
