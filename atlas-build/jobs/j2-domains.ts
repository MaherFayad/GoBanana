/**
 * P1-J2 Domain map: one DomainEntry per domain in data/domains.json, with the J1 page anatomy ids
 * as context. Opus, batch. fitsFamilies and clashFamilies use exactly the J3 card family names
 * (CARD_FAMILIES in jobs/j3-cards.ts), so J4 can join domains to cards by family.
 *
 *   npx tsx run.ts j2-domains --dry
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OPUS, PATHS, ROOT } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import { PROMPT_RULES, typeText } from "../lib/prompt.ts";
import { escapeHtml } from "../lib/review.ts";
import { readKind } from "../lib/shards.ts";
import { CARD_FAMILIES } from "./j3-cards.ts";
import { DomainEntrySchema, type DomainEntry, type PageAnatomy } from "../schema.ts";

type Input = { id: string; name: string };

const FAMILY_SET = new Set(Object.values(CARD_FAMILIES).flat());
const FAMILY_TEXT = Object.entries(CARD_FAMILIES)
  .map(([kind, names]) => `${kind}:\n${names.map((f) => `- ${f}`).join("\n")}`)
  .join("\n");

const PAGES = readKind<PageAnatomy>(PATHS.out, "anatomy")
  .map((p) => p.id)
  .sort();

const SYSTEM = `You write domain entries for GoBanana, a tool that bends one app or web page into a wild but buildable design direction by mixing in an unexpected ingredient (an object, material, era, tradition, mood, constraint or element). A domain entry describes one product domain so the tool can keep the product's real nouns in every search and pick ingredients that fit or clash on purpose.

${PROMPT_RULES}

How to fill each field:
- id: given in the request. Copy it exactly.
- names.en: 2 to 5 names for the domain in English. names.ar: 2 to 4 Arabic names a Saudi product team would say, white Saudi dialect, no tashkeel.
- productNouns: 8 to 15 concrete nouns users see in these products ("eSIM", "data plan", "boarding pass", "fare"). Real product words, not design words. Generic brand names are not allowed.
- audience: one or two plain sentences on who uses these products and what they want on the screen.
- regionNotes: one or two sentences on what changes for Gulf and Saudi users (habits, rules, payment methods, calendar, language), only when it matters. Leave it out when it does not.
- fitsFamilies: 4 to 8 ingredient families from the list below that suit this domain's mood and trust needs.
- clashFamilies: 2 to 5 families from the list below that clash with the domain in a productive way: a surprising mix that still works at high wildness. Never the same as a fits family.

Ingredient families by card kind (use these names exactly, without the kind; mix kinds freely):
${FAMILY_TEXT}

Pages in the anatomy library (for context on what these products show):
${PAGES.join(", ")}

The record type:

${typeText("DomainEntry")}

Reply with one DomainEntry object.`;

const DOMAINS: Input[] = (JSON.parse(readFileSync(join(ROOT, "data", "domains.json"), "utf8")) as { domains: Input[] }).domains;

export default defineJob<Input, DomainEntry>({
  id: "j2-domains",
  kind: "domains",
  model: OPUS,
  mode: process.env.ATLAS_DIRECT ? "direct" : "batch", // ATLAS_DIRECT=1: a small prompt test at full price
  schema: DomainEntrySchema,
  system: SYSTEM,
  maxTokens: 8000,
  expectedOutputTokens: 2500,

  loadInputs: () => DOMAINS,
  requestId: (input) => `j2-${input.id}`,
  buildPrompt: (input) => `Write the DomainEntry for the domain "${input.name}". Its id is "${input.id}".`,

  prepare: (raw, input) => (raw && typeof raw === "object" ? { ...(raw as object), id: input.id } : raw),
  check: (rec) => {
    const out: string[] = [];
    for (const f of [...rec.fitsFamilies, ...rec.clashFamilies]) if (!FAMILY_SET.has(f)) out.push(`unknown family "${f}"`);
    for (const f of rec.clashFamilies) if (rec.fitsFamilies.includes(f)) out.push(`"${f}" both fits and clashes`);
    if (rec.fitsFamilies.length < 3) out.push("fewer than 3 fit families");
    if (rec.clashFamilies.length < 1) out.push("no clash family");
    if (rec.productNouns.length < 5) out.push("fewer than 5 product nouns");
    return out;
  },
  renderReview: (rec) => `<h3>${escapeHtml(rec.id)}</h3>
<p>${escapeHtml(rec.names.en.join(" / "))} | <span dir="rtl" lang="ar">${escapeHtml(rec.names.ar.join(" / "))}</span></p>
<p><b>Nouns:</b> ${escapeHtml(rec.productNouns.join(", "))}</p>
<p><b>Audience:</b> ${escapeHtml(rec.audience)}</p>
${rec.regionNotes ? `<p><b>Region:</b> ${escapeHtml(rec.regionNotes)}</p>` : ""}
<p><b>Fits:</b> ${escapeHtml(rec.fitsFamilies.join("; "))}<br><b>Clashes:</b> ${escapeHtml(rec.clashFamilies.join("; "))}</p>`,
});
