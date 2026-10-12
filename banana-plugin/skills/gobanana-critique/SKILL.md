---
name: gobanana-critique
description: Build then critique - grade a built page against its GoBanana direction. Takes the page as a URL, a local dev server or a screenshot, gets the REVIEW.md checklist from the direction, screenshots the page at the platform's sizes (mobile 390x844, tablet 834x1194, desktop 1440x900) with whatever browser tool is there (Playwright MCP, Chrome tools or npx playwright screenshot), grades each item pass or fix with evidence, lists the top 3 fixes, and offers to apply them inside the page scope only. Use when the user says "critique this page", "review the build", "does this match the direction", "grade my page", "build then critique", "check the launch page against the board", or "how close is this to the concept". Runs get_canvas and export_kit (review) from the GoBanana MCP server.
---

# GoBanana critique

Check a built page against the direction it came from, honestly and with evidence, then fix what matters most without touching anything outside the page.

## Ground rules

- **Evidence or it did not happen.** Every grade cites what you saw (a screenshot at a named size) or a file and line. Do not grade what you could not see; mark it "not checked" and say why.
- **Page scope only.** Fixes stay in the files for the scoped pages and their page-local components and styles. Never edit shared components, global CSS, the project's tokens or theme, layouts used by other pages, or other routes. If a fix needs a shared file, say so and ask first.
- **Screenshots are of the user's own page.** Save them to a temp folder (or `design/explorations/<slug>/critique/` if the user wants them kept). Never screenshot, download or save third-party reference images.
- Plain words, no em dashes.

## Steps

### 1. Find the page and the direction

- **The page:** a URL, a local dev server (`http://localhost:3000/pricing`), or a screenshot the user gives. For a local project with no server running, offer to start it with the project's own dev script; ask before starting it.
- **The direction:** the kept direction from this conversation, or `design/explorations/<slug>/` in the repo, or the canvas (`get_canvas`). You need its platform and pages.

### 2. Get the checklist

- **`design/explorations/<slug>/REVIEW.md` exists:** use it.
- **Otherwise:** call `export_kit` with `canvasId`, `directionId`, `pages`, `scope: "page"` and `formats: ["review"]`, and write it at the returned `path`.
- **Free plan** (`review` is Pro): relay the plan message once. Build the checklist yourself from `DIRECTION.md` (free, or the direction's `spec` from `get_canvas`): one item each for signature, pattern, typography, color, layout, motion, texture, iconography, density, every `avoid` line, plus WCAG 2.2 AA contrast and target size.

### 3. Screenshot at the platform's sizes

| Platform | Sizes |
| --- | --- |
| `mobile` | 390x844 |
| `tablet` | 834x1194 |
| `website` | 1440x900 and 390x844 |
| `webapp` | 1440x900 |
| `any` | 1440x900 and 390x844 |

Use the first tool you have:

1. **Playwright MCP:** resize the browser to the size, navigate, take a full page screenshot. Repeat per size.
2. **Chrome tools** (Claude in Chrome or similar): resize the window, open the page, screenshot.
3. **CLI:** `npx --yes playwright screenshot --viewport-size=390,844 --full-page <url> <tmp>/mobile.png` (install the browser with `npx playwright install chromium` if asked).
4. **None works:** ask the user for screenshots at those sizes, and grade from the code for the rest.

For motion items, also check with reduced motion on when the tool allows it (Playwright: `reducedMotion: "reduce"`), and read the CSS or animation code.

### 4. Grade every item

A table, one row per checklist item:

| Item | Grade | Evidence |
| --- | --- | --- |
| Signature: balance shown as a stamped ticket | pass | 390x844: ticket card with perforated edge above the fold |
| Contrast: body text 4.5:1 | fix | 1440x900: grey #8A8F98 on #F4F1EA is 2.9:1 (`app/pricing/page.tsx` line 42) |
| Motion respects reduced motion | not checked | no browser tool; CSS has no `prefers-reduced-motion` block |

Grades: `pass` or `fix` (or `not checked` with a reason). Be strict on accessibility (WCAG 2.2 AA: SC 1.4.3 text 4.5:1, SC 1.4.11 UI parts 3:1, SC 2.5.8 target size, focus visible, reduced motion) and on the platform (no 12 column grid on a phone, 44pt targets on mobile).

### 5. Top 3 fixes

Pick the 3 fixes that close the most distance to the direction or fix accessibility. One line each: what, where (file), why. Then say how close the page is in one line ("7 of 11 pass; the signature is there, the type voice is not").

### 6. Offer to apply

Ask: "Apply these 3 fixes? I'll only touch files for /pricing." On yes, edit only files inside the page scope, then screenshot again at the same sizes and re-grade the items you touched. If a fix needs a shared file, list it and leave it for the user.

## When things go wrong

- **Page does not load:** say what you tried (URL, status) in one line and ask for a working URL or screenshots.
- **Plan or quota message:** show it as is, with its link, once. Do not retry or loop.
- **Tool error or timeout:** retry once at most, then tell the user in one line.
- **GoBanana tools missing:** you can still grade against a `DIRECTION.md` or `REVIEW.md` in the repo; ask the user to enable the GoBanana connector for the rest.
