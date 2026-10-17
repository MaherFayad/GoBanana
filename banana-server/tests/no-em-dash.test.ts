/**
 * Gate: no em dashes (U+2014) in the words agents read: every plugin skill (.md under
 * ../banana-plugin/skills), the server instructions and every exported tool description.
 * Each failure prints its file and line.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(HERE, "..");
const SKILLS = resolve(SERVER, "../banana-plugin/skills");
const TOOLS = resolve(SERVER, "lib/mcp/tools");
const EM = "—";

function mdFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...mdFiles(path));
    else if (name.endsWith(".md")) out.push(path);
  }
  return out.sort();
}

/** "file:line  text" for every line holding an em dash. */
function hits(label: string, text: string): string[] {
  return text.split("\n").flatMap((line, i) => (line.includes(EM) ? [`${label}:${i + 1}  ${line.trim().slice(0, 120)}`] : []));
}

const skillFiles = mdFiles(SKILLS);
const toolFiles = readdirSync(TOOLS).filter((f) => f.endsWith(".ts")).sort();

describe("no em dashes in agent facing copy", () => {
  it("finds the plugin skills", () => {
    expect(skillFiles.length).toBeGreaterThan(0);
  });

  it.each(skillFiles.map((f) => [relative(SERVER, f), f]))("%s has no em dash", (label, file) => {
    expect(hits(label, readFileSync(file, "utf8"))).toEqual([]);
  });

  it("SERVER_INSTRUCTIONS has no em dash", () => {
    expect(hits("lib/mcp/instructions.ts SERVER_INSTRUCTIONS", SERVER_INSTRUCTIONS)).toEqual([]);
  });

  it.each(toolFiles)("lib/mcp/tools/%s TOOL_DESCRIPTION has no em dash", async (name) => {
    const mod = (await import(pathToFileURL(join(TOOLS, name)).href)) as { TOOL_DESCRIPTION?: unknown };
    if (typeof mod.TOOL_DESCRIPTION !== "string") return;
    const source = readFileSync(join(TOOLS, name), "utf8");
    // Point at the source line when the dash is written there; otherwise at the line of the description.
    const found = mod.TOOL_DESCRIPTION.includes(EM)
      ? hits(`lib/mcp/tools/${name}`, source).concat(source.includes(EM) ? [] : hits(`lib/mcp/tools/${name} TOOL_DESCRIPTION`, mod.TOOL_DESCRIPTION))
      : [];
    expect(found).toEqual([]);
  });
});
