#!/usr/bin/env bash
set -euo pipefail
mkdir -p .cursor/rules app/checkout
cat > AGENTS.md <<'MD'
# Agent rules

KEEP-AGENTS-MARKER: use pnpm, run the tests before every commit.
MD
cat > CLAUDE.md <<'MD'
# Project notes

KEEP-CLAUDE-MARKER: the API lives in server/.
MD
cat > .cursor/rules/base.mdc <<'MD'
---
description: Base rules
alwaysApply: true
---
Use TypeScript strict.
MD
echo 'export default function Checkout() { return null; }' > app/checkout/page.tsx
