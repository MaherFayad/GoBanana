#!/usr/bin/env node
/**
 * Builds the Starlight docs in ../banana-docs and copies them into public/docs, so the
 * Worker serves them at /docs as static assets (docs/site-redesign-spec.md). Runs before the
 * OpenNext build in `preview` and `deploy:preview`. public/docs is generated: it is git-ignored.
 *
 * Plain Node, no shell features, so it runs the same on Windows, macOS and Linux.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = resolve(serverDir, "..", "banana-docs");
const distDir = join(docsDir, "dist");
const targetDir = join(serverDir, "public", "docs");

function npm(args) {
  const command = `npm ${args.join(" ")}`;
  console.log(`[build-docs] ${command}`);
  // One fixed command string through the shell: on Windows npm is a .cmd file, which needs one.
  const result = spawnSync(command, { cwd: docsDir, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`[build-docs] ${command} failed`);
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(join(docsDir, "package.json"))) {
  console.error(`[build-docs] no docs app at ${docsDir}`);
  process.exit(1);
}

if (!existsSync(join(docsDir, "node_modules"))) npm(["ci"]);
npm(["run", "build"]);

if (!existsSync(join(distDir, "index.html"))) {
  console.error(`[build-docs] the docs build left no ${join(distDir, "index.html")}`);
  process.exit(1);
}

rmSync(targetDir, { recursive: true, force: true });
cpSync(distDir, targetDir, { recursive: true });
console.log(`[build-docs] copied ${distDir} to ${targetDir}`);
