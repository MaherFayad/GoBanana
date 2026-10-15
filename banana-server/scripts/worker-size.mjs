#!/usr/bin/env node
/**
 * Prints the size of the Worker upload after `opennextjs-cloudflare build`.
 *
 * Bundles with `wrangler deploy --dry-run --outdir` (no login, nothing is uploaded) and reads
 * wrangler's own "Total Upload: X KiB / gzip: Y KiB" line. Cloudflare's limits page (checked
 * 2026-10-15, last updated 2026-10-12) gives 64 MiB for Workers Free and Paid and says "There is
 * no compressed size limit. Only the uncompressed bundle size counts." So the gate is on the
 * uncompressed size; the gzipped size is printed as a report only (DECISIONS.md, docs/worker-size.md).
 *
 * Usage: npm run worker:size [-- --max-mib 60]   (exits 1 when the uncompressed size is over --max-mib)
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const LIMIT_MIB = 64;
/** Workers Free used to reject uploads over 3 MiB gzipped. Kept as a note, not a gate. */
const OLD_FREE_GZIP_MIB = 3;
const OUT = ".wrangler/size-check";

const maxArg = process.argv.indexOf("--max-mib");
const maxMib = maxArg > -1 ? Number(process.argv[maxArg + 1]) : undefined;

if (!existsSync(".open-next/worker.js")) {
  console.error("No .open-next/worker.js. Run `npx opennextjs-cloudflare build` first.");
  process.exit(2);
}

rmSync(OUT, { recursive: true, force: true });
// A shell command string, so `npx` resolves to npx.cmd on Windows too (execFileSync("npx") fails
// there with ENOENT).
const log = execSync(`npx wrangler deploy --dry-run --outdir ${OUT}`, { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });
for (const line of log.split(/\r?\n/)) {
  if (/warn|limit|exceed/i.test(line)) console.log(`wrangler: ${line.trim()}`);
}

const MiB = 1024 * 1024;
let raw;
let gz;
const m = /Total Upload:\s*([\d.]+)\s*KiB\s*\/\s*gzip:\s*([\d.]+)\s*KiB/.exec(log);
if (m) {
  raw = Number(m[1]) * 1024;
  gz = Number(m[2]) * 1024;
} else {
  // Older wrangler output: sum the bundled files ourselves.
  const files = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
  raw = 0;
  gz = 0;
  for (const f of files(OUT)) {
    if (f.endsWith(".map") || f.endsWith("README.md")) continue;
    const buf = readFileSync(f);
    raw += buf.byteLength;
    gz += gzipSync(buf, { level: 9 }).byteLength;
  }
}

const mib = (n) => (n / MiB).toFixed(2);
console.log(`Worker upload: ${mib(raw)} MiB uncompressed (limit ${LIMIT_MIB} MiB), ${mib(gz)} MiB gzipped (report only).`);
if (gz > OLD_FREE_GZIP_MIB * MiB) {
  console.log(`Note: over ${OLD_FREE_GZIP_MIB} MiB gzipped, the old Workers Free limit. Cloudflare no longer lists a compressed limit; check the first deploy.`);
}
if (maxMib !== undefined && raw > maxMib * MiB) {
  console.error(`Worker is over the ${maxMib} MiB uncompressed budget.`);
  process.exit(1);
}
