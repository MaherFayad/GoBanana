/**
 * Upload step, run only after the owner approves the review pages. It uploads nothing itself:
 * it checks every shard against the manifest, prints the wrangler commands to run from
 * banana-server/, and copies the manifest to banana-server/lib/atlas/manifest.json.
 *
 *   npx tsx upload.ts [--kind cards] [--no-copy]
 *
 * Kinds starting with "example" (the infra test job) or "work-" (a job's intermediate output, such as
 * the J8 briefs) are never uploaded or listed.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { PATHS } from "./config.ts";
import { readManifest, verifyManifest, type Manifest } from "./lib/shards.ts";

export const BUCKET = "banana-atlas";
export const PREFIX = "atlas/v1";

export function shippable(manifest: Manifest, kinds?: readonly string[]): Manifest {
  return {
    version: manifest.version,
    shards: manifest.shards.filter((s) => !s.kind.startsWith("example") && !s.kind.startsWith("work-") && (!kinds || kinds.length === 0 || kinds.includes(s.kind))),
  };
}

/** The wrangler commands (run from banana-server/) for these shards, then the manifest last. */
export function uploadCommands(manifest: Manifest, outDir: string, fromDir: string, manifestFile: string): string[] {
  const rel = (p: string) => relative(fromDir, p).replace(/\\/g, "/");
  const put = (key: string, file: string) => `npx wrangler r2 object put ${BUCKET}/${PREFIX}/${key} --file "${rel(file)}" --content-type application/json --remote`;
  return [...manifest.shards.map((s) => put(s.path, join(outDir, s.path))), put("manifest.json", manifestFile)];
}

function main(argv: readonly string[]): number {
  const kinds: string[] = [];
  let copy = true;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--kind") kinds.push(argv[++i] ?? "");
    else if (argv[i] === "--no-copy") copy = false;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  const problems = verifyManifest(PATHS.out);
  if (problems.length > 0) {
    console.error(`Shards do not match the manifest; rerun the job (or --from-raw):\n  ${problems.join("\n  ")}`);
    return 1;
  }
  const full = readManifest(PATHS.manifest);
  // Partial uploads (--kind) still copy and upload the full shippable manifest, so the server sees every kind.
  const shipManifest = shippable(full);
  const toUpload = shippable(full, kinds);
  if (toUpload.shards.length === 0) {
    console.error("Nothing to upload (only example kinds, or no shards).");
    return 1;
  }
  const shipFile = join(PATHS.out, "manifest.ship.json");
  writeFileSync(shipFile, JSON.stringify(shipManifest, null, 2) + "\n");

  const serverDir = join(dirname(PATHS.serverManifest), "..", "..");
  console.log(`Owner: after approving review/*.html, run these from ${serverDir}:\n`);
  for (const c of uploadCommands(toUpload, PATHS.out, serverDir, shipFile)) console.log(c);

  if (copy) {
    mkdirSync(dirname(PATHS.serverManifest), { recursive: true });
    writeFileSync(PATHS.serverManifest, JSON.stringify(shipManifest, null, 2) + "\n");
    console.log(`\nCopied the manifest (${shipManifest.shards.length} shards) to ${PATHS.serverManifest}${existsSync(PATHS.serverManifest) ? "" : " (failed)"}.`);
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(main(process.argv.slice(2)));
