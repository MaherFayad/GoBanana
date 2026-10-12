/**
 * export_kit: turns a canvas snapshot into text files. The server returns text;
 * the agent writes the files. Pure: no network, DB or Workers bindings.
 */
import type { CanvasSnapshot } from "../canvas/types";
import { agentsMd } from "./agents-md";
import { briefMd } from "./brief";
import { buildPromptMd } from "./build-prompt";
import { designMd } from "./design-md";
import { directionMd } from "./direction-md";
import { figjamSpecJson } from "./figjam-spec";
import { claudeMdSection, copilotInstructions, cursorRule } from "./harness";
import { htmlBoard } from "./html-board";
import { buildKitModel, type KitModel, type KitOptions } from "./model";
import { reviewMd } from "./review";
import { STITCH_MD_FILE, stitchMd, WIREFRAME_FILE } from "./stitch-md";
import { wireframeHtml } from "./wireframe-html";
import { appSlug } from "./scope";
import { tailwindCss } from "./tailwind";
import { tokensJson } from "./tokens";

export const EXPORT_FORMATS = [
  "design_md",
  "agents_md",
  "tokens",
  "tailwind",
  "figjam_spec",
  "html_board",
  "brief",
  "direction_md",
  "build_prompt",
  "review",
  "cursor_rules",
  "copilot",
  "claude_md",
  "stitch_md",
  "wireframe_html",
] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportFile {
  name: string;
  mime: string;
  content: string;
  /** Suggested path in the user's repo, relative to its root. */
  path: string;
  /**
   * True when the content is a marked section of an existing root file (AGENTS.md, CLAUDE.md):
   * replace the block between the same markers if it is there, else append it.
   */
  append?: boolean;
}

interface Generator {
  name: (m: KitModel) => string;
  mime: string;
  build: (m: KitModel) => string;
  path: (m: KitModel) => string;
  append?: (m: KitModel) => boolean;
}

const inDir = (file: string) => (m: KitModel) => `${m.dir}/${file}`;
const fixed = (file: string) => () => file;

/**
 * Root AGENTS.md and CLAUDE.md content goes between `<!-- app:slug -->` markers, so agents can
 * replace the block on the next export instead of appending a second copy.
 */
export function markerName(m: KitModel): string {
  return `${appSlug()}:${m.slug}`;
}
const marked = (build: (m: KitModel) => string) => (m: KitModel) =>
  `<!-- ${markerName(m)} -->\n${build(m).trimEnd()}\n<!-- /${markerName(m)} -->\n`;

const GENERATORS: Record<ExportFormat, Generator> = {
  design_md: { name: fixed("DESIGN.md"), mime: "text/markdown", build: designMd, path: (m) => (m.scope === "system" ? "DESIGN.md" : `${m.dir}/DESIGN.md`) },
  agents_md: { name: fixed("AGENTS.md"), mime: "text/markdown", build: marked(agentsMd), path: fixed("AGENTS.md"), append: () => true },
  tokens: { name: fixed("tokens.json"), mime: "application/json", build: tokensJson, path: inDir("kit/tokens.json") },
  tailwind: { name: fixed("theme.css"), mime: "text/css", build: tailwindCss, path: inDir("kit/theme.css") },
  figjam_spec: { name: fixed("figjam-spec.json"), mime: "application/json", build: figjamSpecJson, path: inDir("figjam-spec.json") },
  html_board: { name: fixed("board.html"), mime: "text/html", build: htmlBoard, path: inDir("board.html") },
  brief: { name: fixed("BRIEF.md"), mime: "text/markdown", build: briefMd, path: inDir("BRIEF.md") },
  direction_md: { name: fixed("DIRECTION.md"), mime: "text/markdown", build: directionMd, path: inDir("DIRECTION.md") },
  build_prompt: { name: fixed("BUILD-PROMPT.md"), mime: "text/markdown", build: buildPromptMd, path: inDir("BUILD-PROMPT.md") },
  review: { name: fixed("REVIEW.md"), mime: "text/markdown", build: reviewMd, path: inDir("REVIEW.md") },
  cursor_rules: {
    name: (m) => `${appSlug()}-${m.slug}.mdc`,
    mime: "text/markdown",
    build: cursorRule,
    path: (m) => `.cursor/rules/${appSlug()}-${m.slug}.mdc`,
  },
  copilot: {
    name: (m) => `${appSlug()}-${m.slug}.instructions.md`,
    mime: "text/markdown",
    build: copilotInstructions,
    path: (m) => `.github/instructions/${appSlug()}-${m.slug}.instructions.md`,
  },
  claude_md: { name: fixed("CLAUDE.md"), mime: "text/markdown", build: marked(claudeMdSection), path: fixed("CLAUDE.md"), append: () => true },
  stitch_md: { name: fixed(STITCH_MD_FILE), mime: "text/markdown", build: stitchMd, path: inDir(STITCH_MD_FILE) },
  wireframe_html: { name: fixed(WIREFRAME_FILE), mime: "text/html", build: wireframeHtml, path: inDir(WIREFRAME_FILE) },
};

export function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === "string" && (EXPORT_FORMATS as readonly string[]).includes(value);
}

/** Build the requested files, in the order asked, once each. Unknown formats are skipped. */
export function exportKit(snapshot: CanvasSnapshot, formats: readonly ExportFormat[], opts: KitOptions = {}): ExportFile[] {
  const wanted = [...new Set(formats)].filter(isExportFormat);
  if (wanted.length === 0) return [];
  const model = buildKitModel(snapshot, opts);
  return wanted.map((f) => {
    const g = GENERATORS[f];
    const file: ExportFile = {
      name: g.name(model),
      mime: g.mime,
      // Last guard for the plain-words rule: no em dashes in any output.
      content: g.build(model).replace(/—/g, "-"),
      path: g.path(model),
    };
    if (g.append?.(model)) file.append = true;
    return file;
  });
}

export { buildKitModel } from "./model";
export type { KitModel, KitOptions } from "./model";
export { SCOPES, MAX_PAGES, appSlug, type Scope } from "./scope";
