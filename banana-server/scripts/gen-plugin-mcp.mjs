/**
 * Writes banana-plugin/.mcp.json from the MCP origin (DIST-02).
 *
 *   MCP_ORIGIN=https://mcp.example.com node scripts/gen-plugin-mcp.mjs
 *
 * MCP_ORIGIN wins, then PUBLIC_ORIGIN, then the workers.dev URL the plugin ships with today
 * (so running it with nothing set changes nothing). Add --check to fail when the file differs
 * instead of writing it. The plugin and the Claude connector must point at the same URL.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ORIGIN = "https://gobanana-server.maherfayad55.workers.dev";
const file = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "banana-plugin", ".mcp.json");

function httpsOrigin(value) {
  try {
    const url = new URL((value ?? "").trim());
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

const origin = httpsOrigin(process.env.MCP_ORIGIN) ?? httpsOrigin(process.env.PUBLIC_ORIGIN) ?? DEFAULT_ORIGIN;
const next = `${JSON.stringify({ mcpServers: { gobanana: { type: "http", url: `${origin}/api/mcp` } } }, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  if (current !== next) {
    console.error(`${file} does not match ${origin}/api/mcp. Run: node scripts/gen-plugin-mcp.mjs`);
    process.exit(1);
  }
  console.log(`plugin .mcp.json points at ${origin}/api/mcp`);
} else {
  writeFileSync(file, next);
  console.log(`wrote ${file} (${origin}/api/mcp)`);
}
