/**
 * Each type voice (lib/direction-detail.ts TYPE_VOICES) as four named Google Fonts: Latin display,
 * Latin body, Arabic display and Arabic body. Exports name these so a builder never falls back to
 * a system default. All are open licence (OFL-1.1) on Google Fonts. No Inter, Roboto or Arial.
 */
import type { TypeVoice } from "@/lib/direction-detail";

export interface VoiceFont {
  family: string;
  weight: number;
  fallback: string;
}

export interface VoiceFonts {
  voice: TypeVoice;
  latinDisplay: VoiceFont;
  latinBody: VoiceFont;
  arabicDisplay: VoiceFont;
  arabicBody: VoiceFont;
}

const f = (family: string, weight: number, fallback = "sans-serif"): VoiceFont => ({ family, weight, fallback });

const TABLE: Record<TypeVoice, Omit<VoiceFonts, "voice">> = {
  grotesk: { latinDisplay: f("Space Grotesk", 700), latinBody: f("Public Sans", 400), arabicDisplay: f("Readex Pro", 700), arabicBody: f("IBM Plex Sans Arabic", 400) },
  "neo-grotesk": { latinDisplay: f("Hanken Grotesk", 700), latinBody: f("Figtree", 400), arabicDisplay: f("IBM Plex Sans Arabic", 700), arabicBody: f("Noto Sans Arabic", 400) },
  "serif-editorial": { latinDisplay: f("Instrument Serif", 400, "serif"), latinBody: f("Inter Tight", 400), arabicDisplay: f("El Messiri", 700), arabicBody: f("Noto Naskh Arabic", 400, "serif") },
  "serif-classic": { latinDisplay: f("Playfair Display", 700, "serif"), latinBody: f("Source Sans 3", 400), arabicDisplay: f("Amiri", 700, "serif"), arabicBody: f("Scheherazade New", 400, "serif") },
  mono: { latinDisplay: f("Space Mono", 700, "monospace"), latinBody: f("Space Grotesk", 400), arabicDisplay: f("Noto Kufi Arabic", 700), arabicBody: f("IBM Plex Sans Arabic", 400) },
  condensed: { latinDisplay: f("Anton", 400), latinBody: f("Work Sans", 400), arabicDisplay: f("Lalezar", 400), arabicBody: f("Vazirmatn", 400) },
  rounded: { latinDisplay: f("Fredoka", 600), latinBody: f("Nunito", 400), arabicDisplay: f("Baloo Bhaijaan 2", 700), arabicBody: f("Tajawal", 400) },
  "display-retro": { latinDisplay: f("Shrikhand", 400, "serif"), latinBody: f("DM Sans", 400), arabicDisplay: f("Lemonada", 700), arabicBody: f("Almarai", 400) },
  "script-hand": { latinDisplay: f("Caveat", 700, "cursive"), latinBody: f("Nunito Sans", 400), arabicDisplay: f("Aref Ruqaa", 700, "serif"), arabicBody: f("Tajawal", 400) },
  slab: { latinDisplay: f("Zilla Slab", 700, "serif"), latinBody: f("IBM Plex Sans", 400), arabicDisplay: f("Reem Kufi", 700), arabicBody: f("IBM Plex Sans Arabic", 400) },
};

export const DEFAULT_VOICE: TypeVoice = "grotesk";

export function voiceFonts(voice: TypeVoice | null | undefined): VoiceFonts {
  const v = voice && TABLE[voice] ? voice : DEFAULT_VOICE;
  return { voice: v, ...TABLE[v] };
}

/** The type block of an Atlas ingredient card (lib/atlas/types.ts IngredientCard["type"]). */
export interface CardType {
  voice: string;
  latin: { display: string; body: string };
  arabic: { display: string; body: string };
}

/**
 * A card's four fonts (P1-I5): its named families, display 700 and body 400 (the voice's Arabic
 * weights), with the fallbacks of its voice. A family the card leaves empty comes from the voice.
 */
export function cardVoiceFonts(type: CardType | null | undefined): VoiceFonts {
  const base = voiceFonts(TABLE[type?.voice as TypeVoice] ? (type?.voice as TypeVoice) : null);
  const named = (family: string | undefined, from: VoiceFont, weight = from.weight): VoiceFont =>
    family?.trim() ? { family: family.trim(), weight, fallback: from.fallback } : from;
  return {
    voice: base.voice,
    latinDisplay: named(type?.latin?.display, base.latinDisplay, 700),
    latinBody: named(type?.latin?.body, base.latinBody, 400),
    arabicDisplay: named(type?.arabic?.display, base.arabicDisplay),
    arabicBody: named(type?.arabic?.body, base.arabicBody),
  };
}

/** One Google Fonts css2 link that loads all four families. */
export function voiceFontsUrl(fonts: VoiceFonts): string {
  const byFamily = new Map<string, Set<number>>();
  for (const font of [fonts.latinDisplay, fonts.latinBody, fonts.arabicDisplay, fonts.arabicBody]) {
    const set = byFamily.get(font.family) ?? new Set<number>();
    set.add(font.weight);
    byFamily.set(font.family, set);
  }
  const params = [...byFamily].map(([family, weights]) => `family=${family.replace(/ /g, "+")}:wght@${[...weights].sort((a, b) => a - b).join(";")}`);
  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}

/** "Space Grotesk 700 (Latin display), Public Sans 400 (Latin body), ..." */
export function voiceFontsText(fonts: VoiceFonts): string {
  return [
    `${fonts.latinDisplay.family} ${fonts.latinDisplay.weight} (Latin display)`,
    `${fonts.latinBody.family} ${fonts.latinBody.weight} (Latin body)`,
    `${fonts.arabicDisplay.family} ${fonts.arabicDisplay.weight} (Arabic display)`,
    `${fonts.arabicBody.family} ${fonts.arabicBody.weight} (Arabic body)`,
  ].join(", ");
}
