---
title: Privacy, takedown and source rules
description: A plain summary of how GoBanana treats your data, other people's images and takedown requests, with links to the full legal pages.
---

:::note[Summary, not the contract]
This page summarizes. The binding texts are the [privacy notice](https://gobanana-server.maherfayad55.workers.dev/en/privacy), the [terms of service](https://gobanana-server.maherfayad55.workers.dev/en/terms) and the [takedown page](https://gobanana-server.maherfayad55.workers.dev/en/takedown). Both legal texts are marked as drafts that still need legal review before launch.
:::

## Source rules

1. **Links, never copies.** GoBanana never downloads, stores or re-hosts images found on other sites. It keeps the URL, the source page, the title, the size and the site.
2. **Source link everywhere.** On the canvas, in share links, in every export and in every skill reply.
3. **Parts are crops in the browser.** Frankenstein it never cuts or saves pieces of an image.
4. **No scraping.** References come from web image search results only, one `site:` scoped request per source.
5. **Never in your repo.** The skills will not copy reference images into your project, and the files they write tell coding agents not to either.
6. **Mobbin stays on your side.** Your own Mobbin connector, links only, never sent to GoBanana.
7. **Palettes in memory.** Thumbnails are read for a moment to compute colors, then dropped.
8. **No referrer.** Board images load with no referrer, so source sites do not see which board showed them.

## Takedowns

If a reference links to your work and you want it removed from GoBanana:

1. Send the form at [/en/takedown](https://gobanana-server.maherfayad55.workers.dev/en/takedown). An email confirms it arrived.
2. Each request is reviewed, usually within 5 working days. A request alone blocks nothing.
3. If approved, the link or the whole domain is blocked **everywhere**: search results, every board and every shared board, from the next load.

The image itself stays on the site that hosts it; GoBanana never had a copy. If the takedown list cannot be loaded, searches and boards fail closed: they show nothing they could not check.

## Your data

| What | Why | How long |
| --- | --- | --- |
| Email and WorkOS user id | Your account | While the account is open |
| Boards: titles, briefs, notes, layout, palettes, reference links and titles | The service | While the account is open |
| Uploads (Pro) | Your own images on your boards | While the account is open |
| Search and canvas counts | Plan limits | While the account is open |
| Ratings and blocklist | Better searches for you | While the account is open; old feedback is purged on a schedule |
| References found but never placed | The tray | Deleted after 30 days |
| Plan and Paddle customer id | Billing | Paddle keeps billing records as tax law requires |
| Takedown requests | Handling them | While the block applies, and up to the period in the privacy notice |

- No data is sold, used for advertising, or used to train AI models.
- GoBanana makes no AI calls. Your agent receives each tool result under its own privacy policy.
- Providers: Cloudflare (hosting, uploads), Neon (database), WorkOS (sign in), Paddle (payments), Serper (web image search, gets search terms only).
- Only cookies needed to sign in and to check out. No ad cookies.
- Not meant for people under 18.

## Your rights

Access, correction and deletion of your data. Delete your account any time at `/en/account`. For other requests, use the contact in the [privacy notice](https://gobanana-server.maherfayad55.workers.dev/en/privacy); replies within 30 days.

## Share links

Pro share links are unlisted and view only. Search engines are told not to index them, but anyone with the link can see the board (never the tray). Turn a link off or replace it any time.
