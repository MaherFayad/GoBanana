/**
 * export_kit: turns a canvas snapshot into text files. The server returns text;
 * the agent writes the files. Pure: no network, DB or Workers bindings.
 */
import type { CanvasSnapshot } from "../canvas/types";
import { agentsMd } from "./agents-md";
import { briefMd } from "./brief";
import { designMd } from "./design-md";
import { figjamSpecJson } from "./figjam-spec";
import { htmlBoard } from "./html-board";
import { buildKitModel, type KitModel } from "./model";
import { tailwindCss } from "./tailwind";
import { tokensJson } from "./tokens";

export const EXPORT_FORMATS = ["design_md", "agents_md", "tokens", "tailwind", "figjam_spec", "html_board", "brief"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportFile {
  name: string;
  mime: string;
  content: string;
}

const GENERATORS: Record<ExportFormat, { name: string; mime: string; build: (m: KitModel) => string }> = {
  design_md: { name: "DESIGN.md", mime: "text/markdown", build: designMd },
  agents_md: { name: "AGENTS.md", mime: "text/markdown", build: agentsMd },
  tokens: { name: "tokens.json", mime: "application/json", build: tokensJson },
  tailwind: { name: "theme.css", mime: "text/css", build: tailwindCss },
  figjam_spec: { name: "figjam-spec.json", mime: "application/json", build: figjamSpecJson },
  html_board: { name: "board.html", mime: "text/html", build: htmlBoard },
  brief: { name: "BRIEF.md", mime: "text/markdown", build: briefMd },
};

export function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === "string" && (EXPORT_FORMATS as readonly string[]).includes(value);
}

/** Build the requested files, in the order asked, once each. Unknown formats are skipped. */
export function exportKit(snapshot: CanvasSnapshot, formats: readonly ExportFormat[]): ExportFile[] {
  const wanted = [...new Set(formats)].filter(isExportFormat);
  if (wanted.length === 0) return [];
  const model = buildKitModel(snapshot);
  return wanted.map((f) => {
    const g = GENERATORS[f];
    // Last guard for the plain-words rule: no em dashes in any output.
    return { name: g.name, mime: g.mime, content: g.build(model).replace(/—/g, "-") };
  });
}

export { buildKitModel } from "./model";
export type { KitModel } from "./model";
