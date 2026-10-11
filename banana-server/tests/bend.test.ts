import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  bendBrief,
  LENSES,
  LISTS,
  MAX_QUERY_WORDS,
  MOVES,
  parseBendInput,
  type MoveId,
  type Wildness,
} from "@/lib/bend";
import { LAYOUT_WORDS } from "@/lib/bend/lists";
import { extractSubject } from "@/lib/bend/subject";
import { MODIFIER_TEMPLATES, PRIMARY_TEMPLATES, PROMPT_CLAUSES } from "@/lib/bend/templates";

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

const BEND_DIR = fileURLToPath(new URL("../lib/bend/", import.meta.url));
const LEVELS: Wildness[] = [1, 2, 3, 4, 5];
const words = (s: string) => s.split(/\s+/).filter(Boolean);

function allBendFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? allBendFiles(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe("determinism", () => {
  it("gives the same output for the same input", () => {
    for (const w of LEVELS) {
      const input = { brief: "flight checkout screen", wildness: w, count: 8 };
      expect(bendBrief(input)).toEqual(bendBrief({ ...input }));
    }
    const withLens = { brief: "hotel booking page", wildness: 4 as const, lens: "sadu", moves: ["era", "material"] as MoveId[] };
    expect(bendBrief(withLens)).toEqual(bendBrief({ ...withLens, moves: ["material", "era"] }));
  });

  it("ignores case and extra spaces in the brief", () => {
    const a = bendBrief({ brief: "Flight  checkout screen ", wildness: 3 });
    const b = bendBrief({ brief: "flight checkout screen", wildness: 3 });
    expect(a.directions).toEqual(b.directions);
  });

  it("gives different output for a different brief, wildness or lens", () => {
    const base = bendBrief({ brief: "flight checkout screen", wildness: 3 });
    expect(bendBrief({ brief: "podcast player", wildness: 3 }).directions).not.toEqual(base.directions);
    expect(bendBrief({ brief: "flight checkout screen", wildness: 4 }).directions).not.toEqual(base.directions);
    expect(bendBrief({ brief: "flight checkout screen", wildness: 3, lens: "najdi" }).directions).not.toEqual(base.directions);
  });

  it("keeps ids stable and unique, and a larger count only appends", () => {
    const six = bendBrief({ brief: "podcast player", wildness: 5 });
    const eight = bendBrief({ brief: "podcast player", wildness: 5, count: 8 });
    expect(eight.directions.slice(0, 6)).toEqual(six.directions);
    const ids = eight.directions.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^bd-[0-9a-z]{8}$/);
  });
});

describe("wildness rules", () => {
  it("uses the right number of moves per level", () => {
    for (const brief of SAMPLE_BRIEFS) {
      const counts = (w: Wildness) => bendBrief({ brief, wildness: w, count: 8 }).directions.map((d) => d.moves.length);
      expect(counts(1).every((n) => n === 1)).toBe(true);
      expect(counts(2).every((n) => n === 1)).toBe(true);
      expect(counts(3).every((n) => n === 2)).toBe(true);
      const four = counts(4);
      expect(four.every((n) => n === 2 || n === 3)).toBe(true);
      expect(four).toContain(2);
      expect(four).toContain(3);
      expect(counts(5).every((n) => n === 3)).toBe(true);
    }
  });

  it("joins combined moves with a plus and never repeats a move in one direction", () => {
    for (const d of bendBrief({ brief: "food delivery cart", wildness: 5, count: 8 }).directions) {
      expect(d.move).toBe(d.moves.join(" + "));
      expect(new Set(d.moves).size).toBe(d.moves.length);
    }
  });

  it("covers all six moves at wildness 1 with six directions", () => {
    const moves = bendBrief({ brief: "banking app onboarding", wildness: 1 }).directions.map((d) => d.moves[0]);
    expect(new Set(moves)).toEqual(new Set(MOVES));
  });

  it("keeps layout words in the query at 1 and drops them at 2 and up", () => {
    for (const d of bendBrief({ brief: "flight checkout screen", wildness: 1 }).directions) {
      expect(d.searchQuery).toContain("flight checkout screen");
    }
    for (const w of [2, 3, 4, 5] as Wildness[]) {
      for (const brief of SAMPLE_BRIEFS) {
        for (const d of bendBrief({ brief, wildness: w, count: 8 }).directions) {
          const briefLayout = words(brief.toLowerCase()).filter((x) => LAYOUT_WORDS.has(x));
          for (const lw of briefLayout) expect(words(d.searchQuery.toLowerCase())).not.toContain(lw);
        }
      }
    }
  });

  it("strips usability words only at 5", () => {
    expect(extractSubject("simple intuitive checkout screen", 4).title).toContain("simple");
    expect(extractSubject("simple intuitive checkout screen", 5).title).toBe("checkout");
  });

  it("pulls a short subject from longer briefs", () => {
    expect(extractSubject("landing page for a coffee shop", 2).title).toBe("coffee shop");
    expect(extractSubject("landing page for a coffee shop", 1).query).toBe("coffee shop landing page");
    expect(extractSubject("ride sharing home screen", 2).title).toBe("ride sharing");
    expect(extractSubject("page", 3).title).toBe("page");
    expect(extractSubject("!!!", 3).title).toBe("interface");
  });
});

describe("count, moves and lens", () => {
  it("returns count directions, default 6, max 8", () => {
    expect(bendBrief({ brief: "podcast player", wildness: 2 }).directions).toHaveLength(6);
    expect(bendBrief({ brief: "podcast player", wildness: 2, count: 1 }).directions).toHaveLength(1);
    expect(bendBrief({ brief: "podcast player", wildness: 2, count: 8 }).directions).toHaveLength(8);
    expect(parseBendInput({ brief: "x", wildness: 2, count: 9 }).ok).toBe(false);
    expect(parseBendInput({ brief: "x", wildness: 2, count: 0 }).ok).toBe(false);
  });

  it("only uses the moves asked for", () => {
    const filters: MoveId[][] = [["material"], ["era", "constraint"], ["transplant", "scale", "lens"]];
    for (const moves of filters) {
      for (const w of LEVELS) {
        const result = bendBrief({ brief: "hotel booking page", wildness: w, moves, count: 8 });
        for (const d of result.directions) {
          for (const m of d.moves) expect(moves).toContain(m);
          expect(d.moves.length).toBeLessThanOrEqual(moves.length);
        }
      }
    }
  });

  it("puts lens terms in every direction when a lens is set", () => {
    for (const lens of LENSES) {
      for (const w of LEVELS) {
        const result = bendBrief({ brief: "government e-services portal", wildness: w, lens: lens.id, count: 8 });
        expect(result.lens?.id).toBe(lens.id);
        for (const d of result.directions) {
          expect(d.moves).toContain("lens");
          expect(lens.terms).toContain(d.ingredients.tradition);
          expect(lens.terms.some((t) => d.searchQuery.includes(t))).toBe(true);
        }
      }
    }
  });

  it("returns plain messages for invalid input", () => {
    const bad = [
      undefined,
      "flight checkout",
      { wildness: 3 },
      { brief: "", wildness: 3 },
      { brief: "x".repeat(501), wildness: 3 },
      { brief: "x", wildness: 6 },
      { brief: "x", wildness: 2.5 },
      { brief: "x", wildness: 3, moves: ["teleport"] },
      { brief: "x", wildness: 3, lens: "nope" },
    ];
    for (const raw of bad) {
      const r = parseBendInput(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.message.length).toBeLessThan(160);
        expect(r.message).not.toMatch(/[{}[\]]/);
      }
    }
  });
});

describe("output quality", () => {
  it("never repeats a title or a list entry in one call", () => {
    for (const brief of SAMPLE_BRIEFS) {
      for (const w of LEVELS) {
        const ds = bendBrief({ brief, wildness: w, count: 8 }).directions;
        const titles = ds.map((d) => d.title.toLowerCase());
        expect(new Set(titles).size).toBe(titles.length);
        const used = ds.flatMap((d) => Object.values(d.ingredients).map((v) => String(v).toLowerCase()));
        expect(new Set(used).size).toBe(used.length);
      }
    }
  });

  it("keeps every query short", () => {
    for (const brief of SAMPLE_BRIEFS) {
      for (const w of LEVELS) {
        for (const d of bendBrief({ brief, wildness: w, count: 8 }).directions) {
          expect(words(d.searchQuery).length).toBeLessThanOrEqual(MAX_QUERY_WORDS);
          expect(words(d.searchQuery).length).toBeGreaterThanOrEqual(2);
          expect(d.title.length).toBeGreaterThan(5);
          expect(d.prompt).toMatch(/^Redesign the /);
        }
      }
    }
  });

  it("has no em dashes in any output", () => {
    for (const brief of SAMPLE_BRIEFS) {
      for (const w of LEVELS) {
        const json = JSON.stringify(bendBrief({ brief, wildness: w, count: 8 }));
        expect(json).not.toContain("—");
      }
    }
  });
});

describe("word lists, lenses and templates", () => {
  it("has no em dashes in any list, lens or template file", () => {
    for (const file of allBendFiles(BEND_DIR)) {
      expect(readFileSync(file, "utf8"), file).not.toContain("—");
    }
    const templates = [
      ...Object.values(PRIMARY_TEMPLATES).flat(),
      ...Object.values(MODIFIER_TEMPLATES).flat(),
      ...Object.values(PROMPT_CLAUSES),
    ];
    for (const t of templates) expect(t).not.toContain("—");
  });

  it("has at least 40 entries in every list", () => {
    const dir = join(BEND_DIR, "lists");
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(9);
    for (const f of files) {
      const list = JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown[];
      expect(list.length, f).toBeGreaterThanOrEqual(40);
    }
  });

  it("keeps list queries short and unique so combined queries fit", () => {
    for (const [name, list] of Object.entries(LISTS)) {
      const labels = list.map((e) => e.label.toLowerCase());
      expect(new Set(labels).size, name).toBe(labels.length);
      for (const e of list) expect(words(e.query).length, `${name}: ${e.query}`).toBeLessThanOrEqual(3);
    }
    for (const e of LISTS.elements) expect(words(e.query).length).toBeLessThanOrEqual(2);
    for (const lens of LENSES) {
      expect(lens.terms.length).toBeGreaterThanOrEqual(8);
      for (const t of lens.terms) expect(words(t).length, t).toBeLessThanOrEqual(3);
    }
  });

  it("has the GCC lens presets with Arabic names", () => {
    const ids = LENSES.map((l) => l.id);
    for (const id of ["sadu", "najdi", "kufic", "mashrabiya", "desert-modern"]) expect(ids).toContain(id);
    for (const l of LENSES) {
      expect(l.name.en.length).toBeGreaterThan(0);
      expect(l.name.ar).toMatch(/^[؀-ۿ ]+$/);
      // No diacritics (harakat).
      expect(l.name.ar).not.toMatch(/[ً-ْ]/);
    }
  });

  it("has no religious terms in any list or lens", () => {
    const deny = [
      "quran", "quranic", "koran", "surah", "ayah", "ayat", "verse", "verses", "allah", "bismillah",
      "shahada", "bible", "biblical", "scripture", "gospel", "psalm", "prayer", "pray", "mosque",
      "masjid", "church", "cathedral", "temple", "shrine", "holy", "sacred", "divine", "god", "gods",
      "deity", "religious", "religion", "mandala", "crucifix", "saint", "buddha", "buddhist",
      "hindu", "islamic", "christian", "jewish", "torah", "kaaba", "mecca", "hajj", "ramadan", "zen",
    ];
    const denyAr = ["قرآن", "القرآن", "آية", "الله", "سورة", "مسجد", "دين"];
    const texts: string[] = [
      ...Object.values(LISTS).flatMap((l) => l.flatMap((e) => [e.label, e.query])),
      ...LENSES.flatMap((l) => [l.id, l.name.en, l.name.ar, ...l.terms]),
    ];
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const d of deny) expect(new RegExp(`\\b${d}\\b`).test(lower), `${text} has ${d}`).toBe(false);
      for (const d of denyAr) expect(text.includes(d), `${text} has ${d}`).toBe(false);
    }
  });
});
