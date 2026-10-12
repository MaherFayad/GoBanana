/** Wild directions v2 exports: page scope, new formats, platform defaults, type voice and paths. */
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import type { CanvasSnapshot } from "../lib/canvas/types";
import { buildKitModel, exportKit, type ExportFile } from "../lib/export";
import { inferPlatform } from "../lib/export/platform";
import { globsFor, inferPages, pageGlobs } from "../lib/export/scope";
import { checkoutCanvas, financeCanvas, hostileCanvas } from "./export-fixtures";

function file(files: ExportFile[], name: string): string {
  const f = files.find((x) => x.name === name);
  if (!f) throw new Error(`missing ${name}`);
  return f.content;
}

function frontMatter(md: string): Record<string, unknown> {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (!m?.[1]) throw new Error("no front matter");
  return parseYaml(m[1]) as Record<string, unknown>;
}

const withBrief = (brief: string): CanvasSnapshot => ({ ...hostileCanvas, title: "Board", brief, items: hostileCanvas.items.filter((i) => i.type !== "typeSample") });

describe("scope", () => {
  it("defaults to page scope: DESIGN.md is a spike under design/explorations, not the product system", () => {
    const [design] = exportKit(financeCanvas, ["design_md"]);
    expect(design!.path).toBe("design/explorations/balance-as-a-pawn-shop-ticket/DESIGN.md");
    expect(design!.content).not.toContain("Do use only the tokens in the front matter for production screens.");
    expect(design!.content).toContain("Do use these tokens only on home screen");
    expect(frontMatter(design!.content).description).toMatch(/^Page level exploration for home screen: Balance as a pawn shop ticket\. Does not change the product design system\.$/);
  });

  it("system scope keeps the old behavior with root paths and no scope block", () => {
    const files = exportKit(financeCanvas, ["design_md", "agents_md", "tokens", "tailwind"], { scope: "system" });
    const dir = "design/explorations/balance-as-a-pawn-shop-ticket";
    expect(files.map((f) => f.path)).toEqual(["DESIGN.md", "AGENTS.md", `${dir}/kit/tokens.json`, `${dir}/kit/theme.css`]);
    const design = file(files, "DESIGN.md");
    expect(design).toContain("Do use only the tokens in the front matter for production screens.");
    expect(design).not.toContain("Scope: one wild page");
    expect(file(files, "theme.css")).toContain("@theme {");
    expect(files.map((f) => f.append ?? false)).toEqual([false, true, false, false]);
  });

  it("writes page scope tokens as a wrapper override, never a global @theme", () => {
    const css = file(exportKit(financeCanvas, ["tailwind"]), "theme.css");
    expect(css).not.toContain("@theme");
    expect(css).toContain('[data-wild-page="balance-as-a-pawn-shop-ticket"] {');
    expect(css).toContain("--color-primary: #b3261e;");
    const tokens = JSON.parse(file(exportKit(financeCanvas, ["tokens"]), "tokens.json")) as { $extensions: { scope: Record<string, unknown> } };
    expect(tokens.$extensions.scope).toMatchObject({ scope: "page", pages: ["home screen"], appliesTo: ["**/home/**", "**/home.*"], platform: "mobile" });
  });
});

describe("directions and status", () => {
  it("reads unrated directions as not rated yet, never as tried and not kept", () => {
    const files = exportKit(financeCanvas, ["design_md", "brief"]);
    const design = file(files, "DESIGN.md");
    expect(design).not.toMatch(/not kept/i);
    expect(design).toContain("Directions not rated yet: Ledger as a 1980s bank statement.");
    const brief = file(files, "BRIEF.md");
    expect(brief).not.toMatch(/not kept/i);
    expect(brief).toContain('Not rated yet: its section "80s statement" has no references.');
    expect(brief).toContain('Kept: 2 references in "Pawn ticket".');
  });

  it("uses the verdict over references, and keeps the old rule when nothing is rated", () => {
    const m = buildKitModel(financeCanvas);
    expect(m.directions.map((d) => d.status)).toEqual(["kept", "unrated"]);
    expect(m.focus.map((d) => d.direction.id)).toEqual(["f1"]);
    expect(buildKitModel(checkoutCanvas).directions.map((d) => d.status)).toEqual(["kept", "kept", "unrated"]);
    const dropped: CanvasSnapshot = {
      ...financeCanvas,
      directions: financeCanvas.directions.map((d) => (d.id === "f1" ? { ...d, detail: { ...d.detail, verdict: "drop" as const } } : d)),
    };
    const md = buildKitModel(dropped);
    expect(md.directions[0]!.status).toBe("dropped");
    // Nothing kept: every direction that was not dropped is in focus.
    expect(md.focus.map((d) => d.direction.id)).toEqual(["f2"]);
    expect(exportKit(dropped, ["design_md"])[0]!.content).toContain("Directions dropped: Balance as a pawn shop ticket.");
  });

  it("exports one direction with directionId and names the folder after it", () => {
    const files = exportKit(financeCanvas, ["direction_md"], { directionId: "f2" });
    expect(files[0]!.path).toBe("design/explorations/ledger-as-a-1980s-bank-statement/DIRECTION.md");
    expect(files[0]!.content).toContain("# Wild direction: Ledger as a 1980s bank statement");
    expect(files[0]!.content).toContain("No visual spec was saved for this direction.");
    expect(files[0]!.content).not.toContain("Balance as a pawn shop ticket");
  });

  it("tolerates junk in the saved detail", () => {
    const junk = { ...financeCanvas, directions: [{ ...financeCanvas.directions[0]!, detail: { platform: "fridge", pages: "home", spec: { typography: 42, steal: "x" }, verdict: "maybe" } as never }] };
    const m = buildKitModel(junk);
    expect(m.directions[0]!.detail).toEqual({});
    expect(m.platform.id).toBe("mobile"); // falls back to the brief
    expect(() => exportKit(junk, ["direction_md", "build_prompt", "review", "cursor_rules", "copilot", "claude_md"])).not.toThrow();
  });
});

describe("pages and paths", () => {
  it("maps routes, names and globs to file globs", () => {
    expect(pageGlobs("app/pricing/**")).toEqual(["app/pricing/**"]);
    expect(pageGlobs("/launch")).toEqual(["**/launch/**", "**/launch.*"]);
    expect(pageGlobs("/")).toEqual(["**/app/page.*", "**/pages/index.*"]);
    expect(pageGlobs("pricing page")).toEqual(["**/pricing/**", "**/pricing.*"]);
    expect(pageGlobs("Year in review")).toEqual(["**/year-in-review/**", "**/year-in-review.*"]);
    expect(pageGlobs("../../etc/**")).toEqual(["etc/**"]);
    expect(globsFor(["/launch", "/launch"])).toEqual(["**/launch/**", "**/launch.*"]);
    expect(inferPages("personal finance app home screen on iPhone")).toEqual(["home screen"]);
    expect(inferPages("a moodboard")).toEqual([]);
  });

  it("uses the pages option over saved pages, at most 5", () => {
    const m = buildKitModel(financeCanvas, { pages: ["app/pricing/**", "/launch", "a", "b", "c", "d"] });
    expect(m.pages).toEqual(["app/pricing/**", "/launch", "a", "b", "c"]);
    expect(m.globs.slice(0, 3)).toEqual(["app/pricing/**", "**/launch/**", "**/launch.*"]);
  });

  it("writes Cursor and Copilot rules with globs from the pages", () => {
    const files = exportKit(financeCanvas, ["cursor_rules", "copilot", "claude_md"], { pages: ["app/(tabs)/home/**", "/wallet"] });
    const [cursor, copilot, claude] = files;
    expect(cursor!.path).toBe(".cursor/rules/gobanana-balance-as-a-pawn-shop-ticket.mdc");
    const cfm = frontMatter(cursor!.content);
    expect(cfm).toEqual({
      description: expect.stringContaining("visual direction for app/(tabs)/home/**, /wallet only"),
      globs: "app/(tabs)/home/**,**/wallet/**,**/wallet.*",
      alwaysApply: false,
    });
    expect(cursor!.content).toContain("Full spec: @design/explorations/balance-as-a-pawn-shop-ticket/DIRECTION.md");
    expect(copilot!.path).toBe(".github/instructions/gobanana-balance-as-a-pawn-shop-ticket.instructions.md");
    expect(frontMatter(copilot!.content).applyTo).toBe("app/(tabs)/home/**,**/wallet/**,**/wallet.*");
    expect(claude!.append).toBe(true);
    expect(claude!.content.startsWith("<!-- gobanana:balance-as-a-pawn-shop-ticket -->\n## Wild page: Balance as a pawn shop ticket\n\n> **Scope")).toBe(true);
    expect(claude!.content.endsWith("<!-- /gobanana:balance-as-a-pawn-shop-ticket -->\n")).toBe(true);
    // One slug across every file of a call.
    expect(cursor!.path).toContain("balance-as-a-pawn-shop-ticket");
    expect(claude!.content).toContain("\n@design/explorations/balance-as-a-pawn-shop-ticket/DIRECTION.md\n");
  });

  it("points Copilot at the spike folder when no page could be found", () => {
    const copilot = exportKit(withBrief("a moodboard"), ["copilot"])[0]!.content;
    expect(frontMatter(copilot).applyTo).toBe("design/explorations/board/**");
    expect(copilot).toContain("Change it to the files of");
  });
});

describe("new formats", () => {
  const files = exportKit(financeCanvas, ["direction_md", "build_prompt", "review", "agents_md"]);

  it("DIRECTION.md holds the full visual spec, art and UI references with steal notes, ship vs explore", () => {
    const md = file(files, "DIRECTION.md");
    for (const h of ["## 1. Balance as a pawn shop ticket", "### Visual spec", "### Steal", "### Avoid", "### Why it fits", "### Art direction references", "### UI references", "## Platform defaults", "## Type", "## Colors: ship vs explore", "## Sources"]) {
      expect(md, h).toContain(h);
    }
    for (const label of ["Typography", "Color", "Layout", "Imagery", "Motion", "Texture", "Iconography", "Density", "Signature component", "Pattern"]) {
      expect(md).toContain(`**${label}:**`);
    }
    const art = md.slice(md.indexOf("### Art direction references"), md.indexOf("### UI references"));
    expect(art).toContain("<https://www.pinterest.com/pin/123456789012345678/> What to steal: steal: the stamped date as a section divider");
    expect(art).not.toContain("dribbble");
    expect(md.slice(md.indexOf("### UI references"))).toContain("<https://dribbble.com/shots/24000001-Wallet-Home-Screen>");
    expect(md).toContain("Status: kept.");
    expect(md).toContain("Explore colors (concept only");
  });

  it("BUILD-PROMPT.md builds exactly the named pages with platform, accessibility and reduced motion", () => {
    const md = file(files, "BUILD-PROMPT.md");
    expect(md).toContain("Build exactly these pages and nothing else: home screen (`**/home/**`, `**/home.*`). Platform: Mobile app (phone).");
    expect(md).toContain("Claude Code, Cursor, v0 or Lovable");
    expect(md).toContain("### Platform constraints");
    expect(md).toContain("safe areas");
    expect(md).toContain("prefers-reduced-motion");
    expect(md).toContain("Do not copy, trace or embed the reference images.");
    expect(md).toContain("https://www.pinterest.com/pin/123456789012345678/");
    expect(md).toContain("### Accessibility (WCAG 2.2 AA)");
  });

  it("REVIEW.md grades each axis, the platform, WCAG 2.2 AA and the scope", () => {
    const md = file(files, "REVIEW.md");
    expect(md).toContain("- [ ] **Typography:** Condensed serif numerals");
    expect(md).toContain("- [ ] **Avoid:** The page does not do this: tiny stamp text under 15px");
    expect(md).toContain("- [ ] **Platform:** Every touch target is at least 44 by 44 pt");
    for (const sc of ["1.4.3", "1.4.11", "2.4.11", "2.5.8", "1.4.10", "2.5.7"]) expect(md).toContain(sc);
    expect(md).toContain("`git diff --stat` touches only home screen");
    expect(md).toContain("390 by 844");
  });

  it("AGENTS.md is a scoped section, not a global token rule", () => {
    const md = file(files, "AGENTS.md");
    expect(md).toContain("## Wild page: Balance as a pawn shop ticket");
    expect(md).toContain("Applies to: `**/home/**`, `**/home.*` (home screen).");
    expect(md).toContain("never add them to the global theme");
    expect(md).not.toContain("Use only its tokens");
  });
});

describe("platform defaults", () => {
  it("guesses the platform from the brief", () => {
    expect(inferPlatform("personal finance app home screen on iPhone")).toBe("mobile");
    expect(inferPlatform("iPad sketching app")).toBe("tablet");
    expect(inferPlatform("SaaS analytics dashboard")).toBe("webapp");
    expect(inferPlatform("launch page for a coffee brand")).toBe("website");
    expect(inferPlatform("a poster")).toBe("any");
  });

  it("gives a phone 4 columns, 34px display, 17px body and no 12 column grid", () => {
    const m = buildKitModel(financeCanvas);
    expect(m.platform.id).toBe("mobile");
    expect(m.typography.map((t) => t.fontSize.value)).toEqual([34, 28, 17, 15]);
    const design = file(exportKit(financeCanvas, ["design_md"]), "DESIGN.md");
    expect(design).toContain("4 columns with 16px side margins");
    expect(design).toContain("44 by 44 pt");
    expect(design).not.toMatch(/12 column/);
    expect(frontMatter(design).typography).toMatchObject({ display: { fontSize: "34px" }, body: { fontSize: "17px" } });
  });

  it("gives a tablet 8 columns", () => {
    const m = buildKitModel(withBrief("iPad recipe app"));
    expect(m.platform.columns).toBe("8 columns");
    expect(file(exportKit(withBrief("iPad recipe app"), ["design_md"]), "DESIGN.md")).toContain("8 columns with 24px side margins");
  });

  it("gives a website 12 columns and fluid clamp() type", () => {
    const snap = withBrief("launch page for a coffee brand");
    const m = buildKitModel(snap);
    expect(m.platform.id).toBe("website");
    const files = exportKit(snap, ["design_md", "tailwind", "build_prompt"]);
    expect(file(files, "DESIGN.md")).toContain("12 columns inside a 1200px max width");
    expect(file(files, "theme.css")).toContain("--text-display: clamp(2.5rem, 1.5rem + 4vw, 4rem);");
    expect(file(files, "BUILD-PROMPT.md")).toContain("clamp(");
    const system = file(exportKit(snap, ["tailwind"], { scope: "system" }), "theme.css");
    expect(system.indexOf(":root {")).toBeLessThan(system.indexOf("@theme {"));
  });

  it("gives a web app a sidebar shell, dense rhythm and 14px body", () => {
    const m = buildKitModel(withBrief("SaaS analytics dashboard"));
    expect(m.platform.id).toBe("webapp");
    expect(m.typography.find((t) => t.name === "body")!.fontSize.value).toBe(14);
    const md = file(exportKit(withBrief("SaaS analytics dashboard"), ["direction_md"]), "DIRECTION.md");
    expect(md).toContain("sidebar shell");
    expect(md).toMatch(/keyboard/i);
    expect(md).toContain("tabular figures");
  });

  it("prefers the direction's saved platform over the brief", () => {
    const snap = { ...financeCanvas, brief: "SaaS analytics dashboard" };
    expect(buildKitModel(snap).platform.id).toBe("mobile");
    expect(buildKitModel(snap).platformFrom).toBe("direction");
  });
});

describe("font pairing", () => {
  it("picks the pairing from the direction's type voice", () => {
    const m = buildKitModel(financeCanvas);
    expect(m.pairingFrom).toBe("voice");
    expect(m.pairing.id).toBe("instrument-serif-inter-tight");
    expect(file(exportKit(financeCanvas, ["design_md"]), "DESIGN.md")).toContain("Picked for the direction's serif editorial type voice.");
  });

  it("lets a type sample on the canvas win, and falls back to the default", () => {
    const withSample: CanvasSnapshot = {
      ...financeCanvas,
      items: [...financeCanvas.items, { id: "ts", type: "typeSample", sectionId: "fs1", x: 20, y: 300, w: 200, h: 100, pairingId: "syne-dm-sans" }],
    };
    expect(buildKitModel(withSample).pairing.id).toBe("syne-dm-sans");
    const rounded: CanvasSnapshot = {
      ...financeCanvas,
      directions: financeCanvas.directions.map((d) => (d.id === "f1" ? { ...d, detail: { ...d.detail, spec: { ...d.detail!.spec!, typeVoice: "rounded" as const } } } : d)),
    };
    expect(buildKitModel(rounded).pairing.id).toBe("fredoka-nunito");
    expect(buildKitModel(withBrief("a poster")).pairingFrom).toBe("default");
  });
});
