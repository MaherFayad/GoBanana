# Decisions

Deviations from `banana-build-spec.md` for the plugin, with the reason. Checked against Claude Code 2.1.296 and the plugin docs at code.claude.com on 2026-10-11.

## 2026-10-11: CLAUDE.md lives in `.claude/`, not the plugin root

Spec section 14 puts `CLAUDE.md` at the root of `banana-plugin/`. A root `CLAUDE.md` is never loaded for plugin users, and `claude plugin validate --strict` fails on it ("CLAUDE.md at the plugin root is not loaded as project context"). Claude Code also reads `.claude/CLAUDE.md` as project memory, so contributor notes moved there.

## 2026-10-11: plugin.json fields

All fields the spec lists are valid: `name`, `displayName`, `version`, `description`, `author`, `homepage`, `license`, `privacyPolicyUrl`, `termsOfServiceUrl`, `icon`. The last three are directory listing fields that Claude Code ignores at load time; they need Claude Code 2.1.281 or later to pass `--strict`, and `icon` is a path to an image inside the plugin (`./assets/icon.png`), not a URL. Added `documentationUrl`, `supportUrl` and `keywords` for the directory listing. `author` is an object (`name`, optional `url`).

## 2026-10-11: skill frontmatter is `name` and `description` only

Claude Code accepts more keys (`when_to_use`, `allowed-tools` and others), but claude.ai and Cowork reject unknown keys. Trigger phrases go in `description`.

## 2026-10-11: evals use the `claude plugin eval` case format

20 cases in `evals/<case>/prompt.md` + `graders/*.md`, with suite-wide MCP mocks in `evals/mocks/banana/`. `_tools.json` mirrors spec section 6 so mocked tools carry real descriptions and input schemas.

## 2026-10-11: font list follows the server

`banana-asset-kit` lists the pairings from `banana-server/lib/kit/fonts.json` (all OFL-1.1). Keep the two in sync.

## 2026-10-11: DESIGN.md lint pinned to 0.4.0

Skills run `npx --yes @google/design.md@0.4.0 lint DESIGN.md`, the version the server pins.
