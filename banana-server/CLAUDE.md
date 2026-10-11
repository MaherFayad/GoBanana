# Banana server

Remote MCP server + moodboard canvas for wild design references. Full spec: ../docs/banana-build-spec.md.

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
TypeScript strict, Next.js 16 App Router on Cloudflare Workers (OpenNext), mcp-handler v2
(@modelcontextprotocol/server v2), @modelcontextprotocol/ext-apps, @xyflow/react,
WorkOS AuthKit (jose), Neon + Drizzle, R2, Serper, culori, Paddle, Vitest, Playwright, axe.

## Layout contract
- `APP_NAME` lives only in `lib/config.ts`. Never hardcode "Banana" in UI copy.
- Each MCP tool: one file in `lib/mcp/tools/<tool>.ts` exporting `register: RegisterTool`
  (see `lib/mcp/tools/types.ts`), listed in `lib/mcp/tools/index.ts`.
- Feature logic stays in `lib/<feature>/` and is pure where possible, so Vitest can cover it
  without network, DB or Workers bindings.
- Tests: `tests/**/*.test.ts` or colocated `lib/**/*.test.ts`.

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
