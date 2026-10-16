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
 */
import { detectStyles, SHOWCASE_STYLE_MAP, type StyleId } from "../../banana-server/lib/styles/index.ts";
import { cleanStyles } from "../../banana-server/lib/styles/ids.ts";

/** Kinds that take style tags from r2-styles. */
export const TAGGED_KINDS = ["cards", "mechanics", "shaders", "motion"] as const;
export type TaggedKind = (typeof TAGGED_KINDS)[number];
const isTagged = (k: string): k is TaggedKind => (TAGGED_KINDS as readonly string[]).includes(k);

export type StyleTag = { id: string; kind: TaggedKind; styles: string[] };
export type TasteVerdict = { id: string; kind: "shaders" | "motion"; verdict: "keep" | "rewrite" | "drop" };

/** Job kinds that only hold overlays (the server layout skips them). */
export const OVERLAY_KINDS = ["style-tags", "taste-verdicts", "rewrite-verdicts", ...TAGGED_KINDS.map((k) => `${k}-rewrites`)];

export type Overlays = {
  tags: Map<string, Map<string, string[]>>;
  verdicts: Map<string, Map<string, TasteVerdict["verdict"]>>;
  rewriteVerdicts: Map<string, Map<string, TasteVerdict["verdict"]>>;
  rewrites: Map<string, Map<string, unknown>>;
};

/** The overlays in a set of job kinds (readJobRecords). Empty maps when none was built. */
export function overlaysFrom(recordsByJobKind: ReadonlyMap<string, readonly unknown[]>): Overlays {
  const ov: Overlays = { tags: new Map(), verdicts: new Map(), rewriteVerdicts: new Map(), rewrites: new Map() };
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
  return ov;
}

/** A recipe's styles: its card's, its showcase style's, else its query words'. Undefined when none. */
export function recipeStyles(r: { key: { lane: string; cardId?: string; style?: string }; query: string }, cardStyles: ReadonlyMap<string, string[]>): string[] | undefined {
  if (r.key.cardId) return cleanStyles(cardStyles.get(r.key.cardId));
  if (r.key.style) return cleanStyles(SHOWCASE_STYLE_MAP[r.key.style] ?? []);
  const genre = r.key.lane === "deck" ? "deck" : r.key.lane === "brand" ? "brand" : null;
  return cleanStyles(detectStyles([r.query], genre) as StyleId[]);
}

type Rec = { id?: string; styles?: string[] };

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
  if (!isTagged(kind)) return { records: [...records], counts };
  const rewrites = ov.rewrites.get(kind) ?? new Map<string, unknown>();
  const verdicts = ov.verdicts.get(kind) ?? new Map<string, string>();
  const second = ov.rewriteVerdicts.get(kind) ?? new Map<string, string>();
  const tags = ov.tags.get(kind) ?? new Map<string, string[]>();
  const out = (records as readonly Rec[]).flatMap((r): Rec[] => {
    let rec = r;
    const re = rewrites.get(r.id!) as Rec | undefined;
    if (re && (second.get(r.id!) === "drop" || second.get(r.id!) === "rewrite")) {
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
    if (rec.styles && rec.styles.length > 0) return [rec];
    const styles = cleanStyles(tags.get(rec.id!));
    if (!styles) return [rec];
    counts.tagged++;
    return [{ ...rec, styles }];
  });
  return { records: out as unknown as T[], counts };
}
