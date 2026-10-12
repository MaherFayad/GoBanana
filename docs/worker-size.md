# Worker size (Cloudflare Workers Free)

Workers Free rejects a Worker upload over **3 MiB gzipped**. The owner chose to stay on
Free, so the Worker has a CI budget of **2.9 MiB** (`npm run worker:size -- --max-mb 2.9`
in `.github/workflows/ci.yml`) and a working target of **2.7 MiB** or less.

| | gzipped | raw |
| --- | --- | --- |
| Before (2026-10-11, commit d7702e4) | 4.20 MiB (wrangler: 4299 KiB) | 18.8 MiB |
| After | **2.61 MiB** (wrangler: about 2.6 MiB) | 9.2 MiB |
| 2026-10-12, d8c7ece, measured on Windows | 3.39 MiB | 11.4 MiB |
| 2026-10-12, site/desktop-redesign before the fixes below (ce277b0) | 3.47 MiB | 11.4 MiB |
| 2026-10-12, after the fixes below | **2.68 MiB** | 9.45 MiB |

Headroom after the cuts: about 0.09 MiB to the 2.7 target, 0.29 MiB to the CI budget,
0.39 MiB to the hard limit. The "after" build already includes the restyle work in
progress on 2026-10-11 (about +0.02 MiB).

### 2026-10-12: growth to 3.47 MiB and back

- **@vercel/og again, Windows only (about 0.53 MiB).** `scripts/patch-opennext.mjs` aliased
  the edge entry to `new URL(...).pathname`, which is `/C:/...` on Windows. esbuild could not
  use it, left the `import()` in place, and wrangler then bundled `@vercel/og` with
  `resvg.wasm` and `yoga.wasm`. Builds on Linux CI were not affected, so d8c7ece already
  measured 3.39 MiB on Windows. The patch drops the leading slash on win32 and upgrades a
  copy patched by the old version.
- **Landing motion libraries in the server bundle (about 56 KiB).** `StoryMotion.tsx` and
  `StoryStage.tsx` load `story-motion.ts` (GSAP, Lenis), `stage-scene.ts` (ogl) and
  `trail.ts` with `import()` inside effects, but Turbopack still compiles dynamic imports of
  client components into SSR chunks. The loaders are now
  `typeof window === "undefined" ? null : () => import(...)`; Next folds `typeof window` to
  `"undefined"` in the server build, so the imports are dropped there.
- **A second copy of `yaml` and lib/export (about 50 KiB).** The landing page ran the real
  exporters at render time for the export fan, so its chunk carried its own copy next to
  the MCP route's. It now imports `lib/site/kit-preview.json` (the first 12 lines of the
  five files), made by `kitPreview()` in lib/site/export-demo.ts;
  `tests/site-showcase.test.ts` fails when the JSON is stale
  (`UPDATE_KIT_PREVIEW=1 npx vitest run tests/site-showcase.test.ts` rewrites it).

## How to measure

```sh
npx opennextjs-cloudflare build      # runs build:ui and next build first
npm run worker:size                  # wrangler deploy --dry-run, gzips the output
npm run worker:breakdown             # which packages the size is made of
```

`worker:breakdown` (scripts/worker-breakdown.mjs) splits the two OpenNext bundles back
into source modules: the server bundle through esbuild's metafile and the Turbopack
chunk source maps in `.next/server/chunks`, the middleware bundle (proxy.ts) on esbuild's
`// path` comments. Each slice is gzipped on its own and summed per package. The numbers
are estimates taken before wrangler minifies the bundle, so they add up to a bit more
than the real size, but the ranking is right. Code that Turbopack copies into several
chunks is counted once per copy, because it is uploaded once per copy.

## Cuts (in order, re-measured after each)

| Cut | Saving (gzipped) | Where |
| --- | --- | --- |
| Wrangler minifies the final bundle (`"minify": true`). OpenNext keeps identifiers and leaves the whole middleware bundle unminified, and wrangler re-printed it. | 0.48 MiB | wrangler.jsonc |
| `@vercel/og` out of the middleware bundle. OpenNext 1.20.10 adds an `@vercel/og` import case to every Turbopack runtime and only shims it for the server bundle, so proxy.ts shipped the library plus `resvg.wasm` and `yoga.wasm`. A postinstall patch adds the same throwing shim to the middleware build. | about 0.67 MiB | scripts/patch-opennext.mjs, package.json `postinstall` |
| Inline MCP Apps canvas HTML served as a static asset (`public/mcp-app/canvas.html`, read through the `ASSETS` binding and cached per isolate) instead of a 760 KB string module. | about 0.22 MiB | lib/mcp/resources/canvas.ts, ui/canvas/vite.config.ts |
| `zod` in `serverExternalPackages`. Turbopack bundled its own zod (every locale included, since `z` is a namespace object) next to the copy the MCP SDK brings into OpenNext's esbuild bundle. Now both use the esbuild copy. | 0.23 MiB | next.config.ts |

The first three were measured together in one build (4.20 to 2.82 MiB); the split between
`@vercel/og` and the canvas HTML is from the breakdown.

## Top 25 contributors

Estimates from `npm run worker:breakdown`, KiB gzipped (before wrangler minifies).
"S" is the server bundle, "M" the middleware bundle (proxy.ts).

| # | Before | KiB | | After | KiB |
| --- | --- | --- | --- | --- | --- |
| 1 | next/dist/compiled/next-server (app-page runtime, S+M) | 566 | | next/dist/compiled/next-server (S+M) | 565 |
| 2 | resvg.wasm + yoga.wasm (@vercel/og, M) | 557 | | next/dist/server (S+M) | 185 |
| 3 | zod (two copies, all locales, S) | 302 | | @workos-inc/node (4 copies, S+M) | 159 |
| 4 | app: lib/mcp (canvas HTML string, S) | 231 | | next/src/server (S+M) | 156 |
| 5 | next/dist/server (S+M) | 183 | | zod (one copy, S) | 154 |
| 6 | next/dist/compiled/@vercel/og JS (M) | 167 | | @neondatabase/serverless (S, plus custom-worker) | 130 |
| 7 | @workos-inc/node (S+M) | 159 | | next/dist/esm (S+M) | 128 |
| 8 | next/src/server (S+M) | 156 | | jose (S+M) | 121 |
| 9 | @neondatabase/serverless (S) | 130 | | next/dist/compiled/jsonwebtoken (S+M) | 81 |
| 10 | next/dist/esm (S+M) | 126 | | @modelcontextprotocol/server (S) | 74 |
| 11 | jose (S+M) | 121 | | drizzle-orm (S) | 70 |
| 12 | next/dist/compiled/jsonwebtoken (S+M) | 81 | | next/src/client (S+M) | 59 |
| 13 | @modelcontextprotocol/server (S) | 74 | | next/dist/compiled/@opentelemetry (S+M) | 47 |
| 14 | drizzle-orm (S) | 66 | | next/src/build (S+M) | 45 |
| 15 | next/src/client (S+M) | 57 | | next/dist/shared (S+M) | 44 |
| 16 | next/dist/compiled/@opentelemetry (S+M) | 47 | | next/dist/compiled/ua-parser-js (S+M) | 44 |
| 17 | next/src/build (S+M) | 45 | | @workos-inc/authkit-nextjs (S+M) | 41 |
| 18 | next/dist/compiled/ua-parser-js (S+M) | 44 | | react-dom (S) | 39 |
| 19 | next/dist/shared (S+M) | 44 | | @opennextjs/aws (M) | 34 |
| 20 | @workos-inc/authkit-nextjs (S+M) | 41 | | yaml (S) | 33 |
| 21 | react-dom (S) | 39 | | next/dist/compiled/@edge-runtime (S+M) | 30 |
| 22 | (Turbopack chunk glue) | 36 | | next/src/shared (S+M) | 29 |
| 23 | @opennextjs/aws (M) | 34 | | (Turbopack chunk glue) | 29 |
| 24 | yaml (S) | 33 | | culori (S) | 28 |
| 25 | next/dist/compiled/@edge-runtime (S+M) | 30 | | next/src/lib (S+M) | 24 |

## Checked and left alone

- **MCP SDK JSON Schema validator.** `@modelcontextprotocol/server` 2.3.1 already uses
  its `cfWorkerProvider` on Workers (the `workerd` condition picks `shimsWorkerd`); Ajv
  is not in the bundle.
- **@workos-inc/node.** Our code does not import it (the email lookup in lib/users.ts is a
  plain `fetch`). It comes in through `@workos-inc/authkit-nextjs` (web sign-in), which
  needs it for `getWorkOS()`, `handleAuth()` and session refresh, so it stays while
  AuthKit stays. Turbopack copies it into each server layer that uses AuthKit (3 copies)
  plus the middleware. Putting `@workos-inc/node` in `serverExternalPackages` would keep
  one server copy (about 0.1 MiB less) but switches it to the package's `workerd` entry
  (a different HTTP client and crypto provider), so it needs a real sign-in test first.
- **Next.js runtimes.** `app-page-turbo.runtime.prod.js` is in both bundles: proxy.ts
  pulls it in through `next/headers` and `next/navigation` (AuthKit). It is about 0.25
  MiB of the middleware. Removing it means a proxy that does not import AuthKit, which
  changes how web sessions refresh. Not done.
- **zod locales.** The single esbuild copy still holds every locale (about 0.3 MB raw),
  because Turbopack loads external packages with a dynamic `import()`, which esbuild
  cannot tree-shake. `zod/mini` is not a drop-in for our schemas.
- **culori.** `culori/fn` needs every mode registered by hand to keep `parse()` accepting
  the same inputs; that leaves little to save (about 28 KiB in total).
- **Source maps, image optimizer, caches.** No `.map` files are uploaded, images are
  `unoptimized`, and the incremental cache, queue and tag cache are OpenNext's dummy
  defaults (nothing bundled).

## Fonts for the inline canvas (restyle)

Font files must not be inlined into the HTML or the Worker. The setup is ready:

1. Import the fonts in the inline canvas code as usual (for example
   `@fontsource-variable/inter/wght.css` and the `@fontsource/ibm-plex-sans-arabic`
   weights that are used). `npm run build:ui` keeps `.woff2`/`.woff`/`.ttf`/`.otf` files out
   of the HTML, writes them to `public/mcp-app/assets/`, and points the CSS at
   `__BANANA_APP_ORIGIN__/mcp-app/assets/<file>`.
2. `lib/mcp/resources/canvas.ts` replaces `__BANANA_APP_ORIGIN__` with APP_URL's origin
   when it serves `ui://banana/canvas`, and adds that origin to
   `_meta.ui.csp.resourceDomains`.
3. `public/_headers` sends `Access-Control-Allow-Origin: *` for `/mcp-app/assets/*`,
   because the view runs on the host's sandbox origin and fonts load in CORS mode.

If APP_URL is not set, the font URLs become relative and the view falls back to system
fonts. Import only the subsets the canvas needs (for example latin and arabic), so the
host does not download unused files.
