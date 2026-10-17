/**
 * Refinement R10: domain cliches. R7 already ranks screen-native cards (glyphs, data marks, the UI
 * default styles) lower as leads everywhere. What it misses is the look a domain's shipped apps
 * already have: the verifier read Saturn Rings on a telecom home as the ring gauges every telecom
 * app shows, and Flat Design 2013 on a food home as what food apps already look like. Those cards
 * are wild elsewhere (rings on a recipe app), so the signal is per domain.
 *
 * Sonnet, batch, one request per domain. The model lists the looks shipped apps and sites of the
 * domain already use, then marks which of the domain's candidate cards (domain fit 2 or 3, or page
 * fit 2 or 3 on one of its pages) are one of those looks. Output kind "domain-cliches"
 * (`{ domainId, look, cardIds }`), an overlay (lib/overlays.ts) that sets `cliche` on those fit
 * records in the server layout; data/r10-domain-looks.json lists every look for review.
 *
 *   npx tsx run.ts r10-cliche --dry
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { PATHS, ROOT, SONNET } from "../config.ts";
import { defineJob } from "../lib/job.ts";
import type { DomainCliche } from "../lib/overlays.ts";
import { escapeHtml } from "../lib/review.ts";
import { readKind } from "../lib/shards.ts";
import { extractJson } from "../lib/validate.ts";
import type { DomainEntry, FitScore, IngredientCard, PageFitScore } from "../schema.ts";

type Input = { domain: DomainEntry; ids: string[]; lines: string[] };

export const DomainClicheSchema = z.object({
  domainId: z.string().min(1),
  look: z.string().trim().min(3),
  cardIds: z.array(z.string().min(1)),
});

const SYSTEM = `You know what shipped apps and websites look like, domain by domain, from years of App Store screens, Mobbin flows and Dribbble shots. You help GoBanana, a tool that bends one app page into a wild but buildable design direction by leading with an ingredient card (a material, object, era, tradition or UI element). A direction is slop when its lead card is simply the look apps of that domain already ship: the user gets what they would have built anyway.

For one domain:
1. List 8 to 15 looks that shipped apps and sites of this domain already use again and again: chart and gauge forms, metaphors, illustration styles, materials, color habits, motifs, era styles, reward and game systems. Each look is a short plain phrase. Example for weather apps: "a sky gradient behind one big temperature", "sun, cloud and rain glyph icons", "a ring or arc gauge for UV or air quality", "a radar map with colored rain bands", "frosted glass cards over a photo".
2. From the card list, mark the cards that ARE one of those looks: a direction led by the card in this domain would give a screen that looks like what the domain's apps already ship. Judge what the user would see, not the structure of the task:
   - Mark an era, style or material card when it is the domain's default visual style (soft pastel blobs and gradients on a wellness app, black and gold foil on a luxury fashion site, a dark neon dashboard on a crypto app), including the flat, glossy, luxury or retro look its apps already share.
   - Mark a chart, glyph or reward card when it is the domain's usual way to show its data or rewards (a candlestick chart on a trading app, a streak counter on a habit app).
   - Do not mark a card because the domain has a task with a similar shape: an instruction manual is not a cliche because sign-up has numbered steps, a wax seal is not a cliche because a lease is signed. The card's own world must already be what the domain's screens look like.
   In weather, a Sky Gradient card or a Weather Symbols card is the look and a Barometer Dial card is (the dial gauge); a Cyanotype Print card is not (blue, but no weather app looks like a cyanotype), and a Ship's Logbook card is not (forecasts are logged, but no weather app looks like a logbook).

The same card can be a cliche in one domain and wild in another: only judge this domain.

Reply with JSON only, inside one \`\`\`json fenced block: {"looks": [{"look": "<short phrase>", "cards": ["<card id>", ...]}]}, every look of step 1, each with the ids of the cards that are that look (often none). Use only card ids from the list.`;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);

function inputs(): Input[] {
  const domains = readKind<DomainEntry>(PATHS.out, "domains").sort((a, b) => a.id.localeCompare(b.id));
  const cards = new Map(readKind<IngredientCard>(PATHS.out, "cards").map((c) => [c.id, c]));
  const fit = readKind<FitScore>(PATHS.out, "fit");
  const pageFit = readKind<PageFitScore>(PATHS.out, "page-fit");
  return domains.map((domain) => {
    const ids = new Set<string>();
    for (const f of fit) if (f.domainId === domain.id && f.score >= 2) ids.add(f.cardId);
    for (const p of pageFit) if (p.domainId === domain.id && p.score >= 2) ids.add(p.cardId);
    const list = [...ids].filter((id) => cards.has(id)).sort();
    return {
      domain,
      ids: list,
      lines: list.map((id) => {
        const c = cards.get(id)!;
        return `- ${c.id} | ${c.name} | ${c.kind}, ${c.family}${c.styles?.[0] ? `, ${c.styles[0]}` : ""} | ${clip(c.idea, 160)}`;
      }),
    };
  });
}

export default defineJob<Input, DomainCliche>({
  id: "r10-cliche",
  kind: "domain-cliches",
  model: SONNET,
  mode: "batch",
  schema: DomainClicheSchema as z.ZodType<DomainCliche>,
  system: SYSTEM,
  maxTokens: 6000,
  expectedOutputTokens: 1500,
  effort: "medium",

  loadInputs: inputs,
  requestId: (input) => `r10c2-${input.domain.id}`,
  buildPrompt: (input) =>
    `Domain: ${input.domain.names.en.join(", ")} (${input.domain.id})
Products: ${input.domain.productNouns.join(", ")}
Audience: ${input.domain.audience}

Cards (${input.lines.length}):
${input.lines.join("\n")}`,
  parse: (text, input) => {
    const v = extractJson(text) as { looks?: Array<{ look?: unknown; cards?: unknown }> };
    return (v.looks ?? []).map((l) => ({ domainId: input.domain.id, look: l.look, cardIds: l.cards }));
  },
  prepare: (raw, input) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as { look?: unknown; cardIds?: unknown };
    const known = new Set(input.ids);
    // Only ids the request carried; em dashes become commas (writing rules).
    const cardIds = Array.isArray(r.cardIds) ? [...new Set(r.cardIds.filter((id): id is string => typeof id === "string" && known.has(id)))].sort() : [];
    const look = typeof r.look === "string" ? r.look.replace(/\s*—\s*/g, ", ").trim() : r.look;
    return { ...r, look, cardIds };
  },
  finalize: (records, ctx) => {
    const out = [...records].sort((a, b) => a.domainId.localeCompare(b.domainId));
    const marked = new Set(out.flatMap((r) => r.cardIds.map((id) => `${r.domainId}|${id}`)));
    ctx.log(`  domain cliches: ${new Set(out.map((r) => r.domainId)).size} domains, ${out.length} looks, ${marked.size} card and domain pairs marked`);
    if (!ctx.dry) {
      const byDomain: Record<string, Array<{ look: string; cards: string[] }>> = {};
      for (const r of out) (byDomain[r.domainId] ??= []).push({ look: r.look, cards: r.cardIds });
      writeFileSync(join(ROOT, "data", "r10-domain-looks.json"), JSON.stringify(byDomain, null, 1) + "\n");
    }
    return out;
  },
  shardOf: (rec) => rec.domainId.charAt(0),
  renderReview: (rec) => `<p><b>${escapeHtml(rec.domainId)}</b>: ${escapeHtml(rec.look)}<br><small>${escapeHtml(rec.cardIds.join(", ") || "(no cards)")}</small></p>`,
});
