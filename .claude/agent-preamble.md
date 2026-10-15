# Shared rules for GoBanana all-phases agents (2026-10-15)

- **Plan and hard rules.** The plan is docs/next-step-plan.md. Read section 0, section 2, and the sections for your tasks. Also read banana-server/CLAUDE.md, the last rows of banana-server/DECISIONS.md (the owner answered D1 to D10), banana-plugin/DECISIONS.md and banana-plugin/.claude/CLAUDE.md. Their hard rules win.
- **Base branch.** Phase 0 is merged on next/phase-0, and next/phase-1 is based on it. Before anything else, run `git merge next/phase-1` in your worktree so you have the latest base.
- **Branch and commits.** Work in your worktree on the branch named in your task. Make one commit per task, with the task id in the title. End each commit message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Checks.** After each task, run `npm run typecheck && npm run lint && npm test` from banana-server/ (run `npm ci` first if node_modules is missing). For UI tasks, also run the relevant Playwright specs. Run `npm run worker:size` for server changes.
- **Records.** Append a row to DECISIONS.md for every behavior change. When a tool's behavior changes, update the skills and eval mocks in banana-plugin in the same task. Add docs pages in banana-docs, in both en and ar (Arabic in white Saudi dialect, no tashkeel), when users see the change.
- **Writing.** No em dashes anywhere. Plain words. Logical CSS properties, tokens only, WCAG 2.2 AA, and a keyboard path for every drag.
- **Database migrations.** Use only the migration number given in your task. Hand-write `db/migrations/<NNNN>_<name>.sql` and add the `_journal.json` entry. Skip the drizzle snapshot; the orchestrator regenerates it at merge. Never run migrations against Neon.
- **Never:** push, deploy, upload to R2, change live Cloudflare or WorkOS settings, or print secrets. Secrets are in C:\Users\Admin\Documents\GitHub\Gobanana\banana-server\.dev.vars and C:\Users\Admin\Documents\GitHub\Gobanana\atlas-build\.env; read them into the environment, never echo them.
- **Pause check.** Before each task, and every ~30 minutes during long jobs, check whether the file C:\Users\Admin\Documents\GitHub\Gobanana\.claude\.pause exists. If it does, commit a wip checkpoint (title starts with "wip:") and stop, reporting where you are.
- **Checkpoints.** Commit at least every ~30 minutes, so a fresh agent can resume from your branch.
- **Final report, short:** the commits, the Done-when evidence, owner actions, anything skipped or blocked, and the files touched.
