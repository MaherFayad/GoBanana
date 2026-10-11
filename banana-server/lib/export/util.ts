/** Small pure helpers shared by the export generators. */

const EM_DASH = /\s*—\s*/g;

/** One line of plain text: no line breaks, no control chars, no em dashes. */
export function oneLine(text: string | null | undefined, max = 400): string {
  if (!text) return "";
  // eslint-disable-next-line no-control-regex
  let out = text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(EM_DASH, ", ").replace(/\s+/g, " ").trim();
  if (out.length > max) out = `${out.slice(0, max - 3).trimEnd()}...`;
  return out;
}

/** Multi-line plain text: keeps paragraphs but drops em dashes and control chars. */
export function plainBlock(text: string | null | undefined, max = 2000): string {
  if (!text) return "";
  return text
    .split(/\r?\n/)
    .map((line) => oneLine(line, max))
    .filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== ""))
    .join("\n")
    .trim();
}

/** Escape user text for inline Markdown (after `oneLine`). */
export function mdText(text: string | null | undefined, max = 400): string {
  return oneLine(text, max).replace(/([\\`*_[\]<>#|~])/g, "\\$1");
}

/** Markdown link that survives spaces and parentheses in URLs. */
export function mdLink(label: string, url: string): string {
  return `[${mdText(label) || "link"}](<${url.replace(/[<>\s]/g, encodeURIComponent)}>)`;
}

/** Escape text for HTML element content and quoted attribute values. */
export function escapeHtml(text: string | number | null | undefined): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Only absolute http(s) URLs are allowed in exports. Returns the URL as given
 * (trimmed) so it still matches the stored value, or null when unsafe.
 */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (/[\s<>"'`]/.test(trimmed)) return parsed.href;
    return trimmed;
  } catch {
    return null;
  }
}

export function finite(n: unknown, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/** kebab-case token name that is a valid CSS identifier for the Tailwind export. */
export function tokenName(raw: string | null | undefined): string {
  const name = (raw ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return /^[a-z0-9]/.test(name) ? name : "";
}

// ---------- color ----------

/** Normalize to lowercase 6 digit hex (alpha dropped), or null when invalid. */
export function normalizeHex(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{3,8})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join("");
  else if (h.length === 8) h = h.slice(0, 6);
  else if (h.length !== 6) return null;
  return `#${h}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? "#000000";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function ratioText(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}

/** Plain-language name of a wildness level (spec section 7). */
export function wildnessLabel(level: number): string {
  const labels = ["Fresh", "Bold", "Weird", "Wild", "Bananas"];
  const i = Math.min(5, Math.max(1, Math.round(finite(level, 1)))) - 1;
  return `${labels[i]} (${i + 1} of 5)`;
}
