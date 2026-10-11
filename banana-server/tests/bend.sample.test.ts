import { describe, expect, it } from "vitest";
import { bendBrief, formatDirections, type Wildness } from "@/lib/bend";

/**
 * Prints directions for the 10 M2 sample briefs at wildness 1, 3 and 5 so people
 * can eyeball quality. Run: npx vitest run tests/bend.sample --silent=false
 */
const SAMPLE_BRIEFS = [
  "flight checkout screen",
  "banking app onboarding",
  "hotel booking page",
  "fitness tracker dashboard",
  "coffee shop landing page",
  "ride sharing home screen",
  "podcast player",
  "government e-services portal",
  "food delivery cart",
  "music festival ticketing",
];

describe("bend samples", () => {
  for (const brief of SAMPLE_BRIEFS) {
    it(brief, () => {
      for (const wildness of [1, 3, 5] as Wildness[]) {
        const result = bendBrief({ brief, wildness });
        expect(result.directions).toHaveLength(6);
        console.log(formatDirections(result) + "\n");
      }
    });
  }
});
