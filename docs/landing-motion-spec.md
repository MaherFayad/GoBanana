# Landing rebuild: scroll story after ssscript.app

The owner's verdict on the first pass: only the hero matched. The rest was cluttered and wordy, and the sections did not follow the reference. This spec replaces the landing-page part of `site-redesign-spec.md`.

Reference evidence was captured in a real Chrome with real wheel and mouse input. It lives in the session scratchpad (`C:\Users\Admin\AppData\Local\Temp\claude\c--Users-Admin-Documents-GitHub-Gobanana\4169a1b4-841e-4620-87f4-f75d6aa4ee9d\scratchpad\`):

- `motion/` holds frames:
  - `a01-trail`: the mouse glyph trail
  - `a03-notif-hover`: the notification stack expanded
  - `a06-drag`: the window dragged, revealing the 3D mark
  - `s00` to `s32`: scroll frames, named by scroll Y
  - one `.webm` recording
- `ref2/` holds viewport shots, `d-*` for desktop and `m-*` for iPhone 13.

Study them, and re-run your own headed session (`playwright-core` in `scratchpad/pw`, `chromium.launch({channel:'chrome', headless:false})`, `page.mouse.wheel`) whenever you are unsure how something moves.

## How the reference works (what to rebuild)

**Persistent layer, always on screen:**
- The menu bar.
- A notification stack fixed at the top right. On hover or focus it fans out into 3 cards stacked vertically.
- The dock, fixed at bottom centre.
- One big 3D app mark, fixed behind the content and centred low on the screen. As you scroll it travels, scales and gets covered by windows and text.
- Film grain over everything.

**Motion:**
- Lenis smooth scroll (`lerp` about 0.1).
- GSAP ScrollTrigger, scrubbed.
- Headings and body text blur in word by word as they enter: blur 8px to 0, opacity 0 to 1, y 12px to 0, scrubbed.
- Video and image windows parallax slightly.

**Hero interactions:**
- The hero window is frosted glass, so the 3D mark shows through it blurred.
- Dragging the window reveals the mark. The mark tilts toward the cursor.
- The mouse leaves a short trail of glyph pixels (`+ x o` in a small grid) that fades out in about 1 second. Draw it with a 2D canvas or WebGL.

**Layout:**
- Space is generous. Each section has one two-tone heading (grey line, then white line) and one or two short lines of text.
- Headings sit on alternating sides, and the body text sits on the opposite side or under the heading.

## GoBanana section order (desktop)

| # | Reference | GoBanana | Layout |
| --- | --- | --- | --- |
| 1 | Hero desktop: waitlist window, 4 callouts | Same desktop. Centre window "Add GoBanana": mark tile, two-tone title, one line, server address + Copy, "Setup guide" link to `/docs/start/install/`. Four callouts. Reference tiles stay as desktop icons with Quick Look | As now, cleaned up |
| 2 | "All in one App." with a giant `video-demo.mp4` window bleeding off the right edge | "One board. / Every idea." on the left, plus 2 small labelled notes. On the right, a big window titled `woven-checkout.board` holding the canvas mock (`ProductFrame`), bleeding off the inline-end edge | Text column about 22rem, window about 70vw |
| 3 | "Agentic Component Library." heading on the right, short text on the left, then an edge-to-edge row of video cards with captions | "Made with / GoBanana." heading on the right, one line on the left. Then an edge-to-edge horizontal row of the 4 gallery boards: large cards with the caption under each, scrolled horizontally by scroll progress, swipe on touch. Each card opens the existing example dialog | Full bleed |
| 4 | Three sparse statements: "One click Add." / "Get a better MCP." / "Flexible AI Modes." | Three statements, alternating sides, the mark visible between them (copy below) | Lots of air |
| 5 | FAQ heading, "Complete Docs" button, Mail window `faqs` | "Questions. / Answered." + "Read the docs" button + Mail window titled `faq`, 5 items (copy below), sender = the app name with the Bend mark avatar | As the reference |
| 6 | "Connect. Prompt. Ship." with a line + CTA on the other side | "Brief. / Bend. / Ship." on the left; a line and the "Add to Claude" button on the right | |
| 7 | Centred "Pricing" eyebrow, huge 3-line heading, 3 short centred lines, then a `pricing.app` window with a comparison table (plans as columns, CTA row) | Same. Heading "Free to start. / Pro when / you need more." Three lines (copy below). Window `pricing.app`: columns Free, Pro monthly, Pro yearly, Founding; rows from the existing pricing data; a CTA row; a small fine-print line | Centred |
| 8 | Pixel-dissolve transition into a light grey section: the mark centred, app windows fanning out of it in a cascade, a few file icons | Same transition. Export windows fan out of the Bend mark: `DESIGN.md`, `AGENTS.md`, `tokens.json`, `tailwind.css`, `board.figjam`. Each is a small window showing a real excerpt from `exportPreview()`. Heading "Ship a kit. / Not a moodboard." | Grey is a token; text keeps AA contrast |
| 9 | The big heading again, with `.txt` signup files piling up at the bottom right | "Your next direction / is one prompt away." Desktop file icons pile up at the bottom right, named after gallery boards and showcase lenses (`souq-checkout.board`, `sadu-weaving.ref` and so on) | |
| 10 | The waitlist window again, then a footer with a large logo and name plus nav columns | The "Add GoBanana" window again, then a footer: large Bend mark + name, © line, nav columns Product / Help / Legal, language switch | |

Remove from the landing page: the "Bend it as a graph" section, the clip slider placeholders, and the four-agent install grid (the docs own setup now). Keep `ClipSlider` in the codebase for when recordings exist.

## Copy (English; write Arabic to match, same brevity)

Apple-style rules:
- One idea per line. Headings use at most 4 words per line, and body lines at most 12 words.
- No jargon on the page except "MCP" in the FAQ.
- Plain, confident, short.
- No em dashes. Use `{app}` for the name.

- Hero h1: "Bend a brief." / "Find what's next."
- Hero line: "Wild design directions and real references, inside your AI agent."
- Hero buttons: "Add to Claude", "See the boards".
- Callouts:
  - "Bend / any brief": "Six moves. Five directions."
  - "Real / references": "Always linked to the source."
  - "Palettes / that pass": "Contrast checked, ready to ship."
  - "Export / a kit": "Files your coding agent can read."
- Window: title "Add {app}" / "to your agent". Line: "Works with Claude, ChatGPT and Cursor." Link: "Setup guide".
- Notifications:
  - "Canvases have a home": "Every board, on one page."
  - "Pro is free in beta": "No card needed."
  - "Founding plan, soon": "$29 once. First 100 buyers."
- Section 2: "One board. / Every idea." Notes:
  - "Directions": "Each one becomes a section."
  - "References": "Dropped in, with their source."
- Section 3: "Made with / {app}." Line: "Four boards. Every tile links to the original."
- Section 4:
  - "Six moves. / Endless directions." / "Material, era, lens, scale, constraint, transplant."
  - "Real work. / Never copied." / "Pinterest, Dribbble, Behance and Awwwards. Linked, not stored."
  - "Palettes / that pass." / "Every color carries its contrast ratio."
- FAQ ("Questions. / Answered.", button "Read the docs"):
  1. "Does it make images with AI?" / "No. Your agent does the thinking. {app} finds real work and links to it."
  2. "Are the images copied?" / "Never. They load from their source, with a link back."
  3. "Which agents work with it?" / "Claude, Claude Code, ChatGPT, Cursor, and any MCP client."
  4. "What does it cost?" / "Free to start. Pro is $5 a month. Free for everyone during the beta."
  5. "Can I get my work removed?" / "Yes. Send a takedown request. Once approved, it's gone everywhere."
- Section 6: "Brief. / Bend. / Ship." Line: "Add {app} to Claude. Ask for something new."
- Pricing lines: "Free while in beta." / "Pro: $5 a month, or $39 a year." / "Founding: $29 once, first 100 buyers."

  Prices must come from the pricing helpers (`priceText`) and the beta flag. Never hardcode a number that the plan data owns. The beta line only shows when beta is on.
- Section 8: "Ship a kit. / Not a moodboard."
- Section 9: "Your next direction / is one prompt away." Below it: "Free during the beta. No card needed." (only when beta is on).

Keep the takedown notice ("Inspiration shown with links to the original work. Want yours removed?") once, under section 3's board row. Hard rule: every reference shows its source.

## Phone (< 768px)

Follow the reference's phone screenshots `ref2/m-*`:
- Single column; the mark sits big behind the content.
- No notification stack, no drag.
- Board row: horizontal swipe with snap.
- Pricing table: one card per plan.
- The fan section becomes a vertical stack of windows.
- The dock stays at the bottom, clear of the safe area.
- No horizontal overflow anywhere.

Arabic mirrors everything, with logical properties only.

## Rules

- GSAP + ScrollTrigger and Lenis may be added (pick versions at least two weeks old, MIT or GSAP's free licence; add them to THIRD_PARTY_NOTICES). Load them only on the landing page.
- Under `prefers-reduced-motion`:
  - no Lenis
  - no scrub or blur reveals: content is simply visible
  - no mouse trail
  - a static mark
  - the fan is shown already open
- WCAG 2.2 AA:
  - Heading order makes sense.
  - The horizontal row works with the keyboard (focusable cards, arrow keys or Tab) and has visible prev/next buttons.
  - Text over the mark or the grey section passes 4.5:1.
- Tokens only (no raw colours outside `styles/studio-tokens.css`), logical properties, no em dashes, `APP_NAME` from config. Dark only.
- Performance: pause the mark's render loop when it is off screen or the tab is hidden; lazy-load the heavy parts; LCP is the hero text.
