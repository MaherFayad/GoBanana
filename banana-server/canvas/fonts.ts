/** Font pairings from `lib/kit/fonts.json` (open-licence fonts only). */
import fontsJson from "@/lib/kit/fonts.json";

export interface FontFace {
  family: string;
  weight: number;
  fallback: string;
}

export interface FontPairing {
  id: string;
  name: string;
  display: FontFace;
  body: FontFace;
  sample: string;
  /** Google Fonts stylesheet URL. */
  url?: string;
}

const data = fontsJson as unknown as { default: string; pairings: FontPairing[] };

export const FONT_PAIRINGS: readonly FontPairing[] = data.pairings;
export const DEFAULT_PAIRING_ID: string = data.default;

export function findPairing(id: string): FontPairing | undefined {
  return FONT_PAIRINGS.find((p) => p.id === id);
}

/** The pairing after `id`, wrapping around. */
export function nextPairingId(id: string): string {
  const i = FONT_PAIRINGS.findIndex((p) => p.id === id);
  const next = FONT_PAIRINGS[(i + 1) % FONT_PAIRINGS.length];
  return next?.id ?? DEFAULT_PAIRING_ID;
}

export function fontStack(face: FontFace): string {
  return `"${face.family}", ${face.fallback}`;
}
