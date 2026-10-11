/**
 * Gate: logical properties only (plan Step 4, spec 12 row 12).
 *
 * Arabic pages are rtl, so owned CSS says start and end, never left and right: no
 * `left`/`right` offsets, no physical margin, padding, border, radius or scroll longhands,
 * no `text-align`, `float` or `clear` set to left or right, and no four-value shorthand
 * (margin, padding, inset, border-*) or multi-value border-radius that differs between the
 * two sides, since those read their values in physical order.
 *
 * The allow-list holds the few rules that must be physical, each with its reason.
 */
import { describe, expect, it } from "vitest";
import { cssDeclarations, OWNED_CSS, read } from "./design-gate-files";

const PHYSICAL =
  /^(left|right|(margin|padding|scroll-margin|scroll-padding)-(left|right)|border-(left|right)(-(width|style|color))?|border-(top|bottom)-(left|right)-radius)$/;
const SIDE_VALUE = /^(text-align|float|clear)$/;
const FOUR_VALUE = /^(margin|padding|inset|scroll-margin|scroll-padding|border-width|border-style|border-color)$/;

/** "file|selector|property" -> reason. */
const ALLOW: Record<string, string> = {
  "canvas/canvas.css|.bn-snap-guide|left":
    "Snap guides live in React Flow's board space (inside .react-flow__viewport), which is physical and never mirrors in rtl; the guide is placed with translate(x, y) from the top-left origin.",
};

const tokens = (value: string) => value.replace(/!important/i, "").trim().split(/\s+(?![^(]*\))/);

function violations(file: string): string[] {
  const out: string[] = [];
  for (const d of cssDeclarations(read(file))) {
    if (d.property.startsWith("--")) continue;
    const at = `${file}:${d.line} ${d.selector} { ${d.property}: ${d.value} }`;
    const allowed = ALLOW[`${file}|${d.selector}|${d.property}`];
    if (allowed) continue;
    if (PHYSICAL.test(d.property)) out.push(at);
    else if (SIDE_VALUE.test(d.property) && /\b(left|right)\b/i.test(d.value)) out.push(at);
    else if (FOUR_VALUE.test(d.property)) {
      const v = tokens(d.value);
      if (v.length === 4 && v[1] !== v[3]) out.push(at);
    } else if (d.property === "border-radius") {
      const v = tokens(d.value.split("/")[0] ?? "");
      // Expand to [top-left, top-right, bottom-right, bottom-left]; mirror-safe when each row matches.
      const [tl, tr = tl, br = tl, bl = tr] = v;
      if (tl !== tr || bl !== br) out.push(at);
    }
  }
  return out;
}

const files = OWNED_CSS();

describe("design gate: logical properties in owned CSS", () => {
  it("scans the real stylesheets", () => {
    expect(files).toEqual(expect.arrayContaining(["canvas/canvas.css", "canvas/overlays.css", "app/(site)/site.css", "styles/studio-components.css", "ui/canvas/inline.css"]));
  });

  it.each(files)("%s uses logical properties", (file) => {
    expect(violations(file), "use inset-inline-*, margin-inline-*, padding-inline-*, border-inline-*, border-start-start-radius, text-align: start/end").toEqual([]);
  });

  it("every allow-list entry still matches a rule", () => {
    for (const key of Object.keys(ALLOW)) {
      const [file, selector, property] = key.split("|") as [string, string, string];
      const hit = cssDeclarations(read(file)).some((d) => d.selector === selector && d.property === property);
      expect(hit, key).toBe(true);
    }
  });
});
