/**
 * Deterministic role assignment from OKLCH lightness and chroma.
 *
 * Roles are filled in this order, stopping when colors run out:
 * 1. surface: the lightest or the darkest color, whichever covers more of the image
 *    (ties go to the lightest).
 * 2. on-surface: the remaining color with the highest contrast against surface.
 * 3. primary: the most common remaining chromatic color (chroma >= 0.03), else the most common.
 * 4. accent: the remaining color with the highest chroma.
 * 5. neutral: the remaining color with the lowest chroma.
 * 6. secondary: the most common remaining color.
 * Extra colors (sizes 7 to 9) become "neutral" when nearly gray, else "secondary".
 * Every tie is broken by hex, so the same input always gives the same roles.
 */
import { hexToOklchColor } from "./color";
import { contrastRatio } from "./contrast";

export const ROLES = ["primary", "secondary", "accent", "neutral", "surface", "on-surface"] as const;
export type Role = (typeof ROLES)[number];

export interface RoleInput {
  hex: string;
  /** Relative weight in the image (count or share). */
  weight: number;
}

export interface RoledColor {
  hex: string;
  role: Role;
  l: number;
  c: number;
  h: number;
  weight: number;
}

const CHROMATIC = 0.03;
const GRAY = 0.04;

type Entry = { hex: string; weight: number; l: number; c: number; h: number };

function byHex(a: Entry, b: Entry): number {
  return a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0;
}

/** Pick the entry with the highest score; ties by hex ascending. */
function pickMax(list: Entry[], score: (e: Entry) => number): Entry | undefined {
  let best: Entry | undefined;
  let bestScore = -Infinity;
  for (const e of [...list].sort(byHex)) {
    const s = score(e);
    if (s > bestScore) {
      best = e;
      bestScore = s;
    }
  }
  return best;
}

export function assignRoles(colors: readonly RoleInput[]): RoledColor[] {
  const pool: Entry[] = [];
  const seen = new Set<string>();
  for (const c of colors) {
    const hex = c.hex.toLowerCase();
    if (seen.has(hex)) continue;
    seen.add(hex);
    pool.push({ hex, weight: c.weight, ...hexToOklchColor(hex) });
  }

  const out: RoledColor[] = [];
  const take = (e: Entry | undefined, role: Role) => {
    if (!e) return;
    pool.splice(pool.indexOf(e), 1);
    out.push({ ...e, role });
  };

  // 1. surface
  if (pool.length > 0) {
    const lightest = pickMax(pool, (e) => e.l) as Entry;
    const darkest = pickMax(pool, (e) => -e.l) as Entry;
    take(darkest.weight > lightest.weight ? darkest : lightest, "surface");
  }
  const surface = out[0];
  // 2. on-surface
  if (surface) take(pickMax(pool, (e) => contrastRatio(e.hex, surface.hex)), "on-surface");
  // 3. primary
  const chromatic = pool.filter((e) => e.c >= CHROMATIC);
  take(pickMax(chromatic.length > 0 ? chromatic : pool, (e) => e.weight), "primary");
  // 4. accent
  take(pickMax(pool, (e) => e.c), "accent");
  // 5. neutral
  take(pickMax(pool, (e) => -e.c), "neutral");
  // 6. secondary
  take(pickMax(pool, (e) => e.weight), "secondary");
  // Extras, most common first.
  while (pool.length > 0) {
    const e = pickMax(pool, (x) => x.weight) as Entry;
    take(e, e.c < GRAY ? "neutral" : "secondary");
  }

  const order = (r: Role) => ROLES.indexOf(r);
  // Stable sort: extras keep their weight order after the main role of the same name.
  return out.sort((a, b) => order(a.role) - order(b.role));
}
