/**
 * R2 overlays: refinement outputs kept in their own kinds, keyed by record id, and laid over the
 * records they refine only when the server layout is written (lib/layout.ts serverLayout). The
 * jobs' own outputs (out/v1/cards, mechanics, shaders, motion, recipes) never change, so a branch
 * that edits a job's replies (r1 on the J3 cards) merges without conflicts, and the refinement jobs
 * can read the base records again on any rebuild.
 *
 * - style-tags (r2-styles): `{ id, kind, styles }`. Sets `styles` on cards, mechanics, shaders and
 *   motion. A record that carries its own styles (a rewrite) keeps them.
 * - taste-verdicts (r2-taste): `{ id, kind, verdict }`. "drop" removes the record; "rewrite" removes
 *   it unless a rewrite with the same id exists.
 * - <kind>-rewrites (r2-rewrite-shaders, r2-rewrite-motion, r2-mechanics-fix): whole records that
 *   replace the record with the same id (render checked by the job that wrote them).
 * - rewrite-verdicts (r2-taste-rewrites): the same judge on the rewrites. A rewrite judged "drop" or
 *   "rewrite" again is not given a third try: the record is left out.
 * - recipes: styles from their card (concept and art lanes), their web showcase style (website
 *   baseline keys), else the words of their query (deck, brand and the rest), when any.
 * - domain-cliches (r10-cliche): `{ domainId, look, cardIds }`. Sets `cliche` (the look) on the fit
 *   records of those cards in that domain only; the bend ranks them lower there.
 * - card-worlds (r10-worlds): `{ id, worlds }`. Sets `worlds` on cards (the twist must come from
 *   another world than its lead).
 */
import { detectStyles, SHOWCASE_STYLE_MAP, type StyleId } from "../../banana-server/lib/styles/index.ts";
import { cleanStyles } from "../../banana-server/lib/styles/ids.ts";

/** Kinds that take style tags from r2-styles. */
export const TAGGED_KINDS = ["cards", "mechanics", "shaders", "motion"] as const;
export type TaggedKind = (typeof TAGGED_KINDS)[number];
const isTagged = (k: string): k is TaggedKind => (TAGGED_KINDS as readonly string[]).includes(k);

export type StyleTag = { id: string; kind: TaggedKind; styles: string[] };
export type TasteVerdict = { id: string; kind: "shaders" | "motion"; verdict: "keep" | "rewrite" | "drop" };
/** R10 (r10-cliche): one look apps of a domain already ship, and the cards that are that look. */
export type DomainCliche = { domainId: string; look: string; cardIds: string[] };
/** R10 (r10-worlds): the material or object worlds a designer sees in a card, main first. */
export type CardWorlds = { id: string; worlds: string[] };

/** R11: the look a card marked in a third of the domains or more carries in the other domains. */
export const WIDE_CLICHE = "a look apps of many domains already ship";

/** Job kinds that only hold overlays (the server layout skips them). */
export const OVERLAY_KINDS = ["style-tags", "taste-verdicts", "rewrite-verdicts", ...TAGGED_KINDS.map((k) => `${k}-rewrites`), "domain-cliches", "card-worlds"];

export type Overlays = {
  tags: Map<string, Map<string, string[]>>;
  verdicts: Map<string, Map<string, TasteVerdict["verdict"]>>;
  rewriteVerdicts: Map<string, Map<string, TasteVerdict["verdict"]>>;
  rewrites: Map<string, Map<string, unknown>>;
  /** R10: domain id to card id to the shipped look the card is (the first look that lists it). */
  cliches: Map<string, Map<string, string>>;
  /** R10: card id to its worlds. */
  worlds: Map<string, string[]>;
};

/** The overlays in a set of job kinds (readJobRecords). Empty maps when none was built. */
export function overlaysFrom(recordsByJobKind: ReadonlyMap<string, readonly unknown[]>): Overlays {
  const ov: Overlays = { tags: new Map(), verdicts: new Map(), rewriteVerdicts: new Map(), rewrites: new Map(), cliches: new Map(), worlds: new Map() };
  const by = <V>(m: Map<string, Map<string, V>>, kind: string) => {
    if (!m.has(kind)) m.set(kind, new Map());
    return m.get(kind)!;
  };
  for (const t of (recordsByJobKind.get("style-tags") ?? []) as StyleTag[]) by(ov.tags, t.kind).set(t.id, t.styles);
  for (const v of (recordsByJobKind.get("taste-verdicts") ?? []) as TasteVerdict[]) by(ov.verdicts, v.kind).set(v.id, v.verdict);
  for (const v of (recordsByJobKind.get("rewrite-verdicts") ?? []) as TasteVerdict[]) by(ov.rewriteVerdicts, v.kind).set(v.id, v.verdict);
  for (const kind of TAGGED_KINDS) {
    for (const r of (recordsByJobKind.get(`${kind}-rewrites`) ?? []) as { id: string }[]) by(ov.rewrites, kind).set(r.id, r);
  }
  for (const c of (recordsByJobKind.get("domain-cliches") ?? []) as DomainCliche[]) {
    const m = by(ov.cliches, c.domainId);
    for (const id of c.cardIds) if (!m.has(id)) m.set(id, c.look);
  }
  // R11: a card marked in at least a third of the domains (Flat Design 2013 in 24 of 60) is a look
  // apps everywhere ship, so it is a cliche in every domain (SaaS pricing took it once telecom's left).
  const spread = new Map<string, number>();
  for (const m of ov.cliches.values()) for (const id of m.keys()) spread.set(id, (spread.get(id) ?? 0) + 1);
  const wide = [...spread].filter(([, n]) => n * 3 >= ov.cliches.size && ov.cliches.size >= 3).map(([id]) => id);
  for (const m of ov.cliches.values()) for (const id of wide) if (!m.has(id)) m.set(id, WIDE_CLICHE);
  for (const w of (recordsByJobKind.get("card-worlds") ?? []) as CardWorlds[]) if (w.worlds.length > 0) ov.worlds.set(w.id, w.worlds.slice(0, 2));
  return ov;
}

/** A recipe's styles: its card's, its showcase style's, else its query words'. Undefined when none. */
export function recipeStyles(r: { key: { lane: string; cardId?: string; style?: string }; query: string }, cardStyles: ReadonlyMap<string, string[]>): string[] | undefined {
  if (r.key.cardId) return cleanStyles(cardStyles.get(r.key.cardId));
  if (r.key.style) return cleanStyles(SHOWCASE_STYLE_MAP[r.key.style] ?? []);
  const genre = r.key.lane === "deck" ? "deck" : r.key.lane === "brand" ? "brand" : null;
  return cleanStyles(detectStyles([r.query], genre) as StyleId[]);
}

type Rec = { id?: string; styles?: string[]; worlds?: string[] };

export type OverlayCounts = { tagged: number; rewritten: number; dropped: number };

/** Pure: the overlays for `kind` applied to its records. Kinds with no overlay pass through unchanged. */
export function applyOverlays<T>(kind: string, records: readonly T[], ov: Overlays): { records: T[]; counts: OverlayCounts } {
  const counts: OverlayCounts = { tagged: 0, rewritten: 0, dropped: 0 };
  if (kind === "recipes") {
    const cards = ov.tags.get("cards") ?? new Map<string, string[]>();
    const out = records.map((r) => {
      const styles = recipeStyles(r as unknown as Parameters<typeof recipeStyles>[0], cards);
      if (!styles) return r;
      counts.tagged++;
      return { ...r, styles };
    });
    return { records: out, counts };
  }
  if (kind === "fit") {
    // R10: a fit record of a card that is a look its domain already ships carries that look.
    const out = (records as readonly { cardId: string; domainId: string; cliche?: string }[]).map((r) => {
      const look = ov.cliches.get(r.domainId)?.get(r.cardId);
      const { cliche: _old, ...rest } = r;
      if (!look) return _old === undefined ? r : rest;
      counts.tagged++;
      return { ...rest, cliche: look };
    });
    return { records: out as unknown as T[], counts };
  }
  if (!isTagged(kind)) return { records: [...records], counts };
  const rewrites = ov.rewrites.get(kind) ?? new Map<string, unknown>();
  const verdicts = ov.verdicts.get(kind) ?? new Map<string, string>();
  const second = ov.rewriteVerdicts.get(kind) ?? new Map<string, string>();
  const tags = ov.tags.get(kind) ?? new Map<string, string[]>();
  const tagged = (r: Rec): Rec => {
    // R10: cards carry their worlds (never counted as a style tag).
    const worlds = kind === "cards" ? ov.worlds.get(r.id!) : undefined;
    const rec = worlds ? { ...r, worlds } : r;
    if (rec.styles && rec.styles.length > 0) return rec;
    const styles = cleanStyles(tags.get(rec.id!));
    if (!styles) return rec;
    counts.tagged++;
    return { ...rec, styles };
  };
  const out = (records as readonly Rec[]).flatMap((r): Rec[] => {
    let rec = r;
    const re = rewrites.get(r.id!) as Rec | undefined;
    if (re && (second.get(r.id!) === "drop" || second.get(r.id!) === "rewrite")) {
      // A lift (the old record was kept) that does not pass keeps the old record; otherwise both go.
      if (verdicts.get(r.id!) === "keep") return [tagged(r)];
      counts.dropped++;
      return [];
    }
    if (re) {
      counts.rewritten++;
      rec = re;
    } else if (verdicts.get(r.id!) === "drop" || verdicts.get(r.id!) === "rewrite") {
      counts.dropped++;
      return [];
    }
    return [tagged(rec)];
  });
  return { records: out as unknown as T[], counts };
}
