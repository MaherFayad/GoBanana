/** export_kit tool (wild directions v2): directionId, pages, scope, paths and plan gating. */
import { describe, expect, it } from "vitest";
import { createExportKitTool, DIRECTION_NOT_FOUND, TOOL_DESCRIPTION } from "@/lib/mcp/tools/export_kit";
import { ALICE, imageNode, makeDeps, seedCanvas, state, text } from "./tools-fixtures";

type Out = { scope: string; files: { name: string; path: string; append?: boolean; content: string }[]; blocked: string[] };

async function seeded(plan?: "founding") {
  const { deps, repos } = makeDeps(plan ? { plans: { [ALICE]: plan } } : {});
  const c = await seedCanvas(repos, ALICE, state([imageNode("a", 1)]), "Pocket ledger");
  await repos.directions.upsertMany(c.id, [
    { bendId: "b1", move: "transplant", title: "Balance as a pawn ticket", searchQuery: "pawn ticket", detail: { platform: "mobile", pages: ["home screen"], verdict: "keep" } },
    { bendId: "b2", move: "era", title: "Ledger as a bank statement", searchQuery: "bank statement" },
  ]);
  return { deps, repos, canvasId: c.id };
}

describe("export_kit tool", () => {
  it("keeps the description short and plain", () => {
    expect(TOOL_DESCRIPTION.length).toBeLessThan(400);
    expect(TOOL_DESCRIPTION).not.toMatch(/[—–]/);
  });

  it("gives free users the scoped direction and build prompt, with paths", async () => {
    const { deps, canvasId } = await seeded();
    const res = await createExportKitTool(deps)({ canvasId, formats: ["direction_md", "build_prompt", "review"] }, ALICE);
    const out = res.structuredContent as Out;
    expect(out.scope).toBe("page");
    expect(out.files.map((f) => f.path)).toEqual([
      "design/explorations/balance-as-a-pawn-ticket/DIRECTION.md",
      "design/explorations/balance-as-a-pawn-ticket/BUILD-PROMPT.md",
    ]);
    expect(out.blocked).toEqual(["review"]);
    expect(text(res)).toContain("These formats need Pro: review. Upgrade: ");
    expect(text(res)).toContain("path: design/explorations/balance-as-a-pawn-ticket/DIRECTION.md");
    expect(text(res)).toContain("do not replace it");
  });

  it("takes directionId as the bend id or the row id, pages and system scope", async () => {
    const { deps, repos, canvasId } = await seeded("founding");
    const exp = createExportKitTool(deps);
    const rows = await repos.directions.listForCanvas(canvasId);
    const b2 = rows.find((r) => r.bendId === "b2")!;
    for (const directionId of ["b2", b2.id]) {
      const res = await exp({ canvasId, formats: ["cursor_rules"], directionId, pages: ["/statement"] }, ALICE);
      const f = (res.structuredContent as Out).files[0]!;
      expect(f.path).toBe(".cursor/rules/gobanana-ledger-as-a-bank-statement.mdc");
      expect(f.content).toContain('globs: "**/statement/**,**/statement.*"');
    }
    const sys = await exp({ canvasId, formats: ["design_md", "agents_md", "claude_md"], scope: "system" }, ALICE);
    const files = (sys.structuredContent as Out).files;
    expect(files.map((f) => [f.path, f.append ?? false])).toEqual([
      ["DESIGN.md", false],
      ["AGENTS.md", true],
      ["CLAUDE.md", true],
    ]);
    expect(text(sys)).toContain("(merge into the existing file by its markers)");
  });

  it("refuses an unknown direction and bad pages with plain messages", async () => {
    const { deps, canvasId } = await seeded("founding");
    const exp = createExportKitTool(deps);
    expect(text(await exp({ canvasId, formats: ["brief"], directionId: "nope" }, ALICE))).toBe(DIRECTION_NOT_FOUND);
    const many = await exp({ canvasId, formats: ["brief"], pages: ["a", "b", "c", "d", "e", "f"] }, ALICE);
    expect(text(many)).toContain("pages takes 1 to 5");
    const scope = await exp({ canvasId, formats: ["brief"], scope: "everything" }, ALICE);
    expect(text(scope)).toContain('scope must be "page"');
  });
});
