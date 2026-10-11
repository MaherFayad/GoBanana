# Restyle plan: Banana in the Studio design language

Spec: `docs/design-language.md`. Tokens: `banana-server/styles/studio-tokens.css` (written, not yet
imported anywhere). This plan is file by file, in order, and split so three agents can work at once
after the current wave lands. File paths are relative to `banana-server/`.

Files read for this plan (as of 2026-10-11): `canvas/*.tsx`, `canvas/nodes/*.tsx`, `canvas/canvas.css`,
`canvas/ShareButton.tsx`, `canvas/UploadButton.tsx`, `canvas/SharedCanvas.tsx`, `ui/canvas/*`,
`app/layout.tsx`, `app/(site)/**`, `app/c/[id]/page.tsx`. The current wave is still editing several of
them; each work package starts by re-reading its files.

---

## Order at a glance

1. **Step 0, foundation** (one agent or the lead, about half a day). Blocks the three packages.
2. **WP-A canvas shell and nodes**, **WP-B public site**, **WP-C overlays, shared and inline canvas**:
   in parallel, disjoint files.
3. **Step 4, gates and QA** (one agent, after A, B and C merge).

Owner decisions to take before Step 0 (defaults in brackets):

- Keep Banana's yellow call-to-action button, or go achromatic like Studio? [achromatic; yellow only as the brand dot]
- Licence of Studio's `pixel-art-icons`: confirm it can ship in Banana. [if unclear, use Pixelarticons, MIT]
- Plain board like Studio, or keep the dot grid? [plain]

---

## Step 0: foundation (blocks A, B, C)

Owns these files only. Nothing here changes how a page looks yet, except fonts.

| File | Change |
|---|---|
| `package.json` | Add `@fontsource-variable/inter` and `@fontsource/ibm-plex-sans-arabic` (both SIL OFL 1.1). |
| `styles/studio-tokens.css` | Already written. Only touch to fix a value; rerun the contrast test. |
| `styles/fonts.css` (new) | `@font-face` for "Inter Variable" (latin, weights 100 to 900) and "IBM Plex Sans Arabic" (400, 500, 600, 700, arabic subset), `font-display: swap`, files from the two packages so the inline single-file build inlines them. |
| `styles/studio-components.css` (new) | The shared primitive classes, exactly as spec section 4, on tokens only: `.st-btn` with `data-variant="ghost|secondary|primary|destructive"`, `data-size="xs|sm|md|lg"`, `data-icon-only`, `data-tone="danger"`, `[aria-pressed="true"]` (fill plus a 2px inner bar), `[data-loading]` spinner; `.st-input`; `.st-menu`, `.st-menu-item`, `.st-menu-sep`; `.st-tooltip`; `.st-dialog` (backdrop, panel, header, eyebrow, title, body, footer, sizes); `.st-toast` stack and kinds; `.st-kbd`; `.st-chip` with `data-tone="ship|explore|success|danger|neutral"` (opaque base layer); `.st-tile-grid`, `.st-tile`, `.st-tile-title` (7px accent dot); `.st-section`; `.st-alert` with tones; `.st-skeleton`; `.st-empty`; `.st-visually-hidden`. Logical properties only. Focus uses `--st-focus-ring`. Durations use the tokens so reduced motion is covered. |
| `components/studio/Tooltip.tsx` (new) | Portal tooltip: hover and focus, hoverable bubble (pointer can rest on it, 100ms close grace), Escape closes, `role="tooltip"`, `aria-describedby`. Replaces every `title=`. |
| `components/studio/Dialog.tsx` (new) | Wraps native `<dialog>` with `showModal()` (focus trap, Escape, focus return), props `title`, `eyebrow`, `tone`, `size`, `footer`; `role="alertdialog"` for danger tone. |
| `components/studio/Toast.tsx`, `toastBus.ts` (new) | `pushToast({ kind, title, body, dedupeKey })`, de-duplicate by default with a "×N" count, `role="alert"` for error and warning, `status` otherwise; success and info 4s, warning 6s, **error stays until closed**; pause on hover and on focus-within; stack at `inset-block-end` and `inset-inline-end` 16px. |
| `components/studio/Kbd.tsx` (new) | `Kbd` and `ShortcutKeys` ("Ctrl+Shift+P" to caps), platform aware (⌘ on Mac). |
| `components/studio/icons/*.tsx` (new) | The pixel icon set Banana needs (24 grid, filled, 2px pixel steps): external, check, compass, close, more, chevron, plus, minus, fit, panel, note, frame, image-off, warning, upload, share, link, hand, help, search. `aria-hidden`, `focusable="false"`, `size` prop (12, 16, 24), `currentColor`. Directional ones carry a `data-mirror` attribute that flips under `:dir(rtl)`. |
| `app/layout.tsx` | Import `styles/fonts.css`, `styles/studio-tokens.css`, `styles/studio-components.css`. No other change (html `lang` and `dir` already right). |
| `tests/design-tokens.test.ts` (new) | Port the contrast check: parse `styles/studio-tokens.css`, composite translucent fills, assert every pair in spec 9.4 meets its minimum and that the light attribute block equals the light media block. Live from day one. |

Done when: the app builds, the token test passes, fonts load on `/en` and `/ar`, and no page looks
different except the font.

---

## WP-A: canvas shell and nodes

**Owns**: `canvas/CanvasApp.tsx`, `canvas/Toolbar.tsx`, `canvas/Tray.tsx`, `canvas/canvas.css`,
`canvas/nodes/*` (all), `canvas/icons.tsx`, `canvas/keyboard.ts`, `canvas/geometry.ts`, `canvas/labels.ts`,
`canvas/context.tsx`, and new files `canvas/viewport.ts`, `canvas/snapping.ts`, `canvas/SnapGuides.tsx`,
`canvas/Notch.tsx`, `canvas/ZoomMenu.tsx`, `canvas/shortcuts.ts`, `canvas/ShortcutSheet.tsx`, plus tests
`tests/canvas-viewport.test.ts`, `tests/canvas-snapping.test.ts`, and edits to `tests/canvas-keyboard.test.ts`
and `e2e/canvas.spec.ts`.
**Does not touch**: `ShareButton.tsx`, `UploadButton.tsx`, `SharedCanvas.tsx`, `WebCanvas.tsx`, `ui/canvas/**` (WP-C).
It places WP-C's buttons in the toolbar slots it already has.

Order inside the package:

1. **`canvas/canvas.css`, palette swap first.**
   - Delete the three `--bn-*` color blocks (base, `prefers-color-scheme: dark`, `[data-theme="dark"]`,
     lines 11 to 94 today). Replace with one alias block on `.bn-canvas` that maps each old name to a
     token (`--bn-bg: var(--st-canvas-bg)`, `--bn-surface: var(--st-bg-surface)`, `--bn-text: var(--st-text)`,
     `--bn-text-muted: var(--st-text-muted)`, `--bn-border: var(--st-border-control)`,
     `--bn-border-subtle: var(--st-border-muted)`, `--bn-focus: var(--st-focus-ring-color)`,
     `--bn-accent: var(--st-canvas-selection-ring-color)`, `--bn-ship-*: var(--st-ship-*)`,
     `--bn-explore-*: var(--st-explore-*)`, `--bn-danger: var(--st-danger-fg)`, notes to `--st-note-*`).
     Theme now comes from the tokens; `data-theme` on `.bn-canvas` keeps working because the token
     file matches `[data-theme]` on any element. Then remove the aliases rule by rule as each block
     below is rewritten.
   - Root: `background: var(--st-bg-body)`, `font: var(--st-weight-regular) var(--st-text-s)/var(--st-leading-snug) var(--st-font-sans)`.
   - Focus: replace the 3px outline rules with `box-shadow: var(--st-focus-ring)`; nodes use
     `--st-focus-ring-halo`. Keep `outline: 2px solid transparent` for forced-colors mode.
   - Buttons: `.bn-btn` follows `.st-btn` (or switch markup to `.st-btn`): sm 28px pill, ghost for
     toolbar icons, secondary for text actions, primary only for the main action.
   - Toolbar: 36px, `--st-bg-body`, no bottom border, padding `0 var(--st-space-s)`, gap `var(--st-space-4xs)`.
   - `.bn-body`: the canvas `main` gets `background: var(--st-canvas-bg)` and
     `border-start-start-radius: var(--st-canvas-corner)`; `overflow: clip`.
   - Nodes: `.bn-node` radius `--st-radius`, no border, `box-shadow: var(--st-shadow-panel-drop)`.
     Selected: `outline: var(--st-canvas-selection-width) solid var(--st-canvas-selection-ring-color)`,
     `outline-offset: var(--st-canvas-selection-offset)`, plus `box-shadow: 0 0 0 calc(var(--st-canvas-selection-offset) + var(--st-canvas-selection-width) + 1px) var(--st-canvas-selection-halo)`.
     Hover: `box-shadow: inset 0 0 0 1px var(--st-canvas-hover-ring-color)`.
   - Notes: fixed paper (`--st-note-*`), radius `--st-radius-sm`, `--st-note-shadow`, ink text; selected
     ring `--st-annotation-selection-ring`.
   - Section: header like a frame header (surface-2, 32px), body `--st-overlay-5`, 1px dashed `--st-border-control`.
   - Chips: 24px pills, opaque base, tones per spec 10.
   - Menu: `.bn-menu` becomes `position: fixed` (portal) with `.st-menu` look; enter and exit animation.
   - Resize: handles 9px, `--st-canvas-resize-handle-fill` and `-border`, radius 2px, keep the 24px
     `::after` hit area; edge lines get a 24px invisible hit strip.
   - Drop target: replace the 3px dashed accent outline with a 2px dashed selection color (halo in
     light), inset 8px, and a centered caption.
   - Reduced motion: remove the `!important` block; durations come from tokens.
   - Physical properties to logical: `left/right` in `.bn-node-bar`, `.bn-menu`, `.bn-help-panel`,
     `.bn-tray` `border-right` to `border-inline-end`, `text-align: left` to `start`.
2. **`canvas/icons.tsx`**: re-export from `components/studio/icons` (or delete and update imports in
   this package). Toolbar 16px, chips 12px.
3. **`canvas/viewport.ts`** (new): `ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]`,
   `nextZoomStep(current, dir)`, `MIN_ZOOM 0.1`, `MAX_ZOOM 4`, `FIT_PADDING = "64px"`,
   `ZOOM_DURATION = 220`. Pure, unit tested.
4. **`canvas/snapping.ts`** (new): port of Studio's `computeSnap` and `collectPeerRects`
   (`fk2:src/admin/pages/site/canvas/boardSnapping.ts`): per axis, closest edge or center within 8
   board units; returns snapped position and guides. Pure, unit tested. Uses `absoluteRect` from
   `geometry.ts` so items in sections snap in board space.
5. **`canvas/CanvasApp.tsx`**, React Flow props (spec section 11):
   - `panOnScroll`, `panOnScrollMode={PanOnScrollMode.Free}`, `zoomOnScroll={false}`,
     `zoomActivationKeyCode={["Meta", "Control"]}`, `selectionOnDrag={!handTool}`,
     `panOnDrag={handTool ? [0, 1] : [1]}`, `selectionMode={SelectionMode.Partial}`,
     `multiSelectionKeyCode={["Meta", "Control", "Shift"]}`, `nodeDragThreshold={3}`,
     `paneClickDistance={3}`, `minZoom={0.1}`, `maxZoom={4}`, `zoomOnDoubleClick={false}`.
     Keep `panActivationKeyCode` default ("Space"), `nodesFocusable`, `autoPanOnNodeFocus`, `deleteKeyCode={null}`.
   - Remove `<Background>` (plain board) unless the owner keeps dots, then `color="var(--st-canvas-dot)"`.
   - Pane keyboard (on the `main`, when the target is the pane or the flow wrapper, not a node or
     field): `+`/`=` and `-` zoom one step around the center; `Mod+0` zoom to 100%; `Shift+1`
     `fitView({ padding: FIT_PADDING, duration })`; `Shift+2` fit selected nodes; arrow keys pan the
     viewport 40px (Shift 160px) as the keyboard alternative to drag-panning; `H` toggles the hand
     tool; `Escape` clears selection (then closes menus first if open); `Mod+A` selects all;
     `?` opens the shortcut sheet. Never `preventDefault` Ctrl/Cmd with `+`, `-`, `0` outside the
     pane, so browser zoom keeps working.
   - Node keyboard (existing `onKeyDownCapture`): keep 8px and 32px nudges and `+`/`-` resize (spec
     rule); add `Mod+D` duplicate (offset 16px, select the copy, announce), keep `M`, `F2`, `Delete`.
   - `onNodeDragStart` with `altKey`: insert a copy at the original position (Alt+drag duplicate);
     announce "Copy made".
   - `onNodeDrag`: `computeSnap` against peers, set the snapped position, update guides state;
     `onNodeDragStop`: clear guides, then the existing `settleIntoSection`.
   - `onNodeContextMenu`: open the node menu at the pointer (`setMenuFor({ id, x, y })`).
   - `onNodeFocus` (or a focusin handler): if the focused node's rect intersects the notch rect, pan by
     the overlap plus 8px (SC 2.4.11).
   - Zoom buttons call `zoomTo(nextZoomStep(...), { duration: ZOOM_DURATION })` instead of `zoomIn`.
   - Theme: stop forcing; leave `data-theme` undefined unless a prop sets it. Set React Flow
     `colorMode` the same way and map `--xy-*` variables to tokens in `canvas.css` (selection box,
     controls, background).
   - Replace the inline status messages for failures with `pushToast` (keep the `aria-live` region for
     moves and resizes).
6. **`canvas/SnapGuides.tsx`** (new): renders guides inside `<ViewportPortal>` as 1px lines in
   `--st-canvas-snap-guide-color` (divided by zoom so they stay 1px).
7. **`canvas/Notch.tsx`** (new): the floating insert toolbar at the top center of the canvas: Add note,
   Add section, a 1px divider, Arrange (menu button). Spec section 3. `role="toolbar"` with arrow-key
   roving. Reports its rect for the focus-clearance rule.
8. **`canvas/Toolbar.tsx`**: becomes the 36px top bar: title and "on {appName}", save status chip (dot
   plus words, retry button on error), zoom group (ghost icon buttons, a percentage button opening
   `ZoomMenu`), slots for WP-C's Share and Upload buttons, results toggle when the rail is hidden, "?"
   help button. Remove `title=` (use `Tooltip`), add `aria-keyshortcuts`. The `<details>` help panel is
   replaced by `ShortcutSheet`.
9. **`canvas/ZoomMenu.tsx`** (new): Zoom in, Zoom out, Zoom to 100%, Zoom to fit, Zoom to selection, each
   with its `Kbd` hint; `.st-menu` look.
10. **`canvas/shortcuts.ts`** (new) and **`canvas/ShortcutSheet.tsx`** (new): one registry of Banana's
    bindings (`{ id, label, mac, win, aria, scope }`) that both the handlers and the sheet read, like
    Studio's `keybindings.ts`. Sheet is a `Dialog` (md) with grouped rows and `ShortcutKeys`.
11. **`canvas/Tray.tsx`**: a 42px rail (one "Search results" item, accent-3 tint, count badge,
    `aria-pressed`, active bar) and a panel on `--st-bg-body`, 320px default, 260 to 520px, resizable
    by a splitter (`role="separator"`, `aria-orientation="vertical"`, `aria-valuenow/min/max`, arrow keys
    16px, Home and End). Tiles: `.st-tile-grid` and `.st-tile` (radius 16px, hover lift, press return),
    thumbnail 4:3, title text-s two lines, source chip below. Empty state: `.st-empty` centered, "No
    results yet." and "Ask your agent to search for references. Results show up here." Keep Enter to add
    and focus management. On RTL the rail sits at inline-start, which is the right edge.
12. **`canvas/nodes/NodeMenu.tsx`**: portal the list to `document.body` with `position: fixed` at the
    trigger or pointer (keeps working inside React Flow transforms), `.st-menu` classes, 16px icon slot,
    danger item. Keep the keyboard code. Trigger is a 24px ghost icon button, visible on hover,
    `:focus-within` and selected.
13. **`canvas/nodes/ImageNode.tsx`**: frame chrome; chips on an opaque base; note strip; upload glyph
    for `upload`. `NoteEditor` uses `.st-input`.
14. **`canvas/nodes/NoteNode.tsx`**: paper colors; a hover and focus chrome pill above with five 24px
    swatch buttons (`aria-pressed`, color names as labels) as a second route next to the menu.
15. **`canvas/nodes/SectionNode.tsx`**: frame-header bar, dashed body, accent-2 dot; chevron is a 24px ghost icon button.
16. **`canvas/nodes/SwatchNode.tsx`**: tile title row, mono codes, contrast rows with `.st-chip`
    success or danger plus icon and word. Move the inline `style` sample to a CSS custom property
    (`style={{ "--sample-bg": against, "--sample-fg": hex }}`), Studio's only allowed inline style.
17. **`canvas/nodes/TypeSampleNode.tsx`**: caps caption; same custom-property pattern for fonts.
18. **`canvas/nodes/chips.tsx`**: `SourceChip` (24px pill, Tooltip with the URL, no `title=`),
    `TagChip` (`.st-chip` ship or explore), `LinkCard` (stripe placeholder, pixel image-off glyph).
19. **`canvas/nodes/Resizer.tsx`**: handle classes for the new CSS; nothing else.
20. **`canvas/labels.ts`**: add "selected" to node labels when selected; directions stay screen words.
21. **Tests**: `tests/canvas-viewport.test.ts`, `tests/canvas-snapping.test.ts`, update
    `tests/canvas-keyboard.test.ts`; in `e2e/canvas.spec.ts` add wheel-pans, Ctrl+wheel zooms,
    marquee selects, Space+drag pans, Shift+1 fits, Mod+D duplicates, Alt+drag duplicates, snap guide
    appears, and axe runs in light, dark and with `dir="rtl"`.

Done when: the web canvas matches spec sections 3 to 6 and 10 in both themes, every new gesture has a
key route listed in the sheet, axe is clean, and existing canvas tests pass.

---

## WP-B: public site (English and Arabic)

**Owns**: `app/(site)/**` (all files, including `site.css`, `[locale]/layout.tsx`, `_components/*`, every
page and form) and `lib/site/dict/**` (copy only). Plus `e2e/site.spec.ts` (new) if wanted.

1. **`app/(site)/site.css`**:
   - Replace the `.site` custom properties and both theme blocks with token use. `.site` background
     `--st-bg-body`, text `--st-text`, font `--st-font-sans` (Arabic switches through the token file, so
     delete `--font-ar` and the `[dir="rtl"]` font rule; keep the taller line height through
     `--st-leading-*`). Body copy stays 1rem (16px); headings: h1 `--st-text-7xl` 600 `--st-text-bright`,
     h2 `--st-text-4xl` 600, h3 `--st-text-2xl` 600.
   - Focus: `--st-focus-ring` (box-shadow) plus `outline: 2px solid transparent`.
   - `.button`: Studio button at lg (44px, pill, weight 700). Default `primary` (overlay-20 fill),
     `.secondary` (overlay-10, `--st-btn-secondary-fg`), `.danger` (destructive: danger-10 fill,
     `--st-danger-fg`). States per spec 4.1; `[aria-disabled]` at 0.38. Keep the 44px minimum.
   - `.card` to tile: no border, `--st-bg-surface-2`, radius `--st-radius-card`; `.grid` parent on
     `--st-bg-surface` with a 1px gap and radius 16px (tile grid). `.card.highlight` becomes a tile with
     a `.st-chip` label, no 3px border.
   - Steps: CSS counter renders the title row "Step 1" in caps 11px with a 7px accent dot.
   - Code: `pre` mono on `--st-bg-surface-3`, radius 12px, no border; stays `direction: ltr`.
   - Inputs: `.st-input` look at 44px: transparent, 1px `--st-border-control`, pill radius; `textarea`
     radius 12px; hover and focus per spec 4.3; `[aria-invalid]` danger.
   - `.status` and `.status.bad` become `.st-alert` success and danger; `.error-summary` a danger alert;
     `.draft` a warning alert; all with an icon and words.
   - Tables: DataTable look: header surface-2, caps text-xs subtle, hairline rows `--st-border-muted`.
   - `dialog`: `.st-dialog` look (surface panel, surface-2 header and footer, eyebrow).
   - Skip link: `--st-text-bright` on `--st-bg-surface-3`, radius 12px.
   - Remove inline `style={{ marginBlockStart: 0 }}` uses with a `.flush-start` class (pages below).
   - Keep logical properties throughout (already true).
2. **`app/(site)/[locale]/layout.tsx`**: header and footer on `--st-bg-body`; brand gets a 7px
   `--st-brand` dot before `APP_NAME`; language switch markup to a secondary sm button-link.
3. **`app/(site)/_components/SiteNav.tsx`**: current page shows the Tabs active treatment (2px
   underline, weight 600) plus `aria-current`; links are 44px ghost items.
4. **`app/(site)/[locale]/page.tsx`** (landing): steps as tile grid; founding block as a tile with a chip;
   remove inline style; primary and secondary CTAs at lg.
5. **`app/(site)/[locale]/pricing/page.tsx`, `CheckoutButton.tsx`**: plan tiles, price at `--st-text-6xl`
   600, picked plan by chip and words; checkout button uses the loading spinner and "Opening checkout…".
6. **`app/(site)/[locale]/account/page.tsx`, `DeleteAccount.tsx`**: sections with hairline titles; the
   delete flow uses the danger-tone dialog structure (eyebrow, title, body that says what is deleted
   and what is kept, Cancel first and focused, "Delete account" destructive).
7. **`app/(site)/[locale]/takedown/page.tsx`, `TakedownForm.tsx`**: field markup (label, hint, inline
   error with `role="alert"`), alerts; radios 24px.
8. **`app/(site)/[locale]/terms/page.tsx`, `privacy/page.tsx`, `_components/LegalDocument.tsx`**: reading
   column (68ch), TOC as a section list, draft banner as a warning alert, tables in DataTable style.
9. **`lib/site/dict/**`**: copy pass with Studio's rules: sentence case, buttons are verb plus noun, no
   "OK" or "Continue", no marketing adjectives, no exclamation marks, no "we" or "our", empty states say
   the next move, no em dashes. Arabic strings get the same review by an Arabic reader.

Done when: every site page matches spec section 10 in light, dark, English and Arabic; axe is clean in
all four; a 400% zoom and a 320px wide viewport reflow with no horizontal scroll (SC 1.4.10).

---

## WP-C: overlays, shared and inline canvas

**Owns**: `canvas/ShareButton.tsx`, `canvas/UploadButton.tsx`, `canvas/SharedCanvas.tsx`,
`canvas/WebCanvas.tsx`, `canvas/overlays.css` (new, for share and upload styles that today live in
`canvas.css` as `.bn-share*` and `.bn-upload*`; WP-A deletes those rules from `canvas.css` in its first
commit), `ui/canvas/**` (`main.tsx`, `inline.css`, `index.html`, `vite.config.ts`, `README.md`),
`app/c/[id]/page.tsx`, `app/c/[id]/loading.tsx` (new), `app/s/[token]/page.tsx`, and `e2e/mcp-apps.spec.ts`.
After Step 0 it also owns `components/studio/**` and `styles/studio-components.css` (A and B ask for
changes there rather than editing).

1. **`canvas/WebCanvas.tsx`**: mount the `ToastProvider` once; no forced theme.
2. **`canvas/ShareButton.tsx`**: today a disclosure panel. Make it Studio's share flow: a secondary sm
   button "Share" that opens a `Dialog` (md, 440px): intro "Anyone with this link can view this canvas.
   They cannot change it.", the link row on surface-2 (URL mono text-xs, "Copy link" secondary sm,
   "Turn off link" ghost danger), or "Create view link" primary when none exists. Copy success is a
   `status` toast "Link copied"; failures are error toasts. Keep the error text next to the button only
   for field-level problems.
3. **`canvas/UploadButton.tsx`**: secondary sm button with the pixel upload glyph and "Upload image";
   `data-loading` spinner and "Uploading…"; result and failure through toasts (drop the inline
   `bn-upload-msg` spans or keep them visually hidden for the live region). The hidden file input keeps
   its label. Replace the inline stroke SVG with the pixel icon.
4. **`canvas/overlays.css`** (new): only what the share dialog rows and upload need beyond
   `studio-components.css`.
5. **`canvas/SharedCanvas.tsx`, `app/s/[token]/page.tsx`**: view-only banner as an info `.st-alert`
   ("View only. You cannot change this canvas."), top bar shows "View only" instead of save status.
6. **`app/c/[id]/loading.tsx`** (new): Studio-style skeleton of the shell (36px bar, rail, panel rows,
   board) with `aria-busy`.
7. **`ui/canvas/main.tsx`, `inline.css`, `index.html`, `vite.config.ts`**: import fonts, tokens and
   components CSS; keep the host theme sync (`host.context.theme` already sets `data-theme`); the
   wrapper bar (`.bn-inline-bar`) becomes a 36px Studio top bar on `--st-bg-body` with "Open on the web"
   as a secondary sm link-button; the conflict banner (`.bn-inline-conflict`) becomes a warning
   `.st-alert`; compact mode under 720px (rail collapsed, panel closed). Inline the woff2 files in the
   single-file build so a host CSP that blocks font hosts does not matter; `system-ui` stays the fallback.
   Remove the inline `style={{ height }}` in favour of a custom property (`style={{ "--inline-h": ... }}`).
8. **Tests**: `e2e/mcp-apps.spec.ts` runs axe in light and dark host themes; a test that the inline
   bundle loads with no font requests to third-party hosts.

Done when: share, upload, shared view and inline canvas match the spec in both themes, the inline
build stays one file, and axe is clean.

---

## Step 4: gates and QA (after A, B and C merge)

Copy Studio's habit of turning design rules into tests (`fk2:src/__tests__/architecture/`):

| Test (new, in `tests/`) | Rule |
|---|---|
| `design-tokens.test.ts` | Already live from Step 0: every pair meets AA. |
| `design-no-raw-colors.test.ts` | No hex, rgb or hsl literals in `canvas/*.css`, `app/(site)/site.css`, `ui/canvas/*.css`, `styles/studio-components.css` (only `styles/studio-tokens.css` may hold them). |
| `design-no-title-tooltips.test.ts` | No `title=` attribute in `canvas/**/*.tsx`, `app/(site)/**/*.tsx`, `ui/canvas/**/*.tsx` (use `Tooltip`). |
| `design-no-em-dash.test.ts` | No U+2014 in UI strings under `canvas/`, `app/`, `ui/`, `lib/site/dict/`, `components/`. |
| `design-logical-properties.test.ts` | No `left`, `right`, `margin-left`, `margin-right`, `padding-left`, `padding-right`, `border-left`, `border-right`, `text-align: left/right` in owned CSS (allow-list the React Flow overrides that need them). |
| `design-target-size.test.ts` (Playwright) | Every focusable element on `/c/:id`, `/en`, `/ar` is at least 24 by 24 CSS px or meets the spacing exception. |

Visual QA: compare `/c/:id` and the inline canvas side by side with Studio's board in both themes;
check Arabic pages with real Arabic copy at 100% and 200% zoom.

---

## Interaction gaps, summary

Banana's React Flow setup today versus Studio (details and props in spec section 11):

| Gap | Banana today | Needed |
|---|---|---|
| Wheel | zooms | pans; Ctrl/Cmd+wheel and pinch zoom |
| Left drag on empty canvas | pans | marquee (intersect); pan with Space, middle button or H |
| Zoom range | 10% to 200% | 10% to 400%, ladder steps, animated 220ms |
| Zoom shortcuts | none on the pane | +, -, Mod+0, Shift+1, Shift+2 |
| Snapping | none | peer edges and centers within 8 units, with guides |
| Duplicate | none | Mod+D and Alt+drag |
| Select all, deselect | none | Mod+A, Escape |
| Context menu | button and M key only | also right click at the pointer |
| Help | `<details>` list | `?` shortcut sheet from one registry |
| Keyboard pan | none | arrow keys on the focused pane |
| Hand tool | none | H latch with grab cursor |
