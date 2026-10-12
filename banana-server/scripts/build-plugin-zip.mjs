/**
 * Packs banana-plugin/ (the Claude plugin: .claude-plugin, skills, .mcp.json, README, LICENSE,
 * assets) into public/downloads/gobanana-plugin.zip for "Upload plugin" in the Claude app, so the
 * download always matches the deployed server. Node built-ins only (zlib deflate, a small zip
 * writer). Evals and internal docs stay out.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "banana-plugin");
const out = join(here, "..", "public", "downloads", "gobanana-plugin.zip");
const INCLUDE = [".claude-plugin", ".mcp.json", "skills", "assets", "README.md", "LICENSE"];

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function walk(p) {
  const st = statSync(p);
  if (!st.isDirectory()) return [p];
  return readdirSync(p).sort().flatMap((n) => walk(join(p, n)));
}

const files = INCLUDE.flatMap((n) => {
  try {
    return walk(join(root, n));
  } catch {
    return [];
  }
});

const locals = [];
const centrals = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(relative(root, file).split(sep).join("/"));
  const data = readFileSync(file);
  const packed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0);
  head.writeUInt16LE(20, 4);
  head.writeUInt16LE(0x0800, 6); // UTF-8 names
  head.writeUInt16LE(8, 8); // deflate
  head.writeUInt32LE(0x00210000, 10); // fixed time and date (1980-01-01), reproducible
  head.writeUInt32LE(crc, 14);
  head.writeUInt32LE(packed.length, 18);
  head.writeUInt32LE(data.length, 22);
  head.writeUInt16LE(name.length, 26);
  locals.push(head, name, packed);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4);
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt16LE(8, 10);
  cen.writeUInt32LE(0x00210000, 12);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(packed.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(name.length, 28);
  cen.writeUInt32LE(offset, 42);
  centrals.push(cen, name);
  offset += head.length + name.length + packed.length;
}
const central = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(central.length, 12);
end.writeUInt32LE(offset, 16);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat([...locals, central, end]));
console.log(`[plugin-zip] ${files.length} files -> ${relative(process.cwd(), out)}`);
