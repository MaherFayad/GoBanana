/**
 * Refinement R6, task B: page names (J1) where the weak domains are thin. The bend finds a brief's
 * page by the J1 page names (banana-server lib/atlas/bend.ts parsePage), and those names are generic:
 * "apartment detail page for an Abu Dhabi rental app" matched no name, fell back to shared words and
 * bent a pricing page with plan cards. This job asks Sonnet (one request, text only) for the names
 * users of telecom, food delivery and real estate products type for the pages those products use
 * ("apartment detail page", "data usage screen", "restaurant menu"), and adds them to the pages.
 *
 * Guard (deterministic): a new name is kept only when it changes the page of no Bench brief and no
 * J8 brief (raw/j8-briefs.jsonl), so only phrasings nothing parsed before can move. Names are only
 * appended, so J1's first names (what page lines and prompts show) stay as they are.
 *
 * Output: the whole anatomy kind with the kept names added. Run after every job that reads page
 * names into its inputs (lib/refine.ts order).
 *
 *   npx tsx run.ts r6-page-names --dry
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { contentWords, parsePage } from "../../banana-server/lib/atlas/bend.ts";
import { PATHS, ROOT, SONNET } from "../config.ts";
import { readKindRecords } from "../lib/atlas-read.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES } from "../lib/prompt.ts";
import { mergeByKey } from "../lib/refine.ts";
import { extractJson } from "../lib/validate.ts";
import { PageAnatomySchema, type DomainEntry, type PageAnatomy } from "../schema.ts";

/** Per weak domain, the pages its products use most. */
export const DOMAIN_PAGES: Record<string, string[]> = {
  telecom: ["plan-picker", "plan-comparison", "app-home", "sign-up", "bill-payment", "subscription-management", "checkout", "offers-page"],
  "food-delivery": ["food-delivery-home", "restaurant-menu", "order-tracking", "cart", "checkout", "offers-page", "place-detail", "search"],
  "real-estate": ["property-listing", "search", "search-results", "maps-directions", "appointment-booking", "loan-application", "landing-page", "wishlist"],
};

type Input = { domains: DomainEntry[]; pages: PageAnatomy[] };

const SYSTEM = `You add page names to GoBanana's page anatomy. GoBanana reads a one-line brief ("apartment detail page for an Abu Dhabi rental app") and finds the page it asks for by matching the page's names inside the brief. Some pages lack the words people use for them in a given product domain, so briefs miss them.

For each domain and page in the request, give 2 to 5 extra English names that a founder or designer in THAT domain would type for that page, in lowercase, 2 to 4 words each:
- Use the domain's own words: "apartment detail page", "villa page", "unit page" for a property listing; "data usage screen", "my lines" for a telecom home; "restaurant page", "dish menu" for a restaurant menu.
- Each name must clearly mean this page in this domain. Never a name that would also mean another page ("plans" alone, "details", "home page", "dashboard") or a name already in the page's list.
- Never brand or product names.

${PROMPT_RULES}

Reply with one \`\`\`json block: {"pages": [{"domain": "<domain id>", "page": "<page id>", "names": ["...", "..."]}]}.`;

/** The guard briefs: the Bench briefs and the J8 briefs (their text and first page). */
export function guardBriefs(): string[] {
  const out: string[] = [];
  const bench = join(ROOT, "..", "banana-server", "bench", "briefs.json");
  if (existsSync(bench)) out.push(...(JSON.parse(readFileSync(bench, "utf8")) as { briefs: Array<{ brief: string }> }).briefs.map((b) => b.brief));
  const j8 = join(PATHS.raw, "j8-briefs.jsonl");
  if (existsSync(j8))
    for (const line of readFileSync(j8, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const v = extractJson((JSON.parse(line) as { text?: string }).text ?? "") as Array<{ brief?: string }>;
        for (const b of v) if (typeof b.brief === "string") out.push(b.brief);
      } catch {
        // A reply that does not parse adds no guard brief.
      }
    }
  return out;
}

const withNames = (pages: readonly PageAnatomy[], add: ReadonlyMap<string, readonly string[]>): PageAnatomy[] =>
  pages.map((p) => (add.has(p.id) ? { ...p, names: { ...p.names, en: [...p.names.en, ...add.get(p.id)!.filter((n) => !p.names.en.includes(n))] } } : p));

/**
 * The names that move no guard brief: each proposed name is tried alone, then the kept ones together
 * (dropping the last kept name until they move none).
 */
export function guardNames(base: readonly PageAnatomy[], proposed: ReadonlyMap<string, readonly string[]>, briefs: readonly string[]): { kept: Map<string, string[]>; dropped: string[] } {
  const before = briefs.map((b) => parsePage(b, base)?.id ?? null);
  const moves = (add: ReadonlyMap<string, readonly string[]>) => {
    const pages = withNames(base, add);
    return briefs.some((b, i) => (parsePage(b, pages)?.id ?? null) !== before[i]);
  };
  const kept = new Map<string, string[]>();
  const dropped: string[] = [];
  const flat: Array<[string, string]> = [];
  for (const [page, names] of proposed) for (const n of names) flat.push([page, n]);
  for (const [page, n] of flat) {
    if (moves(new Map([[page, [n]]]))) dropped.push(`${page}: ${n}`);
    else kept.set(page, [...(kept.get(page) ?? []), n]);
  }
  while (moves(kept)) {
    const [page, names] = [...kept].at(-1)!;
    dropped.push(`${page}: ${names.at(-1)}`);
    if (names.length > 1) kept.set(page, names.slice(0, -1));
    else kept.delete(page);
  }
  return { kept, dropped };
}

const cleanName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export default defineJob<Input, PageAnatomy>({
  id: "r6-page-names",
  kind: "anatomy",
  model: SONNET,
  mode: "batch",
  schema: PageAnatomySchema,
  system: SYSTEM,
  maxTokens: 6000,
  expectedOutputTokens: 2500,
  effort: "low",

  loadInputs: () => {
    const domains = readKindRecords<DomainEntry>("domains").filter((d) => d.id in DOMAIN_PAGES);
    const ids = new Set(Object.values(DOMAIN_PAGES).flat());
    const pages = readKindRecords<PageAnatomy>("anatomy").filter((p) => ids.has(p.id)).sort((a, b) => a.id.localeCompare(b.id));
    return [{ domains, pages }];
  },
  requestId: () => "r6pn-weak",
  buildPrompt: (input) =>
    [
      ...input.domains.map((d) => `Domain ${d.id} (${d.names.en.join(", ")}). Products: ${d.productNouns.slice(0, 10).join(", ")}.\nPages: ${DOMAIN_PAGES[d.id]!.join(", ")}`),
      "",
      "Page names today (id: names):",
      ...input.pages.map((p) => `- ${p.id}: ${p.names.en.join(", ")}`),
    ].join("\n"),
  parse: (text, input) => {
    const v = extractJson(text) as { pages?: Array<{ domain?: string; page?: string; names?: unknown }> };
    const out: PageAnatomy[] = [];
    for (const row of v.pages ?? []) {
      const page = input.pages.find((p) => p.id === row.page);
      if (!page || !Array.isArray(row.names) || !DOMAIN_PAGES[row.domain ?? ""]?.includes(page.id)) continue;
      const names = row.names.filter((n): n is string => typeof n === "string").map(cleanName).filter((n) => contentWords(n).length >= 2 && n.split(" ").length <= 5);
      if (names.length) out.push({ ...page, names: { ...page.names, en: [...page.names.en, ...names.filter((n) => !page.names.en.includes(n))] } });
    }
    return out;
  },
  finalize: (records, ctx) => {
    const base = readKindRecords<PageAnatomy>("anatomy");
    const proposed = new Map<string, string[]>();
    for (const r of records) {
      const old = base.find((p) => p.id === r.id)!;
      const add = r.names.en.filter((n) => !old.names.en.includes(n));
      proposed.set(r.id, [...new Set([...(proposed.get(r.id) ?? []), ...add])]);
    }
    const { kept, dropped } = guardNames(base, proposed, guardBriefs());
    ctx.log(`  names kept: ${[...kept].map(([p, ns]) => `${p} (${ns.join(", ")})`).join("; ") || "none"}`);
    ctx.log(`  names dropped by the guard (they moved a Bench or J8 brief): ${dropped.join("; ") || "none"}`);
    return mergeByKey(base, withNames(base, kept).filter((p) => kept.has(p.id)), (p) => p.id);
  },
});
