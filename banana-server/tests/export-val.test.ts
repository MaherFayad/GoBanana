/** VAL-06 pitch deck and VAL-12 experiment export. */
import { describe, expect, it } from "vitest";
import { exportKit, EXPORT_FORMATS } from "../lib/export";
import { EXPORT_FORMATS as QUOTA_FORMATS } from "../lib/quota";
import { checkoutCanvas } from "./export-fixtures";

describe("pitch_md and experiment_md", () => {
  it("are in the export and the plan lists", () => {
    expect(EXPORT_FORMATS).toContain("pitch_md");
    expect(QUOTA_FORMATS).toContain("experiment_md");
  });

  it("pitch deck: one slide per section, source links kept, no em dash", () => {
    const [f] = exportKit(checkoutCanvas, ["pitch_md"]);
    expect(f!.path).toMatch(/\/PITCH\.md$/);
    expect(f!.content).toContain("Idea:");
    for (const part of ["Mechanic", "References", "Palette", "Type"]) expect(f!.content).toContain(`${part}\n`);
    expect(f!.content).toContain("https://www.pinterest.com/pin/412783122093847261/");
    expect(f!.content).not.toContain("—");
    expect(f!.content.split("\n---\n").length).toBeGreaterThan(4);
  });

  it("experiment: two flagged variants, events and a test plan", () => {
    const [f] = exportKit(checkoutCanvas, ["experiment_md"]);
    expect(f!.content).toContain("### Variant A:");
    expect(f!.content).toContain("### Variant B:");
    expect(f!.content).toMatch(/`wild_[a-z0-9_]+_viewed`/);
    expect(f!.content).toContain("## Test plan");
    expect(f!.content).not.toContain("—");
  });

  it("experiment with one kept direction runs it against the current page", () => {
    const [f] = exportKit(checkoutCanvas, ["experiment_md"], { directionId: "d1" });
    expect(f!.content).toContain("Control (the current page)");
  });
});
