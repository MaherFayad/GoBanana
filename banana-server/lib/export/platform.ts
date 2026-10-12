/**
 * Platform defaults for exports: grid, margins, targets, type scale and spacing per platform,
 * so a phone brief never gets a 12 column grid or a 48px display line.
 *
 * When a direction has no saved platform, `inferPlatform` reads the brief with lib/platform.ts
 * `detectPlatform` (bend's detector).
 */
import { isPlatform, type Platform } from "../direction-detail";
import { detectPlatform } from "../platform";
import type { Dim } from "./model";

export interface ExportPlatform {
  id: Platform;
  /** Plain name, for example "Mobile app (phone)". */
  label: string;
  columns: string;
  margins: string;
  targets: string;
  /** Type sizes in px for the display, headline, body and label tokens. */
  type: { display: number; headline: number; body: number; label: number };
  /** Fluid CSS sizes (websites only), written as clamp(). */
  fluid: { display: string; headline: string } | null;
  spacing: [string, Dim][];
  /** One paragraph on the grid and shell. */
  layout: string;
  /** Hard constraints a builder must respect on this platform. */
  constraints: string[];
  /** Viewports to screenshot when reviewing. */
  screenshots: string;
  /** Platform items for the review checklist. */
  checks: string[];
}

const px = (value: number): Dim => ({ value, unit: "px" });
const scale = (...v: [number, number, number, number, number]): [string, Dim][] =>
  (["xs", "sm", "md", "lg", "xl"] as const).map((k, i) => [k, px(v[i]!)]);

export const EXPORT_PLATFORMS: Record<Platform, ExportPlatform> = {
  mobile: {
    id: "mobile",
    label: "Mobile app (phone)",
    columns: "4 columns",
    margins: "16px side margins",
    targets: "touch targets at least 44 by 44 pt on iOS and 48 by 48 dp on Android",
    type: { display: 34, headline: 28, body: 17, label: 15 },
    fluid: null,
    spacing: scale(4, 8, 16, 24, 32),
    layout:
      "Phone layout: 4 columns with 16px side margins and 16px gutters, one column of content. Main navigation sits in a bottom tab bar (3 to 5 tabs); extra choices open in a bottom sheet. Keep the main action in the bottom third, within thumb reach, and keep content inside the safe areas.",
    constraints: [
      "Respect the safe areas: status bar, notch or Dynamic Island, and the home indicator.",
      "Main navigation in a bottom tab bar with 3 to 5 tabs; secondary choices in a bottom sheet, not a hover menu.",
      "Touch targets at least 44 by 44 pt (iOS) or 48 by 48 dp (Android), with 8px between them.",
      "Text scales with the system setting (Dynamic Type or font scale) up to 200% without clipping.",
      "No hover states: every action works with a tap, and swipe actions have a visible button too.",
      "Type scale: display 34px, title 28px, body 17px, label 15px.",
    ],
    screenshots: "390 by 844 (iPhone) and 360 by 800 (Android), light and dark if the app has both",
    checks: [
      "4 columns, 16px side margins, nothing wider than the screen and no sideways scroll.",
      "Content stays clear of the status bar, notch and home indicator.",
      "Every touch target is at least 44 by 44 pt (48 by 48 dp on Android).",
      "Navigation is a bottom tab bar; extra choices open in a bottom sheet.",
      "Body text is 17px or larger and still fits at 200% text size.",
    ],
  },
  tablet: {
    id: "tablet",
    label: "Tablet app",
    columns: "8 columns",
    margins: "24px side margins",
    targets: "touch targets at least 44 by 44 pt on iOS and 48 by 48 dp on Android",
    type: { display: 40, headline: 28, body: 17, label: 15 },
    fluid: null,
    spacing: scale(4, 8, 16, 24, 48),
    layout:
      "Tablet layout: 8 columns with 24px side margins and 24px gutters. In landscape use a sidebar or split view (list on the left, detail on the right); in portrait collapse to one main column with the sidebar as a sheet. Keep content inside the safe areas.",
    constraints: [
      "Works in portrait and landscape, and in split screen next to another app.",
      "Landscape uses a sidebar or split view; portrait collapses it.",
      "Touch targets at least 44 by 44 pt (iOS) or 48 by 48 dp (Android); pointer hover is a bonus, never required.",
      "Text scales with the system setting up to 200% without clipping.",
      "Type scale: display 40px, title 28px, body 17px, label 15px.",
    ],
    screenshots: "820 by 1180 (portrait) and 1180 by 820 (landscape)",
    checks: [
      "8 columns with 24px side margins; landscape shows a sidebar or split view.",
      "The layout holds in portrait, landscape and split screen.",
      "Every touch target is at least 44 by 44 pt (48 by 48 dp on Android).",
    ],
  },
  website: {
    id: "website",
    label: "Website",
    columns: "12 columns",
    margins: "side margins clamp(16px, 4vw, 48px) and a 1200px max content width",
    targets: "targets at least 24 by 24 CSS px, main calls to action at least 44px tall",
    type: { display: 64, headline: 40, body: 18, label: 14 },
    fluid: { display: "clamp(2.5rem, 1.5rem + 4vw, 4rem)", headline: "clamp(1.75rem, 1.25rem + 2vw, 2.5rem)" },
    spacing: scale(4, 8, 16, 32, 96),
    layout:
      "Website layout: 12 columns inside a 1200px max width, 4 columns under 768px and 8 up to 1024px. Side margins clamp(16px, 4vw, 48px). Sections follow a steady rhythm: 96px between sections on desktop, 64px on phones. Type is fluid with clamp() so the display line shrinks on small screens.",
    constraints: [
      "12 columns from 1024px, 8 from 768px, 4 below; content max width 1200px.",
      "Fluid type: display clamp(2.5rem, 1.5rem + 4vw, 4rem), headline clamp(1.75rem, 1.25rem + 2vw, 2.5rem), body 18px.",
      "Section rhythm: 96px between sections on desktop, 64px on phones.",
      "Reflows at 320 CSS px wide with no sideways scroll (SC 1.4.10).",
      "One h1 per page, landmarks (header, main, footer) and a skip link.",
    ],
    screenshots: "1440 by 900 (desktop), 768 by 1024 (tablet) and 390 by 844 (phone)",
    checks: [
      "12 columns inside a 1200px max width on desktop, 4 columns on phones.",
      "Display and headline sizes are fluid (clamp()) and the display line fits at 320px wide.",
      "Sections follow the 96px desktop / 64px phone rhythm.",
      "One h1, landmark regions and a skip link.",
    ],
  },
  webapp: {
    id: "webapp",
    label: "Web app",
    columns: "a sidebar shell with a 12 column content area",
    margins: "24px content padding",
    targets: "targets at least 24 by 24 CSS px, table rows at least 32px tall",
    type: { display: 32, headline: 20, body: 14, label: 13 },
    fluid: null,
    spacing: scale(4, 8, 16, 24, 32),
    layout:
      "Web app layout: a sidebar shell (240px sidebar, collapsible to icons) with a 12 column content area and 24px padding. Dense 8px rhythm, body text 14 to 16px. Tables get sticky headers, right aligned numbers and tabular figures. Focus order follows the visual order, and every frequent action has a keyboard shortcut.",
    constraints: [
      "Sidebar shell with a 12 column content area; the sidebar collapses on narrow windows.",
      "Dense 8px rhythm; body text 14 to 16px; label 13px.",
      "Tables: sticky header, right aligned numbers, tabular figures, row height at least 32px.",
      "Keyboard: every action works without a mouse, focus order follows the visual order, shortcuts are listed and can be turned off (SC 2.1.4).",
      "A skip link to the main content and visible focus on every control.",
    ],
    screenshots: "1440 by 900 and 1280 by 800, plus one narrow window at 1024 wide",
    checks: [
      "Sidebar shell with a 12 column content area, collapsing on narrow windows.",
      "Dense 8px rhythm with body text between 14 and 16px.",
      "Tables have sticky headers, right aligned numbers and tabular figures.",
      "Every action works by keyboard, focus order follows the visual order, shortcuts are listed.",
    ],
  },
  any: {
    id: "any",
    label: "Any screen",
    columns: "4 columns on phones, 8 on tablets and 12 on desktop",
    margins: "16px side margins on phones, 24px on tablets, 32px or more on desktop",
    targets: "targets at least 24 by 24 CSS px (44 by 44 pt on touch screens)",
    type: { display: 48, headline: 32, body: 16, label: 14 },
    fluid: null,
    spacing: scale(4, 8, 16, 32, 64),
    layout:
      "No platform was set, so use a responsive grid: 4 columns on phones, 8 on tablets and 12 on desktop, with 16px side margins on phones. Let one bold element per screen carry the direction.",
    constraints: [
      "Responsive: 4 columns on phones, 8 on tablets, 12 on desktop.",
      "Targets at least 24 by 24 CSS px, 44 by 44 pt on touch screens.",
      "Reflows at 320 CSS px wide with no sideways scroll (SC 1.4.10).",
    ],
    screenshots: "1440 by 900 (desktop) and 390 by 844 (phone)",
    checks: [
      "The grid steps from 4 columns on phones to 12 on desktop.",
      "The page reflows at 320 CSS px wide with no sideways scroll.",
    ],
  },
};

/** Guess the platform from the brief text (the bend detector, so exports and bend agree). */
export function inferPlatform(brief: string | null | undefined): Platform {
  return detectPlatform(brief ?? "");
}

export function platformOf(value: unknown, brief: string | null | undefined): { platform: Platform; from: "direction" | "brief" | "default" } {
  if (isPlatform(value) && value !== "any") return { platform: value, from: "direction" };
  const guessed = inferPlatform(brief);
  return guessed === "any" ? { platform: "any", from: "default" } : { platform: guessed, from: "brief" };
}
