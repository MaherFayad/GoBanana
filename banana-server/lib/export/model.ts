/**
 * Turns a CanvasSnapshot into one derived "kit model" that every export reads,
 * so DESIGN.md, tokens and Tailwind always agree on the same values.
 */
import type {
  CanvasDirection,
  CanvasItem,
  CanvasSnapshot,
  ContrastResult,
  NoteItem,
  ReferenceItem,
  Tag,
} from "../canvas/types";
import { isReference } from "../canvas/types";
import fontsData from "../kit/fonts.json";
import { contrastRatio, finite, normalizeHex, oneLine, plainBlock, safeUrl, tokenName } from "./util";

// ---------- fonts ----------

export interface FontFace {
  family: string;
  weight: number;
  fallback: string;
}

export interface FontPairing {
  id: string;
  name: string;
  display: FontFace;
  body: FontFace;
  licence: string;
  scripts: string[];
  mood: string[];
  sample: string;
  url: string;
}

interface FontsFile {
  default: string;
  pairings: FontPairing[];
}

const FONTS = fontsData as FontsFile;

export const FONT_PAIRINGS: readonly FontPairing[] = FONTS.pairings;

export function findPairing(id: string | null | undefined): FontPairing | undefined {
  return FONTS.pairings.find((p) => p.id === id);
}

export function defaultPairing(): FontPairing {
  const found = findPairing(FONTS.default) ?? FONTS.pairings[0];
  if (!found) throw new Error("fonts.json has no pairings");
  return found;
}

// ---------- model types ----------

export interface Dim {
  value: number;
  unit: string;
}

export interface ColorToken {
  name: string;
  hex: string;
  oklch: string | null;
  /** Role as written on the canvas, when it differs from the token name. */
  canvasRole: string | null;
  from: "palette" | "swatch" | "contrast";
}

export interface ExploreColor {
  hex: string;
  oklch: string | null;
  role: string | null;
}

export interface TypographyToken {
  name: string;
  fontFamily: string;
  fontSize: Dim;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: Dim | null;
  use: string;
}

export interface ComponentToken {
  name: string;
  backgroundColor?: string;
  textColor?: string;
  typography?: string;
  rounded?: string;
  padding?: Dim;
  /** Contrast of textColor on backgroundColor, when both are set. */
  ratio?: number;
  use: string;
}

export interface Reference {
  n: number;
  id: string;
  type: "image" | "upload";
  title: string;
  site: string;
  /** Safe http(s) source URL, or null when the stored value was not a usable link. */
  url: string | null;
  /** The stored value, shown as text when it is not a safe link. */
  rawUrl: string;
  imageUrl: string | null;
  note: string;
  tag: Tag | null;
  sectionId: string | null;
}

export interface ResolvedSection {
  id: string;
  title: string;
  directionId: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  items: CanvasItem[];
}

export interface DirectionSummary {
  direction: CanvasDirection;
  sectionTitle: string | null;
  referenceCount: number;
  kept: boolean;
}

export interface KitNote {
  text: string;
  sectionTitle: string | null;
  /** Reference the note was attached to, if any. */
  referenceN: number | null;
}

export interface KitModel {
  title: string;
  description: string;
  brief: string;
  wildness: number;
  lens: string | null;
  webUrl: string | null;
  directions: DirectionSummary[];
  sections: ResolvedSection[];
  unsorted: CanvasItem[];
  references: Reference[];
  notes: KitNote[];
  ship: ColorToken[];
  explore: ExploreColor[];
  contrast: ContrastResult[];
  pairing: FontPairing;
  pairingFromCanvas: boolean;
  arabic: boolean;
  typography: TypographyToken[];
  rounded: [string, Dim][];
  spacing: [string, Dim][];
  components: ComponentToken[];
}

// ---------- builders ----------

function readingOrder<T extends { x: number; y: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => finite(a.y) - finite(b.y) || finite(a.x) - finite(b.x));
}

function resolveSections(snapshot: CanvasSnapshot): { sections: ResolvedSection[]; unsorted: CanvasItem[] } {
  const byId = new Map<string, ResolvedSection>();
  const add = (s: { id: string; title: string; directionId?: string | null; x: number; y: number; w: number; h: number }) => {
    if (byId.has(s.id)) return;
    byId.set(s.id, {
      id: s.id,
      title: oneLine(s.title, 120) || "Untitled section",
      directionId: s.directionId ?? null,
      x: finite(s.x),
      y: finite(s.y),
      w: Math.max(0, finite(s.w)),
      h: Math.max(0, finite(s.h)),
      items: [],
    });
  };
  for (const s of snapshot.sections ?? []) add(s);
  for (const item of snapshot.items ?? []) if (item.type === "section") add(item);

  const sections = readingOrder([...byId.values()]);
  const unsorted: CanvasItem[] = [];
  for (const item of readingOrder((snapshot.items ?? []).filter((i) => i.type !== "section"))) {
    let home = item.sectionId ? byId.get(item.sectionId) : undefined;
    if (!home) {
      const cx = finite(item.x) + finite(item.w) / 2;
      const cy = finite(item.y) + finite(item.h) / 2;
      home = sections.find((s) => cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.h);
    }
    if (home) home.items.push(item);
    else unsorted.push(item);
  }
  return { sections, unsorted };
}

function buildReferences(sections: ResolvedSection[], unsorted: CanvasItem[]): Reference[] {
  const sectionOf = new Map<string, string>();
  for (const s of sections) for (const i of s.items) sectionOf.set(i.id, s.id);
  const all = readingOrder([...sections.flatMap((s) => s.items), ...unsorted].filter(isReference));
  const seen = new Set<string>();
  const out: Reference[] = [];
  for (const item of all as ReferenceItem[]) {
    const key = item.sourceUrl?.trim() || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const site = oneLine(item.sourceSite, 60) || (item.type === "upload" ? "upload" : "web");
    out.push({
      n: out.length + 1,
      id: item.id,
      type: item.type,
      title: oneLine(item.title, 160) || `Reference from ${site}`,
      site,
      url: safeUrl(item.sourceUrl),
      rawUrl: oneLine(item.sourceUrl, 500),
      imageUrl: safeUrl(item.imageUrl) ?? safeUrl(item.thumbUrl),
      note: plainBlock(item.note, 600),
      tag: item.tag ?? null,
      sectionId: sectionOf.get(item.id) ?? null,
    });
  }
  return out;
}

function buildColors(snapshot: CanvasSnapshot, swatchOrder: CanvasItem[]) {
  type Raw = { hex: string; oklch: string | null; role: string | null; tag: Tag; from: "palette" | "swatch" };
  const raw: Raw[] = [];
  for (const p of snapshot.palettes ?? []) {
    for (const c of p.colors ?? []) {
      const hex = normalizeHex(c.hex);
      if (hex) raw.push({ hex, oklch: oneLine(c.oklch, 80) || null, role: oneLine(c.role, 40) || null, tag: c.tag === "ship" ? "ship" : "explore", from: "palette" });
    }
  }
  for (const item of swatchOrder) {
    if (item.type !== "swatch") continue;
    const hex = normalizeHex(item.hex);
    if (hex) raw.push({ hex, oklch: oneLine(item.oklch, 80) || null, role: oneLine(item.role, 40) || null, tag: item.tag === "ship" ? "ship" : "explore", from: "swatch" });
  }

  const shipRaw: Raw[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    if (c.tag !== "ship" || seen.has(c.hex)) continue;
    seen.add(c.hex);
    shipRaw.push(c);
  }
  const known = new Set(raw.map((c) => c.hex));

  const contrast: ContrastResult[] = [];
  for (const p of snapshot.palettes ?? []) {
    for (const r of p.contrast ?? []) {
      const fg = normalizeHex(r.fg);
      const bg = normalizeHex(r.bg);
      if (!fg || !bg) continue;
      contrast.push({ fg, bg, ratio: finite(r.ratio, contrastRatio(fg, bg)), passesText: !!r.passesText, passesUi: !!r.passesUi, tag: r.tag === "ship" ? "ship" : "explore" });
    }
  }
  contrast.sort((a, b) => (a.tag === b.tag ? b.ratio - a.ratio : a.tag === "ship" ? -1 : 1));

  // Pure text colors (usually white or black) checked in a ship pair but not on the canvas.
  const extra: { hex: string }[] = [];
  for (const r of contrast) {
    if (r.tag !== "ship") continue;
    for (const hex of [r.fg, r.bg]) {
      if (known.has(hex) || seen.has(hex)) continue;
      seen.add(hex);
      extra.push({ hex });
    }
  }

  const used = new Set<string>();
  const unique = (base: string) => {
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base}-${i}`;
    used.add(name);
    return name;
  };

  const ship: ColorToken[] = [];
  const hasPrimary = shipRaw.some((c) => tokenName(c.role) === "primary");
  shipRaw.forEach((c, i) => {
    const wanted = !hasPrimary && i === 0 ? "primary" : tokenName(c.role) || `color-${i + 1}`;
    const name = unique(wanted);
    ship.push({ name, hex: c.hex, oklch: c.oklch, canvasRole: c.role && tokenName(c.role) !== name ? c.role : null, from: c.from });
  });
  for (const e of extra) {
    const base = e.hex === "#ffffff" ? "white" : e.hex === "#000000" ? "black" : "ink";
    ship.push({ name: unique(base), hex: e.hex, oklch: null, canvasRole: null, from: "contrast" });
  }

  const explore: ExploreColor[] = [];
  const exploreSeen = new Set<string>();
  for (const c of raw) {
    if (c.tag !== "explore" || seen.has(c.hex) || exploreSeen.has(c.hex)) continue;
    exploreSeen.add(c.hex);
    explore.push({ hex: c.hex, oklch: c.oklch, role: c.role });
  }
  return { ship, explore, contrast };
}

function buildTypography(pairing: FontPairing, arabic: boolean): TypographyToken[] {
  const tight = arabic ? null : { value: -0.02, unit: "em" };
  return [
    { name: "display", fontFamily: pairing.display.family, fontSize: { value: 48, unit: "px" }, fontWeight: pairing.display.weight, lineHeight: arabic ? 1.3 : 1.1, letterSpacing: tight, use: "Hero lines and big numbers" },
    { name: "headline", fontFamily: pairing.display.family, fontSize: { value: 32, unit: "px" }, fontWeight: pairing.display.weight, lineHeight: arabic ? 1.4 : 1.2, letterSpacing: tight, use: "Section titles" },
    { name: "body", fontFamily: pairing.body.family, fontSize: { value: 16, unit: "px" }, fontWeight: pairing.body.weight, lineHeight: arabic ? 1.7 : 1.5, letterSpacing: null, use: "Running text and form fields" },
    { name: "label", fontFamily: pairing.body.family, fontSize: { value: 14, unit: "px" }, fontWeight: 700, lineHeight: arabic ? 1.5 : 1.4, letterSpacing: arabic ? null : { value: 0.02, unit: "em" }, use: "Buttons, chips and captions" },
  ];
}

const TEXT_LIKE = /^(on-|text|ink|white|black|foreground|fg)/;
const SURFACE_LIKE = /(surface|neutral|background|paper|base|canvas)/;

function bestPartner(token: ColorToken, ship: ColorToken[]): { token: ColorToken; ratio: number } | null {
  let best: { token: ColorToken; ratio: number } | null = null;
  for (const other of ship) {
    if (other.hex === token.hex) continue;
    const ratio = contrastRatio(token.hex, other.hex);
    if (!best || ratio > best.ratio) best = { token: other, ratio };
  }
  return best;
}

function buildComponents(ship: ColorToken[]): ComponentToken[] {
  const comps: ComponentToken[] = [];
  const names = new Set<string>();
  const referenced = new Set<string>();
  const addName = (base: string) => {
    let name = base;
    for (let i = 2; names.has(name); i++) name = `${base}-${i}`;
    names.add(name);
    return name;
  };

  for (const t of ship) {
    if (TEXT_LIKE.test(t.name)) continue;
    const isButton = t.name === "primary" || t.name === "secondary";
    const isSurface = SURFACE_LIKE.test(t.name);
    const base = isButton ? `button-${t.name}` : isSurface ? (t.name === "surface" ? "card" : `card-${t.name}`) : `chip-${t.name}`;
    const partner = bestPartner(t, ship);
    const comp: ComponentToken = {
      name: addName(base),
      backgroundColor: t.name,
      typography: isSurface ? "body" : "label",
      rounded: isButton ? "md" : isSurface ? "lg" : "full",
      padding: isButton ? { value: 12, unit: "px" } : isSurface ? { value: 24, unit: "px" } : { value: 8, unit: "px" },
      use: isButton ? `Main ${t.name} action` : isSurface ? "Panels and cards" : "Tags, badges and small highlights",
    };
    referenced.add(t.name);
    if (partner && partner.ratio >= 4.5) {
      comp.textColor = partner.token.name;
      comp.ratio = partner.ratio;
      referenced.add(partner.token.name);
    } else {
      comp.use = `${comp.use}. Fill only: no ship color reaches 4.5:1 on it, so never put text on it`;
      delete comp.typography;
    }
    comps.push(comp);
  }

  for (const t of ship) {
    if (referenced.has(t.name)) continue;
    const partner = bestPartner(t, ship);
    const comp: ComponentToken = { name: addName(`text-${t.name}`), textColor: t.name, typography: "body", use: "Text color" };
    if (partner && partner.ratio >= 4.5) {
      comp.backgroundColor = partner.token.name;
      comp.ratio = partner.ratio;
      comp.use = `Text on ${partner.token.name}`;
    }
    referenced.add(t.name);
    comps.push(comp);
  }
  return comps;
}

export function buildKitModel(snapshot: CanvasSnapshot): KitModel {
  const { sections, unsorted } = resolveSections(snapshot);
  const references = buildReferences(sections, unsorted);
  const refByItem = new Map(references.map((r) => [r.id, r]));
  const allItems = readingOrder([...sections.flatMap((s) => s.items), ...unsorted]);
  const sectionTitle = new Map<string, string>();
  for (const s of sections) for (const i of s.items) sectionTitle.set(i.id, s.title);

  const notes: KitNote[] = [];
  for (const item of allItems) {
    if (item.type === "note") {
      const text = plainBlock((item as NoteItem).text, 1000);
      if (text) notes.push({ text, sectionTitle: sectionTitle.get(item.id) ?? null, referenceN: null });
    } else if (isReference(item)) {
      const ref = refByItem.get(item.id);
      if (ref?.note) notes.push({ text: ref.note, sectionTitle: sectionTitle.get(item.id) ?? null, referenceN: ref.n });
    }
  }

  const directions: DirectionSummary[] = (snapshot.directions ?? []).map((d) => {
    const section = sections.find((s) => s.directionId === d.id);
    const referenceCount = section ? section.items.filter(isReference).length : 0;
    return {
      direction: { id: d.id, move: oneLine(d.move, 60), title: oneLine(d.title, 160), searchQuery: oneLine(d.searchQuery, 200) },
      sectionTitle: section?.title ?? null,
      referenceCount,
      kept: referenceCount > 0,
    };
  });

  const { ship, explore, contrast } = buildColors(snapshot, allItems);

  const sample = allItems.find((i) => i.type === "typeSample" && findPairing(i.pairingId));
  const pairing = (sample?.type === "typeSample" ? findPairing(sample.pairingId) : undefined) ?? defaultPairing();
  const arabic = pairing.scripts.includes("arabic");

  const title = oneLine(snapshot.title, 80) || "Untitled canvas";
  const brief = oneLine(snapshot.brief, 500);
  const kept = directions.filter((d) => d.kept).map((d) => d.direction.title);
  const description = oneLine(
    kept.length > 0 ? `${brief ? `${brief}: ` : ""}${kept.join(", ")}` : brief || `Moodboard ${title}`,
    200,
  );

  return {
    title,
    description,
    brief,
    wildness: Math.min(5, Math.max(1, Math.round(finite(snapshot.wildness, 1)))),
    lens: oneLine(snapshot.lens, 60) || null,
    webUrl: safeUrl(snapshot.webUrl),
    directions,
    sections,
    unsorted,
    references,
    notes,
    ship,
    explore,
    contrast,
    pairing,
    pairingFromCanvas: !!sample,
    arabic,
    typography: buildTypography(pairing, arabic),
    rounded: [
      ["none", { value: 0, unit: "px" }],
      ["sm", { value: 4, unit: "px" }],
      ["md", { value: 8, unit: "px" }],
      ["lg", { value: 16, unit: "px" }],
      ["full", { value: 9999, unit: "px" }],
    ],
    spacing: [
      ["xs", { value: 4, unit: "px" }],
      ["sm", { value: 8, unit: "px" }],
      ["md", { value: 16, unit: "px" }],
      ["lg", { value: 32, unit: "px" }],
      ["xl", { value: 64, unit: "px" }],
    ],
    components: buildComponents(ship),
  };
}

export function dimText(d: Dim): string {
  return `${d.value}${d.unit}`;
}

export function colorByName(model: KitModel, name: string | undefined): ColorToken | undefined {
  return name ? model.ship.find((c) => c.name === name) : undefined;
}
