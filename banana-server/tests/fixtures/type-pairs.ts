/**
 * A tiny J12 type atlas for tests: bilingual pairs typed with lib/atlas/types.ts TypePair.
 * Plain words, no em dashes. Two voices have pairs; the others have none, to test the fallback.
 */
import type { TypePair } from "@/lib/atlas/types";

const pair = (id: string, voice: string, latin: [string, string], arabic: [string, string], s: [number, number, number, number]): TypePair => ({
  id,
  voice,
  latin: { display: latin[0], body: latin[1] },
  arabic: { display: arabic[0], body: arabic[1] },
  notes: `${latin[0]} and ${arabic[0]} share an even stroke, so the two headlines read as one voice. Keep Arabic body text at 16px or more.`,
  scores: { harmony: s[0] as 1, latinBody: s[1] as 1, arabicBody: s[2] as 1, hierarchy: s[3] as 1 },
});

export const TYPE_PAIRS: TypePair[] = [
  pair("archivo-work-sans-alexandria-noto-sans-arabic", "grotesk", ["Archivo", "Work Sans"], ["Alexandria", "Noto Sans Arabic"], [4, 4, 4, 4]),
  pair("space-grotesk-inter-readex-pro-ibm-plex-sans-arabic", "grotesk", ["Space Grotesk", "Inter"], ["Readex Pro", "IBM Plex Sans Arabic"], [5, 4, 5, 4]),
  pair("schibsted-grotesk-public-sans-rubik-rubik", "grotesk", ["Schibsted Grotesk", "Public Sans"], ["Rubik", "Rubik"], [3, 3, 3, 3]),
  pair("bitter-source-sans-3-kufam-noto-naskh-arabic", "slab", ["Bitter", "Source Sans 3"], ["Kufam", "Noto Naskh Arabic"], [4, 5, 4, 4]),
  pair("zilla-slab-roboto-noto-kufi-arabic-cairo", "slab", ["Zilla Slab", "Roboto"], ["Noto Kufi Arabic", "Cairo"], [3, 3, 4, 3]),
];
