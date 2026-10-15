/**
 * Worker entry (wrangler.jsonc `main`). Reuses the OpenNext fetch handler and adds the crons
 * (`triggers.crons`, lib/cron/scheduled.ts): the daily purges (30-day unplaced references,
 * 12-month search ratings, personal data under PDPL) and the nightly weights (search_feedback
 * to atlas_weights).
 * Pattern from https://opennext.js.org/cloudflare/howtos/custom-worker.
 * Run `npx opennextjs-cloudflare build` first: `.open-next/worker.js` is generated.
 */
import { handleScheduled } from "./lib/cron/scheduled";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

type Env = CloudflareEnv & { DATABASE_URL?: string };

export default {
  fetch: (handler as ExportedHandler<Env>).fetch,

  async scheduled(controller, env, ctx) {
    handleScheduled(controller, env, ctx);
  },
} satisfies ExportedHandler<Env>;
