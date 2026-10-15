/**
 * Market and script rules for a bend (pure, word lists only, no AI). Field report, 2026-10-12: a
 * GCC flight checkout bend got Wayuu weaving (Colombia) and Icelandic knitwear as its cultural
 * ingredients, and a "serif type only" rule that fights Arabic. When the brief names a market,
 * cultural ingredients come from that region; when it needs Arabic, type rules that only work in
 * Latin script are left out and every type voice gets an Arabic face in the spec.
 */
import type { TypeVoice } from "@/lib/direction-detail";
import { isArabicBrief } from "./queries";

/**
 * "gulf": the GCC (Saudi Arabia, the UAE, Qatar, Kuwait, Oman, Bahrain). "mena": the rest of the
 * Middle East and North Africa, or Arab and Arabic in general. P0-07: a GCC brief got Turkish
 * Iznik tiles when the whole region was one market (live test, 2026-10-13).
 */
export type Market = "gulf" | "mena";

/** Words that name the GCC: its countries, people and cities. */
const GULF_WORDS =
  /\b(gcc|gulf|khaleeji|saudi|ksa|riyadh|jeddah|dammam|khobar|abha|asir|aseer|najd|diriyah|neom|alula|uae|emirati|emirates|dubai|abu dhabi|sharjah|ajman|al ain|qatar|qatari|doha|kuwait|kuwaiti|oman|omani|muscat|salalah|bahrain|bahraini|manama|hajj|umrah|makkah|mecca|madinah|medina)\b/i;

/** Words that name the wider Middle East and North Africa, or Arabic in general. */
const MENA_WORDS =
  /\b(arab|arabic|arabian|rtl|mena|middle east|egypt|egyptian|cairo|jordan|amman|levant|lebanon|beirut|morocco|moroccan|tunisia|algeria|iraq|baghdad|yemen)\b/i;

/** The market a brief names, or null. The Gulf wins when a brief names both. */
export function briefMarket(brief: string): Market | null {
  if (GULF_WORDS.test(brief)) return "gulf";
  return MENA_WORDS.test(brief) ? "mena" : null;
}

/** True when the design must work in Arabic: the brief says Arabic or right to left, or names a market in the region. */
export function needsArabic(brief: string): boolean {
  return isArabicBrief(brief) || briefMarket(brief) !== null;
}

/** Wildness from which a Gulf brief may also draw the wider region's traditions. */
export const WIDER_REGION_FROM_WILDNESS = 4;

/** Gulf crafts (lists/traditions.json keys): the only traditions a GCC brief draws at wildness 1 to 3. */
const GULF_TRADITIONS = [
  "Sadu weaving",
  "mashrabiya screens",
  "Najdi painted doors",
  "Al Qatt Al Asiri",
  "Hejazi rawashin windows",
  "Emirati talli braiding",
  "Omani silver jewelry",
];

/**
 * Traditions (lists/traditions.json keys) a market brief draws. Gulf: its own crafts only. Mena:
 * the Gulf first, then the rest of the Arab world, Turkey and Iran. A Gulf brief adds the mena set
 * from WIDER_REGION_FROM_WILDNESS (lib/bend/index.ts).
 */
export const MARKET_TRADITIONS: Readonly<Record<Market, ReadonlySet<string>>> = {
  gulf: new Set(GULF_TRADITIONS),
  mena: new Set([
    "Sadu weaving",
    "mashrabiya screens",
    "Najdi painted doors",
    "Al Qatt Al Asiri",
    "Hejazi rawashin windows",
    "Emirati talli braiding",
    "Omani silver jewelry",
    "Yemeni qamariya windows",
    "girih tiles",
    "Moroccan zellige",
    "Moroccan Berber rugs",
    "Tunisian blue doors",
    "Egyptian khayamiya",
    "Nubian house painting",
    "Palestinian tatreez",
    "Damascus brocade",
    "Mesopotamian cylinder seals",
    "Turkish Iznik tiles",
    "Turkish ebru marbling",
    "Persian rug borders",
    "Persian miniature painting",
    "Iranian termeh",
    "kilim rugs",
  ]),
};

/**
 * Constraints (lists/constraints.json keys) that only work in Latin script: Arabic has no capitals,
 * small caps or italics, few serif or mono faces, and is joined, never hand-lettered letter by letter.
 */
export const LATIN_ONLY_CONSTRAINTS: ReadonlySet<string> = new Set([
  "serif type only",
  "monospace type only",
  "all caps, everywhere",
  "lowercase letters only",
  "labels in small caps",
  "every heading in italics",
  "every word hand-lettered",
  "ASCII characters only",
  "8-bit pixels only",
]);

/** An Arabic face (Google Fonts, open licence) that pairs with each type voice. */
export const ARABIC_FACE: Readonly<Record<TypeVoice, string>> = {
  grotesk: "IBM Plex Sans Arabic",
  "neo-grotesk": "Noto Sans Arabic",
  "serif-editorial": "Noto Naskh Arabic",
  "serif-classic": "Amiri",
  mono: "IBM Plex Sans Arabic with tabular numbers (Arabic has no true mono)",
  condensed: "Noto Kufi Arabic",
  rounded: "Tajawal",
  "display-retro": "Lalezar for display, Noto Sans Arabic for body",
  "script-hand": "Aref Ruqaa for display only, Noto Naskh Arabic for body",
  slab: "Noto Kufi Arabic",
};
