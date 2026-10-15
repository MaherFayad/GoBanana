#!/usr/bin/env node
/**
 * Checks the Worker's startup time after `opennextjs-cloudflare build`.
 *
 * Cloudflare: "A Worker must parse and execute its global scope (top-level code outside of
 * handlers) within 1 second." `wrangler deploy --dry-run` does not report startup time, so this
 * runs `wrangler check startup`, which profiles the bundle locally (no login, nothing uploaded)
 * and prints the active CPU time. A local CPU is not Cloudflare's, so the budget stays well under
 * the 1 second limit (docs/worker-size.md).
 *
 * Usage: npm run worker:startup [-- --max-ms 400]   (exits 1 when active startup CPU is over --max-ms)
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const LIMIT_MS = 1000;
const PROFILE = ".wrangler/startup.cpuprofile";

const maxArg = process.argv.indexOf("--max-ms");
const maxMs = maxArg > -1 ? Number(process.argv[maxArg + 1]) : undefined;

if (!existsSync(".open-next/worker.js")) {
  console.error("No .open-next/worker.js. Run `npx opennextjs-cloudflare build` first.");
  process.exit(2);
}

const log = execSync(`npx wrangler check startup --outfile ${PROFILE}`, { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });
rmSync(PROFILE, { force: true });
const active = /Active:\s*([\d.]+)\s*ms/.exec(log);
if (!active) {
  console.error("Could not read the startup time from `wrangler check startup`:");
  console.error(log);
  process.exit(2);
}
const ms = Number(active[1]);
console.log(`Worker startup: ${ms} ms active CPU, measured locally (Cloudflare limit ${LIMIT_MS} ms).`);
if (maxMs !== undefined && ms > maxMs) {
  console.error(`Worker startup is over the ${maxMs} ms budget.`);
  process.exit(1);
}
