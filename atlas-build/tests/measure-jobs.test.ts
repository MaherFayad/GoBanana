import { describe, expect, it } from "vitest";
import { parseLines, orderPool } from "../jobs/j9-cc0.ts";
import { candidates } from "../jobs/j12-type.ts";
import { extractHtml } from "../lib/j8.ts";
import { hueName, shares } from "../slop-analyze.ts";

describe("j9 line parser", () => {
  it("reads tags, region and palette, and skips", () => {
    const lines = parseLines("1 | border rhythm; dense repeat grid | palmette; vine scroll | persia | #8A2B1F #d9c49a #1f3a5f\n2 | skip\nnoise\n3 | framed panels | figures | mars | none");
    expect(lines[0]).toEqual({ n: 1, steal: ["border rhythm", "dense repeat grid"], motif: ["palmette", "vine scroll"], region: "persia", palette: ["#8a2b1f", "#d9c49a", "#1f3a5f"] });
    expect(lines[1]).toEqual({ n: 2, skip: true });
    expect(lines[2]).toMatchObject({ n: 3, region: undefined, palette: [] });
  });

  it("interleaves categories and drops duplicate ids", () => {
    const it = (id: string, category: string, museum: string) => ({ id, category, museum, title: id, imageUrl: "https://x", thumbUrl: "https://x", pageUrl: "https://x", rights: { flag: "f", value: "v" } }) as never;
    const out = orderPool([it("a", "maps", "cleveland"), it("b", "maps", "cleveland"), it("c", "textiles", "met"), it("a", "maps", "cleveland")]);
    expect(out.map((x: { id: string }) => x.id)).toEqual(["c", "a", "b"]);
  });
});

describe("j12 candidates", () => {
  it("makes 30 unique pairs per voice", () => {
    const c = candidates();
    expect(c.length).toBe(300);
    expect(new Set(c.map((q) => [q.ld, q.lb, q.ad, q.ab].join("|"))).size).toBe(300);
  });
});

describe("j8 slop helpers", () => {
  it("names hues and ignores greys", () => {
    expect(hueName("rgb(99, 102, 241)")).toBe("indigo");
    expect(hueName("rgb(120, 120, 120)")).toBeNull();
    expect(hueName("rgba(99, 102, 241, 0.1)")).toBeNull();
  });

  it("computes shares per value", () => {
    const empty = { font: [], "accent-hue": [], radius: [], gradient: [], layout: [], shadow: [], copy: [] };
    const r = shares([{ ...empty, font: ["body Inter"] }, { ...empty, font: ["body Inter"] }, { ...empty, font: ["body Roboto"] }, empty], 0.3);
    expect(r).toEqual([{ feature: "font", value: "body Inter", share: 0.5 }]);
  });

  it("extracts the HTML document from a reply", () => {
    expect(extractHtml("Here:\n```html\n<!DOCTYPE html><html></html>\n```")).toBe("<!DOCTYPE html><html></html>");
    expect(extractHtml("no page")).toBeNull();
  });
});
