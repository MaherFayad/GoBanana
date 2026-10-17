/**
 * R7 draft quality: a Frankenstein page made for a direction says where the direction's idea goes.
 * Without it the page is a collage of shipped parts with their sources and nothing about what to
 * change, so an agent builds the collage. With it, each page part the direction's mechanic names
 * (bend_brief R4 `mechanic.parts`) points at the slot that holds that part, with the line that
 * bends it, and a part with no slot is named as the one to add. Pure and deterministic.
 */
import type { StitchRowSnapshot } from "@/lib/canvas/types";
import { roleName } from "./skeleton";
import type { PartRole } from "./types";

export type BendMechanic = {
  element: string;
  how: string;
  parts?: ReadonlyArray<{ element: string; label: string; how: string }>;
  task?: string;
};

/** Stitch roles that can hold a page part (an Atlas UI element), best first. */
export const ELEMENT_ROLES: Readonly<Record<string, readonly PartRole[]>> = {
  header: ["status-header", "nav", "toolbar"],
  "nav-tabs": ["nav", "tabbar", "filters"],
  "bottom-nav": ["tabbar"],
  sidebar: ["sidebar"],
  hero: ["hero"],
  cta: ["cta"],
  progress: ["status-header", "detail"],
  stepper: ["status-header", "form"],
  total: ["sheet", "detail", "pricing"],
  "price-breakdown": ["detail", "sheet", "pricing"],
  card: ["cards", "features"],
  "list-row": ["list", "table"],
  divider: ["content"],
  "section-nav": ["nav", "filters"],
  "empty-state": ["empty"],
  success: ["empty", "detail"],
  error: ["empty"],
  sheet: ["sheet"],
  modal: ["sheet"],
  "form-field": ["form"],
  toggle: ["form", "filters"],
  "chip-filter": ["filters"],
  search: ["toolbar", "filters"],
  map: ["gallery", "detail"],
  chart: ["chart", "stats"],
  "onboarding-slide": ["hero", "content"],
  "paywall-plan": ["pricing", "cards"],
  // Mechanic elements of the word lists engine (lib/bend/mechanic.ts).
  plan: ["pricing", "cards"],
  progress_bar: ["status-header"],
  button: ["cta"],
  list: ["list", "table"],
  empty: ["empty"],
  nav: ["nav", "tabbar"],
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}...` : s);
const plain = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\.$/, "");

/**
 * Lines for a stitch made for a direction: "Bend it:" then one line per mechanic part (its slot, or
 * the slot to add) and the main task. Empty when the direction has no mechanic. A slot is used once,
 * by the first part that can take it.
 */
export function bendLines(mechanic: BendMechanic | undefined, rows: readonly StitchRowSnapshot[], indent = "    "): string[] {
  if (!mechanic) return [];
  const parts = mechanic.parts?.length ? mechanic.parts : [{ element: mechanic.element, label: roleName(mechanic.element), how: mechanic.how }];
  const slots = rows.flatMap((r) => r.slots.map((s) => ({ id: s.id, role: s.role as PartRole })));
  const used = new Set<string>();
  const lines = [`${indent}Bend it (the direction's idea goes here; keep the other slots plain so it reads):`];
  for (const p of parts) {
    const roles = ELEMENT_ROLES[p.element] ?? [];
    const slot = roles.map((role) => slots.find((s) => s.role === role && !used.has(s.id))).find(Boolean);
    const how = clip(plain(p.how), 220);
    if (slot) {
      used.add(slot.id);
      lines.push(`${indent}- ${p.label}: slot ${slot.id} (${roleName(slot.role)}). Rebuild it as: ${how}.`);
    } else {
      lines.push(`${indent}- ${p.label}: no slot holds it yet${roles[0] ? `; add a ${roleName(roles[0])} slot` : ""}. Build it as: ${how}.`);
    }
  }
  if (mechanic.task) lines.push(`${indent}- ${clip(plain(mechanic.task), 260)}.`);
  lines.push(...taskSteps(mechanic, parts, indent));
  return lines;
}

const STOP = new Set(["with", "from", "your", "their", "this", "that", "into", "then", "each", "every", "page", "screen", "main", "task", "what", "they", "more"]);
const stems = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
    .map((w) => w.slice(0, 5));

/**
 * R9: the build order, and the brief's own task steps that no bent part carries. The R7 draft judge's
 * most named gap after the spec was "where the idea goes": a step of the brief ("book installation",
 * "call the rider") with no part and no slot, so the designer had to invent the core of the page.
 * Each such step gets a line: add a slot for it next to the part the task runs through, built from
 * the same idea. Only steps the brief lists ("...: compare speeds and prices, book installation").
 */
export function taskSteps(mechanic: BendMechanic, parts: ReadonlyArray<{ label: string; how: string }>, indent = "    "): string[] {
  const m = /^The main task, (.+?), now runs through the (.+?):/.exec(mechanic.task ?? "");
  if (!m) return [];
  const [, phrase, label] = m as unknown as [string, string, string];
  const out = [`${indent}- Build first: the ${label}, where the main task runs; then the other bent parts; the plain slots last.`];
  const steps = phrase.split(/,\s*(?:and\s+)?/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 2);
  if (steps.length < 2) return out;
  const covered = new Set(parts.flatMap((p) => stems(`${p.label} ${p.how}`)));
  // The first step is what the task part was picked for, so it counts as carried.
  for (const step of steps.slice(1)) {
    if (stems(step).some((w) => covered.has(w))) continue;
    out.push(`${indent}- ${step}: no bent part carries this step yet; give it its own slot right after the ${label}, built from the same idea, so the task reads end to end.`);
  }
  return out;
}
