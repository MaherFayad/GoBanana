/**
 * Serper helpers for judging jobs (J7): the key, the account balance, one image search, and a
 * credits ledger. Only URLs come back from a search and nothing is stored (hard rules 2 and 4).
 *
 * The key is SERPER_API_KEY in the environment, else atlas-build/.env, else banana-server/.dev.vars
 * (this repo keeps it there). Only that one line is read; it is never printed.
 *
 * Credits: one image search with the default 10 results is 1 credit. Asking for more than 10
 * results costs more, so J7 does not.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { MAIN_ATLAS, PATHS, ROOT } from "../config.ts";

/** Credits the product needs at runtime (D2 cap). A build job never spends the account under this. */
export const SERPER_FLOOR = 2_500;

export type SerperImage = { imageUrl?: string; thumbnailUrl?: string; link?: string; title?: string };

/** The value of `name` in dotenv-style text, or undefined. Pure. */
export function envValue(text: string, name: string): string | undefined {
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && m[1] === name) return m[2]!.replace(/^(['"])(.*)\1$/, "$2") || undefined;
  }
  return undefined;
}

export function serperKey(): string {
  if (process.env.SERPER_API_KEY) return process.env.SERPER_API_KEY;
  const files = [
    join(ROOT, ".env"),
    join(MAIN_ATLAS, ".env"),
    resolve(ROOT, "..", "banana-server", ".dev.vars"),
    resolve(MAIN_ATLAS, "..", "banana-server", ".dev.vars"),
  ];
  for (const f of files) {
    if (!existsSync(f)) continue;
    const v = envValue(readFileSync(f, "utf8"), "SERPER_API_KEY");
    if (v) return v;
  }
  throw new Error("SERPER_API_KEY not found (env, atlas-build/.env or banana-server/.dev.vars)");
}

/** Credits left on the account (a free call). */
export async function serperBalance(): Promise<number> {
  const res = await fetch("https://google.serper.dev/account", { headers: { "X-API-KEY": serperKey() } });
  if (!res.ok) throw new Error(`Serper account answered ${res.status}`);
  const j = (await res.json()) as { balance?: unknown };
  if (typeof j.balance !== "number") throw new Error("Serper account gave no balance");
  return j.balance;
}

/** Searches that can be spent without going under the floor. Pure. */
export function creditRoom(balance: number, floor = SERPER_FLOOR): number {
  return Math.max(0, balance - floor);
}

/** One image search (default 10 results, 1 credit). Returns the images and the credits Serper charged. */
export async function serperImageSearch(q: string): Promise<{ images: SerperImage[]; credits: number }> {
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": serperKey(), "content-type": "application/json" },
    body: JSON.stringify({ q }),
  });
  if (!res.ok) throw new Error(`Serper answered ${res.status}`);
  const j = (await res.json()) as { images?: SerperImage[]; credits?: number };
  return { images: j.images ?? [], credits: typeof j.credits === "number" ? j.credits : 1 };
}

// ---------------------------------------------------------------------------------------------
// Credits ledger: serper.csv, next to costs.csv so every checkout shares it.

export const SERPER_LEDGER_HEADER = "time,job,request,credits";
export const serperLedgerPath = () => join(dirname(PATHS.costs), "serper.csv");

export function logCredits(job: string, request: string, credits: number, path = serperLedgerPath()): void {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, SERPER_LEDGER_HEADER + "\n");
  }
  appendFileSync(path, `${new Date().toISOString()},${job},${request},${credits}\n`);
}

/** Total credits the ledger shows for a job id prefix (all jobs when empty). */
export function creditsSpent(prefix = "", path = serperLedgerPath()): number {
  if (!existsSync(path)) return 0;
  let n = 0;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/).slice(1)) {
    const c = line.split(",");
    if (c.length >= 4 && c[1]!.startsWith(prefix)) n += Number(c[3]) || 0;
  }
  return n;
}
