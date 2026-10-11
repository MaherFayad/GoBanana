import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignGallery, type GalleryDir, type GalleryTheme } from "./DesignGallery";
import "./design.css";

/**
 * Test-only gallery of the Studio primitives (plan Step 0), served at /__design (the folder name
 * starts with %5F because a leading underscore marks a private folder in the App Router).
 * e2e/studio-primitives.spec.ts runs axe on it. It 404s in production builds.
 *
 * ?theme=light|dark and ?dir=ltr|rtl show one combination; no query shows all four.
 */
export const metadata: Metadata = { title: "Studio primitives", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

export default async function DesignPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  const theme = pick<GalleryTheme>(q.theme, ["light", "dark"]);
  const dir = pick<GalleryDir>(q.dir, ["ltr", "rtl"]);
  return <DesignGallery theme={theme} dir={dir} />;
}
