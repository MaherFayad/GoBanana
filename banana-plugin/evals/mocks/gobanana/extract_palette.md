---
expect:
  canvasId: string
  itemIds: array
---

Palette (6 colors):
1. #1F2A44 oklch(0.288 0.050 265.9) role: primary
2. #C8553D oklch(0.593 0.152 33.4) role: secondary
3. #8A8F98 oklch(0.649 0.015 262.4) role: neutral
4. #F4F1EA oklch(0.959 0.010 87.5) role: surface
5. #1A1C2E oklch(0.234 0.035 278.5) role: on-surface
6. #E8D9C4 oklch(0.892 0.033 76.4) role: surface-alt
Contrast (text needs 4.5:1, SC 1.4.3; UI parts need 3:1, SC 1.4.11):
- #1A1C2E on #F4F1EA: 14.90:1, text pass, UI pass, tag ship
- #1F2A44 on #F4F1EA: 12.64:1, text pass, UI pass, tag ship
- #F4F1EA on #1F2A44: 12.64:1, text pass, UI pass, tag ship
- #1A1C2E on #E8D9C4: 12.13:1, text pass, UI pass, tag ship
- #1F2A44 on #E8D9C4: 10.29:1, text pass, UI pass, tag ship
- #8A8F98 on #1A1C2E: 5.17:1, text pass, UI pass, tag ship
- #C8553D on #F4F1EA: 3.86:1, text fail, UI pass, tag explore
- #8A8F98 on #F4F1EA: 2.88:1, text fail, UI fail, tag explore

Swatches added to the canvas when addSwatches is true.
