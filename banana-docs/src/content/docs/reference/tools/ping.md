---
title: ping
description: Check that GoBanana is connected and see which account you are signed in with.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All | None | No | read only, idempotent |

## Inputs

None.

## Example call

```json
{ "name": "ping", "arguments": {} }
```

## Example output

```text
Connected to GoBanana as you@example.com.
```

```json title="structuredContent"
{ "ok": true, "app": "GoBanana", "email": "you@example.com" }
```

## Messages

| Message | Meaning |
| --- | --- |
| "You are not signed in. Reconnect to sign in again." | No valid token. Sign in again in your client |
| "You are signed in, but GoBanana could not load your email yet. Try again in a minute." | First sign in worked; the email lookup did not finish |

See [Check it works](/docs/setup/check/).
