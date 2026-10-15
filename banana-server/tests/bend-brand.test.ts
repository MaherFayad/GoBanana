import { describe, expect, it } from "vitest";
import { bendBrief, checkCoherence, formatDirections, parseBendInput, readBrand, type BendInput } from "@/lib/bend";
import { logoRules, primaryFromDesignMd, primaryFromTokens } from "@/lib/bend/brand";
import { bendBriefAtlas } from "@/lib/atlas/bend";
import { createAtlasLoader } from "@/lib/atlas/loader";
import { loaderSource } from "@/lib/atlas/source";
import { createBendBriefTool } from "@/lib/mcp/tools/bend_brief";
import { buildFixtureAtlas, countingFetcher } from "./fixtures/atlas-shards";
import { ALICE, makeDeps, text } from "./tools-fixtures";

const DESIGN_MD = `# Acme Pay design

## Colors
- Primary: #1A56DB (buttons, links, focus)
- Surface: #FFFFFF

## Logo
- Keep clear space of 16px around the logo.
- Never recolor or stretch the logo.
`;

const TOKENS = { color: { brand: { primary: { $value: "#0F766E", $type: "color" } }, neutral: { 900: { $value: "#111827" } } } };

const BRIEF: BendInput = { brief: "flight checkout screen", wildness: 4, platform: "mobile", count: 8 };

describe("brand stretch (VAL-07)", () => {
  it("reads the primary from tokens first, then DESIGN.md", () => {
    expect(primaryFromTokens(TOKENS)).toBe("#0F766E");
    expect(primaryFromTokens({ colors: { primary: "#abc" } })).toBe("#AABBCC");
    expect(primaryFromTokens({ colors: { accent: "#ff0000" } })).toBeNull();
    expect(primaryFromDesignMd(DESIGN_MD)).toBe("#1A56DB");
    expect(primaryFromDesignMd("no colors here")).toBeNull();
    expect(readBrand({ designMd: DESIGN_MD, tokens: TOKENS, stretch: "keep-primary" }).primary).toBe("#0F766E");
  });

  it("reads logo rules from DESIGN.md lines, never headings", () => {
    expect(logoRules(DESIGN_MD, undefined)).toEqual(["Keep clear space of 16px around the logo.", "Never recolor or stretch the logo."]);
    expect(logoRules(undefined, { logo: { clearSpace: "16px" } })).toEqual(["logo clearSpace: 16px"]);
  });

  it("keep-logo-and-primary keeps the primary and the logo in every direction", () => {
    const r = bendBrief({ ...BRIEF, brand: { designMd: DESIGN_MD, stretch: "keep-logo-and-primary" } });
    expect(r.brand).toMatchObject({ stretch: "keep-logo-and-primary", primary: "#1A56DB" });
    expect(r.brand?.onPrimary?.hex).toBe("#FFFFFF");
    for (const d of r.directions) {
      expect(d.spec.color).toMatch(/^Brand primary #1A56DB stays the main action and accent color/);
      expect(d.spec.avoid[0]).toContain("Changing, recoloring or crowding the logo: Keep clear space of 16px");
      expect(d.spec.avoid.length).toBeLessThanOrEqual(3);
      expect(d.prompt).toContain("Keep the logo exactly as the brand ships it");
      expect(d.prompt).toContain("Keep the brand primary #1A56DB");
      if (d.mechanic.element === "header") expect(d.mechanic.how).toContain("the logo stays as the brand ships it");
    }
    expect(formatDirections(r)).toContain("Brand stretch keep-logo-and-primary: every direction keeps the brand primary and the logo as shipped. Read: primary #1A56DB, 2 logo rules.");
  });

  it("keep-primary keeps the primary only", () => {
    const r = bendBrief({ ...BRIEF, brand: { tokens: TOKENS, stretch: "keep-primary" } });
    for (const d of r.directions) {
      expect(d.spec.color).toContain("Brand primary #0F766E");
      expect(d.prompt).not.toContain("Keep the logo");
    }
  });

  it("free keeps nothing and names the primary as a reference", () => {
    const plain = bendBrief(BRIEF);
    const r = bendBrief({ ...BRIEF, brand: { tokens: TOKENS, stretch: "free" } });
    r.directions.forEach((d, i) => {
      expect(d.spec.color).toBe(plain.directions[i]!.spec.color);
      expect(d.prompt).toContain("Brand stretch is free: the brand primary #0F766E is a reference, not a rule.");
    });
  });

  it("never moves ids or picks, and keeps checkCoherence passing", () => {
    const plain = bendBrief(BRIEF);
    const r = bendBrief({ ...BRIEF, brand: { designMd: DESIGN_MD, stretch: "keep-logo-and-primary" } });
    expect(r.directions.map((d) => d.id)).toEqual(plain.directions.map((d) => d.id));
    expect(r.directions.map((d) => d.ingredients)).toEqual(plain.directions.map((d) => d.ingredients));
    for (const d of r.directions) expect(checkCoherence(d, r.directions)).toEqual([]);
  });

  it("says so when no primary is found", () => {
    const r = bendBrief({ ...BRIEF, brand: { designMd: "We like calm.", stretch: "keep-primary" } });
    expect(r.brand?.primary).toBeNull();
    for (const d of r.directions) expect(d.prompt).toContain("Keep the brand's primary color as the main action color.");
    expect(formatDirections(r)).toContain("no primary color found");
  });

  it("applies to the Atlas engine too", async () => {
    const { manifest, files } = await buildFixtureAtlas();
    const source = loaderSource(createAtlasLoader({ manifest, fetchShard: countingFetcher(files).fetchShard, budget: 200 }));
    const r = (await bendBriefAtlas({ brief: "eSIM plan picker for a GCC travel app", wildness: 3, brand: { tokens: TOKENS, stretch: "keep-primary" } }, source))!;
    for (const d of r.directions) expect(d.spec.color).toContain("Brand primary #0F766E");
  });

  it("validates the input with a plain message", () => {
    expect(parseBendInput({ brief: "x", wildness: 2, brand: { stretch: "loose" } })).toMatchObject({ ok: false, message: expect.stringContaining("brand needs a stretch") });
    expect(parseBendInput({ brief: "x", wildness: 2, brand: { designMd: "a".repeat(20_001), stretch: "free" } }).ok).toBe(false);
    expect(parseBendInput({ brief: "x", wildness: 2, brand: { tokens: { big: "a".repeat(20_001) }, stretch: "free" } }).ok).toBe(false);
    const ok = parseBendInput({ brief: "x", wildness: 2, brand: { tokens: TOKENS, stretch: "free" } });
    expect(ok.ok && ok.input.brand?.stretch).toBe("free");
  });

  it("bend_brief takes brand and saves the stretched spec", async () => {
    const { repos } = makeDeps();
    const res = await createBendBriefTool(() => ({ repos }))({ ...BRIEF, brand: { designMd: DESIGN_MD, stretch: "keep-logo-and-primary" } }, ALICE);
    expect(text(res)).toContain("Brand stretch keep-logo-and-primary");
    expect(text(res)).not.toMatch(new RegExp("[\\u2013\\u2014]"));
  });
});
