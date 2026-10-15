Exported 2 files for canvas cv_demo (scope page). Write each file at its path. Tokens are overrides for: checkout. Fonts, corner scale and motion come from the direction's Banana Atlas card (kraft-paper).
--- file: tokens.json (application/json) path: design/explorations/kraft-paper/kit/tokens.json ---
{
  "color": {
    "$type": "color",
    "surface": { "$value": "#F6EFE3" },
    "on-surface": { "$value": "#1D1A16" },
    "primary": { "$value": "#B5471B" }
  },
  "font": {
    "display": { "$type": "fontFamily", "$value": "Fraunces" },
    "body": { "$type": "fontFamily", "$value": "Work Sans" },
    "display-ar": { "$type": "fontFamily", "$value": "El Messiri" },
    "body-ar": { "$type": "fontFamily", "$value": "Noto Naskh Arabic" }
  },
  "rounded": { "$type": "dimension", "none": { "$value": "0px" }, "sm": { "$value": "2px" }, "md": { "$value": "4px" }, "lg": { "$value": "8px" }, "full": { "$value": "9999px" } },
  "$extensions": { "motion": { "verb": "unfold", "ms": 240, "reduced": "fade in place" } }
}
--- end file ---
--- file: theme.css (text/css) path: design/explorations/kraft-paper/kit/theme.css ---
@theme {
  --color-surface: #F6EFE3;
  --color-on-surface: #1D1A16;
  --color-primary: #B5471B;
  --font-display: "Fraunces", serif;
  --font-body: "Work Sans", sans-serif;
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;
}
--- end file ---
Contrast: #1D1A16 on #F6EFE3 15.1:1 (ship, text). #B5471B on #F6EFE3 5.0:1 (ship, text).
