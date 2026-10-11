# Studio design language, as a spec for Banana

This file describes how Studio looks, feels and behaves, so Banana can follow it. It is
extracted from the Studio repository (read only) and cites the source for every value.

- Source repository: `/home/user/maherfayad-stack/figma-killer-2`. Paths below are relative
  to it and written as `fk2:path`.
- Token file for Banana: `banana-server/styles/studio-tokens.css` (all names start with `--st-`).
- File-by-file restyle plan: `docs/design-language-plan.md`.

Where Studio and Banana's hard rules disagree (WCAG 2.2 AA, no em dashes, Arabic and RTL), this
spec keeps Studio's look and changes the smallest thing that makes it pass. Every such change
is marked **A11y change** and listed in [Conflicts and resolutions](#12-conflicts-with-banana-hard-rules-and-how-to-resolve-them).

---

## 1. Principles

Quoted from Studio's own rule books. Where a quote held an em dash, it is cut at that point.

1. **"The base disappears, the meaning appears."** Surfaces, borders and default text are
   achromatic. "If a color isn't carrying information, it doesn't belong in the chrome."
   (`fk2:docs/design.md`, Principle 1)
2. **"Two layers, sharp separation."** Layer 1 is the achromatic base. Layer 2 is color used only
   as identity (numbered accents), state (danger, warning, success, info) or canvas affordance
   (selection and hover rings). "Never decorative." (`fk2:docs/design.md` Principle 2,
   `fk2:CLAUDE.md` "Two-layer color model")
3. **"Surfaces have a hierarchy."** Six surface tones give depth; "Tile/card hovers change
   tone, not border." (`fk2:docs/design.md` Principle 3)
4. **"Cards are tiles, not boxes."** Borderless tiles on a darker parent with a 1px grid gap and
   a 16px radius. (`fk2:docs/design.md` Principle 4, `fk2:src/ui/components/Widget/Widget.module.css`)
5. **"Inputs wear their borders. Cards don't."** Inputs are transparent with a 1px border and a
   pill radius; cards are filled and borderless. (`fk2:docs/design.md` Principle 5)
6. **"Identity is a color, not a label."** A category gets an accent tint, and "A rail accent
   means something." (`fk2:docs/design.md` Principle 6, `fk2:src/ui/railAccent.ts`)
7. **"The canvas owns its own palette."** Neon rings for selection, hover and guides, bright on
   purpose so they read against any content. (`fk2:docs/design.md` Principle 7)
8. **"Motion respects the reader."** Short, purposeful, never blocking; reduced motion zeroes it.
   (`fk2:docs/design.md` Principle 8)
9. **"Say the mechanism, not the feeling."** Copy names what will run, be written or move.
   (`fk2:docs/design.md` "UI copy")
10. **"A control names itself in exactly one way."** Picture first, caption second, label last.
    "Nothing is disabled-but-visible; it is absent." (`fk2:docs/design.md` "The inspector")
11. **Feels like Figma, never noisy.** The owner's ask: "No action whatsoever shows me noisy
    errors" and "Alt+drag to duplicate, Ctrl+D, a free canvas." Toasts de-duplicate, error
    boundaries render in place. (`fk2:STUDIO-FIGMA-FEEL-PLAN.md` header, Z1, Z2)
12. **"A write must have exactly one honest target."** If an action cannot land in one place, it
    is refused with the reason and a remedy, not faked. (`fk2:README.md`,
    `fk2:STUDIO-LIVE-CANVAS-PLAN.md` Track R)

---

## 2. Tokens

Source of truth in Studio: `fk2:src/styles/globals.css`. Banana copy: `banana-server/styles/studio-tokens.css`.
The Studio name is given first, then the Banana name.

### 2.1 Theme switching

- Studio's default theme is **dark**. Light is a token override on `[data-editor-theme='light']`;
  the user picks dark, light or system, and `system` is resolved against `prefers-color-scheme`
  in JS before the attribute is written (`fk2:docs/design.md` TL;DR, `fk2:src/styles/globals.css`
  lines 665 to 770).
- Banana: the base `:root` block is dark. `[data-theme="light"]` (on any element) and
  `@media (prefers-color-scheme: light)` apply light; `[data-theme="dark"]` forces dark on any
  subtree. No script is needed. `color-scheme` is set in each block.
- Text scale: Studio also offers small, large and extra-large text by shifting the whole `--text-*`
  scale one or two steps (`fk2:src/styles/globals.css` lines 614 to 663). Banana can copy that later.

### 2.2 Color: surfaces, borders, text

| Studio | Banana | Dark | Light | Role |
|---|---|---|---|---|
| `--bg-body` | `--st-bg-body` | #000000 | #e3e7ed | App shell, top bar, sidebars, tooltip fill |
| `--bg-surface` | `--st-bg-surface` | #1b1b1b | #ffffff | Panels, dialogs, toasts, tile parent |
| `--bg-surface-2` | `--st-bg-surface-2` | #282828 | #f6f7f9 | Tile cards, **canvas board**, dialog header and footer |
| `--bg-surface-3` | `--st-bg-surface-3` | #323232 | #eceff3 | Tile hover, **context menu fill**, skeleton base |
| `--bg-surface-4` | `--st-bg-surface-4` | #4a4a4a | #e1e5ea | Active frame header, skeleton highlight |
| `--bg-surface-5` | `--st-bg-surface-5` | #605f5f | #d3d9e1 | Strongest nested surface |
| `--border-subtle` | `--st-border-subtle` | #1f1f1f | #eef0f3 | Hairlines |
| `--border-muted` | `--st-border-muted` | #2e2e2e | #dce1e7 | Dividers, notch divider |
| `--border` | `--st-border` | #333333 | #cbd3dc | Dialog header and footer rule, tabs rule |
| `--border-strong` | `--st-border-strong` | #4a4a4a | #aeb8c5 | Strong hairline |
| (new) | `--st-border-control` | white 40% | ink 52% | **A11y addition.** Boundary of inputs and other controls (3:1) |
| `--text-bright` | `--st-text-bright` | #f4f4f5 | #111827 | Titles, KPIs, tooltip text |
| `--text` | `--st-text` | #ededed | #1f2937 | Body text |
| `--text-muted` | `--st-text-muted` | #a1a1aa | #4b5563 | Labels, secondary UI, ghost icons |
| `--text-subtle` | `--st-text-subtle` | #787878 to **#8f8f8f** | #6b7280 to **#56606e** | Captions, meta. **A11y change** |
| `--text-disabled` | `--st-text-disabled` | #52525b | #9ca3af | Disabled only |
| (new) | `--st-text-placeholder` | = subtle | = subtle | **A11y change.** Studio used `--text-disabled` |
| (new) | `--st-link` | = text-bright | = text-bright | Links are achromatic and underlined |

Overlay scale (`--overlay-5` to `--overlay-90`, Banana `--st-overlay-*`): white at that alpha in dark,
`rgba(17, 24, 39, a)` in light. Used for every compact interactive fill (button rest, hover,
pressed, segment, field). Scrim scale (`--scrim-10` to `--scrim-90`, Banana `--st-scrim-*`) is black at
that alpha in both themes, for shadows and backdrops (`fk2:src/styles/globals.css` lines 96 to 122, 712 to 723).

### 2.3 Color: identity accents and state

Identity accents: pastel on dark, deep foreground-safe on light. Each has a 10% tint `-10`
(`fk2:src/styles/globals.css` lines 131 to 151 and 690 to 710).

| Token (`--accent-N`, Banana `--st-accent-N`) | Dark | Light | Studio meaning | Banana use |
|---|---|---|---|---|
| 1 | #8ee6c8 | #047857 | Saved, system, status | **Ship** chip |
| 2 | #c8b6ff | #6d28d9 | Pages, structure | Sections |
| 3 | #9bdcff | #0369a1 | Storage, data | Search results rail item |
| 4 | #ffc7a8 | #9a3412 | Posts, media, activity | **Explore** chip |
| 5 | #ffb6cd | #be123c | Warm secondary | |
| 6 | #b8f28b | #3f6212 | Green secondary | |
| 7 | #f7df72 | #713f12 | Yellow secondary | **Brand mark** (logo dot only) |
| 8 | #83e7ff | #0e7490 | Blue secondary | |
| 9 | #f0a6ff | #a21caf | Violet secondary | |
| 10 | #ff9f9f | #b91c1c | Red secondary | |

Rail groups map jobs to accents: navigate (gold), style (mint), inspect (sky), content (lilac),
assist (violet) (`fk2:docs/design.md` Principle 6, `fk2:src/ui/railAccent.ts`).

State (`fk2:src/styles/globals.css` lines 153 to 176, 725 to 730):

| Token | Dark | Light | Use |
|---|---|---|---|
| `--st-danger` | #ef4444 | #ef4444 | Toast edge, destructive fill tint base |
| `--st-danger-light` | #f87171 | #dc2626 | Error icon |
| `--st-danger-text` | #fecaca | #991b1b | Text on `--st-danger-10` |
| `--st-danger-fg` | #f87171 | #b91c1c | **A11y addition.** Destructive text on plain surfaces (Studio used `--danger`, 3.9:1) |
| `--st-warning` / `-text` | #f59e0b / #fde68a | #b45309 / #92400e | Warning icon / text on tint |
| `--st-success` / `-text` | #34d399 / #d1fae5 | #047857 / #047857 | Success icon / text on tint |
| `--st-info-text` | #c4b5fd | #4338ca | Info text |
| `--st-ship-fg` / `-bg` | accent-1 / accent-1-10 | **#065f46** / accent-1-10 | Ship chip. Light text is Studio's own `--success-text-muted`, because accent-1 is 4.45:1 on the tint |
| `--st-explore-fg` / `-bg` | accent-4 / accent-4-10 | accent-4 / accent-4-10 | Explore chip |
| `--st-btn-secondary-fg` | = text | = text-muted | **A11y change.** Studio rests secondary buttons at text-muted (4.17:1 on overlay-10 in dark) |

### 2.4 Color: canvas affordances

Studio keeps these fixed so they read over any user content (`fk2:src/styles/globals.css` lines 369 to 527).

| Studio | Banana | Dark | Light | Use |
|---|---|---|---|---|
| canvas fill (`CanvasRoot.module.css`) | `--st-canvas-bg` | surface-2 | surface-2 | Board background |
| `--canvas-selection-ring-color` | `--st-canvas-selection-ring-color` | #39ff14 | #39ff14 | Selection outline, marquee |
| (new) | `--st-canvas-selection-halo` | transparent | #08110a | **A11y addition.** 1px ink outside the green in light (green on light is 1.26:1) |
| `--canvas-hover-ring-color` | `--st-canvas-hover-ring-color` | #ff2bd6 | **#c0009c** | Hover ring. **A11y change** in light (2.98:1) |
| `--canvas-snap-guide-color` | `--st-canvas-snap-guide-color` | #00c8ff | **#0077a3** | Alignment guide. **A11y change** in light (1.83:1) |
| marquee fill and edge | `--st-canvas-marquee-fill` / `-border` | green 12% / green | green 18% / ink | Drag-select box |
| `--canvas-resize-handle-fill` | `--st-canvas-resize-handle-fill` / `-border` | #ffffff / #39ff14 | #ffffff / **#08110a** | Handles. **A11y change** edge in light |
| `--annotation-selection-ring` | `--st-annotation-selection-ring` | #ffffff | **#111827** | Selected sticky note. **A11y change** in light (white is 1.07:1) |
| `--canvas-node-badge-text` | same | #08110a | #08110a | Text on a green badge |
| `--canvas-placeholder-bg` | same | 45 degree stripes from text-subtle | same | Empty or failed media |
| `--note-yellow/green/blue/pink/gray` | same | #fff8b8 #d3f39b #aed4fb #ffcfe1 #dfe3ea | same | Sticky paper, not themed |
| `--note-ink` / `-subtle` | same | #1f2126 / ink **72%** | same | **A11y change**: Studio 45% is 2.5:1 |

### 2.5 Typography

- Families (`fk2:src/styles/globals.css` lines 1 to 23): `--font-sans: "Inter Variable", system-ui, sans-serif`
  (Inter is loaded from `@fontsource-variable/inter`, latin subset, weights 100 to 900);
  `--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`.
- Licence: **Inter is SIL Open Font License 1.1, so Banana can use it as is.** It has no Arabic.
  Arabic match: **IBM Plex Sans Arabic** (OFL 1.1, already in `lib/kit/fonts.json`): neutral, low
  contrast, a clear match for Inter's grotesque tone; fallback **Noto Sans Arabic** (OFL 1.1).
  The token file switches `--st-font-sans` to Plex Sans Arabic first under `:lang(ar)` and `[dir="rtl"]`,
  with Inter after it for Latin runs.
- Self-host both (`@fontsource-variable/inter`, `@fontsource/ibm-plex-sans-arabic`) so the inline
  MCP Apps canvas does not depend on Google Fonts under a host CSP.

Fluid scale (`--text-*`, Banana `--st-text-*`, clamp between about 380px and 1440px viewport):

| Step | Range | Studio use |
|---|---|---|
| 3xs | 8 to 9px | Micro badges only |
| 2xs | 9 to 10px | Dialog eyebrow, xs buttons |
| xs | 10 to 11px | sm buttons and inputs, toast body, top bar labels |
| s | 11 to 12px | **Default chrome**: md buttons, menu items, tooltips, toasts, frame titles |
| m | 12 to 13px | lg buttons, nav items |
| l | 13 to 14px | Dialog title |
| xl | 14 to 16px | |
| 2xl | 16 to 18px | Page error headings |
| 3xl to 5xl | 18 to 28px | Headings |
| 6xl | 32 to 40px | |
| 7xl | 40 to 56px | KPI values |

Weights: 400 body, 500 labels and tooltips, 560 menu items, 600 titles, 700 buttons and dialog
titles. Uppercase labels: 11px, 600, letter spacing 0.07em (widget titles); eyebrow 0.12em
(`fk2:docs/design.md` "Typography", `fk2:src/ui/components/Dialog/Dialog.module.css`). Line heights:
1.2 titles, 1.3 tooltips, 1.35 to 1.4 toasts, 1.5 to 1.6 body. Arabic gets 1.7 body and no letter
spacing (token file).

### 2.6 Spacing

Fluid `--space-*` (Banana `--st-space-*`): px 1, 4xs 2 to 3, 3xs 3 to 4, 2xs 4 to 5, xs 5 to 6, s 6 to 8,
m 8 to 10, l 10 to 12, xl 12 to 14, 2xl 14 to 16, 3xl 16 to 18, 4xl 18 to 20, 5xl 20 to 24, 6xl 24 to 28,
7xl 28 to 32, 8xl 32 to 40, 9xl 40 to 48, 10xl 48 to 56, 11xl 56 to 72, 12xl 84 to 108 (px)
(`fk2:src/styles/globals.css` lines 53 to 73).

Frozen scale for dense panels (Studio `--inspector-space-*`, Banana `--st-fixed-*`): 2, 3, 4, 5, 6, 8,
10, 12px. Studio's reason: a fluid gutter "silently gains ~1px per gutter on a wide monitor"
(`fk2:docs/design.md` "The inspector"). Use the frozen scale for canvas node chrome.

Rhythm inside a dense panel: 4px within a group, 8px between groups and sections, 12px inside an
inset card (`fk2:src/styles/globals.css` lines 247 to 283).

### 2.7 Radius, borders, shadows

| Studio | Banana | Value | Use |
|---|---|---|---|
| `--radius-sm` | `--st-radius-sm` | 3px | Chips, keycaps, sticky notes, skeleton bars |
| `--radius` | `--st-radius` | 6px | Editor controls, canvas frames, tooltips |
| xs button / field | `--st-radius-field` | 8px | xs buttons, dense fields |
| menu item | `--st-radius-menu-item` | 12px | Context menu rows, segmented track |
| `--panel-radius` | `--st-radius-panel` | 12px | Dialogs, toasts, spotlight, popovers |
| `--card-radius` | `--st-radius-card` | 16px | Tile cards, context menu, canvas inset corner, notch |
| `--input-radius` | `--st-radius-input` | 1em | Inputs and sm/md/lg buttons (pill) |

Borders are 1px; 2px for the selection outline, the toast state edge and the rail's active bar.

Shadows (`fk2:src/styles/globals.css` lines 340 to 355, 732 to 742):

| Banana | Dark | Use |
|---|---|---|
| `--st-shadow-panel` | inset 0 -1px 0 scrim-40, 0 12px 40px rgba(0,0,0,.65) | Floating panels, toasts, spotlight, canvas frames (drop part) |
| `--st-shadow-menu` | 0 12px 28px scrim-50 | Context menu |
| `--st-shadow-dialog` | 0 18px 48px | Dialog |
| `--st-shadow-tooltip` | 0 4px 16px scrim-50, inset 0 1px 0 overlay-5 | Tooltip |
| `--st-shadow-card-hover` | 0 2px 4px scrim-30, 0 8px 20px scrim-40 | Clickable tile under the pointer |
| `--st-shadow-canvas-chrome` | 0 12px 28px scrim-30 | Notch toolbar |
| `--st-note-shadow` | 0 1px 2px, 0 6px 14px | Sticky note contact shadow |
| `--st-shadow-input-focus` | inset glow | Focused input |

Floating panels also get `backdrop-filter: blur(24px)` and a 1px `--st-overlay-10` border; they are
the only surface with border plus blur (`fk2:docs/design.md` "Floating Overlay Panels").

### 2.8 Z-index layers

Global ladder (`fk2:src/styles/globals.css` lines 528 to 572, `fk2:docs/reference/design-tokens.md` "Z-index layers"):

| Banana | Value | What |
|---|---|---|
| `--st-z-canvas-floating-toolbar` | 15 | Toolbar anchored to board furniture |
| `--st-z-dropdown` | 20 | Dropdowns |
| `--st-z-topbar` | 30 | Main top bar |
| `--st-z-floating-panel` | 50 | Floating panels |
| `--st-z-sidebar` | 55 | Sidebars, rail |
| `--st-z-toolbar-popover` | 201 | Top bar popovers |
| `--st-z-spotlight` | 9000 | Command palette, modal shells |
| `--st-z-dialog` | 9500 | Dialog (opens from inside shells) |
| `--st-z-menu` | 9800 | Context menus (open from anywhere, even dialogs) |
| `--st-z-toast` | 10000 | Toasts |
| `--st-z-tooltip` | 10001 | Tooltips, always on top |

Inside the canvas (an isolated stacking context, canvas root at `z-index: 0`): plugin overlay 50,
selection and hover rings and selection toolbar 51, notch 53 (`--st-z-canvas-*`).

### 2.9 Motion

Measured over Studio's CSS modules: `120ms ease` is used 36 times and is the default; then 100, 140,
160ms ease.

| Banana | Value | Studio source |
|---|---|---|
| `--st-duration-instant` | 70ms | Keycap press (`Kbd.module.css`) |
| `--st-duration-fast` | 80ms | Tooltip fade, spotlight close |
| `--st-duration-quick` | 100ms | Menu exit, tab colour |
| `--st-duration-base` | 120ms | Hover, tile lift, spotlight open, tab panel fade |
| `--st-duration-medium` | 140ms | Rail indicator, toast enter |
| `--st-duration-moderate` | 150ms | Button colour |
| `--st-duration-slow` | 180ms | Sidebar width, notch roll |
| `--st-duration-zoom` | 220ms | Discrete zoom (`CanvasTransformLayer.module.css`) |
| `--st-duration-shimmer` | 1.4s | Skeleton loop |
| `--st-duration-spin` | 0.8s | Button spinner |
| `--st-delay-peek-hide` | 600ms | Notch stays before rolling away |

Easings: `ease` (default), `ease-out` (enter), `ease-in` (exit), `cubic-bezier(0.4, 0, 0.2, 1)` for zoom,
`cubic-bezier(0.16, 1, 0.3, 1)` for menu enter, `cubic-bezier(0.4, 0, 1, 1)` for menu exit.
Continuous gestures (wheel, pinch, drag) never animate; only discrete steps do
(`fk2:src/admin/pages/site/canvas/CanvasTransformLayer.module.css`). Reduced motion zeroes
everything (`fk2:src/styles/globals.css` lines 772 to 782); in Banana the duration tokens become 0ms.

---

## 3. Layout shell

Source: `fk2:src/admin/layouts/AdminCanvasLayout/AdminCanvasLayout.module.css`,
`fk2:src/admin/pages/site/toolbar/Toolbar.module.css`, `fk2:src/admin/pages/site/sidebars/**`,
`fk2:src/admin/state/workspaceLayout.ts`, `fk2:src/admin/pages/site/store/slices/uiSlice.ts`.

```
+--------------------------------------------------------------------------+
| top bar 36px, --bg-body: brand | project | tools ......... zoom | status   |
+----+-------------------+-------------------------------------+-----------+
|rail| left panel        |  canvas (--bg-surface-2)            | right     |
|42px| 320px default     |  rounded 16px top-start corner      | panel     |
|    | 260 to 520px      |        [ notch toolbar ]            | 290px     |
|    | --bg-body         |                                     | 260-520px |
+----+-------------------+-------------------------------------+-----------+
```

- **Shell**: full viewport, `--bg-body`. The canvas sits inset into it: `border-top-left-radius: 16px`
  on `--bg-surface-2`, and a 12px top-right radius when the right sidebar is open. This black frame
  around a rounded grey board is Studio's signature silhouette.
- **Top bar**: 36px tall, `--bg-body`, padding 0 `--space-s`, gap `--space-4xs`, z 30. Items are 28px
  tall: site name (text-xs, 700, max 140px, ellipsis), project name (text-xs 600, subtle, double click
  to rename), ghost icon buttons, zoom group (zoom out, a percentage button at least 44px wide, zoom
  in), save status (6px dot plus text-xs 700 label), split publish button. Under 760px it wraps to
  68px and hides zoom and status.
- **Left sidebar**: a 42px rail of 28px icon buttons (padding `--space-s` `--space-2xs`, gap
  `--space-s`), each tinted by its accent with a soft glow; the active item gets a 16% tint fill and
  a 2px by 14px bar on its outer edge. The panel beside it is 320px by default, resizable 260 to
  520px; open and close animate width over 180ms.
- **Right sidebar**: properties panel, 290px default (Figma's 240px plus a category rail and
  scrollbar gutter), 260 to 520px. Tabs (Properties, Comments) above the panel only when both exist.
- **Canvas**: frames start 80px from the top-left; frames are 40px apart; overflow is `clip`, never
  `hidden`, so focus never scrolls the board.
- **Floating toolbar (notch)**: centered at the top edge of the canvas, hanging down from it:
  `--bg-body` fill, radius 0 0 16px 16px with inverted outer corners, padding and gap `--space-3xs`,
  `--st-shadow-canvas-chrome`, z 53. Holds insert buttons, a 1px by 18px divider, undo and redo. In
  live mode it "peeks": parked above the edge, it rolls down on hover or focus-within (180ms) and
  rolls back 600ms after the pointer leaves (`fk2:src/admin/pages/site/canvas/CanvasNotch.module.css`).
- **Toasts**: bottom right, 16px inset, column grows upward.
- **Spotlight** (Cmd+K): 640px wide, 28vh from the top, max height min(60vh, 560px); input row 56px,
  result rows 44px, group headers 28px, footer 36px; backdrop `--scrim-50` with 8px blur
  (`fk2:src/admin/spotlight/Spotlight.module.css`).

---

## 4. Components

Every interactive control in Studio goes through a primitive in `fk2:src/ui/components/`; a bare
`<button>` fails a gate test. Class names are composed with a 3-line `cn` helper; no Tailwind.

### 4.1 Button (`fk2:src/ui/components/Button/Button.module.css`)

Base: inline-flex, no border, pill radius (`--radius-input`) for sm, md, lg; font weight 700;
`transition: color, background-color, border-color, opacity 150ms ease`.

| Variant | Rest | Hover | Active (pressed down) | Selected (`aria-pressed`) |
|---|---|---|---|---|
| ghost | transparent, text-muted | overlay-10, text | overlay-20, text | (use secondary) |
| secondary | overlay-10, text-muted (Banana: `--st-btn-secondary-fg`) | overlay-20, text | overlay-30 | overlay-20, text |
| primary | overlay-20, text | overlay-30 | overlay-20 | |
| destructive | danger-10, danger (Banana: `--st-danger-fg`) | opacity 0.9 | opacity 0.8 | |
| ghost, tone danger | transparent, danger | danger-10, danger-light | same | |

Primary is achromatic. Studio has no colored call-to-action button.

| Size | Studio height (icon-only width) | Padding | Font | Radius | Banana |
|---|---|---|---|---|---|
| micro | 18 (18) | 0 3xs | 2xs | 6px | **Do not use** (below 24px) |
| xs | 22 (26) | 0 xs | 2xs | 8px | **24 (24)**, A11y change |
| sm (default) | 26 (28) | 0 s | xs | pill | **28 (28)**, A11y change |
| md | 32 (32) | xs xl | s | pill | 32 |
| lg | 44 (44) | 0 2xl | m | pill | 44 (site default) |

States: `:focus-visible` uses the focus ring (Studio: `box-shadow: 0 0 0 1px overlay-20`; Banana:
`--st-focus-ring`, see 9.2). `:disabled` opacity 0.38 and no pointer events; `aria-disabled` keeps
pointer events so tooltips still explain why. Loading: a 12px spinner (2px ring, overlay-20 track,
`currentColor` head, 0.8s linear) is overlaid while the label keeps its width, so the button never
resizes; the busy label is the same verb in progress ("Saving…").

Shapes: `pill` (999px), `flush` (0). Nav item: 44px rows, 2px start-edge bar when active.

### 4.2 Icon buttons

Icon-only buttons are square at their size (28px default in Studio, 24px in the inspector grid).
Icons 12 to 14px inside (`Icon size={14}` appears 144 times, 13 127 times, 12 110 times). A ghost
icon button rests at text-muted and lightens to text on hover. Every icon button carries an
`aria-label`, and its hover hint is a `Tooltip`, never `title=` (gated by `no-native-title-tooltips.test.ts`).

### 4.3 Inputs (`fk2:src/ui/components/Input/Input.module.css`)

Transparent fill, 1px border, pill radius, text `--text`, font sans.

| State | Studio | Banana |
|---|---|---|
| rest | border overlay-20 | border `--st-border-control` (**A11y change**) |
| hover | border overlay-30 | border overlay-60 (dark) / overlay-70 (light) |
| focus | border overlay-50, `--shadow-input-focus` | same plus `--st-focus-ring` |
| invalid | border danger | border `--st-danger-fg` plus a text error and `aria-invalid` |
| disabled | opacity 0.5 | same |
| placeholder | `--text-disabled` | `--st-text-placeholder` (**A11y change**) |

Sizes: xs 24px (pad 4xs xs, text-xs), sm 28px (2xs s, text-xs), md 32px (xs m, text-s). Textarea line
height 1.5; `autoGrow` uses `field-sizing: content` with a row cap. Inside dense panels the field is a
filled 8px rectangle whose border shows only on hover and focus (inspector skin).

### 4.4 Menus and context menus (`fk2:src/ui/components/ContextMenu/ContextMenu.module.css`)

- Panel: `position: fixed` at the pointer or trigger, z `--menu-z-index` (9800), padding `--space-3xs`,
  **no border**, radius 16px, fill `--bg-surface-3`, shadow 0 12px 28px scrim-50, width capped at
  `100vw - 16px`, transform origin top center.
- Enter: 130ms `cubic-bezier(0.16, 1, 0.3, 1)` from opacity 0, translateY(-4px), scale(0.97).
  Exit: 100ms `cubic-bezier(0.4, 0, 1, 1)` to translateY(-3px) scale(0.98); the component stays
  mounted 110ms for it. No animation under reduced motion.
- Item: min height 28px, padding 0 `--space-m`, gap `--space-m`, radius 12px, text-s, weight 560, text
  color; a 16px icon slot at the start; a checkmark at the end for a selected option
  (`menuitemradio`). Hover is the ghost button hover (overlay-10).
- Separator: margin 3xs xs, `--bg-surface-2` line. Submenu chevron at 70% opacity.
- Searchable menus keep a fixed search header and scroll only the list.
- Keyboard: Studio's primitive handles Escape only. **Banana keeps its own arrow, Home, End,
  Escape and Tab handling** (`canvas/nodes/NodeMenu.tsx`), which is better than Studio here.

### 4.5 Tooltip (`fk2:src/ui/components/Tooltip/Tooltip.module.css`, `Tooltip.tsx`)

Fill `--bg-body`, text `--text-bright`, 1px `--overlay-5` border, radius 6px, `--shadow-tooltip`, padding
xs m, text-s weight 500, line height 1.3, max width 240px (280px wide variant), a 6px diamond arrow;
fades in over 80ms once positioned; z 10001. Opens on hover and optionally on focus; closes on
Escape, scroll or outside pointerdown; sets `aria-describedby` on the trigger and `role="tooltip"`.
Studio sets `pointer-events: none` on the bubble; Banana must keep it open while hovered (9.5).

### 4.6 Dialog (`fk2:src/ui/components/Dialog/Dialog.module.css`, `Dialog.tsx`)

- Backdrop: fixed, z 9500, `--bg-body` at 50%, padding `--space-5xl`, centered.
- Panel: radius 12px, `--bg-surface`, shadow 0 18px 48px, max height 80vh, grid rows header, body,
  footer. Widths: sm 360, md 440, lg 520, xl 640, 2xl 820.
- Header: `--bg-surface-2`, padding l xl, bottom rule `--border`, grid with a 26px close button.
  Optional eyebrow: text-2xs, 700, 0.12em, uppercase, text-subtle (danger tone: red). Title: text-l,
  700, line height 1.2, one line with ellipsis.
- Body: padding 2xl, scrolls. Footer: same chrome as header, buttons at the end, gap s.
- Behavior: `role="dialog"` with `aria-modal`, or `alertdialog` for the danger tone; Escape closes;
  focus goes to the first control (usually Cancel) and returns to the trigger on close.
- Native `alert()`, `confirm()` and `prompt()` are banned.

### 4.7 Toasts (`fk2:src/ui/components/Toast/**`)

- Stack: fixed bottom 16px, right 16px, z 10000, column-reverse, gap s, max width min(420px, 100vw - 32px).
- Card: grid `16px 1fr auto`, padding m l, `--bg-surface`, 1px overlay-10, radius 12px, `--shadow-panel`,
  24px blur, text-s, line height 1.4. Enter 140ms ease-out from translateY(6px) scale(0.98).
- Kind: the card stays achromatic; only a 2px start edge and the 16px icon carry color (danger,
  warning, success; info uses text-subtle). Title text-bright weight 500; body text-muted text-xs,
  clamped to 3 lines; a "×N" counter when the same toast repeats (dedupe by default).
- Timing: error 8s, warning 6s, success and info 4s; paused while hovered. `role="alert"` for error
  and warning, `role="status"` otherwise. Operation failures always go to a toast; field validation
  stays next to the field (`fk2:CLAUDE.md` "UI error handling").

### 4.8 Tabs and segmented control

- Tabs (`fk2:src/ui/components/Tabs/Tabs.module.css`): underline style. List has a 1px `--border`
  bottom rule. Tab: padding s 2xl, 14px, 500, text-subtle; hover text; active text, weight 600, and a
  2px underline that overlaps the rule. Panel fades in 120ms from translateY(4px).
- Segmented control (`SegmentedControl.module.css`): a track with 2px padding, 1px overlay-20 border,
  overlay-5 fill, radius 12px; segments radius 8px, hover overlay-10, pressed overlay-20. Mixed
  values show a dashed track.

### 4.9 Panels and sections

- Panel body on `--bg-body` beside the canvas; floating overlay panels on `--bg-surface` with border,
  blur and `--shadow-panel`.
- Section (`fk2:src/ui/components/Section/`): a hairline and a title, no fill, no chip. The title is
  the disclosure toggle; the chevron shares the icon's 16px box and shows on hover. An empty section
  has no disclosure at all.
- Tile card (`Widget.module.css`): `--bg-surface-2` tiles on a `--bg-surface` parent, 1px grid gap,
  radius 16px, no border. Title row: a 7px accent dot (radius 3px) and an 11px uppercase label. Hover:
  surface-3; a clickable tile also rises 2px with `--shadow-card-hover`, and returns on press.
- Scrollbars: 6px, transparent track, thumb text-subtle at 58%, hover text-muted at 72%.

### 4.10 Loading skeletons (`fk2:src/ui/components/Skeleton/`)

Bars with radius-sm, fill surface-3 with a surface-3 to surface-4 to surface-3 gradient at 200% size,
1.4s ease-in-out loop, all regions in sync. Shapes: block (three bars), cards, rows, tree (indented,
cascading). The host carries `aria-busy="true"`. Reduced motion stops the shimmer and keeps the fill.

### 4.11 Empty states (`fk2:src/ui/components/EmptyState/`)

Variant `card`: padding xl, radius 12px, `--bg-surface`, text-s subtle, line height 1.5. Variant
`centered`: fills the region, centered, padding 5xl 2xl, text-muted. Copy rule: the title states the
fact ("No projects yet."), the description lists the next moves, the button carries the verb.

### 4.12 Keycap (`fk2:src/ui/components/Kbd/Kbd.module.css`)

19px tall, min width 19px, padding 0 xs, 1px border, radius 3px, a vertical gradient face, a
four-part shadow that fakes a raised cap, mono text-xs 500. Hover lifts, active depresses (70ms).
`ShortcutKeys` splits "⌘K" or "Ctrl+Shift+P" into caps. Banana: label color `--st-kbd-text`
(**A11y change**, Studio text-muted is 3.86:1 on the cap).

---

## 5. Canvas visuals

Source: `fk2:src/admin/pages/site/canvas/**`, `fk2:src/core/studio-runtime/selectionChromeCss.ts`.

- **Frames** (`BoardFramesLayer.module.css`): radius 6px, `--shadow-panel-drop`, no border. A header
  bar above the body: padding 2xs s, `--bg-surface-2`, title text-s 600 with ellipsis, a muted badge;
  grab cursor. The frame edits land in (active) gets a `--bg-surface-4` header, not a ring.
- **Selected frame**: `outline: 2px solid` selection green, `outline-offset: 2px`. **Multi-selection**:
  one 1px dashed green bounding box, radius 6px. **Hovered node**: inset 1px pink ring.
- **Marquee**: 12% green fill, 1px green edge, drawn in screen pixels above the board (z 51).
- **Resize handles**: 9px squares, 1px green edge, white fill, radius 2px, centered on the corners;
  edges are invisible 7px strips along the whole side with resize cursors.
- **Sticky notes**: fixed pastel paper in both themes, radius 3px, `--note-shadow`, ink text, grab
  cursor. A small pill toolbar (surface-2, 1px border, pill radius) floats above the note with color
  swatches; it fades in over 120ms on hover, focus-within or selection. Selected note: white ring.
- **Empty media**: diagonal stripes (`--canvas-placeholder-bg`).
- **Snap guides**: thin cyan lines touching both aligned items.

---

## 6. Canvas interaction model

Sources: `fk2:src/admin/pages/site/hooks/useCanvas.ts`, `canvas/math.ts`, `canvas/canvasPanInput.ts`,
`canvas/canvasZoomFit.ts`, `canvas/boardSnapping.ts`, `canvas/canvasFreeMove.ts`,
`canvas/BoardFramesLayer/useMarqueeSelection.ts`, `canvas/BoardFramesLayer/framesInMarquee.ts`,
`canvas/useBoardAnnotationKeyboard.ts`, `fk2:src/admin/spotlight/keybindings.ts` and
`keybindingGestures.ts`, `fk2:STUDIO-FIGMA-FEEL-PLAN.md` Track K, `fk2:STUDIO-FIGMA-PARITY-PLAN.md` D1 to D3.

### 6.1 Pan and zoom

- **Plain wheel pans** (vertical; Shift+wheel horizontal). It does not zoom.
- **Ctrl or Cmd + wheel zooms toward the cursor**; trackpad pinch arrives the same way. Factor per
  event: `0.9985 ^ deltaY` (about 15% per wheel notch).
- **Space + left drag pans**, **middle-button drag pans**, and **H** latches a hand tool (open-hand
  cursor, grab while dragging) until another tool is picked.
- **+ / -** zoom one step around the viewport center through the ladder
  `0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4`. **Cmd/Ctrl+0** resets to 100%. **Shift+1** zooms to
  fit every item, **Shift+2** to the selection, both with 64px padding and centered. A toolbar zoom
  menu also offers "Fill".
- Range 10% to 400%. The design canvas opens at 50%.
- Discrete changes (buttons, keys, fit) animate 220ms `cubic-bezier(0.4, 0, 0.2, 1)`; continuous
  gestures write the transform every frame and never animate.
- Pan and zoom run outside React state (a ref plus one DOM write per frame); the store is updated
  100ms after the gesture ends. Pan is measured at 60 fps.

### 6.2 Select

- Click selects (replace). **Shift+click** adds (frames) or selects a range (layers). **Cmd/Ctrl+click** toggles.
- **Drag on empty canvas draws a marquee** after 3px of movement; anything it **intersects** is
  selected (touching edges do not count). A non-additive marquee clears the old selection. Space or
  middle-button drags are never claimed by the marquee.
- **Cmd/Ctrl+A** selects all frames. **Escape** steps out (deselect). **Enter** selects the first
  child, **Shift+Enter** the parent.
- A click on the background deselects; the click that ends a marquee is swallowed.

### 6.3 Move, duplicate, resize

- Drag moves; the drag is a session that does not re-render per move.
- **Alt+drag** drags a copy. **Shift+drag** locks to one axis. **Cmd/Ctrl+drag** places freely.
- **Snapping**: edges and centers snap to peers within **8 board units** (6px for free moves), and a
  cyan guide is drawn for each matched axis.
- **Arrow keys nudge** the selected frames 1px, **Shift+arrow** 10px.
- Resize from 8 handles (corners and edge strips); **K** scale tool keeps proportions.
- **Alt+hover** with a selection measures distances (red pills) and padding (violet).

### 6.4 Shortcut table (Studio)

| Action | Mac | Windows |
|---|---|---|
| Command palette | ⌘K | Ctrl+K |
| Save | ⌘S | Ctrl+S |
| Settings | ⌘, | Ctrl+, |
| Shortcut sheet | ? | ? |
| Undo / Redo | ⌘Z / ⌘⇧Z | Ctrl+Z / Ctrl+Shift+Z |
| Cycle panels | F6 | F6 |
| Assistant | ⌘I | Ctrl+I |
| Duplicate | ⌘D | Ctrl+D |
| Copy / Cut / Paste | ⌘C / ⌘X / ⌘V | Ctrl+C / Ctrl+X / Ctrl+V |
| Delete | ⌘⌫, Delete, Backspace | Ctrl+Backspace, Delete, Backspace |
| Zoom to 100% | ⌘0 | Ctrl+0 |
| Zoom to fit / to selection | ⇧1 / ⇧2 | Shift+1 / Shift+2 |
| Zoom in / out | + / - | + / - |
| Move layer up / down | ⌥↑ / ⌥↓ | Alt+↑ / Alt+↓ |
| Select child / parent | ↵ / ⇧↵ | Enter / Shift+Enter |
| Rename | ⌘R | Ctrl+R |
| Hide / Lock | ⌘⇧H / ⌘⇧L | Ctrl+Shift+H / Ctrl+Shift+L |
| Group / Ungroup | ⌘G / ⌘⇧G | Ctrl+G / Ctrl+Shift+G |
| Tools: text, frame, comment, hand, scale, box, round box | T F C H K R O | same |
| Copy as PNG | ⌘⇧C | Ctrl+Shift+C |
| Select all frames | ⌘A | Ctrl+A |
| Nudge (Shift for 10) | arrows | arrows |
| Measure | ⌥ + hover | Alt + hover |
| Duplicate by drag / axis lock / free place | ⌥ / ⇧ / ⌘ + drag | Alt / Shift / Ctrl + drag |
| Pan | Space + drag, middle drag, H | same |

One registry feeds both the handlers and the `?` sheet, and each binding carries an
`aria-keyshortcuts` value.

---

## 7. Iconography

- Set: **pixel-art-icons**, a vendored subset (`fk2:vendor/pixel-art-icons/`, 117 icons in this
  checkout, about 4,053 in the full sibling repo). Deep imports only
  (`pixel-art-icons/icons/<name>`); no Lucide, Heroicons or Phosphor; no inline SVG strings (gate tests).
- Drawing: 24 by 24 grid, **filled** paths, axis-aligned segments on a **2px pixel grid**, diagonals as
  staircases, no strokes (`fk2:vendor/pixel-art-icons/icons/close.tsx`, `fk2:docs/design.md` "The inspector").
  Many have a `-solid` variant (`circle-alert-solid`, `warning-diamond-solid`).
- Sizes in use: 12 to 14px in chrome, 16px in toasts and menu slots, 20 to 28px rarely. Color is
  `currentColor`; rail icons take their accent and a `drop-shadow(0 0 5px tint 28%)` glow.
- Licence: the vendored `package.json` names no licence. **Confirm it is the owner's or open.** If it
  is not usable, the closest open set is **Pixelarticons** (MIT, 24px pixel grid, same staircase style).
- Banana today draws Lucide-style 2px stroke icons inline (`canvas/icons.tsx`). Moving to the pixel
  set is the single biggest "looks like Studio" change after the palette. Use 12px (crisp at half
  size) in chips and 16px in buttons; 24px for empty states.

---

## 8. Copy tone

From `fk2:docs/design.md` "UI copy" (read off `StyleCompileConsentBanner` and `DeleteProjectDialog`):

- **Name the mechanism.** Say what will run, be written, or move, in the user's words.
- **Say where things go.** A destructive-looking verb names the destination ("The folder is moved to
  `studio-workspace/.trash/`, where you can move it back at any time.").
- **Buttons say what happens**: verb plus noun ("Delete project", "Create project"); never "OK",
  "Continue", "Confirm", "Yes". Busy label is the verb in progress ("Deleting…"). Refusal is "Not now"
  or "Cancel", never "No thanks".
- **No marketing adjectives** (powerful, seamless, beautiful, magical, effortless, blazing, simply,
  just) and **no exclamation marks**.
- **Sentence case** everywhere. The product name is flat, never "the Studio", never "we" or "our".
- **Second person, present tense, active voice**, and never apologise for the system.
- **An empty state says what to do next.** "A title that is only a mood is not a state."
- **A step is done when a fact says so**, never a flag set because the user looked at a screen.

Banana already writes this way. Two adaptations: Studio's copy uses em dashes freely, Banana uses
none (commas, colons, periods, parentheses); and the product name comes from `APP_NAME` only.

---

## 9. Accessibility notes

What Studio does well, and where Banana must go further.

### 9.1 Studio strengths to keep

- Reduced motion zeroes every animation and transition.
- Toasts use `role="alert"` or `role="status"`; dialogs trap and restore focus; Escape closes.
- No `title=` tooltips, no native dialogs; tooltips set `aria-describedby` and close on Escape.
- Every shortcut has an `aria-keyshortcuts` value; one registry drives the help sheet.
- Icon glyphs are `aria-hidden` and the control carries the accessible name.
- State in toasts is shown by icon shape and words, not color alone.

### 9.2 Focus (SC 2.4.7, 2.4.11, 1.4.11)

Studio's ring is `0 0 0 1px var(--overlay-20)`: 1.91:1 on dark panels and 1.53:1 on light. **A11y change**:
`--st-focus-ring` is a 2px solid achromatic ring (`#f4f4f5` dark, `#111827` light). Over images and
canvas items use `--st-focus-ring-halo` (2px halo in the opposite tone, then the 2px ring), so it reads
on any picture. Keep Studio's achromatic look; do not tint it.

### 9.3 Targets (SC 2.5.8)

Studio's micro (18px) and xs (22px) buttons, 9px handles and 7px edge strips are under 24px. Banana:
no control below 24 by 24 (`--st-target-min`); handles keep their 9px look but get a 24px hit area
(pseudo-element); edge strips grow to 24px of invisible hit area centered on the edge.

### 9.4 Contrast results

Checked with culori `wcagContrast` against `banana-server/styles/studio-tokens.css` (172 rows, 0
failures; script parses the real file, composites translucent fills over their base, and checks that
the light attribute block and the light media block are identical).

Changes made because a Studio value failed AA (original value and ratio in brackets):

| Token | Theme | New | Studio value |
|---|---|---|---|
| `--st-text-subtle` | dark | #8f8f8f (4.56 on surface-2) | #787878 (3.34 on surface-2, 3.90 on surface) |
| `--st-text-subtle` | light | #56606e (5.14 on body) | #6b7280 (3.90 on body) |
| `--st-text-placeholder` | both | = text-subtle | `--text-disabled` (2.23 dark, 2.54 light) |
| `--st-border-control` | both | white 40% / ink 52% (3.43 to 3.79) | overlay-20 (1.91 dark, 1.53 light) |
| `--st-focus-ring-color` | both | solid 2px (11.66 to 19.11) | overlay-20 1px (1.91 / 1.53) |
| `--st-btn-secondary-fg` | dark | text (9.14) | text-muted (4.17) |
| `--st-danger-fg` | both | #f87171 / #b91c1c | `--danger` as text (3.92 dark surface-2, 3.76 on white) |
| `--st-kbd-text` | dark | #ededed (8.45) | text-muted (3.86) |
| `--st-note-ink-subtle` | both | ink 72% (5.08 to 6.14) | ink 45% (2.53 to 2.74) |
| `--st-ship-fg` | light | #065f46 (6.24) | accent-1 #047857 (4.45 on the tint) |
| `--st-canvas-selection-halo` | light | #08110a (17.89) | green alone (1.26) |
| `--st-canvas-hover-ring-color` | light | #c0009c (5.26) | #ff2bd6 (2.98) |
| `--st-canvas-snap-guide-color` | light | #0077a3 (4.70) | #00c8ff (1.83) |
| `--st-canvas-resize-handle-border` | light | #08110a (17.89) | green edge on white fill (1.26) |
| `--st-annotation-selection-ring` | light | #111827 (16.55) | #ffffff (1.07) |
| `--st-canvas-marquee-border` | light | #08110a (17.89) | green (1.26) |

Full results (fg on bg, ratio, minimum):

| Theme | Use | Foreground | Background | Ratio | Min | Result |
|---|---|---|---|---|---|---|
| dark | body and label text | `text-bright` #f4f4f5 | `bg-body` #000000 | 19.11 | 4.5 | pass |
| dark | body and label text | `text-bright` #f4f4f5 | `bg-surface` #1b1b1b | 15.67 | 4.5 | pass |
| dark | body and label text | `text-bright` #f4f4f5 | `bg-surface-2` #282828 | 13.41 | 4.5 | pass |
| dark | body and label text | `text-bright` #f4f4f5 | `bg-surface-3` #323232 | 11.66 | 4.5 | pass |
| dark | body and label text | `text` #ededed | `bg-body` #000000 | 17.94 | 4.5 | pass |
| dark | body and label text | `text` #ededed | `bg-surface` #1b1b1b | 14.71 | 4.5 | pass |
| dark | body and label text | `text` #ededed | `bg-surface-2` #282828 | 12.59 | 4.5 | pass |
| dark | body and label text | `text` #ededed | `bg-surface-3` #323232 | 10.95 | 4.5 | pass |
| dark | body and label text | `text-muted` #a1a1aa | `bg-body` #000000 | 8.19 | 4.5 | pass |
| dark | body and label text | `text-muted` #a1a1aa | `bg-surface` #1b1b1b | 6.72 | 4.5 | pass |
| dark | body and label text | `text-muted` #a1a1aa | `bg-surface-2` #282828 | 5.75 | 4.5 | pass |
| dark | body and label text | `text-muted` #a1a1aa | `bg-surface-3` #323232 | 5.00 | 4.5 | pass |
| dark | captions, meta, placeholders | `text-subtle` #8f8f8f | `bg-body` #000000 | 6.49 | 4.5 | pass |
| dark | captions, meta, placeholders | `text-subtle` #8f8f8f | `bg-surface` #1b1b1b | 5.33 | 4.5 | pass |
| dark | captions, meta, placeholders | `text-subtle` #8f8f8f | `bg-surface-2` #282828 | 4.56 | 4.5 | pass |
| dark | input placeholder | `text-placeholder` #8f8f8f | `bg-surface` #1b1b1b | 5.33 | 4.5 | pass |
| dark | input placeholder | `text-placeholder` #8f8f8f | `bg-surface-2` #282828 | 4.56 | 4.5 | pass |
| dark | links (underlined) | `link` #f4f4f5 | `bg-body` #000000 | 19.11 | 4.5 | pass |
| dark | links (underlined) | `link` #f4f4f5 | `bg-surface` #1b1b1b | 15.67 | 4.5 | pass |
| dark | primary button | `text` #ededed | `overlay-20 over bg-surface-2` #535353 | 6.57 | 4.5 | pass |
| dark | primary button on panel | `text` #ededed | `overlay-20 over bg-surface` #494949 | 7.69 | 4.5 | pass |
| dark | primary button hover | `text` #ededed | `overlay-30 over bg-surface-2` #696969 | 4.69 | 4.5 | pass |
| dark | secondary button | `btn-secondary-fg` #ededed | `overlay-10 over bg-surface-2` #3e3e3e | 9.14 | 4.5 | pass |
| dark | secondary button on panel | `btn-secondary-fg` #ededed | `overlay-10 over bg-surface` #323232 | 10.95 | 4.5 | pass |
| dark | menu item hover | `text` #ededed | `overlay-10 over bg-surface-3` #474747 | 7.94 | 4.5 | pass |
| dark | ghost button hover on panel | `text-muted` #a1a1aa | `overlay-10 over bg-surface` #323232 | 5.00 | 4.5 | pass |
| dark | destructive text and menu item | `danger-fg` #f87171 | `bg-surface` #1b1b1b | 6.23 | 4.5 | pass |
| dark | destructive text and menu item | `danger-fg` #f87171 | `bg-surface-2` #282828 | 5.33 | 4.5 | pass |
| dark | destructive text and menu item | `danger-fg` #f87171 | `bg-surface-3` #323232 | 4.64 | 4.5 | pass |
| dark | destructive button | `danger-fg` #f87171 | `danger-10 over bg-surface-2` #3c2b2b | 4.83 | 4.5 | pass |
| dark | error alert | `danger-text` #fecaca | `danger-10 over bg-surface` #301f1f | 10.82 | 4.5 | pass |
| dark | warning alert | `warning-text` #fde68a | `warning-10 over bg-surface` #312819 | 11.64 | 4.5 | pass |
| dark | success alert | `success-text` #d1fae5 | `success-10 over bg-surface` #1e2d28 | 12.67 | 4.5 | pass |
| dark | info text | `info-text` #c4b5fd | `bg-surface` #1b1b1b | 9.33 | 4.5 | pass |
| dark | Ship chip | `ship-fg` #8ee6c8 | `ship-bg over bg-surface` #272f2c | 9.35 | 4.5 | pass |
| dark | Explore chip | `explore-fg` #ffc7a8 | `explore-bg over bg-surface` #322c29 | 9.15 | 4.5 | pass |
| dark | Ship chip | `ship-fg` #8ee6c8 | `ship-bg over bg-surface-2` #323b38 | 7.87 | 4.5 | pass |
| dark | Explore chip | `explore-fg` #ffc7a8 | `explore-bg over bg-surface-2` #3e3835 | 7.68 | 4.5 | pass |
| dark | identity label text | `accent-1` #8ee6c8 | `bg-surface-2` #282828 | 10.04 | 4.5 | pass |
| dark | identity label text | `accent-2` #c8b6ff | `bg-surface-2` #282828 | 8.14 | 4.5 | pass |
| dark | identity label text | `accent-3` #9bdcff | `bg-surface-2` #282828 | 9.88 | 4.5 | pass |
| dark | identity label text | `accent-4` #ffc7a8 | `bg-surface-2` #282828 | 9.82 | 4.5 | pass |
| dark | identity label text | `accent-5` #ffb6cd | `bg-surface-2` #282828 | 9.00 | 4.5 | pass |
| dark | identity label text | `accent-6` #b8f28b | `bg-surface-2` #282828 | 11.31 | 4.5 | pass |
| dark | identity label text | `accent-7` #f7df72 | `bg-surface-2` #282828 | 11.06 | 4.5 | pass |
| dark | identity label text | `accent-8` #83e7ff | `bg-surface-2` #282828 | 10.42 | 4.5 | pass |
| dark | identity label text | `accent-9` #f0a6ff | `bg-surface-2` #282828 | 8.15 | 4.5 | pass |
| dark | identity label text | `accent-10` #ff9f9f | `bg-surface-2` #282828 | 7.52 | 4.5 | pass |
| dark | tooltip | `text-bright` #f4f4f5 | `bg-body` #000000 | 19.11 | 4.5 | pass |
| dark | toast title, dialog title | `text-bright` #f4f4f5 | `bg-surface` #1b1b1b | 15.67 | 4.5 | pass |
| dark | keycap label | `kbd-text` #ededed | `kbd-face-top` #434343 | 8.45 | 4.5 | pass |
| dark | keycap label | `kbd-text` #ededed | `kbd-face-bottom` #2f2f2f | 11.44 | 4.5 | pass |
| dark | note text | `note-ink` #1f2126 | `note-yellow` #fff8b8 | 14.86 | 4.5 | pass |
| dark | empty note hint | `note-ink-subtle over note-yellow` #5e5d4f | `note-yellow` #fff8b8 | 6.14 | 4.5 | pass |
| dark | note text | `note-ink` #1f2126 | `note-green` #d3f39b | 13.09 | 4.5 | pass |
| dark | empty note hint | `note-ink-subtle over note-green` #515c47 | `note-green` #d3f39b | 5.74 | 4.5 | pass |
| dark | note text | `note-ink` #1f2126 | `note-blue` #aed4fb | 10.44 | 4.5 | pass |
| dark | empty note hint | `note-ink-subtle over note-blue` #475362 | `note-blue` #aed4fb | 5.08 | 4.5 | pass |
| dark | note text | `note-ink` #1f2126 | `note-pink` #ffcfe1 | 11.71 | 4.5 | pass |
| dark | empty note hint | `note-ink-subtle over note-pink` #5e525a | `note-pink` #ffcfe1 | 5.39 | 4.5 | pass |
| dark | note text | `note-ink` #1f2126 | `note-gray` #dfe3ea | 12.51 | 4.5 | pass |
| dark | empty note hint | `note-ink-subtle over note-gray` #55575d | `note-gray` #dfe3ea | 5.61 | 4.5 | pass |
| dark | badge on selection | `canvas-node-badge-text` #08110a | `canvas-selection-ring-color` #39ff14 | 14.15 | 4.5 | pass |
| dark | input and control boundary | `border-control over bg-body` #666666 | `bg-body` #000000 | 3.66 | 3 | pass |
| dark | input and control boundary | `border-control over bg-surface` #767676 | `bg-surface` #1b1b1b | 3.79 | 3 | pass |
| dark | input and control boundary | `border-control over bg-surface-2` #7e7e7e | `bg-surface-2` #282828 | 3.63 | 3 | pass |
| dark | input and control boundary | `border-control over bg-surface-3` #848484 | `bg-surface-3` #323232 | 3.43 | 3 | pass |
| dark | focus ring | `focus-ring-color` #f4f4f5 | `bg-body` #000000 | 19.11 | 3 | pass |
| dark | focus ring | `focus-ring-color` #f4f4f5 | `bg-surface` #1b1b1b | 15.67 | 3 | pass |
| dark | focus ring | `focus-ring-color` #f4f4f5 | `bg-surface-2` #282828 | 13.41 | 3 | pass |
| dark | focus ring | `focus-ring-color` #f4f4f5 | `bg-surface-3` #323232 | 11.66 | 3 | pass |
| dark | focus ring against its halo | `focus-ring-color` #f4f4f5 | `focus-halo-color` #000000 | 19.11 | 3 | pass |
| dark | ghost icon on toolbar | `text-muted` #a1a1aa | `bg-surface-2` #282828 | 5.75 | 3 | pass |
| dark | toast error icon | `danger-light` #f87171 | `bg-surface` #1b1b1b | 6.23 | 3 | pass |
| dark | toast warning icon | `warning` #f59e0b | `bg-surface` #1b1b1b | 8.02 | 3 | pass |
| dark | toast success icon | `success` #34d399 | `bg-surface` #1b1b1b | 8.96 | 3 | pass |
| dark | selection outline | `canvas-selection-ring-color` #39ff14 | `canvas-bg` #282828 | 10.87 | 3 | pass |
| dark | hover ring | `canvas-hover-ring-color` #ff2bd6 | `canvas-bg` #282828 | 4.61 | 3 | pass |
| dark | snap guide | `canvas-snap-guide-color` #00c8ff | `canvas-bg` #282828 | 7.52 | 3 | pass |
| dark | marquee edge | `canvas-marquee-border` #39ff14 | `canvas-bg` #282828 | 10.87 | 3 | pass |
| dark | note selection ring | `annotation-selection-ring` #ffffff | `canvas-bg` #282828 | 14.74 | 3 | pass |
| dark | resize handle (white fill) | `canvas-resize-handle-fill` #ffffff | `canvas-bg` #282828 | 14.74 | 3 | pass |
| light | body and label text | `text-bright` #111827 | `bg-body` #e3e7ed | 14.29 | 4.5 | pass |
| light | body and label text | `text-bright` #111827 | `bg-surface` #ffffff | 17.74 | 4.5 | pass |
| light | body and label text | `text-bright` #111827 | `bg-surface-2` #f6f7f9 | 16.55 | 4.5 | pass |
| light | body and label text | `text-bright` #111827 | `bg-surface-3` #eceff3 | 15.38 | 4.5 | pass |
| light | body and label text | `text` #1f2937 | `bg-body` #e3e7ed | 11.83 | 4.5 | pass |
| light | body and label text | `text` #1f2937 | `bg-surface` #ffffff | 14.68 | 4.5 | pass |
| light | body and label text | `text` #1f2937 | `bg-surface-2` #f6f7f9 | 13.69 | 4.5 | pass |
| light | body and label text | `text` #1f2937 | `bg-surface-3` #eceff3 | 12.73 | 4.5 | pass |
| light | body and label text | `text-muted` #4b5563 | `bg-body` #e3e7ed | 6.09 | 4.5 | pass |
| light | body and label text | `text-muted` #4b5563 | `bg-surface` #ffffff | 7.56 | 4.5 | pass |
| light | body and label text | `text-muted` #4b5563 | `bg-surface-2` #f6f7f9 | 7.05 | 4.5 | pass |
| light | body and label text | `text-muted` #4b5563 | `bg-surface-3` #eceff3 | 6.55 | 4.5 | pass |
| light | captions, meta, placeholders | `text-subtle` #56606e | `bg-body` #e3e7ed | 5.14 | 4.5 | pass |
| light | captions, meta, placeholders | `text-subtle` #56606e | `bg-surface` #ffffff | 6.38 | 4.5 | pass |
| light | captions, meta, placeholders | `text-subtle` #56606e | `bg-surface-2` #f6f7f9 | 5.95 | 4.5 | pass |
| light | input placeholder | `text-placeholder` #56606e | `bg-surface` #ffffff | 6.38 | 4.5 | pass |
| light | input placeholder | `text-placeholder` #56606e | `bg-surface-2` #f6f7f9 | 5.95 | 4.5 | pass |
| light | links (underlined) | `link` #111827 | `bg-body` #e3e7ed | 14.29 | 4.5 | pass |
| light | links (underlined) | `link` #111827 | `bg-surface` #ffffff | 17.74 | 4.5 | pass |
| light | primary button | `text` #1f2937 | `overlay-20 over bg-surface-2` #c8cacf | 8.95 | 4.5 | pass |
| light | primary button on panel | `text` #1f2937 | `overlay-20 over bg-surface` #cfd1d4 | 9.59 | 4.5 | pass |
| light | primary button hover | `text` #1f2937 | `overlay-30 over bg-surface-2` #b1b4ba | 7.06 | 4.5 | pass |
| light | secondary button | `btn-secondary-fg` #4b5563 | `overlay-10 over bg-surface-2` #dfe1e4 | 5.77 | 4.5 | pass |
| light | secondary button on panel | `btn-secondary-fg` #4b5563 | `overlay-10 over bg-surface` #e7e8e9 | 6.16 | 4.5 | pass |
| light | menu item hover | `text` #1f2937 | `overlay-10 over bg-surface-3` #d6dadf | 10.45 | 4.5 | pass |
| light | ghost button hover on panel | `text-muted` #4b5563 | `overlay-10 over bg-surface` #e7e8e9 | 6.16 | 4.5 | pass |
| light | destructive text and menu item | `danger-fg` #b91c1c | `bg-surface` #ffffff | 6.47 | 4.5 | pass |
| light | destructive text and menu item | `danger-fg` #b91c1c | `bg-surface-2` #f6f7f9 | 6.04 | 4.5 | pass |
| light | destructive text and menu item | `danger-fg` #b91c1c | `bg-surface-3` #eceff3 | 5.61 | 4.5 | pass |
| light | destructive button | `danger-fg` #b91c1c | `danger-10 over bg-surface-2` #f5e5e7 | 5.31 | 4.5 | pass |
| light | error alert | `danger-text` #991b1b | `danger-10 over bg-surface` #fdecec | 7.28 | 4.5 | pass |
| light | warning alert | `warning-text` #92400e | `warning-10 over bg-surface` #fef5e7 | 6.56 | 4.5 | pass |
| light | success alert | `success-text` #047857 | `success-10 over bg-surface` #ebfbf5 | 5.13 | 4.5 | pass |
| light | info text | `info-text` #4338ca | `bg-surface` #ffffff | 7.90 | 4.5 | pass |
| light | Ship chip | `ship-fg` #065f46 | `ship-bg over bg-surface` #e6f2ee | 6.70 | 4.5 | pass |
| light | Explore chip | `explore-fg` #9a3412 | `explore-bg over bg-surface` #f5ebe7 | 6.24 | 4.5 | pass |
| light | Ship chip | `ship-fg` #065f46 | `ship-bg over bg-surface-2` #deeae9 | 6.24 | 4.5 | pass |
| light | Explore chip | `explore-fg` #9a3412 | `explore-bg over bg-surface-2` #ede4e2 | 5.84 | 4.5 | pass |
| light | identity label text | `accent-1` #047857 | `bg-surface-2` #f6f7f9 | 5.12 | 4.5 | pass |
| light | identity label text | `accent-2` #6d28d9 | `bg-surface-2` #f6f7f9 | 6.63 | 4.5 | pass |
| light | identity label text | `accent-3` #0369a1 | `bg-surface-2` #f6f7f9 | 5.54 | 4.5 | pass |
| light | identity label text | `accent-4` #9a3412 | `bg-surface-2` #f6f7f9 | 6.82 | 4.5 | pass |
| light | identity label text | `accent-5` #be123c | `bg-surface-2` #f6f7f9 | 5.86 | 4.5 | pass |
| light | identity label text | `accent-6` #3f6212 | `bg-surface-2` #f6f7f9 | 6.60 | 4.5 | pass |
| light | identity label text | `accent-7` #713f12 | `bg-surface-2` #f6f7f9 | 8.09 | 4.5 | pass |
| light | identity label text | `accent-8` #0e7490 | `bg-surface-2` #f6f7f9 | 5.00 | 4.5 | pass |
| light | identity label text | `accent-9` #a21caf | `bg-surface-2` #f6f7f9 | 5.90 | 4.5 | pass |
| light | identity label text | `accent-10` #b91c1c | `bg-surface-2` #f6f7f9 | 6.04 | 4.5 | pass |
| light | tooltip | `text-bright` #111827 | `bg-body` #e3e7ed | 14.29 | 4.5 | pass |
| light | toast title, dialog title | `text-bright` #111827 | `bg-surface` #ffffff | 17.74 | 4.5 | pass |
| light | keycap label | `kbd-text` #4b5563 | `kbd-face-top` #ffffff | 7.56 | 4.5 | pass |
| light | keycap label | `kbd-text` #4b5563 | `kbd-face-bottom` #e5e7eb | 6.10 | 4.5 | pass |
| light | note text | `note-ink` #1f2126 | `note-yellow` #fff8b8 | 14.86 | 4.5 | pass |
| light | empty note hint | `note-ink-subtle over note-yellow` #5e5d4f | `note-yellow` #fff8b8 | 6.14 | 4.5 | pass |
| light | note text | `note-ink` #1f2126 | `note-green` #d3f39b | 13.09 | 4.5 | pass |
| light | empty note hint | `note-ink-subtle over note-green` #515c47 | `note-green` #d3f39b | 5.74 | 4.5 | pass |
| light | note text | `note-ink` #1f2126 | `note-blue` #aed4fb | 10.44 | 4.5 | pass |
| light | empty note hint | `note-ink-subtle over note-blue` #475362 | `note-blue` #aed4fb | 5.08 | 4.5 | pass |
| light | note text | `note-ink` #1f2126 | `note-pink` #ffcfe1 | 11.71 | 4.5 | pass |
| light | empty note hint | `note-ink-subtle over note-pink` #5e525a | `note-pink` #ffcfe1 | 5.39 | 4.5 | pass |
| light | note text | `note-ink` #1f2126 | `note-gray` #dfe3ea | 12.51 | 4.5 | pass |
| light | empty note hint | `note-ink-subtle over note-gray` #55575d | `note-gray` #dfe3ea | 5.61 | 4.5 | pass |
| light | badge on selection | `canvas-node-badge-text` #08110a | `canvas-selection-ring-color` #39ff14 | 14.15 | 4.5 | pass |
| light | input and control boundary | `border-control over bg-body` #767b86 | `bg-body` #e3e7ed | 3.42 | 3 | pass |
| light | input and control boundary | `border-control over bg-surface` #83878f | `bg-surface` #ffffff | 3.60 | 3 | pass |
| light | input and control boundary | `border-control over bg-surface-2` #7f838c | `bg-surface-2` #f6f7f9 | 3.54 | 3 | pass |
| light | input and control boundary | `border-control over bg-surface-3` #7a7f89 | `bg-surface-3` #eceff3 | 3.49 | 3 | pass |
| light | focus ring | `focus-ring-color` #111827 | `bg-body` #e3e7ed | 14.29 | 3 | pass |
| light | focus ring | `focus-ring-color` #111827 | `bg-surface` #ffffff | 17.74 | 3 | pass |
| light | focus ring | `focus-ring-color` #111827 | `bg-surface-2` #f6f7f9 | 16.55 | 3 | pass |
| light | focus ring | `focus-ring-color` #111827 | `bg-surface-3` #eceff3 | 15.38 | 3 | pass |
| light | focus ring against its halo | `focus-ring-color` #111827 | `focus-halo-color` #ffffff | 17.74 | 3 | pass |
| light | ghost icon on toolbar | `text-muted` #4b5563 | `bg-surface-2` #f6f7f9 | 7.05 | 3 | pass |
| light | toast error icon | `danger-light` #dc2626 | `bg-surface` #ffffff | 4.83 | 3 | pass |
| light | toast warning icon | `warning` #b45309 | `bg-surface` #ffffff | 5.02 | 3 | pass |
| light | toast success icon | `success` #047857 | `bg-surface` #ffffff | 5.48 | 3 | pass |
| light | selection outline (halo) | `canvas-selection-halo` #08110a | `canvas-bg` #f6f7f9 | 17.89 | 3 | pass |
| light | hover ring | `canvas-hover-ring-color` #c0009c | `canvas-bg` #f6f7f9 | 5.26 | 3 | pass |
| light | snap guide | `canvas-snap-guide-color` #0077a3 | `canvas-bg` #f6f7f9 | 4.70 | 3 | pass |
| light | marquee edge | `canvas-marquee-border` #08110a | `canvas-bg` #f6f7f9 | 17.89 | 3 | pass |
| light | note selection ring | `annotation-selection-ring` #111827 | `canvas-bg` #f6f7f9 | 16.55 | 3 | pass |
| light | resize handle (ink edge) | `canvas-resize-handle-border` #08110a | `canvas-bg` #f6f7f9 | 17.89 | 3 | pass |

Reported, not adjusted (they need a non-color cue instead, see 9.6):

| Theme | Pair | Ratio |
|---|---|---|
| dark | pressed fill (overlay-20) vs hover fill (overlay-10) on surface-2 | 1.39 |
| dark | pressed fill vs rest surface-2 | 1.92 |
| light | pressed fill vs hover fill on surface-2 | 1.25 |
| light | pressed fill vs rest surface-2 | 1.53 |
| both | disabled text (exempt under SC 1.4.3) | 1.91 / 2.37 |

Chips that sit on images (source chip, Ship and Explore) must paint their tint over an opaque base:
`background: linear-gradient(var(--st-ship-bg), var(--st-ship-bg)), var(--st-bg-surface)`. The ratios
above assume that base.

### 9.5 Hover content (SC 1.4.13)

Studio tooltips use `pointer-events: none`, so the pointer cannot move onto them. Banana tooltips must
stay open while the pointer is over the bubble (allow pointer events, close on leave with a 100ms
grace), keep Escape to dismiss, and only hold supplementary text (the control already has its name).
Hover-revealed chrome (note toolbar, node menu button) must also appear on `:focus-within` and when
selected, as Studio's note chrome does.

### 9.6 State not by color alone (SC 1.4.1)

- Pressed toggles and selected segments: keep Studio's overlay fill, and add `aria-pressed` plus a
  second cue (a check icon, weight 600, or a 2px inner bar like the rail's active indicator).
- Selected canvas items: the 2px outline is a shape cue, plus `aria-selected` and "selected" in the
  accessible name. Active versus selected must differ in shape (header tone versus outline).
- Ship and Explore keep icon plus word. Swatch contrast badges keep icon plus word ("AA", "UI only",
  "Fails").
- Save status keeps the words, the dot is extra.

### 9.7 Zoom, reflow, motion

- Studio blocks native browser zoom inside the editor (`AdminZoomGuard`) and sets `overflow: hidden`
  and `touch-action: pan-x pan-y` on `html, body`. **Banana must not**: capture Ctrl+wheel and pinch
  only on the canvas pane, never `preventDefault` on keyboard Ctrl/Cmd and +, -, 0, and keep the
  public site free to zoom and reflow (SC 1.4.4, 1.4.10).
- Every drag needs a keyboard or single-pointer alternative (SC 2.5.7); see the plan for the list.

---

## 10. Mapping to Banana

Banana surfaces and files are as of 2026-10-11 (`banana-server/canvas/**`, `banana-server/app/(site)/**`).

| Banana surface | Studio pattern | How to apply |
|---|---|---|
| **Canvas shell** (`canvas/CanvasApp.tsx`, `.bn-canvas`) | AdminCanvasLayout shell | `--st-bg-body` shell; canvas `<main>` on `--st-canvas-bg` with `border-start-start-radius: var(--st-canvas-corner)`. Drop the dot `Background` (Studio's board is plain), or keep it at `--st-canvas-dot` if the owner wants a moodboard cue. Default theme follows the system through the tokens; dark when there is no preference. |
| **Tray** (`canvas/Tray.tsx`) | Left sidebar: 42px rail plus 320px panel; tile cards | A rail with one "Search results" item (accent-3, count badge); the panel on `--st-bg-body`, 320px default, resizable 260 to 520px with a keyboard splitter (`role="separator"`, arrows change width by 16px). Header as a Section title (text-s 600) plus caption. Tiles: tile cards on a `--st-bg-surface` parent with a 1px gap, radius 16px, hover lift 2px plus `--st-shadow-card-hover`, press returns. Empty state: centered EmptyState, "No results yet." plus the next move. |
| **Toolbar** (`canvas/Toolbar.tsx`) | 36px top bar plus notch | Top bar on `--st-bg-body`: title (text-xs 700) and "on {APP_NAME}" (subtle), save status chip (dot plus words), zoom group (ghost icon buttons and a percentage button that opens a zoom menu), share, upload, "?" help. Add note, Add section, Arrange move to a notch at the top center of the canvas; Arrange becomes a menu button. All icon buttons 28px, Tooltip plus `aria-label`, `aria-keyshortcuts` where bound. |
| **Node menu** (`canvas/nodes/NodeMenu.tsx`) | ContextMenu | Fixed, portaled, `--st-bg-surface-3`, radius 16px, padding 3xs, `--st-shadow-menu`, items 28px (Banana 32px is fine), radius 12px, weight 560, 16px icon slot, danger item in `--st-danger-fg`, separators surface-2. Enter and exit animations. Keep Banana's keyboard roving. Also open it at the pointer on right click (`onNodeContextMenu`). The "…" trigger is a 24px ghost icon button, shown on hover, focus-within and selection. |
| **Image and upload nodes** (`canvas/nodes/ImageNode.tsx`) | Board frame | Radius `--st-radius`, `--st-shadow-panel-drop`, no border. Hover: inset 1px hover ring. Selected: 2px outline in `--st-canvas-selection-ring-color`, offset 2px, plus `--st-canvas-selection-halo` 1px outside in light. Note strip: surface-2, text-s. Upload adds an upload glyph in its chip ("Your upload"). |
| **Note node** (`canvas/nodes/NoteNode.tsx`) | Sticky note | Fixed paper colors in both themes (`--st-note-*`), radius 3px, `--st-note-shadow`, `--st-note-ink`. Hover chrome pill above with five 24px swatches. Selected: `--st-annotation-selection-ring`. Empty hint in `--st-note-ink-subtle`. |
| **Swatch node** (`canvas/nodes/SwatchNode.tsx`) | Frame plus tile title row | Frame chrome; color block on top; role in text-s 600; hex and OKLCH in mono text-xs subtle; contrast rows with a small "Aa" keycap-sized sample and a state chip (success or danger tokens, icon plus word). |
| **Type sample node** (`canvas/nodes/TypeSampleNode.tsx`) | Frame plus widget title | Frame chrome; pairing name as an uppercase 11px caption (tracking caps, subtle); sample text uses the pairing's own fonts (user content, not tokens). |
| **Section node** (`canvas/nodes/SectionNode.tsx`) | Frame header bar plus multi-select box | Header bar like a frame header (`--st-bg-surface-2`, 32px dense row: chevron, title text-s 600, count subtle, menu). Body: `--st-overlay-5` fill with a 1px dashed `--st-border-control` edge (3:1), radius 6px. Identity dot in accent-2. |
| **Link card** (`canvas/nodes/chips.tsx` `LinkCard`) | CanvasModulePlaceholder | Diagonal stripes (`--st-canvas-placeholder-bg`), centered: image-off glyph, title text-s 600, site text-xs subtle, an underlined "View on {site}" link, caption "The image could not load here." |
| **Source chip** (`SourceChip`) | TagPill / chip | 24px tall pill, opaque `--st-bg-surface` base, text-xs 600 `--st-text`, 12px external glyph, ellipsis, underline on hover, `--st-focus-ring-halo` on focus. Replace `title=` with Tooltip showing the URL. |
| **Ship / Explore chip** (`TagChip`) | TagPill with accent identity | Ship: `--st-ship-fg` on `--st-ship-bg`; Explore: `--st-explore-fg` on `--st-explore-bg`; opaque base over images; 24px pill; icon plus word. |
| **Share dialog** (current wave, expected under `canvas/`) | Dialog md plus ShareDialog rows | Dialog 440px, title "Share canvas", intro text-s muted saying exactly who can see what ("Anyone with this link can view this canvas. They cannot change it."). Link rows on surface-2, radius 3px, URL in mono text-xs with ellipsis, "Copy link" secondary sm, "Turn off link" ghost danger. Revoked links in a collapsed `details`. Copy result goes to a `role="status"` toast "Link copied". |
| **Upload button** (current wave) | Button secondary plus FileUpload plus CanvasFileDropHint | Secondary sm button with upload glyph, label "Upload image"; loading spinner and "Uploading…". Drop on the canvas shows a centered caption "Drop to add to the canvas" and a 2px dashed `--st-canvas-selection-ring-color` (halo in light) inset outline. Failures go to an error toast. The button is the keyboard alternative to drag and drop. |
| **Site header and footer** (`app/(site)/[locale]/layout.tsx`, `_components/SiteNav.tsx`) | Top bar language plus Tabs underline | Header on `--st-bg-body` with a 1px `--st-border` bottom rule; brand text-xl 700 with a 7px `--st-brand` dot; nav links as 44px ghost items, current page with a 2px underline (Tabs active). Language switch as a secondary sm button-link. Footer text-s subtle on `--st-bg-body`, links underlined. Not sticky (SC 2.4.11). |
| **Landing** (`app/(site)/[locale]/page.tsx`) | Tile cards, KPI type, Code | Hero h1 at text-7xl 600 `--st-text-bright`, lead text-xl muted. CTAs: primary lg ("Install") and secondary lg. Steps as tile cards (surface-2 tiles on a surface parent, 1px gap, radius 16px, title row with accent dot and "Step 1" caps label). Code blocks mono on `--st-bg-surface-3`, radius 12px. Video slot uses the stripe placeholder. Founding block: a tile with a TagPill, not a 3px border. |
| **Pricing** (`app/(site)/[locale]/pricing/**`) | Tile cards, KPI, DataTable | Plan tiles; price at text-6xl 600; feature list text-l; the picked plan marked with a TagPill and words, not a thick border. Comparison table: header row surface-2, text-xs caps subtle; hairline rows; cells text-s. Checkout button primary lg with the loading spinner. |
| **Account** (`app/(site)/[locale]/account/**`) | Section, Dialog (danger tone) | Sections as hairline plus title. Delete account: danger-tone Dialog sm (`alertdialog`), eyebrow "Delete account", body states what is deleted and what is kept, buttons "Cancel" (secondary) and "Delete account" (destructive), focus on Cancel. |
| **Takedown form** (`app/(site)/[locale]/takedown/**`) | Input, FormField, Alert | Inputs at 44px on the site (pill, `--st-border-control`), label text-s 600 above, hint text-s subtle; field errors inline with `role="alert"`; error summary as a danger Alert (`--st-danger-10` tint, `--st-danger-text`, icon); success as a success Alert. Radio choices 24px. |
| **Legal pages** (`app/(site)/[locale]/terms`, `privacy`, `_components/LegalDocument.tsx`) | Reading column, Section, Alert | Body text-xl at 68ch, line height 1.6 (1.8 Arabic), headings text-3xl and 2xl 600; table of contents as a Section list; the draft banner as a warning Alert. Tables use the DataTable style. |
| **Inline MCP Apps canvas** (`ui/canvas/**`, same `canvas/` code) | Same shell, compact | Follow the host theme (set `data-theme` from the MCP Apps host context). Self-contained fonts (bundled woff2) because the host CSP may block font CDNs; fall back to `system-ui`. Under 720px wide: rail collapsed, panel closed, top bar shows title, save status, zoom and "Open on the web". Toasts inside the frame, bottom inline-end, 16px inset. |

---

## 11. Gaps between Banana's React Flow setup and Studio's behavior

Banana's `ReactFlow` (in `canvas/CanvasApp.tsx`) uses React Flow defaults: left drag pans, wheel zooms,
no marquee without Shift, zoom 0.1 to 2. Studio wheel-pans and drag-selects. Props and handlers
needed (React Flow 12.12):

| Studio behavior | React Flow setting |
|---|---|
| Wheel pans, Shift+wheel horizontal | `panOnScroll`, `panOnScrollMode={PanOnScrollMode.Free}`, `zoomOnScroll={false}` |
| Ctrl/Cmd+wheel and pinch zoom | `zoomActivationKeyCode={["Meta", "Control"]}`, `zoomOnPinch` (default) |
| Left drag on empty canvas draws a marquee | `selectionOnDrag`, `panOnDrag={[1]}` |
| Marquee selects what it touches | `selectionMode={SelectionMode.Partial}` |
| Space + drag pans | `panActivationKeyCode="Space"` (default; keep) |
| Shift or Cmd/Ctrl click adds | `multiSelectionKeyCode={["Meta", "Control", "Shift"]}` |
| 3px before a drag or marquee starts | `nodeDragThreshold={3}`, `paneClickDistance={3}` |
| 10% to 400% | `minZoom={0.1}`, `maxZoom={4}` |
| Double click does not zoom | `zoomOnDoubleClick={false}` |
| H hand tool | state `handTool`: `panOnDrag={handTool ? [0, 1] : [1]}`, `selectionOnDrag={!handTool}`, `elementsSelectable={!handTool}`, grab cursor class |
| + / - step ladder, Cmd/Ctrl+0, Shift+1, Shift+2 | a pane `onKeyDown`: `zoomTo(nextStep, { duration: 220 })`, `zoomTo(1)`, `fitView({ padding: "64px", duration: 220 })`, `fitView({ nodes: selected, padding: "64px" })` |
| Snap to peer edges and centers, with guides | `onNodeDrag` computes a snap like Studio's `computeSnap` (8 units), writes the snapped position, and a `ViewportPortal` draws guides in `--st-canvas-snap-guide-color`; clear on `onNodeDragStop` |
| Alt+drag duplicates | `onNodeDragStart` with `altKey`: insert a copy at the start position and let the original move |
| Escape deselects, Cmd/Ctrl+A selects all, Cmd/Ctrl+D duplicates | pane and node `onKeyDown` handlers |
| Right click opens the node menu | `onNodeContextMenu` sets `menuFor` with the pointer position |
| Selection outline, hover ring, handles | CSS on `.react-flow__node.selected`, `:hover`, `.react-flow__resize-control` with the tokens |

---

## 12. Conflicts with Banana hard rules, and how to resolve them

| # | Conflict | Rule | Resolution (faithful to Studio) |
|---|---|---|---|
| 1 | Focus ring is 1px at overlay-20 (1.5 to 1.9:1) | SC 2.4.7, 1.4.11 | 2px solid achromatic ring, halo over images (`--st-focus-ring`, `--st-focus-ring-halo`) |
| 2 | micro 18px and xs 22px buttons, 9px handles, 7px edges | SC 2.5.8 | Drop micro; xs 24px, sm 28px; handles keep the look with 24px hit areas |
| 3 | text-subtle, placeholders, kbd labels, danger text, note hints, secondary buttons under 4.5:1 | SC 1.4.3 | Adjusted tokens, listed in 9.4 |
| 4 | Input outline at overlay-20 | SC 1.4.11 | `--st-border-control` |
| 5 | Neon rings, guides and white handles fail on the light canvas | SC 1.4.11 | Ink halo and darker light variants; dark keeps Studio's neon |
| 6 | Pressed and selected shown by a 1.3 to 1.9:1 fill change | SC 1.4.1, 1.4.11 | Keep the fill, add a check, weight or 2px bar, and `aria-pressed` |
| 7 | Tooltips not hoverable | SC 1.4.13 | Pointer events on, close on leave with grace, Escape kept |
| 8 | Hover-only chrome | SC 2.1.1, 2.5.7 | Also on focus-within and selection; every action also in the node menu and on keys |
| 9 | Drag-only gestures: marquee, Alt+drag, resize, pan, snap, tray drag, file drop | SC 2.5.7 | Keyboard and menu routes: Shift+arrow or Cmd/Ctrl+A selection, Cmd/Ctrl+D, +/- and "Make bigger/smaller" on a node, arrow keys pan when the pane has focus, Enter on tray tiles, Upload button |
| 10 | Studio blocks browser zoom | SC 1.4.4, 1.4.10 | Canvas captures gestures only inside the pane; never blocks keyboard page zoom |
| 11 | Studio copy uses em dashes | Banana copy rule | Commas, colons, periods, parentheses |
| 12 | Studio chrome uses physical properties (about 250 left/right vs 53 logical) | RTL Arabic | Logical properties everywhere (`inset-inline-*`, `margin-inline-*`, `border-start-start-radius`); rail and tray on the inline-start side; toasts at inline-end; directional glyphs (chevrons, arrows) mirrored with `:dir(rtl)`; the canvas coordinate space does not mirror, and arrow keys move in screen directions |
| 13 | 9 to 11px chrome text | Readability, Arabic | Floor readable text at `--st-text-s` in canvas chrome and 16px on the site; under `:lang(ar)` use one step up for chrome text |
| 14 | Nudge is 1px and 10px in Studio | Banana spec 8px and 32px | Keep the spec |
| 15 | `+`/`-` zoom in Studio, resize a focused node in Banana | Spec keyboard alternative | `+`/`-` zoom when the pane has focus, resize when a node has focus; both listed in the shortcut sheet |
| 16 | Toasts auto-dismiss in 4 to 8s | SC 2.2.1, 2.4.11 | Error toasts stay until closed; the save chip keeps the lasting state; the toast stack never covers the focused item (move it, or pan the item clear) |
| 17 | Notch floats over the canvas | SC 2.4.11 | When a focused node's rect meets the notch rect, pan it clear by the overlap plus 8px (and keep `autoPanOnNodeFocus`) |
| 18 | Studio has no colored call to action; Banana's site uses a yellow button | Studio principle 1 | Achromatic primary buttons; Banana yellow (`--st-brand`) only as the brand mark. **Owner decision** if the yellow CTA should stay |
| 19 | Icon set licence unknown | Open licence rule | Confirm pixel-art-icons licence; else Pixelarticons (MIT) |
