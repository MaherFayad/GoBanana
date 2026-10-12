/**
 * Blocks CI (spec section 13): every generated DESIGN.md passes the design.md CLI lint,
 * and our in-process tokens and Tailwind output match the CLI `export` command.
 * Runs the locally installed CLI (same as `npx @google/design.md`) on temp files.
 */
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { buildKitModel, exportKit } from "../lib/export";
import { tailwindCss, tailwindThemeBlock } from "../lib/export/tailwind";
import { dtcgCore, tokensJson } from "../lib/export/tokens";
import { FIXTURES } from "./export-fixtures";

const run = promisify(execFile);
const CLI = fileURLToPath(new URL("../node_modules/@google/design.md/dist/index.js", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "design-md-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function cli(args: string[]): Promise<{ stdout: string; code: number }> {
  try {
    const { stdout } = await run(process.execPath, [CLI, ...args], { maxBuffer: 10 * 1024 * 1024 });
    return { stdout, code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; code?: number };
    return { stdout: e.stdout ?? "", code: typeof e.code === "number" ? e.code : 1 };
  }
}

interface LintReport {
  findings: { severity: string; rule?: string; message: string; path?: string }[];
  summary: { errors: number; warnings: number };
}

describe.each(Object.entries(FIXTURES))("design.md CLI on fixture %s", (name, snapshot) => {
  // Page scope (the default) and system scope DESIGN.md must both lint clean.
  const designMd = exportKit(snapshot, ["design_md"])[0]?.content ?? "";
  const path = join(dir, `${name}-DESIGN.md`);
  writeFileSync(path, designMd);
  const model = buildKitModel(snapshot);
  const systemPath = join(dir, `${name}-system-DESIGN.md`);
  writeFileSync(systemPath, exportKit(snapshot, ["design_md"], { scope: "system" })[0]?.content ?? "");
  const systemModel = buildKitModel(snapshot, { scope: "system" });

  it.each([
    ["page", path],
    ["system", systemPath],
  ])("passes lint with no errors and no warnings (%s scope)", async (_scope, file) => {
    const { stdout, code } = await cli(["lint", "--format", "json", file]);
    const report = JSON.parse(stdout) as LintReport;
    expect(report.summary.errors, JSON.stringify(report.findings, null, 2)).toBe(0);
    expect(code).toBe(0);
    expect(report.findings.filter((f) => f.severity !== "info"), JSON.stringify(report.findings, null, 2)).toEqual([]);
  }, 30_000);

  it("tokens.json matches `export --format dtcg`", async () => {
    const { stdout, code } = await cli(["export", "--format", "dtcg", path]);
    expect(code).toBe(0);
    expect(dtcgCore(model)).toEqual(JSON.parse(stdout));
    const ours = JSON.parse(tokensJson(model)) as Record<string, unknown>;
    delete ours.$extensions;
    expect(ours).toEqual(JSON.parse(stdout));
  }, 30_000);

  it("theme.css matches `export --format css-tailwind`", async () => {
    const { stdout, code } = await cli(["export", "--format", "css-tailwind", systemPath]);
    expect(code).toBe(0);
    expect(tailwindThemeBlock(systemModel)).toBe(stdout);
    expect(tailwindCss(systemModel).endsWith(stdout)).toBe(true);
    // Page scope sets the same variables on a wrapper instead of @theme (fluid type aside).
    const cliVars = stdout.split("\n").filter((l) => l.startsWith("  --") && !/--text-(display|headline):/.test(l));
    const pageCss = tailwindCss(model);
    for (const v of cliVars) expect(pageCss).toContain(v);
    expect(pageCss).not.toContain("@theme");
  }, 30_000);
});
