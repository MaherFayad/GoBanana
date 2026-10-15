/**
 * RTL mirroring notes per part (VAL-08): for each UI element, what flips in a right to left layout
 * and what must not. Plain English for a designer or a coding agent. Deterministic, no model call.
 */
import type { RtlNote } from "@/lib/direction-detail";

type Row = { part: string; flips: string; keeps: string };

const row = (part: string, flips: string, keeps: string): Row => ({ part, flips, keeps });

/** Keyed by the Atlas UiElement names (lib/atlas/types.ts). */
export const RTL_BY_ELEMENT: Readonly<Record<string, Row>> = {
  header: row("Header", "Back and menu swap sides, the title aligns right, and the action group moves to the left.", "The logo and brand mark do not mirror."),
  "nav-tabs": row("Tabs", "The first tab sits at the right, order runs right to left, and the active underline follows.", "Icons of real objects (phone, camera) do not mirror."),
  "bottom-nav": row("Bottom navigation", "Items run right to left, with home at the right end.", "Object icons and the logo do not mirror."),
  sidebar: row("Sidebar", "It docks to the right edge, and its collapse chevron points the other way.", "The logo and keyboard shortcut hints stay as they are."),
  hero: row("Hero", "The text block aligns right, split layouts swap image and text, and diagonal cuts and gradients mirror.", "Product photos, logos and any text drawn inside an image do not mirror."),
  cta: row("Main action", "In a button pair the primary sits at the right, and arrow or chevron glyphs point left.", "Download, play and external-link icons do not mirror."),
  progress: row("Progress", "Bars and rings fill from right to left, step dots run right to left, and a back chevron points right.", "Percent values and numbers stay as digits; a time scrubber (video, audio) still runs left to right."),
  stepper: row("Stepper", "Step 1 sits at the right, connector lines run right to left, and next and back arrows mirror.", "Step numbers stay as digits."),
  total: row("Total", "Labels sit at the right and amounts at the left of each row.", "Digits and the currency stay one left to right run (wrap them in an LTR isolate), so SAR 1,240 does not reorder."),
  "price-breakdown": row("Price breakdown", "Labels sit at the right, amounts at the left, and the total row keeps that rule.", "Digits and the currency stay one left to right run (wrap them in an LTR isolate)."),
  card: row("Card", "In a horizontal card image, title and meta swap sides, and badges move to the opposite corner.", "Photos and brand logos do not mirror."),
  "list-row": row("List row", "The leading icon sits at the right, the trailing chevron at the left pointing left, and swipe actions reveal from the opposite edge.", "Phone numbers, order ids and codes stay left to right runs."),
  divider: row("Divider", "Inset dividers start from the right.", "Full width rules do not change."),
  "section-nav": row("Section navigation", "Anchors list from the right, and the active marker sits on the right edge.", "Section numbers stay as digits."),
  "empty-state": row("Empty state", "Text aligns right or stays centered, and any arrow pointing at an action mirrors.", "Illustrations of real objects do not mirror."),
  loading: row("Loading", "Skeleton blocks align right and a shimmer sweeps right to left.", "A clock style spinner keeps turning clockwise."),
  success: row("Success", "The message aligns right, and share or next arrows mirror.", "The check mark is not directional, so it does not mirror."),
  error: row("Error", "The message aligns right, and the retry arrow mirrors.", "Error codes and technical strings stay left to right."),
  toast: row("Toast", "It slides in from the start edge (right), and its action sits at the left end.", "Codes and Latin product names stay left to right runs."),
  sheet: row("Sheet", "Content aligns right, and the close button sits at the right (start) corner.", "The drag handle is symmetric, so it does not change."),
  modal: row("Modal", "Content aligns right, and the close and primary actions swap sides with the layout.", "Quoted Latin text keeps its own direction."),
  "form-field": row("Form field", "Labels and typed text align right, leading icons move to the right, and clear and show password buttons move to the left.", "Email, URL, phone, card number and one time code inputs stay left to right (set dir=ltr, keep them aligned right)."),
  toggle: row("Toggle", "The knob rests at the right when off and slides left when on, and the label sits at the right.", "The knob shape does not change."),
  "chip-filter": row("Filter chips", "Chips flow from the right, wrap right to left, and the scroll starts at the right edge.", "Counts and emoji do not change."),
  search: row("Search", "The search icon sits at the right (start), the clear button at the left, and typed text aligns right.", "A pasted Latin query stays a left to right run."),
  map: row("Map", "Controls (zoom, locate) move to the left, and the search bar and sheet align right.", "The map itself never mirrors: north stays up, and street names keep their own script and direction."),
  chart: row("Chart", "The legend and value axis move to the right, and categorical groups may run right to left.", "Time axes and numeric axes keep running left to right, and axis ticks stay as digits."),
  avatar: row("Avatar", "Name and meta sit to the left of the avatar, and stacked avatars overlap toward the left.", "Photos do not mirror."),
  "onboarding-slide": row("Onboarding slide", "Slides advance right to left (swipe left for next), dots run right to left, and the next arrow points left.", "Illustrations do not mirror unless they show a direction."),
  "paywall-plan": row("Plan cards", "Plan cards order right to left with the default plan at the right, and check marks lead on the right.", "Prices, currency and discount percent stay left to right runs."),
};

/** Rules that hold for every part. */
export const RTL_GLOBAL: readonly string[] = [
  'Set `dir="rtl"` and `lang="ar"` on the page root and use logical CSS properties (margin-inline-start, inset-inline-end, text-align: start).',
  "Mirror direction: back, next, forward, send, reply, list bullets, progress, swipe and slide order. Do not mirror meaning: media controls (play, pause, skip, scrubber), logos, photos, clocks, check marks and charts with a time axis.",
  "Swipe: next moves from right to left and back from left to right; give every swipe a tap or button alternative.",
  "Numbers: pick one digit set for the whole product (0 to 9 is common in Saudi apps) and keep numbers, phone numbers, ids and prices as left to right runs inside the right to left text.",
  "Type: no letter spacing on Arabic, line height 1.5 or more for body, and size Arabic text up about 10 percent next to Latin text.",
];

/**
 * Notes for these parts (UI element names), in order, without repeats and without unknown names.
 * `max` keeps the list short enough to read.
 */
export function rtlNotes(parts: readonly string[], max = 6): RtlNote[] {
  const seen = new Set<string>();
  const out: RtlNote[] = [];
  for (const p of parts) {
    const r = RTL_BY_ELEMENT[p];
    if (!r || seen.has(p)) continue;
    seen.add(p);
    out.push({ part: r.part, flips: r.flips, keeps: r.keeps });
    if (out.length >= max) break;
  }
  return out;
}
