import { describe, expect, it } from "vitest";
import { clipTitle } from "@/lib/bend/index";

describe("clipTitle", () => {
  it("drops a dangling preposition left by the word cap", () => {
    // Merged bend, rental search: "Al Ahsa Oasis from Above" was cut to "Al Ahsa Oasis from".
    expect(clipTitle("Al Ahsa Oasis from Above")).toBe("Al Ahsa Oasis");
    expect(clipTitle("Light Falling Through Lattice")).toBe("Light Falling Through Lattice");
    expect(clipTitle("Shadows Cast Long Through Windows")).toBe("Shadows Cast Long");
  });
  it("keeps a full title and still cuts at the first comma", () => {
    expect(clipTitle("Gas Station Price Sign")).toBe("Gas Station Price Sign");
    expect(clipTitle("Najdi Doors, painted")).toBe("Najdi Doors");
  });
});
