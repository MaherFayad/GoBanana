---
title: attach_screenshot
description: Attach a screenshot of one X post on the board, captured by your own agent, so cut_parts and Frankenstein pages can use it. Stored as your upload.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| Pro (and every account during the beta) | Your upload space: 10 MB per image, 1 GB on Pro, 50 MB in the beta | Yes | |

An X post on the board has no image GoBanana can cut: GoBanana never fetches or captures X. Your own agent captures a screenshot of that one post with its screenshot or browser tool and passes it here. It is stored as your upload, with the same checks as the Upload button (plan, size, your storage, the file type read from the bytes), and linked to the post. Then [cut_parts](/docs/reference/tools/cut-parts/) cuts it like any image, and every part keeps the post link and the credit "Post by Name (@handle) on X".

If the agent cannot capture the post, it asks you for a screenshot. It never crawls X.

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | Yes | 1 to 100 characters | The board |
| `itemId` | string | Yes | an X post item on the board | The post the screenshot shows |
| `image` | string | Yes | base64 PNG, JPEG or WebP, up to 10 MB; a `data:image/...;base64,` prefix is fine | The screenshot |
| `sourceUrl` | string | Yes | `x.com/<handle>/status/<id>` | The post link; it must be the same post as the item |

## Example call

```json
{
  "name": "attach_screenshot",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "itemId": "xp_12",
    "image": "data:image/png;base64,iVBORw0KGgo…",
    "sourceUrl": "https://x.com/lenaui/status/1840000000000000302"
  }
}
```

## Result

```text
Attached your screenshot (1200 x 1500 px) to X post xp_12: Post by Lena Ortiz (@lenaui) on X https://x.com/lenaui/status/1840000000000000302. Next: cut_parts { cuts: [{ itemId: "xp_12", role, crop }] } with crops measured on your screenshot. Every part keeps the post link and credit.
```

A second screenshot for the same post replaces the first, and the first is deleted unless a part still uses it.

## Errors

- Not an X post item, or a different post: the message says which post the item is.
- Not PNG, JPEG or WebP (GIF too), or not base64: "image must be a base64 PNG, JPEG or WebP screenshot, up to 10 MB."
- Over 10 MB, no upload plan, or your upload space is full: the same plain messages as the Upload button.
