import { describe, expect, it } from "vitest";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";

describe("typeText", () => {
  it("returns a whole multi-line interface, nested blocks included", () => {
    const t = typeText("IngredientCard");
    expect(t.startsWith("export interface IngredientCard {")).toBe(true);
    expect(t.endsWith("}")).toBe(true);
    expect(t).toContain("artQueries: string[];");
    expect(t).toContain("culturalNotes?: string;");
  });

  it("returns one-line interfaces and multi-line type aliases", () => {
    expect(typeText("FitScore")).toMatch(/^export interface FitScore \{.*\}$/);
    const ui = typeText("UiElement");
    expect(ui).toContain('"header"');
    expect(ui.trim().endsWith('"paywall-plan";')).toBe(true);
    expect(typeText("Platform")).toBe('export type Platform = "mobile" | "tablet" | "website" | "webapp";');
  });

  it("joins several and throws on an unknown name", () => {
    expect(typeText("FitScore", "SlopRule").split("\n\n")).toHaveLength(2);
    expect(() => typeText("Nope")).toThrow();
  });

  it("states the plan 6.3 rules", () => {
    expect(PROMPT_RULES).toMatch(/em dash/);
    expect(PROMPT_RULES).toMatch(/tashkeel/);
    expect(PROMPT_RULES).toMatch(/Quranic/);
    expect(PROMPT_RULES).toMatch(/Google Fonts/);
    expect(PROMPT_RULES).not.toMatch(/\u2014/);
  });
});
