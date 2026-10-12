# AGENTS.md

Template for a project that uses GoBanana. Copy it to your project root as `AGENTS.md`, or let `gobanana-handoff` add the GoBanana section to the AGENTS.md you already have. Everything outside the markers is yours.

## Project rules

- Build UI with the components in `src/components/ui` and the tokens in `src/styles/tokens.css`.
- Follow `DESIGN.md` at the root for every page not listed below.

<!-- gobanana:frosted-sleeve -->
## Wild page: Frosted sleeve (GoBanana)

Applies only to: `app/checkout/**`. Inherits the project's design system. Does not change it.

- Read `design/explorations/frosted-sleeve/DIRECTION.md` before editing these files. It holds the pattern, the signature component, type, color, layout and motion.
- Token overrides for these pages: `design/explorations/frosted-sleeve/DESIGN.md`. Do not move them into the global tokens.
- Colors tagged `ship` passed WCAG 2.2 contrast (SC 1.4.3 at 4.5:1 for text, SC 1.4.11 at 3:1 for UI parts). Colors tagged `explore` are concept only: never put text on them.
- Keep shared components unchanged. Make page-local variants inside `app/checkout/`.
- Respect `prefers-reduced-motion`.
- Reference images belong to their owners. Never copy them into the repo; link to the source.
- Done when every item in `design/explorations/frosted-sleeve/REVIEW.md` passes.
<!-- /gobanana:frosted-sleeve -->
