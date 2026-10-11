---
title: Plans and limits
description: What Free, Pro and Founding include, and what happens when you reach a limit.
---

:::note[Pro for everyone during the beta]
Payments are off. Every signed-in account gets Pro limits, and nothing is charged.
:::

## Compare plans

<div class="gb-table">

| | Free | Pro monthly | Pro yearly | Founding |
| --- | --- | --- | --- | --- |
| Price | $0 | $5 per month | $39 per year | $29 once, first 100 buyers |
| Searches per month | 30 | 300 | 300 | 200 |
| Canvases | 3 | Unlimited | Unlimited | Unlimited |
| Items per canvas | 40 | 300 | 300 | 300 |
| Share links, uploads (1 GB) | No | Yes | Yes | Yes |
| Export formats | DESIGN.md, brief | All | All | All |

</div>

Pro yearly saves 35% compared with 12 monthly payments.

See the live prices on the [pricing page](https://gobanana-server.maherfayad55.workers.dev/en/pricing).

## What is always free

- [`bend_brief`](/docs/reference/tools/bend-brief/), with no monthly limit.
- Rating directions and references.
- Palettes, layouts and reading a canvas.

## How limits count

- **Searches.** One call to `search_references` is one search, however many lanes it runs. Searches reset on the 1st of each month (UTC).
- **Canvases.** Every canvas you own counts. Creating one with `new_canvas`, or `open_canvas` without an id, uses one.
- **Items.** References, notes, swatches and sections on one canvas. An `add_to_canvas` call that would go over the limit adds nothing.

## When you reach a limit

The tool replies with one plain message and a link to the plans. For example:

```text
You have used your 30 free searches this month. Upgrade: <link>
```

The plugin's skills show that message once and stop. They never retry in a loop.

## Billing

Paddle handles payments as the reseller and Merchant of Record. Paddle adds sales tax or VAT where needed and sends your invoices. A subscription can be cancelled at any time and stays active until the end of the paid period.
