import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  bendBrief,
  LENSES,
  LISTS,
  MAX_QUERY_WORDS,
  MAX_TITLE_WORDS,
  MAX_TWIST_WORDS,
  MOVES,
  parseBendInput,
  splitMoves,
  type MoveId,
  type Wildness,
} from "@/lib/bend";
import { LAYOUT_WORDS, lensEntries, RENAMED } from "@/lib/bend/lists";
import { mulberry32 } from "@/lib/bend/prng";
import { extractSubject } from "@/lib/bend/subject";
import {
  article,
  canRender,
  PAIR_TEMPLATES,
  PROMPT_CLAUSES,
  render,
  ROLE,
  SINGLE_TEMPLATES,
  templateRoles,
  TWIST_TEMPLATES,
} from "@/lib/bend/templates";

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
        expect(json).not.toContain("\u2014");
      }
    }
  });
});

describe("word lists, lenses and templates", () => {
  it("has no em dashes in any list, lens or template file", () => {
    for (const file of allBendFiles(BEND_DIR)) {
      expect(readFileSync(file, "utf8"), file).not.toContain("\u2014");
    }
    const templates = [
      ...Object.values(SINGLE_TEMPLATES).flat(),
      ...Object.values(PAIR_TEMPLATES).flat(),
      ...Object.values(TWIST_TEMPLATES).flat(),
      ...Object.values(PROMPT_CLAUSES),
    ];
    for (const t of templates) expect(t).not.toContain("\u2014");
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

/** 20 seeded random briefs, so the caps are checked beyond the hand-picked samples. */
function randomBriefs(n: number): string[] {
  const rng = mulberry32(20261011);
  const pick = (xs: readonly string[]) => xs[Math.floor(rng() * xs.length)]!;
  const things = [
    "insurance claim", "grocery list", "car rental", "pet adoption", "tax filing", "language learning",
    "recipe", "museum ticket", "crypto wallet", "smart home", "parking payment", "job board",
    "university admissions", "hospital appointment", "wedding planner", "e-commerce returns",
  ];
  const kinds = ["screen", "app", "dashboard", "landing page", "onboarding flow", "settings page", "checkout", "portal"];
  const lead = ["", "", "simple ", "clean intuitive ", "fast "];
  const tail = ["", "", " for teenagers", " for a small bakery", " with dark mode"];
  return Array.from({ length: n }, () => `${pick(lead)}${pick(things)} ${pick(kinds)}${pick(tail)}`);
}
const RANDOM_BRIEFS = randomBriefs(20);

/**
 * Ids captured from the engine before titles became short title plus twist (2026-10-11).
 * Ids are saved on canvases, so they must never move for the same input.
 */
const ID_SNAPSHOT: { input: { brief: string; wildness: Wildness; lens?: string }; ids: string[] }[] = [
  {
    input: { brief: "flight checkout screen", wildness: 5 },
    ids: ["bd-hf5abe4m", "bd-8dti7s7c", "bd-r65qu4pr", "bd-dwyo4stn", "bd-2r5484w5", "bd-8hfupzvw", "bd-9dybmp54", "bd-t9uj85a1"],
  },
  {
    input: { brief: "podcast player", wildness: 3 },
    ids: ["bd-1wojkuo9", "bd-5rpsgh9a", "bd-wotpt12c", "bd-uus6ri8n", "bd-m6oheyqw", "bd-j9rpcy83", "bd-4173oy4g", "bd-r7y73371"],
  },
  {
    input: { brief: "government e-services portal", wildness: 4, lens: "najdi" },
    ids: ["bd-pcv7ucs0", "bd-l67d5nq2", "bd-z83i3gqc", "bd-fru702be", "bd-8v9hrhtw", "bd-m62xasee", "bd-sqxglu78", "bd-09r9tgzk"],
  },
];

describe("short title and twist", () => {
  it("keeps ids exactly as captured before the title rework", () => {
    for (const { input, ids } of ID_SNAPSHOT) {
      expect(bendBrief({ ...input, count: 8 }).directions.map((d) => d.id)).toEqual(ids);
    }
  });

  it("caps titles at 10 words and twists at 8 for samples and random briefs", () => {
    for (const brief of [...SAMPLE_BRIEFS, ...RANDOM_BRIEFS]) {
      for (const w of LEVELS) {
        for (const lens of [undefined, "najdi", "sadu"]) {
          const result = bendBrief({ brief, wildness: w, count: 8, ...(lens ? { lens } : {}) });
          for (const d of result.directions) {
            expect(words(d.title).length, d.title).toBeLessThanOrEqual(MAX_TITLE_WORDS);
            expect(words(d.twist).length, d.twist).toBeLessThanOrEqual(MAX_TWIST_WORDS);
            expect(words(d.searchQuery).length, d.searchQuery).toBeLessThanOrEqual(MAX_QUERY_WORDS);
            expect(d.title).toMatch(/^[A-Z0-9]/);
            expect(d.title).not.toMatch(/[,:;.\s]$/);
            expect(d.twist).not.toMatch(/[,:;.\s]$/);
          }
          const titles = result.directions.map((d) => d.title.toLowerCase());
          expect(new Set(titles).size, brief).toBe(titles.length);
        }
      }
    }
  });

  it("adds a twist from wildness 3 up and none at 1 and 2", () => {
    for (const brief of [...SAMPLE_BRIEFS, ...RANDOM_BRIEFS.slice(0, 5)]) {
      for (const w of LEVELS) {
        for (const d of bendBrief({ brief, wildness: w, count: 8 }).directions) {
          if (w <= 2) expect(d.twist).toBe("");
          else expect(words(d.twist).length).toBeGreaterThan(0);
        }
      }
    }
    // A moves filter with no constraint or scale still gets a twist (from the mood).
    for (const d of bendBrief({ brief: "podcast player", wildness: 3, moves: ["era", "material"], count: 8 }).directions) {
      expect(d.twist.length).toBeGreaterThan(0);
      expect(d.ingredients.constraint).toBeUndefined();
      expect(d.ingredients.element).toBeUndefined();
    }
  });

  it("leads with the lens when a lens is set, and keeps every move in the prompt", () => {
    for (const lens of LENSES) {
      for (const w of [3, 4, 5] as Wildness[]) {
        for (const d of bendBrief({ brief: "flight checkout screen", wildness: w, lens: lens.id, count: 8 }).directions) {
          expect(d.title, d.title).toContain(d.ingredients.tradition);
        }
      }
    }
    for (const d of bendBrief({ brief: "flight checkout screen", wildness: 5, count: 8 }).directions) {
      for (const v of Object.values(d.ingredients)) expect(d.prompt).toContain(String(v));
    }
  });

  it("builds the query from the headline moves plus at most one twist word", () => {
    for (const brief of SAMPLE_BRIEFS) {
      for (const d of bendBrief({ brief, wildness: 5, count: 8 }).directions) {
        const { twist } = splitMoves(d.moves, false);
        if (!twist) continue;
        const slot = { transplant: "object", material: "material", era: "era", constraint: "constraint", scale: "element", lens: "tradition" } as const;
        const label = d.ingredients[slot[twist]]!;
        const lists = { transplant: "objects", material: "materials", era: "eras", constraint: "constraints", scale: "elements", lens: "traditions" } as const;
        const query = LISTS[lists[twist]].find((e) => e.label === label)!.query;
        if (words(query).length > 1) expect(d.searchQuery.toLowerCase(), d.searchQuery).not.toContain(query.toLowerCase());
      }
    }
  });

  it("splits moves into a headline pair and a twist", () => {
    expect(splitMoves(["transplant", "material", "constraint"], false)).toEqual({ headline: ["transplant", "material"], twist: "constraint" });
    expect(splitMoves(["scale", "material", "era"], false)).toEqual({ headline: ["material", "era"], twist: "scale" });
    expect(splitMoves(["era", "transplant", "lens"], true)).toEqual({ headline: ["era", "lens"], twist: "transplant" });
    expect(splitMoves(["material", "scale"], false)).toEqual({ headline: ["material"], twist: "scale" });
    expect(splitMoves(["material", "era"], false)).toEqual({ headline: ["material", "era"], twist: null });
    expect(splitMoves(["era"], false)).toEqual({ headline: ["era"], twist: null });
  });
});

describe("template grammar", () => {
  const ROLE_LISTS: Record<string, readonly string[]> = {
    obj: LISTS.objects.map((e) => e.label),
    mat: LISTS.materials.map((e) => e.label),
    era: LISTS.eras.map((e) => e.label),
    rule: LISTS.constraints.map((e) => e.label),
    el: LISTS.elements.map((e) => e.label),
    lens: [...LISTS.traditions.map((e) => e.label), ...LENSES.flatMap((l) => l.terms)],
    m: LISTS.moods.map((e) => e.label),
    eralead: LISTS.eras.filter((e) => e.leads).map((e) => e.label),
    matlead: LISTS.materials.filter((e) => e.leads).map((e) => e.label),
  };
  const SUBJECTS = [
    { subj: "flight checkout", head: "flight checkout" },
    { subj: "coffee shop landing page", head: "landing page" },
    { subj: "podcast", head: "podcast" },
  ];

  /** Render a template so every entry of every role it uses appears at least once. */
  function renderAll(template: string): string[] {
    const roles = templateRoles(template).filter((r) => r !== "subj" && r !== "head");
    const longest = Math.max(1, ...roles.map((r) => ROLE_LISTS[r]!.length));
    const out: string[] = [];
    for (const s of SUBJECTS) {
      for (let i = 0; i < longest; i++) {
        const vars: Record<string, string> = { ...s };
        roles.forEach((r, k) => {
          const list = ROLE_LISTS[r]!;
          vars[r] = list[(i + k * 7) % list.length]!;
        });
        out.push(render(template, vars));
      }
    }
    return out;
  }

  function grammarProblems(text: string): string[] {
    const problems: string[] = [];
    if (/\b(a|an) (a|an)\b/i.test(text)) problems.push("double article");
    if (/\s{2,}/.test(text) || text !== text.trim()) problems.push("extra space");
    if (/\s[,:;.]/.test(text) || /[,:;]{2,}|,\s*,|:\s*:/.test(text)) problems.push("stray punctuation");
    if (/[,:;]$/.test(text)) problems.push("trailing punctuation");
    if (/[{}]/.test(text)) problems.push("unfilled token");
    if (/[—–]/.test(text)) problems.push("dash");
    for (const [, art, next] of text.matchAll(/\b(a|an|A|An) ([\w-]+)/g)) {
      if (art!.toLowerCase() !== article(next!)) problems.push(`"${art} ${next}"`);
    }
    if (/\b(\w+) \1\b/i.test(text)) problems.push("repeated word");
    return problems;
  }

  it("grammar check catches the mistakes it looks for", () => {
    for (const bad of ["a a matchbook", "an matchbook", "a arcade cabinet", "two  spaces", "ends with a comma,", "a , b", "the the rule", "left {obj}"]) {
      expect(grammarProblems(bad), bad).not.toEqual([]);
    }
    expect(grammarProblems("Flight checkout as an arcade cabinet, a matchbook and an 8-bit sign")).toEqual([]);
  });

  it("has six or more templates per move, move pair and twist source", () => {
    for (const m of MOVES) expect(SINGLE_TEMPLATES[m].length, m).toBeGreaterThanOrEqual(6);
    for (const [k, list] of Object.entries(PAIR_TEMPLATES)) expect(list.length, k).toBeGreaterThanOrEqual(6);
    for (const [k, list] of Object.entries(TWIST_TEMPLATES)) expect(list.length, k).toBeGreaterThanOrEqual(6);
    // Every pair the headline can hold has templates (constraint always goes to the twist).
    const leaders = MOVES.filter((m) => m !== "constraint");
    for (const a of leaders) {
      for (const b of leaders) {
        if (MOVES.indexOf(a) < MOVES.indexOf(b)) expect(PAIR_TEMPLATES[`${a}+${b}`], `${a}+${b}`).toBeDefined();
      }
    }
  });

  it("only uses roles the move or pair fills", () => {
    const base = ["subj", "head", "m"];
    const own = (m: MoveId) => [ROLE[m], `${ROLE[m]}lead`];
    for (const m of MOVES) {
      for (const t of SINGLE_TEMPLATES[m]) for (const r of templateRoles(t)) expect([...base, ...own(m)], t).toContain(r);
      for (const t of TWIST_TEMPLATES[m]) for (const r of templateRoles(t)) expect([...base, ROLE[m]], t).toContain(r);
    }
    for (const t of TWIST_TEMPLATES.mood) for (const r of templateRoles(t)) expect(base, t).toContain(r);
    for (const [key, list] of Object.entries(PAIR_TEMPLATES)) {
      const roles = key.split("+").flatMap((m) => own(m as MoveId));
      for (const t of list) for (const r of templateRoles(t)) expect([...base, ...roles], t).toContain(r);
    }
  });

  it("renders every template with every list entry cleanly", () => {
    const all = [
      ...Object.values(SINGLE_TEMPLATES).flat(),
      ...Object.values(PAIR_TEMPLATES).flat(),
      ...Object.values(TWIST_TEMPLATES).flat(),
      ...Object.values(PROMPT_CLAUSES),
    ];
    const failures: string[] = [];
    for (const t of all) {
      for (const text of renderAll(t)) {
        const p = grammarProblems(text);
        if (p.length) failures.push(`${text} (${p.join(", ")})`);
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
  });

  it("can always fit a twist in 8 words and a single-move title in 10", () => {
    for (const [source, list] of Object.entries(TWIST_TEMPLATES)) {
      for (const text of list.flatMap((t) => renderAll(t))) {
        // At least the shortest template must fit for every entry; checked per entry below.
        expect(text.length).toBeGreaterThan(0);
      }
      const roles = source === "mood" ? ["m"] : [ROLE[source as MoveId]];
      for (const entry of ROLE_LISTS[roles[0]!]!) {
        const vars = { subj: "x", head: "x", m: "neon-lit", [roles[0]!]: entry };
        const best = Math.min(...list.map((t) => words(render(t, vars)).length));
        expect(best, `${source}: ${entry}`).toBeLessThanOrEqual(MAX_TWIST_WORDS);
      }
    }
    for (const m of MOVES) {
      for (const entry of ROLE_LISTS[ROLE[m]]!) {
        const vars = { subj: "coffee shop landing page", head: "landing page", m: "sunset glow", [ROLE[m]]: entry };
        const best = Math.min(...SINGLE_TEMPLATES[m].filter((t) => canRender(t, vars)).map((t) => words(render(t, vars)).length));
        expect(best, `${m}: ${entry}`).toBeLessThanOrEqual(MAX_TITLE_WORDS);
      }
    }
  });

  it("never puts an entry marked leads: false right before the subject", () => {
    const blocked = [...LISTS.eras, ...LISTS.materials].filter((e) => !e.leads).map((e) => e.label.toLowerCase());
    expect(blocked.length).toBeGreaterThan(0);
    for (const brief of SAMPLE_BRIEFS) {
      for (const w of LEVELS) {
        for (const d of bendBrief({ brief, wildness: w, count: 8 }).directions) {
          const subject = extractSubject(brief, w).title.toLowerCase();
          for (const b of blocked) expect(d.title.toLowerCase(), d.title).not.toContain(`${b} ${subject}`);
        }
      }
    }
  });

  it("keeps scale elements plural so verbs agree", () => {
    for (const e of LISTS.elements) expect(/s$/.test(e.label) || ["emoji", "dice"].includes(e.label), e.label).toBe(true);
  });

  it("keeps reworded entries keyed by their old label", () => {
    for (const [list, map] of Object.entries(RENAMED)) {
      const entries = list.startsWith("lens:")
        ? lensEntries(LENSES.find((l) => `lens:${l.id}` === list)!)
        : LISTS[list as keyof typeof LISTS];
      expect(entries, list).toBeDefined();
      for (const [label, old] of Object.entries(map)) {
        const entry = entries.find((e) => e.label === label);
        expect(entry, `${list}: ${label}`).toBeDefined();
        expect(entry!.key).toBe(old);
        expect(entries.some((e) => e.label === old), `${list}: ${old} still listed`).toBe(false);
      }
    }
  });
});
