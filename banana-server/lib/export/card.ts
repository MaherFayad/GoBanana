/**
 * Exports from the direction's lead Atlas card (docs/next-step-plan.md P1-I5). Pure: the caller
 * passes the cards it loaded (lib/atlas loader) as plain data.
 *
 * - Fonts: the card's Latin and Arabic display and body families.
 * - Radius: the card's radius word as a rounded scale.
 * - Motion: the card's verb, duration and reduced motion fallback.
 * - Palette: the card's colors, refined by the board (reconcile_direction): a board color takes a
 *   card color's place only when every ship pair that color is in still passes (WCAG 2.2 SC 1.4.3
 *   4.5:1 for text, SC 1.4.11 3:1 for UI parts). Card pairs that fail are never ship.
 */
import type { ContrastResult } from "../canvas/types";
import type { IngredientCard } from "../atlas/types";
import { isTypeVoice, TYPE_VOICES, type TypeVoice } from "../direction-detail";
import { cardVoiceFonts, type VoiceFonts } from "../kit/voice-fonts";
import type { ColorToken, Dim, FontPairing } from "./model";
import { contrastRatio, normalizeHex } from "./util";

/** The card fields exports read. */
export type LeadCard = Pick<IngredientCard, "id" | "name" | "palette" | "shipPairs" | "type" | "motion" | "radius">;

export const TEXT_MIN = 4.5;
export const UI_MIN = 3;

const px = (value: number): Dim => ({ value, unit: "px" });

/** The rounded scale for each card radius word. "soft" is today's fixed scale. */
export const CARD_RADII: Record<IngredientCard["radius"], [string, Dim][]> = {
  none: [["none", px(0)], ["sm", px(0)], ["md", px(0)], ["lg", px(0)], ["full", px(0)]],
  small: [["none", px(0)], ["sm", px(2)], ["md", px(4)], ["lg", px(8)], ["full", px(9999)]],
  soft: [["none", px(0)], ["sm", px(4)], ["md", px(8)], ["lg", px(16)], ["full", px(9999)]],
  round: [["none", px(0)], ["sm", px(8)], ["md", px(16)], ["lg", px(24)], ["full", px(9999)]],
};

export function cardRounded(card: LeadCard | null | undefined): [string, Dim][] {
  const scale = (card && CARD_RADII[card.radius]) ?? CARD_RADII.soft;
  return scale.map(([k, d]) => [k, { ...d }]);
}

export interface KitMotion {
  verb: string;
  ms: number;
  reduced: string;
}

export function cardMotion(card: LeadCard | null | undefined): KitMotion | null {
  const m = card?.motion;
  if (!m || typeof m.verb !== "string" || !Number.isFinite(m.ms)) return null;
  return { verb: m.verb.trim().slice(0, 60), ms: Math.min(2000, Math.max(0, Math.round(m.ms))), reduced: (m.reduced ?? "").trim().slice(0, 200) };
}

// ---------- fonts ----------

export const cardVoice = (card: LeadCard): TypeVoice | null => (isTypeVoice(card.type?.voice) ? card.type.voice : null);

const googleUrl = (families: string[]) =>
  `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.replace(/ /g, "+")}`).join("&")}&display=swap`;

/** The card's Latin pairing, in the shape of lib/kit/fonts.json pairings. Null when a Latin family is missing. */
export function cardPairing(card: LeadCard): FontPairing | null {
  if (!card.type?.latin?.display?.trim() || !card.type.latin.body?.trim()) return null;
  const { latinDisplay: display, latinBody: body } = cardVoiceFonts(card.type);
  return {
    id: `card-${card.id}`,
    name: `${display.family} and ${body.family}`,
    display,
    body,
    licence: "Google Fonts",
    scripts: ["latin"],
    mood: [],
    sample: card.name,
    url: googleUrl([display.family, body.family]),
  };
}

/** The card's four fonts (lib/kit/voice-fonts.ts cardVoiceFonts), Latin from `pairing`. */
export function cardFonts(card: LeadCard, pairing: FontPairing): VoiceFonts {
  return { ...cardVoiceFonts(card.type), latinDisplay: { ...pairing.display }, latinBody: { ...pairing.body } };
}

/** The key two directions must not share: the Latin display and body families. */
export const pairKey = (p: Pick<FontPairing, "display" | "body">) => `${p.display.family.toLowerCase()}|${p.body.family.toLowerCase()}`;

/** Voices in a fixed order starting after `voice`, for picking a free pairing. */
export function voicesAfter(voice: TypeVoice | null): TypeVoice[] {
  const at = voice ? TYPE_VOICES.indexOf(voice) : -1;
  return [...TYPE_VOICES.slice(at + 1), ...TYPE_VOICES.slice(0, Math.max(0, at + 1))].filter((v) => v !== voice);
}

// ---------- palette ----------

type CardRole = IngredientCard["palette"][number]["role"];

/** reconcile_direction role (lib/palette/roles.ts) to card role. */
const BOARD_ROLE: Record<string, CardRole> = {
  surface: "surface",
  "on-surface": "ink",
  primary: "accent",
  accent: "accent",
  secondary: "support",
  neutral: "support",
};

/** Text pairs (one side is ink) need 4.5:1; every other pair is a UI pair and needs 3:1. */
export const pairMin = (a: CardRole | undefined, b: CardRole | undefined) => (a === "ink" || b === "ink" ? TEXT_MIN : UI_MIN);

export interface CardColors {
  ship: ColorToken[];
  contrast: ContrastResult[];
  /** Board colors that took a card color's place, as "card hex > board hex". */
  refined: string[];
  /** Board colors that were not used (no matching role, or the swap would fail contrast). */
  unused: string[];
}

const TOKEN_FOR_ROLE: Record<CardRole, string[]> = { surface: ["surface"], ink: ["ink"], accent: ["primary", "accent"], support: ["secondary", "neutral"] };

/**
 * The card palette as ship colors, refined by the board palette. Each card color, in order, may
 * take the first unused board color of the same role, but only when every card ship pair it is in
 * still passes its minimum with the colors chosen so far. Pairs that fail even with the card's own
 * colors are kept as explore, never ship.
 */
export function cardColors(card: LeadCard, board: readonly { hex: string; role: string }[] = []): CardColors {
  const entries = card.palette.flatMap((c) => {
    const hex = normalizeHex(c.hex);
    return hex ? [{ hex, role: c.role, card: hex }] : [];
  });
  const roleOf = new Map(entries.map((e) => [e.card, e.role]));
  const pairs = card.shipPairs.flatMap(([a, b]) => {
    const fg = normalizeHex(a);
    const bg = normalizeHex(b);
    return fg && bg && roleOf.has(fg) && roleOf.has(bg) ? [{ fg, bg, min: pairMin(roleOf.get(fg), roleOf.get(bg)) }] : [];
  });
  // Card hex to the hex chosen for it.
  const chosen = new Map(entries.map((e) => [e.card, e.hex]));
  const now = (hex: string) => chosen.get(hex) ?? hex;
  const passesNow = (p: { fg: string; bg: string; min: number }) => contrastRatio(now(p.fg), now(p.bg)) >= p.min;
  const passing = pairs.filter(passesNow);

  const pool = board.flatMap((b) => {
    const hex = normalizeHex(b.hex);
    const role = BOARD_ROLE[b.role];
    return hex && role ? [{ hex, role }] : [];
  });
  const used = new Set<string>();
  const refined: string[] = [];
  for (const e of entries) {
    const candidate = pool.find((b) => b.role === e.role && !used.has(b.hex) && b.hex !== e.card);
    if (!candidate) continue;
    used.add(candidate.hex);
    chosen.set(e.card, candidate.hex);
    if (passing.filter((p) => p.fg === e.card || p.bg === e.card).every(passesNow)) {
      e.hex = candidate.hex;
      refined.push(`${e.card} > ${candidate.hex}`);
    } else {
      chosen.set(e.card, e.card);
      used.delete(candidate.hex);
    }
  }

  const names = new Set<string>();
  const nameFor = (role: CardRole) => {
    const options = TOKEN_FOR_ROLE[role];
    for (const n of options) if (!names.has(n)) return names.add(n), n;
    const base = options[0]!;
    let i = 2;
    while (names.has(`${base}-${i}`)) i++;
    names.add(`${base}-${i}`);
    return `${base}-${i}`;
  };
  const seen = new Set<string>();
  const ship: ColorToken[] = [];
  for (const e of entries) {
    if (seen.has(e.hex)) continue;
    seen.add(e.hex);
    ship.push({ name: nameFor(e.role), hex: e.hex, oklch: null, canvasRole: null, from: e.hex === e.card ? "card" : "board" });
  }

  const contrast: ContrastResult[] = pairs.map((p) => {
    const fg = now(p.fg);
    const bg = now(p.bg);
    const raw = contrastRatio(fg, bg);
    return { fg, bg, ratio: Math.round(raw * 100) / 100, passesText: raw >= TEXT_MIN, passesUi: raw >= UI_MIN, tag: raw >= p.min ? "ship" : "explore" };
  });
  contrast.sort((a, b) => (a.tag === b.tag ? b.ratio - a.ratio : a.tag === "ship" ? -1 : 1));
  const unused = pool.filter((b) => !used.has(b.hex)).map((b) => b.hex);
  return { ship, contrast, refined, unused };
}
