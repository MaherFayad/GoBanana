# Decisions

Deviations from `docs/banana-build-spec.md` and library choices, newest last.

| Date | Area | Decision | Why |
| --- | --- | --- | --- |
| 2026-10-11 | Repo | One GitHub repo (`GoBanana`) with `banana-server/` and `banana-plugin/` folders instead of two repos. | Owner started in a single repo. Folders match the spec names so they can split out later without moves inside each folder. |
| 2026-10-11 | MCP | `mcp-handler` 2.x renamed `createMcpHandler` to `createMcpRouteHandler` and now builds on `@modelcontextprotocol/server` 2.x (split SDK). Spec example uses the 1.x names. | Follow current library docs (spec rule 4). |
| 2026-10-11 | Tooling | TypeScript pinned to 5.9.3, not 7.x. | Next.js 16 type plugin and many tools still target the 5.x compiler API. |
| 2026-10-11 | Milestones | M1 infra code is written, but its "Done when" (live deploy + AuthKit login) needs owner credentials. Pure library work from M2 to M4 (bend engine, sources, layout, palette math, exports) was built in parallel because it has no dependency on M1 infra. | Unblocks progress while credentials are pending. Nothing is wired to production until M1 is verified. |
