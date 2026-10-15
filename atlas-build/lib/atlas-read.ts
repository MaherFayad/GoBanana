/**
 * Reads an earlier job's records back from out/v1/<kind>/*.json (later jobs build on earlier ones,
 * plan 6.3). Throws with a clear message when the kind has not been built yet.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "../config.ts";

export function readKindRecords<T>(kind: string, outDir = PATHS.out): T[] {
  const dir = join(outDir, kind);
  if (!existsSync(dir)) throw new Error(`out/v1/${kind}/ does not exist yet: run (or rebuild with --from-raw) the job that writes "${kind}" first`);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) throw new Error(`out/v1/${kind}/ has no shards`);
  return files.flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as T[]);
}
