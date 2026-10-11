# Visual QA screenshots (Studio restyle, Step 4)

Taken 2026-10-11 with `VISUAL_QA=1 npx playwright test e2e/visual-qa.spec.ts --project=chromium`
(in `banana-server/`, against `next dev` with the E2E sign-in bypass). The canvas is the seeded
board from `e2e/support/seed-canvas.ts`: three image tiles on an allowed host (synthetic gradients,
not anyone's image), one link card fallback (blocked host), three notes, two swatches, a type
sample and a section, at 85% zoom, with three search results in the panel. Desktop is 1440x900,
mobile is 390x844. Rerun the command to refresh them.

| File | What to look at |
|---|---|
| `canvas-light-desktop.png` | Studio shell: 36px top bar, rail plus results panel, rounded board corner, notch centered on the board, plain board, AA chips on swatches. |
| `canvas-dark-desktop.png` | Same in dark: black shell around the grey board, notch inverted corners blend into the shell, note paper keeps its light colors. |
| `canvas-light-mobile.png` | Phone width: compact layout (no rail, panel closed, "Results (3)" in the top bar), top bar wraps to two rows with no stray divider, notch fits the board. |
| `canvas-dark-mobile.png` | Same in dark. |
| `share-dialog-light-desktop.png` | Share dialog (md) over the backdrop: link row on surface-2, mono URL field, "Copy link" and "Turn off link", "Link ready" toast bottom end. |
| `share-dialog-dark-desktop.png` | Same in dark. |
| `share-dialog-light-mobile.png` | Dialog fits 390px with 16px gutters; link actions wrap under the field. |
| `share-dialog-dark-mobile.png` | Same in dark. |
| `site-en-light-desktop.png` | Landing: header with brand dot and nav, hero, yellow primary call to action, step tiles. |
| `site-en-dark-desktop.png` | Same in dark. |
| `site-en-light-mobile.png` | Landing at 390px: nav wraps, buttons and tiles stay inside the gutters, no horizontal scroll. |
| `site-en-dark-mobile.png` | Same in dark. |
| `site-ar-light-desktop.png` | Arabic landing: rtl mirroring (brand at the inline start on the right, language switch on the left), IBM Plex Sans Arabic, Latin words in place. |
| `site-ar-dark-desktop.png` | Same in dark. |
| `site-ar-light-mobile.png` | Arabic at 390px: wrapping order of nav and language switch, step labels "الخطوة 1". |
| `site-ar-dark-mobile.png` | Same in dark. |
| `site-ar-light-zoom200.png` | Arabic at 200% zoom (720x450 CSS px at 2x): text reflows, nothing clipped, header stays on one row. |
| `site-ar-dark-zoom200.png` | Same in dark. |
| `pricing-en-light-desktop.png` | Plan tiles: price at text-6xl, "Your current plan" chip (beta user, wraps under the title at four columns), founding chip, "Checkout is not open yet." |
| `pricing-en-dark-desktop.png` | Same in dark. |
| `pricing-en-light-mobile.png` | Pricing at 390px: tiles stack inside the gutters; the current plan chip fits on the title row here. |
| `pricing-en-dark-mobile.png` | Same in dark. |
| `inline-canvas-light-desktop.png` | Inline canvas (MCP Apps fake host, 760px frame, host theme light): "Open on the web" bar, rail and panel, notch inside the board. |
| `inline-canvas-dark-desktop.png` | Same with the host theme dark. |
| `inline-canvas-light-mobile.png` | Inline canvas in a 358px frame: compact top bar on three rows, notch fits the board edge to edge. |
| `inline-canvas-dark-mobile.png` | Same in dark. |
