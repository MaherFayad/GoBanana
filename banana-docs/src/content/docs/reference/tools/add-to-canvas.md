---
title: add_to_canvas
description: Place references (with a steal note), notes, color swatches and sections on a board. Direction results go to their direction's section, art above UI.
---

| Plan | Quota | Changes data | Hints |
| --- | --- | --- | --- |
| All. Free boards hold 40 items, Pro 300 | Item cap per board | Yes | |

## Inputs

| Name | Type | Required | Limits | What it does |
| --- | --- | --- | --- | --- |
| `canvasId` | string | Yes | 1 to 100 characters | The board |
| `items` | object[] | Yes | 1 to 50 per call | What to place, see below |
| `sectionId` | string | No | 1 to 120 characters | Put the items in this section |

### Item types

| `type` | Fields | Notes |
| --- | --- | --- |
| `reference` | `referenceId` (required), `note` (1 to 280 characters) | A search result from the tray. The note says what to steal: start it with `steal:` |
| `note` | `text` (1 to 2000 characters) | A yellow note. Links are clickable. Caps labels like `WILD:` show as chips |
| `swatch` | `hex` (`#abc` or `#aabbcc`), `role` (up to 60 characters) | A color swatch, tagged `explore` until a contrast check says otherwise |
| `section` | `title` (1 to 120 characters), `directionId` | A frame that groups items |

## Placement rules

- A reference found for a direction goes to that direction's section. If there is none yet, it is created.
- In a direction section, **art** zone items sit in a labelled **Art direction** row above the **UI references** grid. The zone comes with the reference.
- A batch that would cross the item cap is refused whole.
- Never place results rated `bad`; they have left the tray anyway.

## Example call

```json
{
  "name": "add_to_canvas",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "sectionId": "sec_cereal",
    "items": [
      { "type": "note", "text": "WILD: giant sparklines everywhere. PATTERN: a loud front panel with a puzzle panel on the side. SIGNATURE: the hero built like a cereal box." },
      { "type": "reference", "referenceId": "ref_3m7k", "note": "steal: the side panel puzzle as the section divider" },
      { "type": "reference", "referenceId": "ref_8k2p", "note": "steal: the oversized product shot cropped by the fold" }
    ]
  }
}
```

## Example output

```text
Added 3 items to "Coffee launch page".
- note it_41 at (120, 96) in section sec_cereal
- image it_42 at (120, 300) in section sec_cereal
- image it_43 at (440, 640) in section sec_cereal
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-…
```

Skipped items are listed with a reason, for example a `referenceId` that is not in the tray.

## Messages

| Message | Fix |
| --- | --- |
| "This canvas has reached the 40 item limit on the free plan. Upgrade: …" | Remove items, new board, or upgrade |
| "That section was not found on this canvas. Call get_canvas to see section ids." | Use a current `sectionId` |
| "items must be a list of 1 to 50 items…" | Check the item shapes above |

Next: [`arrange_canvas`](/docs/reference/tools/arrange-canvas/).
