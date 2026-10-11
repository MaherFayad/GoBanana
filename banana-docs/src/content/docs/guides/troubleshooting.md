---
title: Troubleshooting
description: Plain fixes for the messages GoBanana sends back.
---

GoBanana never throws raw errors at your agent. It sends back a short message. Find yours below.

## "You are not signed in. Reconnect to sign in again."

Your sign-in expired or never finished.

- **Claude Code:** run `/mcp`, pick the GoBanana server and log in again.
- **Claude apps, ChatGPT, Cursor:** reconnect the GoBanana connector and sign in when asked.

Then run [`ping`](/docs/reference/tools/ping/). It should reply with your email.

## "That canvas was not found."

The `canvasId` is wrong, or the canvas belongs to another account. Ask your agent to list your recent canvases with [`get_canvas`](/docs/reference/tools/get-canvas/), then use one of those ids. Or open a new canvas.

Make sure you are signed in with the same account you use on the web.

## "The canvas changed while saving. Try again."

Two changes reached the canvas at the same time. Run the same request again.

## "Something went wrong on our side. Try again in a minute."

A short outage. Wait a minute and try again.

## Limit messages

| Message starts with | What to do |
| --- | --- |
| "You have used your 30 free searches this month." | Upgrade, or wait for the reset on the 1st of the month (UTC). |
| "You have used your 3 free canvases." | Upgrade, or add to one of your canvases. |
| "This canvas has reached the 40 item limit on the free plan." | Upgrade, remove items, or start a new canvas. |
| "These formats need Pro:" | The free formats still export. Upgrade for the rest. |

The plugin's skills show the upgrade message once and stop. They never retry in a loop. See [Plans and limits](/docs/reference/plans/).

## The canvas does not show inline

Some clients cannot show the canvas in the chat. Every reply that touches a canvas includes its web link. Open it to see the board full screen.

## A reference image does not load

Images load from their source site. If the source blocks it or the image is gone, the canvas shows a link card with the title, the source site and the link.

## A palette skipped some images

[`extract_palette`](/docs/reference/tools/extract-palette/) lists each skipped item with a reason. Common ones: the image host is not on the allowlist, the image is too large, or its format, for example WebP, is not supported yet. Pick other image items and run it again.

## The plugin's server is missing in Claude Code

The plugin's server key was renamed from `banana` to `gobanana`. Reinstall the plugin, then run `/mcp`.

## Still stuck

Check that the server address is exactly:

```text
https://gobanana-server.maherfayad55.workers.dev/api/mcp
```
