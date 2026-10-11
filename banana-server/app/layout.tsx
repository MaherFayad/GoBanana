import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { APP_NAME } from "@/lib/config";
import { DEFAULT_LOCALE, LOCALE_HEADER, dirOf, isLocale } from "@/lib/site/i18n";
import "@/styles/fonts.css";
import "@/styles/studio-tokens.css";
import "@/styles/studio-components.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Wild design references and a moodboard canvas for your AI agent.",
};

// Dark only (owner decision): the tokens' light blocks never apply under data-theme="dark".
export const viewport: Viewport = { colorScheme: "dark" };

// proxy.ts sets x-site-locale on /en/* and /ar/*, so <html lang dir> is right on every
// site page (WCAG 2.2 SC 3.1.1). Other routes (canvas, API) fall back to English.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const requested = (await headers()).get(LOCALE_HEADER);
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  return (
    <html lang={locale} dir={dirOf(locale)} data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
