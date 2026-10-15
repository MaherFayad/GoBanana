/**
 * Headless Chrome for jobs that render pages (J8 screenshots, J9 contact sheets, J12 specimens).
 * Playwright is not an atlas-build dependency: it loads from banana-server/node_modules (this
 * checkout's, else the main checkout's) and drives the installed Chrome (channel "chrome").
 * Screenshots stay in memory; nothing here writes images to disk.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { MAIN_ATLAS, ROOT } from "../config.ts";

/** The small part of Playwright's API the jobs use (atlas-build has no playwright types). */
export interface Page {
  setContent(html: string, opts?: { waitUntil?: "load" | "domcontentloaded" | "networkidle"; timeout?: number }): Promise<void>;
  goto(url: string, opts?: { waitUntil?: "load" | "domcontentloaded" | "networkidle"; timeout?: number }): Promise<unknown>;
  evaluate<R, A = undefined>(fn: (arg: A) => R | Promise<R>, arg?: A): Promise<R>;
  screenshot(opts?: { type?: "png" | "jpeg"; quality?: number; fullPage?: boolean; clip?: { x: number; y: number; width: number; height: number } }): Promise<Buffer>;
  close(): Promise<void>;
}
export interface Browser {
  newPage(opts?: { viewport?: { width: number; height: number }; deviceScaleFactor?: number; javaScriptEnabled?: boolean }): Promise<Page>;
  close(): Promise<void>;
}
type Playwright = { chromium: { launch(opts: { channel?: string; headless?: boolean }): Promise<Browser> } };

function playwright(): Playwright {
  const dirs = [resolve(ROOT, "..", "banana-server"), resolve(MAIN_ATLAS, "..", "banana-server")];
  for (const dir of dirs) {
    if (existsSync(join(dir, "node_modules", "playwright"))) {
      return createRequire(join(dir, "package.json"))("playwright") as Playwright;
    }
  }
  throw new Error("playwright not found in banana-server/node_modules (run npm ci in banana-server)");
}

let shared: Promise<Browser> | null = null;

/** One shared headless Chrome per process. */
export function browser(): Promise<Browser> {
  shared ??= playwright().chromium.launch({ channel: "chrome", headless: true });
  return shared;
}

export async function closeBrowser(): Promise<void> {
  if (!shared) return;
  const b = await shared;
  shared = null;
  await b.close();
}
