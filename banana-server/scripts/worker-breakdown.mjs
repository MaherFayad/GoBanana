#!/usr/bin/env node
/**
 * Estimates which packages make up the gzipped Worker, after `opennextjs-cloudflare build`.
 *
 * The Worker is custom-worker.ts + two OpenNext bundles:
 * - `.open-next/server-functions/default/handler.mjs` (esbuild; metafile next to it). Most of
 *   it is Turbopack chunks from `.next/server/chunks`, which carry source maps, so each chunk
 *   is split back into its source modules with the map.
 * - `.open-next/middleware/handler.mjs` (proxy.ts, unminified esbuild output with
 *   `// path` module comments), split on those comments.
 * Each slice is gzipped on its own and summed per package. Gzip sizes are estimates (slices
 * compress a little worse alone than inside the whole file) but rank the parts correctly.
 * Code duplicated across chunks is counted every time, as it is in the upload.
 *
 * Usage: node scripts/worker-breakdown.mjs [--top 25] [--files]
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { AnyMap, decodedMappings } from "@jridgewell/trace-mapping";

const argv = process.argv.slice(2);
const top = Number(argv[argv.indexOf("--top") + 1]) || 25;
const byFile = argv.includes("--files");
const SERVER = ".open-next/server-functions/default";
const MIDDLEWARE = ".open-next/middleware/handler.mjs";

/** Groups a source path into a package (`next/dist/compiled/next-server`) or an app folder. */
function group(path) {
  const p = decodeURIComponent(path).replace(/^.*turbopack:\/\/\//, "").replace(/\[project\]\//, "");
  if (byFile) return p.replace(/^.*node_modules\//, "");
  const i = p.lastIndexOf("node_modules/");
  if (i < 0) return "app: " + p.replace(/^(\.\.\/)+/, "").replace(/^\.open-next\/(server-functions\/default|middleware)\//, "").split("/").slice(0, 2).join("/");
  const parts = p.slice(i + 13).split("/");
  const name = parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
  if (name === "next") {
    const rest = parts.slice(1);
    return `next/${rest.slice(0, rest[1] === "compiled" ? 3 : 2).join("/")}`;
  }
  return name;
}

const rows = new Map(); // key -> { raw, gz, where:Set }
function add(key, text, where) {
  if (!text) return;
  const r = rows.get(key) ?? { raw: 0, gz: 0, where: new Set() };
  r.raw += Buffer.byteLength(text);
  r.gz += gzipSync(text, { level: 9 }).byteLength;
  r.where.add(where);
  rows.set(key, r);
}

/** Splits a Turbopack chunk into source-module slices with its source map. */
function addChunk(file, mapFile, where) {
  const code = readFileSync(file, "utf8");
  if (!existsSync(mapFile)) return add(group(file), code, where);
  const map = new AnyMap(readFileSync(mapFile, "utf8"));
  const lines = code.split("\n");
  const slices = new Map();
  decodedMappings(map).forEach((segs, li) => {
    const line = lines[li] ?? "";
    let prevCol = 0;
    let prevKey = "(chunk glue)";
    for (const seg of segs) {
      const s = slices.get(prevKey) ?? [];
      s.push(line.slice(prevCol, seg[0]));
      slices.set(prevKey, s);
      prevCol = seg[0];
      prevKey = seg.length > 1 ? group(map.resolvedSources[seg[1]] ?? map.sources[seg[1]]) : "(chunk glue)";
    }
    const s = slices.get(prevKey) ?? [];
    s.push(line.slice(prevCol) + "\n");
    slices.set(prevKey, s);
  });
  for (const [key, parts] of slices) add(key, parts.join(""), where);
}

if (!existsSync(join(SERVER, "handler.mjs.meta.json"))) {
  console.error("Run `npx opennextjs-cloudflare build` first.");
  process.exit(2);
}

// Server bundle: esbuild inputs; Turbopack chunks are mapped back to their sources.
const meta = JSON.parse(readFileSync(join(SERVER, "handler.mjs.meta.json"), "utf8"));
const out = Object.values(meta.outputs)[0];
for (const [input, { bytesInOutput }] of Object.entries(out.inputs)) {
  if (!bytesInOutput) continue;
  const chunk = input.match(/\.next\/server\/(.*)$/);
  const original = chunk ? join(".next/server", chunk[1]) : null;
  if (original && existsSync(original + ".map")) {
    addChunk(original, original + ".map", "server");
  } else if (existsSync(input)) {
    // Scale the minified-but-not-mangled share by the source's own gzip ratio.
    const src = readFileSync(input);
    const ratio = gzipSync(src, { level: 9 }).byteLength / Math.max(1, src.byteLength);
    const r = rows.get(group(input)) ?? { raw: 0, gz: 0, where: new Set() };
    r.raw += bytesInOutput;
    r.gz += Math.round(bytesInOutput * ratio);
    r.where.add("server");
    rows.set(group(input), r);
  }
}

// Middleware bundle: split on esbuild's `// path` module comments.
if (existsSync(MIDDLEWARE)) {
  const lines = readFileSync(MIDDLEWARE, "utf8").split("\n");
  let cur = "(middleware glue)";
  let buf = [];
  const flush = () => {
    const text = buf.join("\n");
    const m = cur.match(/\.next\/server\/(chunks\/.*\.js)$/);
    if (m && existsSync(join(".next/server", m[1]) + ".map") && text.length > 50_000) {
      addChunk(join(".next/server", m[1]), join(".next/server", m[1]) + ".map", "middleware");
    } else add(group(cur), text, "middleware");
    buf = [];
  };
  for (const l of lines) {
    if (/^\/\/ (\.open-next|node_modules|node-builtins|\.\.\/)\S*$/.test(l)) {
      flush();
      cur = l.slice(3);
    }
    buf.push(l);
  }
  flush();
}

const list = [...rows.entries()].sort((a, b) => b[1].gz - a[1].gz);
const kb = (n) => (n / 1024).toFixed(0).padStart(6);
const total = list.reduce((s, [, r]) => s + r.gz, 0);
console.log(`${"gzip KB".padStart(7)} ${"raw KB".padStart(7)}  where              package or folder`);
for (const [k, r] of list.slice(0, top)) {
  console.log(` ${kb(r.gz)}  ${kb(r.raw)}  ${[...r.where].join("+").padEnd(18)} ${relative(".", k)}`);
}
console.log(`Sum of all slices: ${kb(total)} KB gzipped (estimate; wasm files are extra).`);
