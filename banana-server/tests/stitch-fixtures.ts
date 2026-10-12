/** Shared fixtures for the stitch ("Frankenstein it") tests. */
import type { Part, PartRole } from "@/lib/stitch/types";

export function part(id: string, role: PartRole, src: number, over: Partial<Part> = {}): Part {
  return {
    id,
    role,
    imageUrl: `https://cdn.dribbble.com/shot/${src}.png`,
    sourceUrl: `https://dribbble.com/shots/${src}`,
    sourceSite: "dribbble.com",
    title: `Shot ${src}`,
    crop: { x: 0, y: 0, w: 1, h: 0.2 },
    imageWidth: 1600,
    imageHeight: 1200,
    ...over,
  };
}

/** A library over 3 source pages: one nav, hero, cards and footer part cut from each. */
export function library(): Part[] {
  const roles: PartRole[] = ["nav", "hero", "cards", "footer"];
  return roles.flatMap((role) => [1, 2, 3].map((s) => part(`pt-${role}${s}`, role, s)));
}

