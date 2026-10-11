/** Accessible names and short copy for nodes. Plain words, no em dashes. */
import { findPairing } from "./fonts";
import { siteFromUrl } from "./state";
import type { CanvasFlowNode, Tag } from "./types";

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

export function nodeLabel(n: CanvasFlowNode): string {
  switch (n.type) {
    case "image":
    case "upload": {
      const what = n.type === "upload" ? "Your image" : "Image";
      const site = n.type === "upload" ? "your uploads" : siteName(n.data.sourceSite, n.data.sourceUrl);
      const tag = n.data.tag ? `, ${tagLabel(n.data.tag)}` : "";
      return `${what}: ${n.data.title || "Untitled"}, from ${site}${tag}`;
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
  }
}
