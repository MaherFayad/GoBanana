/**
 * Upload step, run only after the owner approves the review pages. It uploads nothing itself:
 * it checks every job shard against the job manifest, turns out/v1 into the server's shard layout
 * in out/server/v1 (lib/layout.ts: the layout banana-server/lib/atlas/loader.ts reads), prints the
 * wrangler commands to run from banana-server/, and copies the server manifest to
 * banana-server/lib/atlas/manifest.json.
 *
 *   npx tsx upload.ts [--kind cards] [--no-copy]
 *
 * --kind takes server kinds (pages, domains, fit, cards, lines, mechanics, lenses, recipes, cc0,
 * slop) and only limits the printed commands; the manifest always lists every kind. Job kinds the
 * server does not read (example, bench, ...) and "work-" kinds (a job's intermediate output, such as
 * the J8 briefs) are never uploaded.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { PATHS } from "./config.ts";
import { readManifest, verifyManifest, type Manifest } from "./lib/shards.ts";
import { readJobRecords, serverLayout, serverUploadCommands, writeServerLayout } from "./lib/layout.ts";

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
  // The server's layout (lib/layout.ts). Partial uploads (--kind) still copy the full manifest,
  // so the server sees every kind.
  const layout = serverLayout(readJobRecords(PATHS.out));
  if (layout.manifest.shards.length === 0) {
    console.error("Nothing to upload (only kinds the server does not read, or no shards).");
    return 1;
  }
  const serverOut = join(PATHS.out, "..", "server", "v1");
  writeServerLayout(serverOut, layout);
  const picked = kinds.length > 0 ? { ...layout, files: new Map([...layout.files].filter(([p]) => kinds.includes(p.split("/")[0]!))) } : layout;
  if (layout.skipped.length > 0) console.log(`Not uploaded (the server does not read them): ${layout.skipped.join(", ")}.`);

  const serverDir = join(dirname(PATHS.serverManifest), "..", "..");
  const rel = (p: string) => relative(serverDir, p).replace(/\\/g, "/");
  console.log(`Owner: after approving review/*.html, run these from ${serverDir}:\n`);
  for (const c of serverUploadCommands(picked, serverOut, rel, BUCKET, PREFIX)) console.log(c);

  if (copy) {
    mkdirSync(dirname(PATHS.serverManifest), { recursive: true });
    writeFileSync(PATHS.serverManifest, JSON.stringify(layout.manifest, null, 2) + "\n");
    console.log(`\nCopied the manifest (${layout.manifest.shards.length} shards) to ${PATHS.serverManifest}${existsSync(PATHS.serverManifest) ? "" : " (failed)"}.`);
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(main(process.argv.slice(2)));
