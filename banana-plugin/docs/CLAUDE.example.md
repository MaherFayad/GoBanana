# CLAUDE.md section

What `gobanana-handoff` adds to a project's `CLAUDE.md` (format `claude_md`). It sits between markers, so the rest of your CLAUDE.md stays as it is. If your CLAUDE.md already imports AGENTS.md with `@AGENTS.md`, the AGENTS.md section is enough.

```markdown
<!-- gobanana:frosted-sleeve -->
## Wild page: Frosted sleeve (GoBanana)

Applies only to `app/checkout/**`. Inherits our design system. Does not change it.

When you work on these files:
- Read @design/explorations/frosted-sleeve/DIRECTION.md first.
- Use the token overrides in design/explorations/frosted-sleeve/DESIGN.md for these pages only.
- Only `ship` colors carry text. `explore` colors are concept only.
- Do not edit shared components, global CSS or tokens for this page. Make page-local variants.
- Never copy reference images into the repo.
- When done, grade the page against design/explorations/frosted-sleeve/REVIEW.md (gobanana-critique).
<!-- /gobanana:frosted-sleeve -->
```
