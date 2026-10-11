# Site redesign spec: the GoBanana desktop

Owner decisions, 2026-10-12:

- Marketing pages stay in `banana-server` (Next 16, OpenNext on Cloudflare). Keep the banana yellow brand accent.
- Docs ship as a separate Astro Starlight app in `banana-docs/`, served at `/docs` on the same workers.dev domain. They are built with `base: '/docs'` and copied into `banana-server/public/docs/` before the OpenNext build.
- Signed-in pages are in scope: the dashboard, the canvas editor, the shared canvas, account, sign-in branding and the not-found page.
- Visual reference: https://ssscript.app/ (feel, structure and motion only). Never copy its assets, copy, code or icons.

Full plan and audit: https://claude.ai/code/artifact/9cb4d661-aecb-4875-bb4c-217e252776bc

## The reference, in short

The page is a fake macOS desktop on black (`#000`) with film grain:

- a menu bar with a live clock
- draggable windows (traffic-light dots, 1rem radius, glass panels `#1f1f1f87` with backdrop blur)
- a dock at the bottom, desktop icons, and a notification stack in the top right that fans out on hover
- a blurred 3D app icon (WebGL) behind the hero
- a clip slider of screen recordings
- the FAQ drawn as a Mail app (list plus reading pane)
- pricing as cards

Typography and motion:

- Font: Instrument Sans 400, 500, 600 and 700.
- Headings come in two tones: the first line grey (`#b9b9b9`-ish), the second white.
- Headings are set tight: line-height 0.9, letter-spacing -0.04em. h1 is about 2.6rem; section headings are 1.6 to 2.1rem.
- Body is 0.9rem at line-height 1.5, max 60ch, with key words lifted to white.
- Buttons roll the label up on hover while a copy rolls in from below. Easing is `cubic-bezier(.22,1,.36,1)` over 0.3s.

Reference screenshots (desktop 1440, iPhone 13, docs) are in the session scratchpad, under the folders `ref/` and `gb/`.

## Mapping to GoBanana

| Reference | GoBanana | Reuses |
| --- | --- | --- |
| Menu bar + clock | Bend mark, How it works, Gallery, Docs, Pricing; right: language switch, clock (Arabic digits in `ar`), Sign in, "Add to Claude" pill | `SiteNav` |
| Waitlist window | "Add to Claude" window: server address + copy + 3 install steps | `ServerAddress`, `InstallMocks` |
| 4 corner callouts | Bend, References, Palette, Export | landing copy |
| Desktop icons | Floating reference tiles (Quick Look window with source link) | `HeroField`, `RefImage` |
| Notification stack | "New: a home for your canvases", "Pro for everyone during the beta" | |
| 3D icon | Bend mark in glass (OGL), static fallback | `BrandMark` |
| Dock | Bend mark, Canvas, Gallery, Docs: jump to sections | new |
| Clip slider | 6 to 8 recordings (placeholders with posters until recorded) | new |
| Component library | "One board for the whole idea": canvas mock in a window | `ProductFrame` |
| Feature trio | "Bend it as a graph" in a window | `GraphWires` |
| (none) | Gallery as a Finder window | `GalleryBoard` |
| (none) | Export kit as a text-editor window | `ExportTabs`, `CodeBlock` |
| Mail FAQ | Same pattern | new |
| CTA + pricing | "Brief. Bend. Ship." + plans as windows | `PlanBits` |

Internal pages:

- Dashboard: a Finder window. It gets a title bar, a toolbar (search, grid/list, New canvas), a glass sidebar, a designed empty tile and an Inspector. On mobile it becomes a segmented control, rows, and a bottom-sheet for details.
- Canvas: a title bar (name, save state, Share), glass toolbars, and the tray styled as a dock. The new font goes in the chrome only, never in the user's board.
- Shared canvas: the same chrome plus a "Made with GoBanana" notification.
- Account: a System Settings window.
- Not found: a "moved to the Trash" window.
- Inline canvas in Claude: tokens and font only.

## Rules (tests enforce most)

- No raw colours outside token files. Use logical CSS properties only. No em dashes in copy. Never hardcode the app name; read `APP_NAME` from `lib/config.ts`.
- WCAG 2.2 AA:
  - Every draggable window moves with arrow keys (16px steps) and closes with Escape.
  - Text stays selectable.
  - `prefers-reduced-motion` turns off drag inertia, label rolls, WebGL and autoplay.
  - Contrast is 4.5:1 or better.
- Arabic mirrors everything (menu bar, traffic lights, dock order, windows). Arabic headings use normal tracking.
- Under 768px, show a phone home screen, not a shrunk desktop: stacked full-width windows, no drag, a bottom dock that respects `safe-area-inset-bottom`, and compare tables as cards.
- Keep the site dark only. The Worker must stay under 2.9 MB gzipped.
- GSAP and OGL load only on the landing page.
