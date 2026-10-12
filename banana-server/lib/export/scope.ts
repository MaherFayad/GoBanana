/**
 * Export scope. "page" (default): the kit is one wild exploration for a page or two, layered on
 * top of the project's own design system. "system": the old behavior, the kit is the system.
 */
import { APP_NAME } from "../config";
import { mdText, oneLine, tokenName } from "./util";

export const SCOPES = ["page", "system"] as const;
export type Scope = (typeof SCOPES)[number];

export const MAX_PAGES = 5;

/** Page words found in briefs, longest first, with the route slug they map to. */
const PAGE_WORDS: [RegExp, string, string][] = [
  [/\byear in review\b/i, "year in review", "year-in-review"],
  [/\bempty states?\b/i, "empty state", "empty-state"],
  [/\b(launch|landing) page\b/i, "launch page", "launch"],
  [/\bhome ?(screen|page)\b/i, "home screen", "home"],
  [/\bonboarding\b/i, "onboarding", "onboarding"],
  [/\bpricing\b/i, "pricing page", "pricing"],
  [/\bcheckout\b/i, "checkout", "checkout"],
  [/\bpaywall\b/i, "paywall", "paywall"],
  [/\bsettings\b/i, "settings", "settings"],
  [/\bsplash\b/i, "splash screen", "splash"],
  [/\b404\b|\bnot found page\b/i, "404 page", "not-found"],
  [/\bdashboard\b/i, "dashboard", "dashboard"],
  [/\bprofile\b/i, "profile", "profile"],
  [/\b(sign ?up|register)\b/i, "sign up", "signup"],
  [/\b(log ?in|sign ?in)\b/i, "log in", "login"],
  [/\bcart\b/i, "cart", "cart"],
  [/\bsearch (screen|page)\b/i, "search", "search"],
];

/** Guess the page from the brief ("personal finance app home screen" gives "home screen"). */
export function inferPages(brief: string | null | undefined): string[] {
  const text = brief ?? "";
  for (const [re, page] of PAGE_WORDS) if (re.test(text)) return [page];
  return [];
}

/** Clean user page names: one line, at most 80 chars, unique, at most MAX_PAGES. */
export function cleanPages(pages: readonly unknown[] | null | undefined): string[] {
  const out: string[] = [];
  for (const p of pages ?? []) {
    if (typeof p !== "string") continue;
    const v = oneLine(p, 80);
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= MAX_PAGES) break;
  }
  return out;
}

const GLOB_SAFE = /[^A-Za-z0-9_\-./*?{}[\]()@+!]/g;

function slugFromName(name: string): string {
  for (const [re, , slug] of PAGE_WORDS) if (re.test(name)) return slug;
  return tokenName(name.replace(/\b(the|page|screen|view|route|flow)\b/gi, " "));
}

/** File globs for one page: a path or glob is kept, a route or a name becomes `**\/name/**`. */
export function pageGlobs(page: string): string[] {
  const p = page.trim();
  const looksLikePath = !p.startsWith("/") && (/[*?{]/.test(p) || /^[\w.@()[\]-]+\/[\w./@()[\]*-]*$/.test(p));
  if (looksLikePath) {
    const g = p.replace(/^\.\//, "").replace(GLOB_SAFE, "").replace(/\.\.+\//g, "");
    return g ? [g] : [];
  }
  if (p.startsWith("/")) {
    const segs = p
      .split("/")
      .map((s) => s.replace(/^[[(].*[\])]$/, "").replace(GLOB_SAFE, ""))
      .filter((s) => s && s !== "." && s !== "..");
    if (segs.length === 0) return ["**/app/page.*", "**/pages/index.*"];
    const route = segs.join("/");
    return [`**/${route}/**`, `**/${route}.*`];
  }
  const slug = slugFromName(p);
  return slug ? [`**/${slug}/**`, `**/${slug}.*`] : [];
}

export function globsFor(pages: readonly string[]): string[] {
  return [...new Set(pages.flatMap(pageGlobs))];
}

export function kitSlug(title: string): string {
  const s = tokenName(title).slice(0, 48).replace(/-+$/, "");
  return s || "wild-page";
}

/** App prefix for harness file names, from APP_NAME (never hardcoded). */
export function appSlug(): string {
  return tokenName(APP_NAME) || "app";
}

export function explorationDir(slug: string): string {
  return `design/explorations/${slug}`;
}

/** "pricing page (`**\/pricing/**`)" style list for prose. */
export function pagesText(pages: readonly string[], brief: string): string {
  if (pages.length === 0) {
    return brief ? `the screen in the brief ("${mdText(brief, 160)}")` : "the page named in the brief";
  }
  return pages.map((p) => mdText(p, 80)).join(", ");
}

export function globsText(globs: readonly string[]): string {
  return globs.length > 0 ? globs.map((g) => `\`${g}\``).join(", ") : "no file paths yet";
}

export interface ScopeInfo {
  scope: Scope;
  pages: string[];
  globs: string[];
  brief: string;
  dir: string;
}

/**
 * The short scope block every page scope file opens with (Markdown).
 * Returns an empty array for system scope.
 */
export function scopeBlock(s: ScopeInfo): string[] {
  if (s.scope !== "page") return [];
  const where = pagesText(s.pages, s.brief);
  const lines = [
    `> **Scope: one wild page, not the product design system.** Applies only to: ${where}.`,
    `> Files: ${globsText(s.globs)}.${s.globs.length === 0 ? " Name the page files before building." : ""}`,
    "> This inherits the project's own design system and its existing DESIGN.md, and does not change them.",
    `> Tokens here are page level overrides: use them only inside these pages. The full spec lives in \`${s.dir}/\`.`,
  ];
  return lines;
}

/** Plain text version for JSON and CSS comments. */
export function scopeSentence(s: ScopeInfo): string {
  if (s.scope !== "page") return "Scope: product design system.";
  const where = s.pages.length > 0 ? s.pages.map((p) => oneLine(p, 80)).join(", ") : "the screen in the brief";
  return `Scope: one wild page, not the product design system. Applies only to: ${where}. Inherits the project's own design system and existing DESIGN.md and does not change them. Tokens here are page level overrides.`;
}
