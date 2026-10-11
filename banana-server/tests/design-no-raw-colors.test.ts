/**
 * Gate: no raw colors outside the token file (plan Step 4, spec section 2).
 *
 * Only styles/studio-tokens.css may hold color literals; every other stylesheet and every
 * component reads `var(--st-*)`, so both themes, forced colors and the contrast gate
 * (design-tokens.test.ts) cover every color on screen. Checked: hex, the color functions
 * (rgb, hsl, hwb, lab, lch, oklab, oklch, color) and CSS named colors in declaration values,
 * across all owned CSS; and hex or color-function literals in UI source (TS, TSX, HTML).
 */
import { describe, expect, it } from "vitest";
import { cssDeclarations, OWNED_CSS, read, sourceFiles } from "./design-gate-files";

const TOKENS = "styles/studio-tokens.css";

const HEX = /#[0-9a-f]{3,8}\b/gi;
const COLOR_FN = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;

// CSS Color 4 named colors (system colors such as Canvas or Highlight are allowed: they are
// what forced-colors rules must use).
const NAMED = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown " +
    "burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan " +
    "darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred " +
    "darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink " +
    "deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold " +
    "goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush " +
    "lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey " +
    "lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime " +
    "limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen " +
    "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin " +
    "navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise " +
    "palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue " +
    "saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow " +
    "springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen"
  ).split(" "),
);

/** Properties whose values are names, not colors (a font called "Olive" is not a color). */
const NAME_VALUED = /^(font|font-family|animation|animation-name|transition-property|grid-area|grid-template-areas|content|counter-reset|counter-increment|will-change|view-transition-name|container-name)$/;

/**
 * Unavoidable literals outside the token file, each with its reason. Keyed "file: literal".
 */
const ALLOW: Record<string, string> = {
  // The swatch node's contrast rows measure the user's color against pure white and pure black
  // (SC 1.4.3 numbers shown to the user). These are the measured values, not chrome styling,
  // and must not change with the theme.
  "canvas/nodes/SwatchNode.tsx: #ffffff": "contrast is measured against pure white",
  "canvas/nodes/SwatchNode.tsx: #000000": "contrast is measured against pure black",
};

const cssFiles = OWNED_CSS().filter((f) => f !== TOKENS);
const uiFiles = sourceFiles(["app", "canvas", "components", "ui"], /\.(tsx?|html)$/);

describe("design gate: no raw colors outside styles/studio-tokens.css", () => {
  it("scans the real stylesheets and UI source", () => {
    expect(cssFiles).toEqual(expect.arrayContaining(["canvas/canvas.css", "app/(site)/site.css", "styles/studio-components.css", "ui/canvas/inline.css"]));
    expect(uiFiles).toEqual(expect.arrayContaining(["canvas/CanvasApp.tsx", "ui/canvas/main.tsx", "components/studio/Dialog.tsx"]));
    expect(read(TOKENS)).toMatch(HEX);
  });

  it.each(cssFiles)("%s uses tokens for every color", (file) => {
    const found: string[] = [];
    for (const d of cssDeclarations(read(file))) {
      const value = d.value.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""');
      for (const m of value.matchAll(HEX)) found.push(`${file}:${d.line} ${d.property}: ${m[0]}`);
      for (const m of value.matchAll(COLOR_FN)) found.push(`${file}:${d.line} ${d.property}: ${m[0]}...)`);
      if (NAME_VALUED.test(d.property)) continue;
      for (const word of value.toLowerCase().match(/(?<![\w-])[a-z]+(?![\w-])/g) ?? []) {
        if (NAMED.has(word)) found.push(`${file}:${d.line} ${d.property}: ${word}`);
      }
    }
    expect(found, "use a --st-* token (add one to styles/studio-tokens.css if none fits)").toEqual([]);
  });

  it.each(uiFiles)("%s has no color literals", (file) => {
    const text = read(file);
    const found: string[] = [];
    for (const re of [HEX, COLOR_FN]) {
      for (const m of text.matchAll(re)) {
        // Numeric character references (&#8230;) are text, not colors.
        if (text[(m.index ?? 0) - 1] === "&") continue;
        const key = `${file}: ${m[0]}`;
        if (ALLOW[key]) continue;
        found.push(`${file}:${text.slice(0, m.index).split("\n").length} ${m[0]}`);
      }
    }
    expect(found, "use a --st-* token through CSS, or add an allow-list entry with its reason").toEqual([]);
  });

  it("every allow-list entry still matches something", () => {
    for (const key of Object.keys(ALLOW)) {
      const [file, literal] = key.split(": ") as [string, string];
      expect(read(file), key).toContain(literal);
    }
  });
});
