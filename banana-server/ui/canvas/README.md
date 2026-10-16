# Inline canvas (MCP Apps)

The moodboard canvas shown inside chat clients (spec section 9, milestone M5). It is the
same `canvas/CanvasApp` as the web canvas at `/c/:id`, built into one HTML file.

## How it fits together

| Piece | File |
| --- | --- |
| Entry: connects to the host, reads the `open_canvas` result, renders the canvas | `ui/canvas/main.tsx` |
| Vite build: one HTML file, all JS and CSS inlined, fonts as separate files | `ui/canvas/vite.config.ts` |
| Wrapper look: Studio top bar, conflict alert, compact mode | `ui/canvas/inline.css` |
| Built HTML and UI fonts (static assets, read through the ASSETS binding) | `public/mcp-app/canvas.html`, `public/mcp-app/assets/` |
| `ui://banana/canvas` resource, mime type, CSP, APP_URL filled into font URLs | `lib/mcp/resources/canvas.ts` |
| Load and save over the host bridge | `canvas/persistence-bridge.ts` |
| App-only save tool (hidden from the model) | `lib/mcp/tools/save_canvas_state.ts` |
| App-only load tool (fallback when a host drops result `_meta`) | `lib/mcp/tools/load_canvas_state.ts` |

1. The agent calls `open_canvas`. Its tool listing has `_meta.ui.resourceUri: "ui://banana/canvas"`.
2. The host reads the resource (`text/html;profile=mcp-app`) and renders it in a sandboxed
   iframe with a CSP built from `_meta.ui.csp`.
3. The host sends the tool result to the view. `structuredContent.canvas` is small (`id`,
   `title`, `webUrl`, counts) because some hosts show it to the model. The board itself
   (`state`, `updatedAt`) is in the result `_meta["banana/canvas"]`, which goes to the view
   only. If a host drops it, the view calls `load_canvas_state`.
4. Each change auto-saves after 1 second through `save_canvas_state` (host proxied
   `tools/call`), with `baseUpdatedAt` set to the last version the view saw.
5. If an agent tool or the web canvas saved in between, the view shows a choice:
   "Load the latest version" or "Keep my version". Nothing is overwritten silently.

Images load in the browser from their source hosts. The view never fetches image bytes.

X posts (`xpost` items) are link cards here: the author, "Open on X" and the note, never the post text and never X's embed. The CSP declares no X host and no `frameDomains`; X's widget script also cannot draw a post inside the opaque-origin sandbox, and X's developer terms bar showing X content inside a frame (DECISIONS.md 2026-10-16). The web canvas shows X's official embed. Tested in `e2e/canvas-xpost.spec.ts`.
Source links open through the host (`ui/open-link`).

"Show in chat" (P0-12, `ui/canvas/ShowPage.tsx`, shown when the host advertises
`updateModelContext`): the user picks a Frankenstein page, and the view draws it to one
image in the browser (`canvas/vision/render-page.ts`, loaded with `import()` on click) and
sends it with `ui/update-model-context`, after a text layout map with each part's source link
(`canvas/vision/page-context.ts`). The parts load with CORS onto a `<canvas>` in memory;
nothing is uploaded or stored. A host without a CORS header (Pinterest) would taint the
canvas, so such a page is not drawn: the view sends the parts view from `get_snapshot`
instead and says why. A host that takes text only gets the layout map. Tested in
`e2e/mcp-apps-show-page.spec.ts`.

## Look

Same Studio design language as the web canvas (docs/design-language.md): `main.tsx` imports
`styles/fonts.css`, `styles/studio-tokens.css` and `styles/studio-components.css`.

- Theme: the host theme (`hostContext.theme`) goes on `<html>` and the wrapper as `data-theme`;
  without one the tokens follow the system.
- A 36px top bar on `--st-bg-body` with "Open on the web" (secondary sm link-button) and
  "Full screen" where the host offers it.
- The conflict choice is a warning alert; toasts show inside the frame, bottom inline end.
- Under 720px wide the wrapper gets `data-compact` (rail collapsed, panel closed).
- Fonts (Inter, IBM Plex Sans Arabic) are never inlined. The build writes them to
  `public/mcp-app/assets/` with URLs that start with a placeholder; `canvas.ts` fills in
  APP_URL's origin when serving and adds it to the CSP `resourceDomains`; `public/_headers`
  allows cross-origin font loads. Without APP_URL, or when a host blocks it, the view uses
  `system-ui`. The view never requests fonts from a third-party host (checked in
  `e2e/mcp-apps.spec.ts`).

## Build

```bash
npm run build:ui   # writes public/mcp-app/canvas.html and public/mcp-app/assets/*.woff2
```

`npm run build` runs it first, and `npm run deploy:preview` runs `npm run build` through
OpenNext. The output is checked in so typecheck, tests and e2e work on a fresh clone.
Rebuild and commit it after changing anything under `canvas/`, `components/studio/`,
`styles/` or `ui/canvas/`.

## Tests

- `tests/mcp-apps.test.ts` (Vitest): resource listing, mime type, CSP, self-contained HTML,
  tool metadata, save tool rules, bridge persistence against the real tool.
- `e2e/mcp-apps.spec.ts` (Playwright): the built HTML in a sandboxed iframe under a strict
  CSP, with a fake host that speaks the ext-apps postMessage protocol. Axe runs with the
  light and the dark host theme, and a test checks that fonts load only from APP_URL. Runs without the
  Next server: `E2E_BASE_URL=http://localhost:1 npx playwright test e2e/mcp-apps.spec.ts`.

## Manual checklist per release (spec section 13, "Inline canvas")

Run on a preview deploy with a test account. Do it in Claude (web and desktop) and in
ChatGPT (developer mode connector). Note the date, client version and result for each line.

### Setup

- Claude: Settings, Connectors, Add custom connector, URL `https://<preview>/api/mcp`. Sign in.
- ChatGPT: Settings, Apps and Connectors, Advanced, Developer mode on, Create connector with
  the same URL. Sign in.

### Checks

1. Ask: "Open a new moodboard canvas for a cold glass checkout screen." The canvas renders
   inline, with the title in the toolbar and an "Open on the web" link.
2. Ask the agent to bend the brief and search references with that canvasId. Ask it to open
   the canvas again. Tray results show thumbnails.
3. Allowlisted hosts (Google thumbnails, Pinterest, Dribbble, Behance, Awwwards) show images.
   Any image that fails shows a link card with title, site and source link, never a broken image.
4. Every tile shows its source chip. Clicking it opens the source page in a new tab (the host
   may ask to confirm).
5. Drag a tray result onto the canvas. Then focus a tray tile and press Enter: it is added too.
6. Keyboard only: Tab to a node, arrow keys move it 8 px (Shift 32 px), `+`/`-` resize, `M`
   opens its menu, Delete removes it. The focus ring is visible and not hidden by the toolbar.
7. The toolbar save status reads "All changes saved" about 1 second after a change.
8. Open the web link. The web canvas shows the same items. Change something on the web, then
   change something inline: the inline canvas shows the conflict choice. "Load the latest
   version" shows the web change; "Keep my version" keeps the inline one. Reload the web page
   to confirm.
9. Ask the agent to add a note with add_to_canvas while the canvas is open, then move a node
   inline. The conflict choice appears; after "Load the latest version" the note is there.
10. After an inline change, ask "What is on my canvas now?". The agent calls get_canvas and
    describes the change (the view updates the model context after each save).
11. Full screen (where the host offers it): the "Full screen" button switches and the canvas
    fills the view; "Exit full screen" goes back.
12. Type samples use their Google Font. If the host blocks the font hosts, they fall back to
    system fonts and stay readable.
13. Dark mode in the host: the canvas follows the host theme, and text stays readable.
    The UI text is set in Inter (check the iframe's network panel: fonts come from the app
    origin's `/mcp-app/assets/`, nothing from a font CDN).
14. Free plan with 3 canvases: asking for a 4th shows the plain upgrade message inline.
15. Check the browser console of the iframe: no CSP errors for scripts or styles. Blocked
    image hosts may log CSP errors for images; those tiles must show link cards.
16. Save does not show up as a tool call the model makes (save_canvas_state is app-only). In
    clients without MCP Apps (Claude Code, Cursor), open_canvas still returns the web link.
