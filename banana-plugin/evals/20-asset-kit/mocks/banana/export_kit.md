Exported 2 files for canvas cv_demo. Write each file to disk as named.
--- file: tokens.json (application/json) ---
{
  "color": {
    "$type": "color",
    "primary": { "$value": "#1F2A44" },
    "surface": { "$value": "#F4F1EA" },
    "surface-alt": { "$value": "#E8D9C4" },
    "on-surface": { "$value": "#1A1C2E" }
  },
  "font": {
    "display": { "$type": "fontFamily", "$value": "Space Grotesk" },
    "body": { "$type": "fontFamily", "$value": "Inter" }
  },
  "radius": { "$type": "dimension", "sm": { "$value": "4px" }, "lg": { "$value": "16px" } }
}
--- end file ---
--- file: tailwind-theme.css (text/css) ---
@theme {
  --color-primary: #1F2A44;
  --color-surface: #F4F1EA;
  --color-surface-alt: #E8D9C4;
  --color-on-surface: #1A1C2E;
  --font-display: "Space Grotesk", sans-serif;
  --font-body: "Inter", sans-serif;
  --radius-sm: 4px;
  --radius-lg: 16px;
}
--- end file ---
