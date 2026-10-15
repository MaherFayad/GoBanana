---
title: Plans and limits
description: Every limit per plan, which export needs Pro, the exact limit messages, and when quotas reset. From banana-server/lib/quota.ts and lib/billing/plans.ts.
---

## Limits per plan

| | Free | Pro monthly | Pro yearly | Founding |
| --- | --- | --- | --- | --- |
| Price | $0 | $5 a month | $39 a year | $29 once |
| Searches a month | 30 | 300 | 300 | 200 |
| Canvases you own | 3 | Unlimited | Unlimited | Unlimited |
| Items per canvas | 40 | 300 | 300 | 300 |
| Share links | No | Yes | Yes | Yes |
| Uploads to your canvases | No | 1 GB | 1 GB | 1 GB |
| Export formats | 5 free formats | All 15 | All 15 | All 15 |

GoBanana is for individuals: there are no team plans. Prices are in US dollars. Paddle is the reseller and Merchant of Record: it handles payment, sales tax or VAT, invoices and refunds. Pro yearly saves about 35% against 12 monthly payments. The Founding plan is for the first 100 buyers.

:::tip[Beta]
Payments are off during the beta. Every signed in account gets Pro monthly limits (300 searches, unlimited canvases, all exports) and nothing is charged.
:::

## Export formats by plan

| Format | File | Free | Pro |
| --- | --- | --- | --- |
| `design_md` | DESIGN.md | Yes | Yes |
| `brief` | BRIEF.md | Yes | Yes |
| `direction_md` | DIRECTION.md | Yes | Yes |
| `build_prompt` | BUILD-PROMPT.md | Yes | Yes |
| `stitch_md` | FRANKENSTEIN.md | Yes | Yes |
| `culture_md` | CULTURE.md | Yes | Yes |
| `claude_settings` | `.claude/settings.json` keys | Yes | Yes |
| `review` | REVIEW.md | No | Yes |
| `cursor_rules` | `.cursor/rules/gobanana-<slug>.mdc` | No | Yes |
| `copilot` | `.github/instructions/gobanana-<slug>.instructions.md` | No | Yes |
| `agents_md` | AGENTS.md section | No | Yes |
| `claude_md` | CLAUDE.md section | No | Yes |
| `tokens` | `kit/tokens.json` | No | Yes |
| `tailwind` | `kit/theme.css` | No | Yes |
| `figjam_spec` | `figjam-spec.json` | No | Yes |
| `html_board` | `board.html` | No | Yes |
| `wireframe_html` | `frankenstein-wireframe.html` | No | Yes |

Paths and contents: [Export formats](/docs/reference/exports/). The repo notes that `wireframe_html` being Pro is still for the owner to confirm.

## What counts

- **A search** is one `search_references` call, whatever it returns and however many lanes it runs. Lane retries are separate calls, so each counts.
- **A canvas** is one you own. Deleting a canvas frees its slot.
- **Items** are the nodes on a board: references, notes, swatches, sections and Frankenstein page frames (one frame counts as one item). Tray results do not count. A batch that would cross the cap is refused whole.
- **Uploads** are images you add to your own canvases on the web: PNG, JPEG, WebP or GIF, up to 10 MB each, within your plan's storage.

## When limits reset

Searches reset on the 1st of each month at 00:00 UTC. Canvases and items do not reset; they free up when you delete.

## The messages

The tools never throw raw errors. At a limit they return one of these, with the pricing link:

| Message | When |
| --- | --- |
| "You have used your 30 free searches this month. Upgrade: …" | Free plan, search quota used |
| "You have used your 300 searches this month. They reset on November 1." | Paid plan, search quota used |
| "You have used your 3 free canvases. Upgrade for unlimited canvases: …" | Free plan, `new_canvas` or `open_canvas` without an id |
| "This canvas has reached the 40 item limit on the free plan. Upgrade: …" | Free plan, `add_to_canvas` or a Frankenstein page would cross 40 |
| "This canvas has reached the 300 item limit. Remove some items or start a new canvas." | Paid plan, 300 items |
| "These formats need Pro: review, cursor_rules. Upgrade: …" | `export_kit` with Pro formats on Free. The free formats still export in the same call |

The plugin's skills show the message once and stop. They never loop.

## Cancelling and refunds

A subscription can be cancelled at any time and stays active to the end of the paid period, then the account returns to Free. You can get a full refund within 14 days of your first payment. Refunds and billing questions are handled by Paddle, the payment provider. Prices may change for new purchases; subscribers get at least 30 days notice. See the [terms](https://gobanana-server.maherfayad55.workers.dev/en/terms#plans).
