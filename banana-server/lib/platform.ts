/**
 * Platform: where a design lives (phone, tablet, website, web app). Decides which bend
 * constraints and elements make sense, the layout and density lines of a direction's visual
 * spec, and the UI words searches use. Pure and dependency free (rule based, no AI).
 */
import { isPlatform, type Platform } from "./direction-detail";

export type { Platform } from "./direction-detail";

export interface PlatformProfile {
  platform: Platform;
  /** Plain name for prompts and notes ("iPhone or Android app"). */
  label: string;
  /** Layout sentence for the visual spec: grid, margins, navigation. */
  grid: string;
  /** The grid alone, for joining after a constraint ("a 4 column grid with 16px margins"). */
  gridShort: string;
  /** Density sentence for the visual spec. */
  density: string;
  /** Display and body sizes for the typography line. */
  display: string;
  body: string;
  /** UI words for search queries ("app ui", "website", "dashboard ui"). */
  uiTail: string;
  /** Component used when the brief names none. */
  defaultComponent: string;
  /** Components a pattern can land on, in order of preference. */
  components: readonly string[];
  /** Motion note added to every direction on this platform. */
  motion: string;
  /** Things that break usability here (the spec's avoid list starts from these). */
  avoid: readonly string[];
  /**
   * List entries never picked on this platform, by list name and entry key (lib/bend/lists).
   * New entries can also carry their own "notOn" list.
   */
  banned: Readonly<Partial<Record<"constraints" | "elements" | "objects", readonly string[]>>>;
}

export const PLATFORM_PROFILES: Record<Platform, PlatformProfile> = {
  mobile: {
    platform: "mobile",
    label: "phone app",
    grid: "4 column grid, 16px margins, key actions in the thumb zone, a tab bar or bottom sheet.",
    gridShort: "a 4 column grid with 16px margins and actions in the thumb zone",
    density: "One idea per screen, 44pt tap targets, generous spacing on an 8pt rhythm.",
    display: "34px",
    body: "17px",
    uiTail: "app ui",
    defaultComponent: "card",
    components: ["bottom sheet", "tab bar", "card", "empty state"],
    motion: "Keep transitions under 300ms.",
    avoid: [
      "Tap targets under 44pt",
      "Detail hidden behind hover",
      "Body text under 16px",
      "Wide tables that scroll sideways",
    ],
    banned: {
      constraints: [
        "a strict 12 column grid, nothing breaks it",
        "everything rotated 90 degrees",
        "type set at 300 points",
        "text runs in a spiral",
        "split screen down the middle",
        "every word a different size",
      ],
      elements: ["mouse cursors"],
    },
  },
  tablet: {
    platform: "tablet",
    label: "tablet app",
    grid: "8 column grid, 24px margins, a split view or sidebar in landscape, sheets for actions.",
    gridShort: "an 8 column grid with 24px margins",
    density: "Two panes at most, 44pt tap targets, room for touch and keyboard.",
    display: "40px",
    body: "17px",
    uiTail: "ipad app ui",
    defaultComponent: "card",
    components: ["sidebar", "card", "bottom sheet", "empty state"],
    motion: "Keep transitions under 300ms.",
    avoid: ["Tap targets under 44pt", "A stretched phone layout", "Detail hidden behind hover"],
    banned: {
      constraints: [
        "a strict 12 column grid, nothing breaks it",
        "everything rotated 90 degrees",
        "text runs in a spiral",
        "a receipt-width column only",
      ],
      elements: ["mouse cursors"],
    },
  },
  website: {
    platform: "website",
    label: "website",
    grid: "12 column grid, fluid type, a scroll story that opens on a hero with one clear action.",
    gridShort: "a 12 column grid with fluid type",
    density: "Airy sections, one message per screen height, body text under 75 characters wide.",
    display: "clamp(48px, 8vw, 120px)",
    body: "18px",
    uiTail: "website",
    defaultComponent: "hero section",
    components: ["hero section", "section divider", "pricing table", "footer"],
    motion: "Scroll reveals stay subtle and never block reading.",
    avoid: [
      "A hero with no clear first action",
      "Body text wider than 75 characters",
      "Scroll jacking",
    ],
    banned: {},
  },
  webapp: {
    platform: "webapp",
    label: "web app",
    grid: "Sidebar shell with a 12 column content area, dense tables, full keyboard support.",
    gridShort: "a sidebar shell with a 12 column content area",
    density: "Dense, 8px rhythm, compact tables and filters, every action reachable by keyboard.",
    display: "28px",
    body: "14px",
    uiTail: "dashboard ui",
    defaultComponent: "data table",
    components: ["data table", "kpi card", "sidebar", "empty state"],
    motion: "Never move data while someone reads it.",
    avoid: [
      "Decoration inside data tables",
      "Motion on live numbers",
      "Low contrast on dense text",
      "Hiding actions from the keyboard",
    ],
    banned: {
      constraints: [
        "no buttons, only words you tap",
        "everything rotated 90 degrees",
        "text runs in a spiral",
        "everything overlaps",
        "one photo fills the whole screen",
        "photos only, no shapes",
        "a receipt-width column only",
        "70 percent empty space",
        "type set at 300 points",
        "diagonal layout only",
        "every word a different size",
        "one sentence per screen",
        "a single giant number per screen",
        "everything in one long scroll",
      ],
      elements: [],
    },
  },
  any: {
    platform: "any",
    label: "screen",
    grid: "A clear grid that suits the screen, with one strong focal point.",
    gridShort: "a clear grid",
    density: "Comfortable spacing on an 8px rhythm, one focal point per view.",
    display: "40px",
    body: "16px",
    uiTail: "ui design",
    defaultComponent: "card",
    components: ["card", "hero section", "empty state"],
    motion: "Keep transitions short.",
    avoid: ["Text below 4.5 to 1 contrast", "Controls that only work with a mouse"],
    banned: {},
  },
};

// ---------------------------------------------------------------------------
// Detection

/** Phrases checked in order. The first group that matches wins. */
const RULES: readonly { platform: Exclude<Platform, "any">; pattern: RegExp }[] = [
  // Device words beat everything: "dashboard app on iPhone" is a phone app.
  { platform: "tablet", pattern: /\b(ipad|ipados|tablets?)\b|آيباد|ايباد|تابلت|جهاز لوحي/ },
  {
    platform: "mobile",
    pattern:
      /\b(iphone|ios|android|smartphones?|phones?|mobile apps?|apple watch|smart ?watch|watch ?os|wear ?os|watch apps?)\b|آيفون|ايفون|أندرويد|اندرويد|جوال|موبايل|هاتف/,
  },
  // Marketing pages beat product words: "pricing page for a saas tool" is a website.
  {
    platform: "website",
    pattern:
      /\b(landing ?pages?|websites?|home ?pages?|marketing (site|pages?)|portfolio (site|website)|personal site|blogs?|pricing pages?|launch pages?|campaign (site|pages?)|microsites?|web ?site)\b|صفحة هبوط|موقع/,
  },
  {
    platform: "webapp",
    pattern:
      /\b(dashboards?|web ?apps?|saas|admin( panel)?|console|crm|erp|analytics tools?|back ?office|internal tools?|cms|b2b)\b|لوحة تحكم|لوحة معلومات/,
  },
  // Mobile words, weaker than any web word above.
  { platform: "mobile", pattern: /\b(mobile|apps?|app screens?|home screen|lock screen)\b|تطبيق/ },
  { platform: "website", pattern: /\b(site|web ?pages?|pages?)\b|صفحة/ },
];

/** Where the brief's design lives, by its words. "any" when it does not say. */
export function detectPlatform(brief: string): Platform {
  const text = ` ${brief.toLowerCase().replace(/[^\p{L}\p{N}\s-]+/gu, " ")} `;
  // "mobile web" and "responsive website" are websites.
  if (/\b(mobile web|responsive (web ?site|site|website))\b/.test(text)) return "website";
  for (const rule of RULES) if (rule.pattern.test(text)) return rule.platform;
  return "any";
}

/** The override when it is a platform, else the detected one. */
export function resolvePlatform(brief: string, override?: unknown): Platform {
  return isPlatform(override) ? override : detectPlatform(brief);
}

/** True when a list entry may be used on the platform. */
export function allowedOn(
  platform: Platform,
  list: string,
  key: string,
  notOn?: readonly string[],
): boolean {
  if (notOn?.includes(platform)) return false;
  const banned = (PLATFORM_PROFILES[platform].banned as Record<string, readonly string[] | undefined>)[list];
  return !banned?.includes(key);
}
