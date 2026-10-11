#!/usr/bin/env bash
set -euo pipefail
cat > DESIGN.md <<'MD'
---
version: alpha
name: Frosted checkout
description: Checkout as a frosted vinyl sleeve, with a brutalist receipt for the summary.
colors:
  primary: "#1F2A44"
  secondary: "#C8553D"
  neutral: "#8A8F98"
  surface: "#F4F1EA"
  on-surface: "#1A1C2E"
typography:
  display: { fontFamily: "Space Grotesk", fontSize: 48px, fontWeight: 700, lineHeight: 1.1 }
  body: { fontFamily: "Inter", fontSize: 16px, fontWeight: 400, lineHeight: 1.5 }
rounded:
  sm: 4px
  lg: 16px
spacing:
  sm: 8px
  md: 16px
  lg: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 12px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: 16px
---

## Colors

Ship colors are in the front matter. They pass WCAG 2.2 contrast for their use.

Concept only (explore): frosted lilac #D9D4F0 and receipt yellow #F2E46B. Do not put text on them.

## Overview

Checkout as a frosted vinyl sleeve. Payment slides out like a record. The order summary is a brutalist receipt.

## Typography

Space Grotesk for display, Inter for body.

## Layout

One column on mobile, 8 px spacing grid.

## Elevation & Depth

Frosted glass panels over a flat surface. No drop shadows.

## Shapes

Large 16 px radius on the sleeve, 4 px on receipt cards.

## Components

Primary button in deep navy with light text. Receipt cards on the surface color.

## Do's and Don'ts

- Do keep text on ship colors only.
- Don't copy reference images into the product.

## Sources

- [Frosted sleeve checkout](https://dribbble.com/shots/10000001-frosted-sleeve-checkout) (dribbble.com)
- [Brutalist receipt UI](https://www.pinterest.com/pin/100000000000000004/) (pinterest.com)
MD
