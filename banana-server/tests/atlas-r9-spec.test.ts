/**
 * R9: the direction spec agrees with itself and with the page (lib/atlas/spec-coherence.ts). The
 * second card's texture and motion act on this page's parts, every color the text names is in the
 * palette, and the spacing words agree with the card's density.
 */
import { describe, expect, it } from "vitest";
import { coherentMechanic, coherentSpec, colorLine, densityLine, densityWords, motionLine, paletteColors, placeTexture, reducedOnPart, textureLine, type SpecPart } from "@/lib/atlas/spec-coherence";
import type { IngredientCard } from "@/lib/atlas/types";
import type { VisualSpec } from "@/lib/direction-detail";
import { PLATFORM_PROFILES } from "@/lib/platform";
import { taskSteps } from "@/lib/stitch/bend-lines";
import { CARDS } from "./fixtures/atlas";

const SOUQ: IngredientCard["palette"] = [
  { hex: "#f7f3ea", role: "surface", name: "sign board enamel white" },
  { hex: "#161616", role: "ink", name: "sign painter black" },
  { hex: "#d22b2b", role: "accent", name: "shopfront red" },
  { hex: "#1f4fa3", role: "support", name: "cobalt shadow blue" },
  { hex: "#e3b023", role: "support", name: "mustard trim yellow" },
];
const APRICOT: IngredientCard["palette"] = [
  { hex: "#f9ead2", role: "surface", name: "apricot cream" },
  { hex: "#3b1c0c", role: "ink", name: "dried pit" },
  { hex: "#d9661b", role: "accent", name: "apricot amber" },
];

const lead: IngredientCard = { ...CARDS[0]!, name: "Hand-Painted Souq Shop Sign", palette: SOUQ, density: "dense", texture: "Visible brush edge on the header board letters only", motion: { verb: "Swings", ms: 300, reduced: "The sign shows its final angle" } };
const honey: IngredientCard = { ...CARDS[1]!, name: "Asiri Mountain Honey", motion: { verb: "Settles", ms: 480, reduced: "The fill level swaps instantly to its new height with no tilt." } };
const rock: IngredientCard = { ...CARDS[1]!, name: "Qatari Al Jassasiya Rock Carvings", texture: "Pecked cup marks in two parallel rows, on one progress or stats card only. The current mark fills with low sun amber." };
const parts: SpecPart[] = [
  { element: "card", label: "deal cards", how: "Each deal is a painted board" },
  { element: "hero", label: "season banner", how: "The banner is one long shop sign" },
  { element: "chart", label: "savings meter", how: "The meter is a hand-lettered gauge" },
];
const task = "The main task, pick a deal and order, now runs through the deal cards: each deal is a painted board.";

describe("R9 second card lines act on this page", () => {
  it("moves a borrowed texture's own place onto the page part it names", () => {
    const { line } = textureLine({ lead, second: rock, adds: "texture", platform: "mobile", parts, task });
    expect(line).toContain("on the savings meter only");
    expect(line).not.toContain("progress or stats card");
    expect(line).toContain("Pecked cup marks");
    expect(line).toMatch(/^The twist, the surface of Qatari Al Jassasiya Rock Carvings: /);
  });

  it("says why the twist is there, in this page's words", () => {
    const why = { ...rock, surprise: "Small hollows carved in rows become a tactile dot system for the UI. They read like a record left by hand." };
    expect(textureLine({ lead, second: why, adds: "texture", platform: "mobile", parts, task, pageLabel: "offers page" }).line).toMatch(/^The twist, the surface of Qatari Al Jassasiya Rock Carvings: small hollows carved in rows become a tactile dot system for the offers page\. /);
  });

  it("lands a borrowed texture that names no place on a part other than the task part", () => {
    const glow: IngredientCard = { ...rock, name: "City Lights at Night", texture: "A soft 12 px glow, nothing else glows." };
    expect(textureLine({ lead, second: glow, adds: "texture", platform: "mobile", parts, task }).line).toMatch(/\. On the season banner only: a soft 12 px glow/);
    // A borrowed texture whose own place is the task part moves off it (the lead's material lives there).
    const deal: IngredientCard = { ...rock, texture: "Grain on one feature card only." };
    expect(textureLine({ lead, second: deal, adds: "texture", platform: "mobile", parts, task }).line).toContain("on the season banner only");
  });

  it("keeps the last word of a place as its noun and drops later places of the card's world", () => {
    const { text, part } = placeTexture("Matte clay sheen only on the step header card, sitting on a twill weave on the sash card.", parts, "deal cards");
    expect(part?.label).toBe("season banner");
    expect(text).toBe("Matte clay sheen only on the season banner, sitting on a twill weave there.");
    expect(placeTexture("The parts list card carries a hairline grid.", parts, "deal cards").text).toBe("On the deal cards: a hairline grid.");
  });

  it("puts the borrowed motion's verb on the task part, timed to the main task, with the card's objects gone", () => {
    const line = motionLine({ lead, second: honey, adds: "motion", platform: "mobile", parts, task });
    expect(line).toBe("The twist, the motion of Asiri Mountain Honey. Settles in 480ms on the deal cards, each time the main task moves on (pick a deal and order); with reduced motion on, it swaps instantly to its new height with no tilt.");
    const slow = { ...honey, surprise: "Honey gives the UI a two-grade color system. It pours with a heavy, settling motion." };
    expect(motionLine({ lead, second: slow, adds: "motion", platform: "mobile", parts, task })).toMatch(/^The twist, the motion of Asiri Mountain Honey: it pours with a heavy, settling motion\. Settles/);
    expect(line).not.toMatch(/fill level/);
  });

  it("keeps the lead's own motion, with the reduced text in lower case", () => {
    expect(motionLine({ lead, second: honey, adds: "texture", platform: "mobile", parts, task })).toBe("Swings in 300ms; with reduced motion on, the sign shows its final angle.");
    expect(reducedOnPart("Instant swap to the open panel.")).toBe("instant swap to the open panel");
    expect(reducedOnPart("Envelope swaps to its open state with a 120 ms fade")).toBe("it swaps to its open state with a 120 ms fade");
  });
});

describe("R9 colors come from the palette", () => {
  it("keeps colors the palette names or holds, and lists every palette color by name", () => {
    expect(paletteColors("A hard offset shadow in cobalt, and red", SOUQ)).toBe("A hard offset shadow in cobalt shadow blue, and shopfront red");
    expect(paletteColors("Big price in white on black", SOUQ)).toBe("Big price in sign board enamel white on sign painter black");
    expect(paletteColors("The mark fills with low sun yellow", SOUQ)).toBe("The mark fills with mustard trim yellow");
    expect(paletteColors("Edges in shopfront red", SOUQ)).toBe("Edges in shopfront red");
    expect(colorLine({ name: "Souq", palette: SOUQ, shipPairs: [] })).toContain("support cobalt shadow blue #1F4FA3, support mustard trim yellow #E3B023");
  });

  it("swaps a color the palette does not hold for the nearest palette color", () => {
    expect(paletteColors("The card runs from a heartwood-red core to a teal edge.", APRICOT)).toBe("The card runs from an apricot amber core to an apricot amber edge.");
    expect(paletteColors("A green credit counter", SOUQ)).not.toMatch(/\bgreen\b/);
    expect(paletteColors("Accent #00FF00 glow", APRICOT)).not.toContain("#00FF00");
  });

  it("keeps the verb and subject before a color word, and leaves white space alone", () => {
    expect(paletteColors("The bar glows red", SOUQ)).toBe("The bar glows shopfront red");
    expect(paletteColors("Buttons fill yellow on tap", SOUQ)).toBe("Buttons fill mustard trim yellow on tap");
    expect(paletteColors("Plenty of white space between rows", APRICOT)).toBe("Plenty of white space between rows");
  });

  it("never touches card names that hold a color word", () => {
    expect(paletteColors("One rule from White Text on Color: pink panels", APRICOT, ["White Text on Color"])).toBe("One rule from White Text on Color: apricot amber panels");
  });

  it("applies to the texture, motion and mechanic lines, not to the imagery or avoid lines", () => {
    const pinkLead: IngredientCard = { ...lead, palette: APRICOT, texture: "A violet rim on the hero card" };
    const spec = { layout: "The deal cards glow green.", signature: "s", pattern: "p", whyItFits: "w", imagery: "Photos of a green souq door.", avoid: ["Violet gradients."], steal: ["The surface: x"], texture: "", motion: "", density: "" } as unknown as VisualSpec;
    const out = coherentSpec(spec, { lead: pinkLead, second: null, adds: null, platform: "mobile", parts, task });
    expect(out.texture).not.toMatch(/violet/);
    expect(out.layout).not.toMatch(/green/);
    expect(out.imagery).toBe("Photos of a green souq door.");
    expect(out.avoid).toEqual(["Violet gradients."]);
    expect(out.steal[0]).toMatch(/^The surface: .*on the season banner/);
    const dm = coherentMechanic({ element: "header", how: "A blue banner", parts: [{ element: "hero", label: "season banner", how: "A purple band" }] }, { lead: pinkLead, second: null });
    expect(dm.how).not.toMatch(/blue/);
    expect(dm.parts![0]!.how).not.toMatch(/purple/);
  });
});

describe("R9 Bend it lines give the build order and the brief's uncovered steps", () => {
  it("names the task part first and adds a slot line for a listed step no part carries", () => {
    const mechanic = {
      element: "plan",
      how: "Two plans sit in brass pans",
      parts: [
        { element: "paywall-plan", label: "plan column headers", how: "Two plans sit in brass pans" },
        { element: "list-row", label: "feature comparison rows", how: "Rows are teak strips" },
      ],
      task: "The main task, compare speeds and prices, book installation, now runs through the plan column headers: two plans sit in brass pans.",
    };
    const lines = taskSteps(mechanic, mechanic.parts, "");
    expect(lines[0]).toBe("- Build first: the plan column headers, where the main task runs; then the other bent parts; the plain slots last.");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/^- book installation: no bent part carries this step yet; give it its own slot right after the plan column headers/);
  });

  it("counts a one-word first step as the carried one, not the next step", () => {
    const parts = [{ element: "search", label: "search field", how: "A long plot" }];
    const lines = taskSteps({ element: "search", how: "x", parts, task: "The main task, search, compare speeds and prices, book installation, now runs through the search field: x." }, parts, "");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^- compare speeds and prices: no bent part carries/);
    expect(lines[2]).toMatch(/^- book installation: no bent part carries/);
  });

  it("adds nothing for a task phrase the brief does not list", () => {
    expect(taskSteps({ element: "hero", how: "x", task: "The main task, the first impression, now runs through the hero: x." }, [], "")).toHaveLength(1);
    expect(taskSteps({ element: "hero", how: "x" }, [], "")).toEqual([]);
  });
});

describe("R9 density words agree with the card", () => {
  it("a dense card never reads generous, airy or comfortable", () => {
    for (const p of Object.keys(PLATFORM_PROFILES) as Array<keyof typeof PLATFORM_PROFILES>) {
      const line = densityLine("dense", p);
      expect(line, p).toMatch(/^Dense; /);
      expect(line, p).not.toMatch(/generous|airy|comfortable|one message per screen height/i);
    }
    expect(densityLine("dense", "mobile")).toBe("Dense; several facts per screen, 44pt tap targets, tight spacing on an 8pt rhythm.");
  });

  it("an airy card never reads dense, compact or tight", () => {
    for (const p of Object.keys(PLATFORM_PROFILES) as Array<keyof typeof PLATFORM_PROFILES>) {
      const line = densityLine("airy", p);
      expect(line, p).toMatch(/^Airy; /);
      expect(line.slice(6), p).not.toMatch(/\b(dense|compact|tight|packed|crowded)\b/i);
    }
    expect(densityLine("airy", "webapp")).toBe("Airy; open, 8px rhythm, roomy tables and filters, every action reachable by keyboard.");
  });

  it("a balanced card keeps the platform words, without the extremes", () => {
    expect(densityLine("balanced", "mobile")).toBe(`Balanced; ${PLATFORM_PROFILES.mobile.density.replace(/^./, (c) => c.toLowerCase())}`);
    expect(densityLine("balanced", "webapp")).toMatch(/^Balanced; even, 8px rhythm/);
    expect(densityWords("Generous spacing, airy hero", "dense")).toBe("Tight spacing, dense hero");
  });

  it("fixes spacing words in the layout line too", () => {
    const spec = { layout: "Rows sit with generous spacing.", signature: "", pattern: "", whyItFits: "", steal: [], texture: "", motion: "", density: "" } as unknown as VisualSpec;
    expect(coherentSpec(spec, { lead, second: null, adds: null, platform: "mobile", parts, task }).layout).toBe("Rows sit with tight spacing.");
  });
});
