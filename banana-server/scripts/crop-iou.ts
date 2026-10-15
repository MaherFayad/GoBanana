/**
 * Crop accuracy for P1-I4 (docs/next-step-plan.md section 8): IoU of the default crops and the
 * agent's crops against the owner's gold parts.
 *
 *   npx tsx scripts/crop-iou.ts                                  # bench/gold/*.json, ROLE_BANDS only
 *   npx tsx scripts/crop-iou.ts --anatomy ../atlas-build/out/v1/anatomy   # also the anatomy bands
 *   npx tsx scripts/crop-iou.ts --json
 *
 * The gold set (P1-J11, about 200 parts) is labelled by the owner; until it exists this prints how
 * to add it and exits 0. Gold part shape: lib/stitch/crop-iou.ts. --anatomy reads every .json file
 * in a folder, each one PageAnatomy or an array of them. Reads local files only; no network.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PageAnatomy } from "@/lib/atlas/types";
import { evaluateCrops, formatCropReport, parseGold, type GoldPart } from "@/lib/stitch/crop-iou";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GOLD = join(ROOT, "bench", "gold");

const jsonFiles = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f));

function readAnatomies(dir: string): Map<string, PageAnatomy> {
  const out = new Map<string, PageAnatomy>();
  for (const file of jsonFiles(dir)) {
    const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
    for (const a of Array.isArray(raw) ? raw : [raw]) {
      const page = a as PageAnatomy;
      if (page && typeof page.id === "string" && Array.isArray(page.sections)) out.set(page.id, page);
    }
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const at = args.indexOf("--anatomy");
  const anatomyDir = at >= 0 ? args[at + 1] : undefined;

  if (!existsSync(GOLD) || jsonFiles(GOLD).length === 0) {
    console.log("No gold set yet: add bench/gold/*.json (owner labels, P1-J11). See lib/stitch/crop-iou.ts for the part shape.");
    return;
  }
  const parts: GoldPart[] = [];
  let dropped = 0;
  for (const file of jsonFiles(GOLD)) {
    const got = parseGold(JSON.parse(readFileSync(file, "utf8")));
    parts.push(...got.parts);
    dropped += got.dropped;
  }
  const anatomies = anatomyDir ? readAnatomies(resolve(anatomyDir)) : new Map<string, PageAnatomy>();
  const report = evaluateCrops(parts, anatomies);
  if (asJson) {
    console.log(JSON.stringify({ ...report, dropped, anatomies: anatomies.size }, null, 2));
    return;
  }
  console.log(formatCropReport(report));
  if (dropped > 0) console.log(`\nLeft out ${dropped} malformed gold parts.`);
  if (anatomyDir) console.log(`\nRead ${anatomies.size} page anatomies from ${anatomyDir}.`);
}

main();
