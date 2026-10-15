/**
 * P1-J8 page jobs: one default single-file HTML page per Bench brief, from one model. The pages
 * themselves stay in raw/<job>.jsonl (the reply text); the records are only a receipt per page.
 * slop-analyze.ts renders them and writes the SlopRule[] output.
 */
import { z } from "zod";
import type { ModelId } from "../config.ts";
import { loadBriefs } from "../jobs/j8-briefs.ts";
import type { BenchBrief } from "../schema.ts";
import { defineJob, type AtlasJob } from "./job.ts";

export const PageReceiptSchema = z.object({ id: z.string(), model: z.string(), bytes: z.number().int().positive() });
export type PageReceipt = z.infer<typeof PageReceiptSchema>;

/** Viewports per platform for rendering. */
export const VIEWPORTS: Record<BenchBrief["platform"], { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1194 },
  website: { width: 1440, height: 900 },
  webapp: { width: 1440, height: 900 },
};

// Deliberately plain, like a user asking for a page: the point is to see the model's defaults.
const SYSTEM = "You are a helpful assistant that writes front-end code.";

/** The HTML document inside a reply: a fenced block when there is one, else the text from <!doctype or <html. */
export function extractHtml(text: string): string | null {
  const fence = /```(?:html)?\s*\n([\s\S]*?)(?:\n```|$)/i.exec(text);
  const body = fence?.[1] ?? text;
  const start = body.search(/<!doctype html|<html/i);
  return start >= 0 ? body.slice(start) : null;
}

export function pageJob(id: string, model: ModelId): AtlasJob<BenchBrief, PageReceipt> {
  return defineJob<BenchBrief, PageReceipt>({
    id,
    kind: `work-${id}`,
    model,
    mode: "batch",
    schema: PageReceiptSchema,
    system: SYSTEM,
    // Cost care: pages are capped at 8,000 output tokens (thinking included) at low effort.
    maxTokens: 8000,
    expectedOutputTokens: 5000,
    effort: "low",

    loadInputs: () => loadBriefs(),
    requestId: (b) => `page-${b.id}`.slice(0, 64),
    buildPrompt: (b) => {
      const vp = VIEWPORTS[b.platform];
      return `Design and build this as a single self-contained HTML file (inline CSS, no build step): ${b.brief}\n\nPlatform: ${b.platform} (about ${vp.width}px wide). Keep it under 300 lines. Reply with only the HTML.`;
    },
    parse: (text, b) => {
      const html = extractHtml(text);
      if (!html) throw new Error("no HTML document in the reply");
      return [{ id: b.id, model, bytes: Buffer.byteLength(html) }];
    },
  });
}
