#!/usr/bin/env node
/**
 * Postinstall: keeps @vercel/og out of the OpenNext middleware bundle (proxy.ts).
 *
 * @opennextjs/cloudflare (checked on 1.20.10) patches every Turbopack runtime with a
 * `case "next/dist/compiled/@vercel/og/index.node.js": import(".../index.edge.js")`.
 * For the server bundle it aliases that file to a throwing shim when no route uses
 * @vercel/og, but the Node middleware bundle has no such alias, so proxy.ts ships the whole
 * library plus resvg.wasm and yoga.wasm: about 0.7 MB gzipped of the 3 MB Workers Free limit.
 * A proxy never renders OG images, so this adds the same alias to the middleware build.
 *
 * Idempotent. If the file no longer matches (OpenNext changed), it warns and does nothing:
 * the CI size budget (`npm run worker:size -- --max-mb 2.9`) then shows the regression.
 * See DECISIONS.md (Hosting, Worker size).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(
  new URL("../node_modules/@opennextjs/cloudflare/dist/cli/build/open-next/bundle-node-middleware.js", import.meta.url),
);
const MARKER = "banana: no @vercel/og in middleware";
const ANCHOR = `...(hasOpentelemetry ? {} : { "@opentelemetry/api": "next/dist/compiled/@opentelemetry/api" }),`;
const ADDITION = `
            // ${MARKER} (scripts/patch-opennext.mjs)
            "next/dist/compiled/@vercel/og/index.edge.js": decodeURIComponent(new URL("../../templates/shims/throw.js", import.meta.url).pathname),`;

if (!existsSync(FILE)) {
  console.warn("[patch-opennext] @opennextjs/cloudflare not installed; skipped");
  process.exit(0);
}
const src = readFileSync(FILE, "utf8");
if (src.includes(MARKER)) process.exit(0);
if (!src.includes(ANCHOR) || !existsSync(new URL("../../templates/shims/throw.js", `file://${FILE}`))) {
  console.warn("[patch-opennext] bundle-node-middleware.js changed upstream; @vercel/og patch NOT applied. Check the Worker size.");
  process.exit(0);
}
writeFileSync(FILE, src.replace(ANCHOR, ANCHOR + ADDITION));
console.log("[patch-opennext] middleware bundle: @vercel/og aliased to a throwing shim");
