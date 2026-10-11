---
title: add_to_canvas
description: "يضع عناصر على اللوحة: مراجع من search_references (عبر referenceId) وملاحظات وعينات ألوان وأقسام."
---

يضع عناصر على اللوحة: مراجع من `search_references` (عبر `referenceId`) وملاحظات وعينات ألوان وأقسام. العناصر الجديدة تذهب أسفل الموجود. والمراجع التي وجدت لاتجاه محفوظ تذهب إلى قسم ذلك الاتجاه.

**الاسم في العملاء:** Add to canvas

## المعاملات

<div class="gb-table">

| المعامل | النوع | إلزامي | الوظيفة |
| --- | --- | --- | --- |
| `canvasId` | نص | نعم | معرف اللوحة. |
| `items` | قائمة | نعم | من 1 إلى 50 عنصرا. كل عنصر واحد من: `{ type: "reference", referenceId }` أو `{ type: "note", text }` (حتى 2000 حرف) أو `{ type: "swatch", hex, role? }` (لون مثل `#ffd84d`، والدور حتى 60 حرفا) أو `{ type: "section", title, directionId? }` (العنوان حتى 120 حرفا). |
| `sectionId` | نص | لا | القسم الذي توضع فيه العناصر. |

</div>

## مثال

```json
{
  "canvasId": "<canvasId>",
  "items": [
    {
      "type": "reference",
      "referenceId": "<referenceId>"
    },
    {
      "type": "note",
      "text": "Keep the stripes for progress only"
    }
  ]
}
```

## ما تعيده

كل عنصر جديد مع `id` و`type` وموضعه وقسمه، والعناصر المتجاوزة مع السبب، ورابط الويب.

## الخطة

العناصر في كل لوحة: 40 في المجانية، و300 في Pro.

## صفحات ذات صلة

- [اللوحات وصفحة اللوحات](/docs/ar/guides/canvases/)
- [كل أدوات MCP](/docs/ar/reference/tools/)
