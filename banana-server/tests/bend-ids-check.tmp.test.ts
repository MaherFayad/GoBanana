import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
import { bendBrief, formatDirections, LENSES, type Wildness } from "@/lib/bend";
it("check", () => {
  const before = JSON.parse(readFileSync(process.env.SP + "/ids-before.json", "utf8")) as Record<string, string[]>;
  let diff = 0, total = 0;
  for (const [k, ids] of Object.entries(before)) {
    const [b, w, l] = k.split("|");
    const r = bendBrief({ brief: b!, wildness: Number(w) as Wildness, count: 8, ...(l ? { lens: l } : {}) });
    r.directions.forEach((d, i) => { total++; if (d.id !== ids[i]) diff++; });
  }
  console.log("diff", diff, "of", total);
  for (const w of [3, 5] as Wildness[]) console.log(formatDirections(bendBrief({ brief: "flight checkout screen", wildness: w })));
  console.log(formatDirections(bendBrief({ brief: "government e-services portal", wildness: 4, lens: "najdi" })));
  expect(diff).toBe(0);
});
