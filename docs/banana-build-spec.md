# Banana MCP: Build Spec for Claude Code

Working name: **Banana** (placeholder until a trademark check; keep the name in one config value, `APP_NAME`).
Owner: Maher Fayad. Spec date: 2026-10-11. Target launch: 2026-12-12.

## How to use this file

1. Read this whole file before writing code.
2. Create `CLAUDE.md` in each repo from the "CLAUDE.md starter" section at the end.
3. Build milestone by milestone (M1 to M8). Do not start a milestone until the previous one meets its "Done when" list.
4. When a library detail in this spec turns out to be wrong or outdated, check the library's current docs, follow the docs, and note the change in `DECISIONS.md`.
5. Ask the owner before changing anything in "Hard rules".

---

## 1. What we are building

A remote MCP server plus a moodboard canvas plus a Claude plugin.

- The user asks their AI agent (Claude, ChatGPT, Cursor, VS Code) for "wild" design ideas.
- The server turns the brief into "bend" directions (rule-based, no AI), searches the web for references on Pinterest, Dribbble, Behance and Awwwards, and puts them in a canvas tray.
- The user (or the agent) arranges references on a **moodboard canvas** that opens inline in the chat (MCP Apps) and full-screen on the web.
- The canvas exports a **DESIGN.md**, an **AGENTS.md**, design tokens, an HTML board, and a FigJam layout spec.

Positioning: "Mobbin shows what works. Banana shows what's next."

## 2. Hard rules (never break these)

1. **No AI calls from the server.** No LLM, no image generation, no vision API. Bend moves are templates and word lists. Any thinking happens in the user's own agent.
2. **Never download, store or re-host third-party images** (Pinterest, Dribbble, Behance, Awwwards or any site found by search). Store URLs and metadata only. Images load in the browser from their source.
   - Exception: `extract_palette` may fetch thumbnail bytes **into memory only** to compute colors, then drop them. Never write them to disk, R2, cache or logs.
3. **Every reference shows its source link** on the canvas, in share links and in every export.
4. **No scraping.** No Pinterest or Dribbble scraping, no Apify-style scrapers, no headless browsing of those sites. Dribbble appears only through web search results.
5. **Takedown list** is checked on every search and every canvas load.
6. **Shared canvases** are unlisted, view-only and send `X-Robots-Tag: noindex` plus a `noindex` meta tag.
7. **Accessibility:** WCAG 2.2 AA. Every drag has a keyboard and menu alternative (SC 2.5.7), targets at least 24x24 px (SC 2.5.8), visible focus (SC 2.4.7), focus not hidden by toolbars (SC 2.4.11), state never shown by color alone (SC 1.4.1), contrast 4.5:1 for text (SC 1.4.3) and 3:1 for UI parts (SC 1.4.11).
8. **Writing style in all UI copy and docs:** no em dashes, plain words.

## 3. Scope

### In v1 (launch)

- 8 MCP tools (section 6)
- Moodboard canvas: web (`/c/:id`) and inline (MCP Apps), same saved state
- Item types: image tile, note, swatch, type sample, section, upload (user's own images)
- Exports: DESIGN.md, AGENTS.md, `tokens.json`, Tailwind theme, HTML board, FigJam spec, brief
- Accounts (WorkOS AuthKit), Free and Pro plans, Paddle billing, quotas
- Landing page, pricing, account page, takedown form, terms, privacy notice (Arabic and English)
- Claude plugin with 6 skills

### Not in v1

- Pinterest own-boards adapter, Are.na adapter (v2)
- Real-time co-editing, comments, team tier (v2)
- PNG export of canvases (browsers block rasterizing cross-origin images; working around it would mean copying images)
- Any AI or image generation (never)

## 4. Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Language | TypeScript (strict) | One language across server, canvas and plugin |
| App | Next.js App Router | Landing, account, web canvas, API routes |
| Hosting | Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`) | Free plan while building, Workers Paid ($5/mo) at launch. Fallback: Vercel (free to build, Pro $20/mo when charging) |
| MCP | `mcp-handler` + MCP spec 2026-07-28, Streamable HTTP, stateless | Use `createMcpHandler`, `withMcpAuth`, `protectedResourceHandler` |
| Inline UI | MCP Apps, `@modelcontextprotocol/ext-apps` | Tool declares `_meta.ui.resourceUri`; UI served as a `ui://` resource. Check current docs for the resource mime type and `_meta.ui.csp` fields |
| Canvas | React Flow (`@xyflow/react`, MIT) with custom nodes | DOM-based, so tiles are plain `<img>` tags. Do not use Excalidraw (stores image data in the drawing) or tldraw (paid licence) |
| Auth | WorkOS AuthKit, CIMD on, DCR on for older clients | Verify JWTs against AuthKit JWKS with `jose`; check issuer and audience (the MCP URL) |
| Database | Neon Postgres + Drizzle ORM | Use the Neon serverless HTTP driver on Workers |
| Storage | Cloudflare R2 (binding) | Only user uploads and export files |
| Search | Serper images endpoint | `POST https://google.serper.dev/images`, header `X-API-KEY`, body `{ q, num }`. Response items include title, image URL, size, thumbnail URL, source and link; confirm field names against a live response |
| Color | `culori` for OKLCH and contrast; an image decoder plus a median-cut quantizer for extraction | `node-vibrant` may not run on Workers. If it fails, use pure-JS or wasm decoders (for example `jpeg-js`, `upng-js` or `@jsquash/*`) and a small quantizer. Record the choice in `DECISIONS.md` |
| Billing | Paddle Billing + webhooks | Merchant of Record (handles VAT). Verify the `Paddle-Signature` header on webhooks |
| Validation | `@google/design.md` CLI | `npx @google/design.md lint <file>` must pass for every generated DESIGN.md. Spec is alpha; pin the version |
| Tests | Vitest, Playwright, axe, MCP Inspector | See section 13 |

## 5. Architecture

```text
AI client (Claude, ChatGPT, Cursor) + Banana plugin skills
   |  MCP (Streamable HTTP, OAuth bearer token)
   v
Cloudflare Workers: Next.js app
   /api/mcp                 8 tools, withMcpAuth, quota check
   ui://banana/canvas       inline canvas (MCP Apps build of /canvas)
   /c/:id                   full-screen web canvas (same React Flow app)
   /api/canvas/:id          load and save canvas state
   /api/paddle/webhook      sets the user's plan
   /.well-known/oauth-protected-resource
   (site)                   landing, pricing, account, takedown, terms, privacy
   |
   +--> WorkOS AuthKit   login for MCP and web
   +--> Neon Postgres    users, canvases, references, palettes, usage, takedowns
   +--> Cloudflare R2    user uploads and export files only
   +--> Serper           image search (link-out)
   +--> Paddle           checkout, tax, webhooks
```

The agent, not the server, writes files to the user's disk and drives Figma (through the Figma MCP).

## 6. MCP tools

All inputs are Zod schemas. Every tool returns `content` (text for the agent) and `structuredContent` (for the UI). Tool descriptions are product copy: short, plain, and they tell the agent when to use the tool.

| Tool | Input | Output | Plan |
| --- | --- | --- | --- |
| `bend_brief` | `brief` (string, max 500), `wildness` (1 to 5), `moves?` (list), `lens?` (culture preset id), `count` (default 6, max 8) | `directions: [{ id, move, title, searchQuery }]` | Free, unlimited |
| `search_references` | `directionId?` or `query?` (one required), `sources[]` (`pinterest`, `dribbble`, `behance`, `awwwards`; default first two), `count` (4 to 24, default 12), `canvasId?` | `references: [{ id, thumbUrl, imageUrl, sourceUrl, sourceSite, title, width, height }]`; adds them to the canvas tray when `canvasId` is given | Counts toward search quota |
| `extract_palette` | `canvasId`, `itemIds[]`, `size` (5 to 9, default 6), `addSwatches?` (bool) | `palette: [{ hex, oklch, role }]`, `contrast: [{ fg, bg, ratio, passesText, passesUi, tag }]` where tag is `ship` or `explore` | Free |
| `open_canvas` | `canvasId?`, `title?` (max 80), `brief?` (max 500) | `canvas: { id, title, webUrl }`; `_meta.ui.resourceUri: "ui://banana/canvas"` | Free: 3 canvases |
| `add_to_canvas` | `canvasId`, `items[]` (each: `{ type: "reference", referenceId }`, `{ type: "note", text }`, `{ type: "swatch", hex, role? }`, `{ type: "section", title }`), `sectionId?` | `items: [{ id, x, y }]` | Item caps per plan |
| `arrange_canvas` | `canvasId`, `layout` (`by_direction`, `masonry`, `grid`, `hero`), `sectionId?` | `items: [{ id, x, y, w, h }]` | Free |
| `get_canvas` | `canvasId` | Sections, items (with source links and notes), palettes, brief | Free |
| `export_kit` | `canvasId`, `formats[]` (`design_md`, `agents_md`, `tokens`, `tailwind`, `figjam_spec`, `html_board`, `brief`) | `files: [{ name, mime, content }]` as text | Free: `design_md`, `brief`. Pro: all |

Error style: never throw raw errors at the agent. Return a short plain message (for example "You have used your 30 free searches this month. Upgrade: <link>").

### Example registration

```typescript
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { openCanvas } from "@/lib/canvas/store";
import { verifyAuthKitToken } from "@/lib/auth";

const handler = createMcpHandler((server) => {
  server.registerTool(
    "open_canvas",
    {
      title: "Open moodboard canvas",
      description:
        "Open or create a moodboard canvas. Shows it inline when the client supports it, and always returns a web link.",
      inputSchema: z.object({
        canvasId: z.string().optional(),
        title: z.string().max(80).optional(),
        brief: z.string().max(500).optional(),
      }),
      _meta: { ui: { resourceUri: "ui://banana/canvas" } },
    },
    async (input, ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId as string;
      const canvas = await openCanvas({ ...input, userId });
      return {
        content: [{ type: "text", text: `Canvas ready: ${canvas.webUrl}` }],
        structuredContent: { canvas },
      };
    },
  );
});

const authed = withMcpAuth(handler, verifyAuthKitToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authed as GET, authed as POST };
```

## 7. Bend engine (`lib/bend/`)

Rule-based. Same inputs must always give the same outputs (seed from a hash of brief + wildness + moves).

### Moves

| Move | What it does | Query pattern |
| --- | --- | --- |
| `transplant` | Moves the screen into another object or industry | `{object} packaging design {mood}` |
| `material` | Renders UI in a physical material | `{material} texture ui design` |
| `era` | Moves it to another design period | `{era} graphic design {subject}` |
| `constraint` | Removes a default (no cards, one color, type only) | `{constraint} web design` |
| `scale` | Plays with size and density | `oversized {element} poster` |
| `lens` | Pulls from a visual tradition | `{tradition} pattern contemporary design` |

### Wildness

| Level | Label | Rule |
| --- | --- | --- |
| 1 | Fresh | 1 move, keep layout words in the query |
| 2 | Bold | 1 move, drop layout words |
| 3 | Weird | 2 moves combined |
| 4 | Wild | 2 to 3 moves |
| 5 | Bananas | 3 moves, ignore usability words entirely |

### Word lists

Store in `lib/bend/lists/*.json`: `objects`, `materials`, `eras`, `constraints`, `elements`, `moods`, `traditions`. Start with 30 to 50 entries each.

Culture lens presets (`lib/bend/lenses.json`), each with id, name (English and Arabic), and terms. Start with GCC presets: `sadu` (Sadu weaving), `najdi` (Najdi mud architecture), `kufic` (Kufic geometric patterns), `mashrabiya`, `desert-modern`. Never include sacred text or religious verses.

Example output for `{ brief: "flight checkout screen", wildness: 4 }`:

```text
move: transplant + material
query: vinyl record sleeve packaging design frosted glass texture
title: "Checkout as a frosted vinyl sleeve"
```

## 8. Source adapters (`lib/sources/`)

```typescript
export interface SourceAdapter {
  id: "web_search" | "pinterest_own" | "arena";
  search(q: { query: string; count: number; userId: string }): Promise<Reference[]>;
}

export type Reference = {
  id: string;          // our id
  thumbUrl: string;    // loaded in the browser, never re-hosted
  imageUrl: string;    // loaded in the browser, never re-hosted
  sourceUrl: string;   // always shown
  sourceSite: string;  // "pinterest.com", "dribbble.com" ...
  title?: string;
  width?: number;
  height?: number;
};
```

### `web_search` (v1)

- Build the query: `{searchQuery} (site:pinterest.com OR site:dribbble.com OR ...)` from the selected sources.
- Call Serper images. Keep only: title, image URL, thumbnail URL, size, source page link, domain.
- Drop results with no source link, results whose image host is not in the allowlist (section 9), and anything on the takedown list.
- Never fetch the image bytes here.
- On failure: return fewer results with a note. Never fall back to scraping.

### `pinterest_own` and `arena` (v2, stub only in v1)

Create the files with `throw new Error("not in v1")` and a comment pointing to section 3.

## 9. Moodboard canvas (`canvas/`)

One React Flow app, built twice: as a Next.js page at `/c/:id` and as an MCP Apps bundle served at `ui://banana/canvas`.

### Node types

| Node | Shows | Actions |
| --- | --- | --- |
| `image` | `<img>` from source, source chip (site + link), `explore`/`ship` chip, optional note | move, resize, note, open source, remove |
| `note` | Short text | edit, recolor, move |
| `swatch` | Color, hex, OKLCH, contrast badge vs white and black | rename role, toggle `ship`/`explore` |
| `typeSample` | A font pairing from `lib/kit/fonts.json`, sample line | swap pairing |
| `section` | Titled frame (React Flow group) per direction | rename, collapse, arrange contents |
| `upload` | User's own image from R2 | same as `image` |

### Behavior

- **Tray:** search results appear in a side tray; drag into the canvas, or press Enter on a focused tile to add it.
- **Auto-save:** debounce 1 s; save React Flow nodes and viewport JSON to `canvases.state` via `/api/canvas/:id` (web) or the MCP Apps bridge (inline).
- **Arrange:** toolbar button calls the same `lib/layout/` code as `arrange_canvas`.
- **Keyboard:** arrow keys nudge 8 px (Shift = 32 px), Tab moves between nodes, menu on each node offers Move to section, Bring forward, Remove.
- **Image fails to load:** render a link card (title + source site + link) instead of a broken image.
- **Takedown:** on load, hide any item whose URL or domain is on the takedown list.

### Inline (MCP Apps) specifics

- Declare allowed image hosts in `_meta.ui.csp.resourceDomains`. Start list (verify exact CDN host names in M3 and update):
  - Google image thumbnail host(s) returned by Serper
  - Pinterest image CDN
  - Dribbble image CDN
  - Behance image CDN
  - Awwwards image CDN
- Results from any other host are dropped at search time.
- If hotlinking from a host fails in testing, show link cards for that host.

### Layouts (`lib/layout/`)

- `by_direction`: one column per section, 280 px wide, 16 px gaps
- `masonry`: 4 columns, keep aspect ratios
- `grid`: equal cells, crop with `object-fit: cover`
- `hero`: first item 2x, others in a ring below

## 10. Exports (`lib/export/`)

The server returns text; the agent writes files.

### DESIGN.md

Follows the Google Labs DESIGN.md spec (alpha). Front matter keys: `version`, `name`, `description`, `colors`, `typography`, `rounded`, `spacing`, `components`. Sections in this order when present: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts. Component properties allowed: `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`.

```markdown
---
version: alpha
name: {canvas_title}
description: {one_line_direction}
colors:
  primary: "{oklch}"
  secondary: "{oklch}"
  neutral: "{oklch}"
  surface: "{oklch}"
  on-surface: "{oklch}"
typography:
  display: { fontFamily: "{font}", fontSize: 48px, fontWeight: 700, lineHeight: 1.1 }
  body: { fontFamily: "{font}", fontSize: 16px, fontWeight: 400, lineHeight: 1.5 }
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
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 12px
---

## Overview
## Colors
## Typography
## Layout
## Elevation & Depth
## Shapes
## Components
## Do's and Don'ts
```

Only colors tagged `ship` go in the front matter. `explore` colors are listed in prose under Colors as "concept only".

### AGENTS.md

```markdown
# Design rules for coding agents

Read DESIGN.md before writing any UI. Use only its tokens.

## Ship
Tokens and components tagged `ship` passed WCAG 2.2 contrast
(SC 1.4.3 at 4.5:1 for text, SC 1.4.11 at 3:1 for UI parts). Use them in production.

## Explore only
Tokens tagged `explore` are concept material. Never use them in
production screens without a design review.

## Sources
Reference images belong to their owners. Never copy them into the repo.
```

### Others

- `tokens`: W3C DTCG JSON via the design.md CLI `export` command (dtcg target). Check exact flags with `npx @google/design.md --help`.
- `tailwind`: same CLI, tailwind target.
- `html_board`: single static HTML page laid out like the canvas, `<img>` tags pointing at sources, a Sources list at the bottom, `noindex` meta.
- `figjam_spec`: JSON `{ sections: [{ title, x, y, w, h, items: [{ type, x, y, w, h, imageUrl?, text?, hex?, sourceUrl }] }] }` for the `banana-moodboard` skill to build with the Figma MCP.
- `brief`: markdown with the brief, bend directions tried, what was kept and notes.

### Asset kit (skill-driven, no generation)

Built by the `banana-asset-kit` skill from `export_kit` output: tokens, CSS gradients from palette pairs that pass contrast, one font pairing from `lib/kit/fonts.json` (open-licence fonts only), one open icon set suggestion (Lucide or Phosphor) matched to radius and stroke. File names in English, numbered left to right, top to bottom.

## 11. Data model (`db/schema.ts`, Drizzle)

| Table | Columns | Notes |
| --- | --- | --- |
| `users` | `id`, `workos_id` (unique), `email`, `plan` (`free`, `pro_monthly`, `pro_yearly`, `founding`), `paddle_customer_id`, `created_at` | |
| `canvases` | `id`, `user_id`, `title`, `brief`, `wildness`, `lens`, `state` (jsonb: nodes + viewport), `share_token` (nullable), `updated_at` | |
| `directions` | `id`, `canvas_id`, `move`, `title`, `search_query` | Becomes a section |
| `references` | `id`, `canvas_id`, `source_site`, `source_url`, `image_url`, `thumb_url`, `title`, `width`, `height`, `created_at` | URLs only. Purge rows not placed on a canvas after 30 days (cron) |
| `palettes` | `id`, `canvas_id`, `colors` (jsonb), `contrast` (jsonb) | |
| `uploads` | `id`, `user_id`, `r2_key`, `mime`, `bytes` | User's own images |
| `usage` | `user_id`, `period` (YYYY-MM), `searches`, `canvases` | Primary key (`user_id`, `period`) |
| `takedowns` | `id`, `url_or_domain`, `reason`, `created_at` | |

Account deletion removes all rows for the user and their R2 objects.

## 12. Plans, billing and quotas

| | Free | Pro monthly | Pro yearly | Founding lifetime |
| --- | --- | --- | --- | --- |
| Price | $0 | $5/mo | $39/yr | $29 once, first 100 buyers |
| Searches per month | 30 | 300 | 300 | 200 |
| Canvases | 3 | Unlimited | Unlimited | Unlimited |
| Items per canvas | 40 | 300 | 300 | 300 |
| Share links, uploads (1 GB) | No | Yes | Yes | Yes |
| `export_kit` formats | `design_md`, `brief` | All | All | All |

Flow:

1. Client hits `/api/mcp`, gets 401 with `WWW-Authenticate` pointing to `/.well-known/oauth-protected-resource`, logs in with AuthKit. Token subject maps to `users.workos_id`; create the row on first sight.
2. Pricing page opens Paddle Checkout with `custom_data: { userId }`. Founding offer is a one-time Paddle product; stop selling at 100.
3. `/api/paddle/webhook` verifies the signature and sets `users.plan` on purchase and subscription created, updated and canceled.
4. Every limited tool checks `usage` for the current period first. Over the limit: return the plain upgrade message.
5. Hard cap the Serper key at $30 a month in the Serper dashboard.

## 13. Testing (all "Blocks" rows must pass in CI)

| Test | Checks | Tool | Blocks |
| --- | --- | --- | --- |
| Unit | Bend determinism, layout math, quota math, contrast math | Vitest | Yes |
| No-storage | Adapters and canvas save never fetch or write image bytes; `extract_palette` never writes bytes anywhere | Vitest with network and storage mocks | Yes |
| MCP contract | Every tool lists, runs, returns valid structured content | MCP Inspector + scripted client | Yes |
| Auth | 401 challenge, metadata endpoint, issuer and audience checks, web session | Playwright on a preview deploy | Yes |
| Canvas | Drag from tray, keyboard move, resize, arrange, save, reload, share link | Playwright | Yes |
| Accessibility | Canvas and site keyboard-only; axe has no serious issues | Playwright + axe | Yes |
| DESIGN.md | Every generated file passes `npx @google/design.md lint` | CLI in Vitest | Yes |
| Plugin | `claude plugin validate --strict` | CLI | Yes |
| Inline canvas | Renders in Claude and ChatGPT; allowlisted images load; others show link cards | Manual checklist per release | Yes |
| Skill evals | 20 test briefs call the right tools in a sensible order | `claude plugin eval` | No, tracked |

## 14. Repos and layout

```text
banana-server/                 (private)
  app/
    api/[transport]/route.ts          MCP endpoint
    api/canvas/[id]/route.ts          load and save canvas state
    api/paddle/webhook/route.ts
    .well-known/oauth-protected-resource/route.ts
    c/[id]/page.tsx                   full-screen canvas
    (site)/                           landing, pricing, account, takedown, terms, privacy
  canvas/            React Flow app: nodes, tray, toolbar (shared by web and inline)
  ui/canvas/         MCP Apps build of canvas/ (ui://banana/canvas)
  lib/
    auth.ts          AuthKit JWT verification (jose + JWKS)
    bend/            moves, lenses, lists, templates
    sources/         web-search, pinterest-own (stub), arena (stub)
    layout/          by_direction, masonry, grid, hero
    palette/         decode, quantize, contrast, roles
    export/          design-md, agents-md, tokens, tailwind, figjam-spec, html-board, brief
    kit/fonts.json   curated open-licence font pairings
    quota.ts
    takedown.ts
  db/schema.ts
  tests/
  DECISIONS.md
  CLAUDE.md

banana-plugin/                 (public, MIT)
  .claude-plugin/plugin.json   name, displayName, version, description, author, homepage, license,
                               privacyPolicyUrl, termsOfServiceUrl, icon
  .mcp.json                    { "mcpServers": { "banana": { "type": "http", "url": "https://<domain>/api/mcp" } } }
  skills/
    banana-explore/SKILL.md
    banana-moodboard/SKILL.md
    banana-design-md/SKILL.md
    banana-agents-md/SKILL.md
    banana-palette/SKILL.md
    banana-asset-kit/SKILL.md
  evals/
  README.md
  CLAUDE.md
```

Plugin rules: no top-level `bin/` folder (claude.ai and Cowork refuse to install plugins with one). Plugin name in kebab-case and must not start with `claude-` or `anthropic-`. Check the current `.mcp.json` shape for remote HTTP servers in the Claude Code plugin docs before publishing.

### Skills

| Skill | Triggers on | Instructions to the agent |
| --- | --- | --- |
| `banana-explore` | "go wild", "push this design", "crazy ideas for" | Run `bend_brief`, `open_canvas`, then `search_references` for 2 to 3 directions into the tray; let the user pick |
| `banana-moodboard` | "make a moodboard", "arrange this" | `add_to_canvas` + `arrange_canvas`; for Figma, `export_kit` with `figjam_spec` then build with the Figma MCP; keep source links on every tile |
| `banana-design-md` | "DESIGN.md", "design system file" | `get_canvas`, `export_kit` with `design_md`, write the file, run the lint command, fix errors |
| `banana-agents-md` | "AGENTS.md", "rules for coding agents" | `export_kit` with `agents_md`; point to DESIGN.md |
| `banana-palette` | "palette", "colors from these" | `extract_palette` with `addSwatches: true`; explain roles and WCAG results |
| `banana-asset-kit` | "asset kit", "starter kit" | `export_kit` with `tokens` and `tailwind`; add gradients, font pairing, icon set pick; English names, numbered |

## 15. Environment variables

```text
APP_NAME=Banana
APP_URL=https://<domain>
MCP_RESOURCE_URL=https://<domain>/api/mcp
WORKOS_CLIENT_ID=
WORKOS_API_KEY=
WORKOS_AUTHKIT_DOMAIN=
DATABASE_URL=                 # Neon
R2_BUCKET=                    # Workers binding name
SERPER_API_KEY=
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_PRICE_PRO_MONTHLY=
PADDLE_PRICE_PRO_YEARLY=
PADDLE_PRICE_FOUNDING=
IMAGE_HOST_ALLOWLIST=         # comma-separated hosts, see section 9
```

Never log tokens, API keys or image bytes.

## 16. Milestones

Dates are Saudi weekends (Friday and Saturday).

### M1. Setup (Oct 23 to 24)

- Next.js app on Cloudflare Workers via OpenNext, deployed to `workers.dev`
- Neon + Drizzle schema migrated (section 11)
- AuthKit: protected resource metadata, `withMcpAuth`, JWT verification, a `ping` tool
- CI: typecheck, lint, Vitest

Done when: Claude Code connects to the deployed MCP, logs in through the browser, and `ping` returns the user's email.

### M2. Bend + search (Oct 30 to 31)

- `bend_brief` with moves, wildness, lists and GCC lens presets
- `web_search` adapter + `search_references`
- Takedown list check
- Verify image CDN host names and hotlinking; set `IMAGE_HOST_ALLOWLIST`

Done when: unit tests prove bend determinism; the no-storage test passes; 10 sample briefs return at least 8 usable results each.

### M3. Palette + exports + plugin v0.1 (Nov 6 to 7)

- `extract_palette` (in-memory decode, quantize, OKLCH, contrast, roles)
- `export_kit`: `design_md`, `agents_md`, `tokens`, `tailwind`, `brief`
- Plugin repo with `banana-explore`, `banana-design-md`, `banana-palette`
- Publish plugin and server core on GitHub (MIT for plugin and MCP core)

Done when: every generated DESIGN.md passes lint; `claude plugin validate --strict` passes.

### M4. Web canvas (Nov 13 to 14)

- React Flow app at `/c/:id` with all node types, tray, toolbar, auto-save, keyboard moves, link-card fallback
- `/api/canvas/:id` load and save
- `lib/layout/` with the 4 layouts

Done when: Playwright canvas flows and axe checks pass.

### M5. Canvas in chat + canvas tools (Nov 20 to 21)

- MCP Apps build of the canvas at `ui://banana/canvas` with CSP allowlist
- `open_canvas`, `add_to_canvas`, `arrange_canvas`, `get_canvas`
- Quotas (section 12)

Done when: the inline canvas renders and saves in Claude and ChatGPT; changes made inline show on the web canvas and the reverse.

### M6. Skills + remaining exports (Nov 27 to 28)

- `figjam_spec`, `html_board` exports
- Skills: `banana-moodboard`, `banana-agents-md`, `banana-asset-kit`
- 20 eval briefs in `evals/`

Done when: evals run; a FigJam board can be built end to end from a canvas via the Figma MCP.

### M7. Billing + legal (Dec 4 to 5)

- Paddle products (monthly, yearly, founding with 100 cap), checkout, webhook
- Share links (unlisted, noindex), uploads to R2 (1 GB Pro cap)
- Pages: pricing, account (plan, delete account), takedown form, terms, privacy notice in Arabic and English

Done when: a test purchase flips the plan; account deletion removes all data and R2 objects.

### M8. Launch (Dec 11 to 12)

- Switch to Workers Paid, custom domain
- Submit the plugin to Anthropic's directory; list on MCP directories
- Landing page with one-liner, 20-second canvas video, founding offer

Done when: a new user can install the plugin, log in, make a canvas and export a DESIGN.md in under 5 minutes.

## 17. Open decisions (defaults in bold)

| Decision | Options | Default |
| --- | --- | --- |
| Final name | Keep Banana; a new name | **New name after trademark check** (keep `APP_NAME` configurable) |
| Hosting | Cloudflare Workers; Vercel | **Cloudflare Workers** |
| Auth | WorkOS AuthKit; Clerk | **WorkOS AuthKit** |
| Open-source scope | Plugin only; plugin + MCP core; everything | **Plugin + MCP core (MIT)**; canvas and hosting private |
| First v2 feature | Are.na; Pinterest own boards; co-editing | **Are.na** |

---

## CLAUDE.md starter

Copy into `banana-server/CLAUDE.md` (and adapt for `banana-plugin/`):

```markdown
# Banana server

Remote MCP server + moodboard canvas for wild design references. Full spec: banana-build-spec.md.

## Hard rules
- No AI calls from the server. No LLM, no image generation, no vision APIs.
- Never download, store or re-host third-party images. URLs and metadata only.
  extract_palette may decode thumbnails in memory; never persist bytes.
- Every reference shows its source link everywhere.
- No scraping of Pinterest, Dribbble or any site.
- Check the takedown list on every search and canvas load.
- WCAG 2.2 AA; every drag has a keyboard alternative.
- UI copy: plain words, no em dashes.

## Stack
TypeScript strict, Next.js App Router on Cloudflare Workers (OpenNext), mcp-handler,
@modelcontextprotocol/ext-apps, @xyflow/react, WorkOS AuthKit (jose), Neon + Drizzle,
R2, Serper, culori, Paddle, Vitest, Playwright, axe.

## Commands
- dev: npm run dev
- test: npm test
- e2e: npm run e2e
- typecheck: npm run typecheck
- deploy preview: npm run deploy:preview

## Working style
- One milestone at a time; meet its "Done when" list before moving on.
- Record any deviation from the spec in DECISIONS.md with the reason.
- Keep tool descriptions short and plain; they are product copy.
- Ask before changing hard rules, pricing or plan limits.
```
