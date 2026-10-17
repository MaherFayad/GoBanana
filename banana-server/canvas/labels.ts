/** Accessible names and short copy for nodes. Plain words, no em dashes. */
import { findPairing } from "./fonts";
import { siteFromUrl } from "./state";
import type { CanvasFlowNode, Tag } from "./types";

/** Row labels inside a section with art direction items (lib/layout zones). */
export const ZONE_LABELS = { art: "Art direction", ui: "UI references" } as const;

export function tagLabel(tag: Tag): string {
  return tag === "ship" ? "Ship" : "Explore";
}

/** "pinterest.com" from a sourceSite value like "pinterest", "www.pinterest.com" or a URL. */
export function siteName(sourceSite: string | null | undefined, sourceUrl: string): string {
  const s = (sourceSite ?? "").trim();
  if (!s) return siteFromUrl(sourceUrl);
  if (/^https?:\/\//i.test(s)) return siteFromUrl(s);
  return s.replace(/^www\./i, "");
}

/** Accessible name of a node. Ends with ", selected" while it is selected (SC 1.4.1: not color alone). */
export function nodeLabel(n: CanvasFlowNode): string {
  const base = baseLabel(n);
  return n.selected ? `${base}, selected` : base;
}

function baseLabel(n: CanvasFlowNode): string {
  switch (n.type) {
    case "image":
    case "upload": {
      const what = n.type === "upload" ? "Your image" : n.data.zone === "art" ? "Art direction image" : "Image";
      const site = n.type === "upload" ? "your uploads" : siteName(n.data.sourceSite, n.data.sourceUrl);
      const tag = n.data.tag ? `, ${tagLabel(n.data.tag)}` : "";
      const cluster = n.data.cluster ? `, cluster ${n.data.cluster}` : "";
      const becomes = n.type === "image" && n.data.zone === "art" && n.data.becomes ? `, becomes ${n.data.becomes}` : "";
      return `${what}: ${n.data.title || "Untitled"}, from ${site}${tag}${cluster}${becomes}`;
    }
    case "note": {
      const text = n.data.text.trim();
      return `Note: ${text ? text.slice(0, 80) : "empty"}`;
    }
    case "swatch":
      return `Color ${n.data.hex}${n.data.role ? `, ${n.data.role}` : ""}, ${tagLabel(n.data.tag)}`;
    case "typeSample":
      return `Type sample: ${findPairing(n.data.pairingId)?.name ?? n.data.pairingId}`;
    case "section":
      return `Section: ${n.data.title}${n.data.collapsed ? ", collapsed" : ""}`;
    case "stitch":
      return `Frankenstein page: ${n.data.title}, ${n.data.rows.length} row${n.data.rows.length === 1 ? "" : "s"}`;
  }
}

/** Short name used inside menu labels, for example "Options for Note". */
export function shortLabel(n: CanvasFlowNode): string {
  switch (n.type) {
    case "image":
    case "upload":
      return n.data.title || "image";
    case "note":
      return "note";
    case "swatch":
      return `color ${n.data.hex}`;
    case "typeSample":
      return "type sample";
    case "section":
      return `section ${n.data.title}`;
    case "stitch":
      return `Frankenstein page ${n.data.title}`;
  }
}
