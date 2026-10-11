#!/usr/bin/env node
/**
 * Prints the gzipped size of the Worker upload after `opennextjs-cloudflare build`.
 *
 * Bundles with `wrangler deploy --dry-run --outdir` (no login, nothing is uploaded), then
 * gzips each bundled file. Cloudflare limits (compressed): Workers Free 3 MB, Workers
 * Paid 10 MB. We must be on Workers Paid before this passes 3 MB (DECISIONS.md).
 *
 * Usage: npm run worker:size [-- --max-mb 3]   (exits 1 when over --max-mb)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const FREE_MB = 3;
const PAID_MB = 10;
const OUT = ".wrangler/size-check";

const maxArg = process.argv.indexOf("--max-mb");
const maxMb = maxArg > -1 ? Number(process.argv[maxArg + 1]) : undefined;

if (!existsSync(".open-next/worker.js")) {
  console.error("No .open-next/worker.js. Run `npx opennextjs-cloudflare build` first.");
  process.exit(2);
}

rmSync(OUT, { recursive: true, force: true });
execFileSync("npx", ["wrangler", "deploy", "--dry-run", "--outdir", OUT], { stdio: ["ignore", "ignore", "inherit"] });

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

let raw = 0;
let gz = 0;
for (const f of files(OUT)) {
  if (f.endsWith(".map") || f.endsWith("README.md")) continue;
  const buf = readFileSync(f);
  raw += buf.byteLength;
  gz += gzipSync(buf, { level: 9 }).byteLength;
}

const mb = (n) => (n / 1024 / 1024).toFixed(2);
console.log(`Worker upload: ${mb(raw)} MB raw, ${mb(gz)} MB gzipped (Free limit ${FREE_MB} MB, Paid ${PAID_MB} MB).`);
if (gz > FREE_MB * 1024 * 1024) console.log("Over the Workers Free limit: deploy needs Workers Paid.");
if (maxMb !== undefined && gz > maxMb * 1024 * 1024) {
  console.error(`Worker is over the ${maxMb} MB budget.`);
  process.exit(1);
}
