---
title: rate_directions
description: "يبقي اتجاهات bend_brief أو يحذفها من اللوحة بعد أن يقيمها الوكيل، فلا تعرض اللوحة إلا الأفكار القابلة للتنفيذ."
---

يبقي اتجاهات `bend_brief` أو يحذفها من اللوحة بعد أن يقيمها الوكيل، فلا تعرض اللوحة إلا الأفكار القابلة للتنفيذ. الاتجاه المحذوف يغادر اللوحة مع قسمه وعناصره ونتائجه في قائمة النتائج. والأفكار التي تحذف كثيرا تقل في الاقتراحات اللاحقة.

**الاسم في العملاء:** Rate directions

## المعاملات

<div class="gb-table">

| المعامل | النوع | إلزامي | الوظيفة |
| --- | --- | --- | --- |
| `canvasId` | نص | نعم | اللوحة التي حفظت فيها الاتجاهات (`bend_brief` مع `canvasId`). |
| `ratings` | قائمة | نعم | من 1 إلى 20 تقييما. كل تقييم `{ directionId, verdict, reasons? }`. قيمة `verdict` هي `keep` أو `drop`. ويمكن أن تضم `reasons` القيم `no_ui_path` و`no_usable_refs` و`off_brief` و`duplicate_idea` و`too_literal` و`strong_salvage` و`great_refs`. |

</div>

## مثال

```json
{
  "canvasId": "<canvasId>",
  "ratings": [
    {
      "directionId": "bd-3kq9x1ma",
      "verdict": "drop",
      "reasons": [
        "no_ui_path"
      ]
    }
  ]
}
```

## ما تعيده

ما بقي وما حذف.

## الخطة

مجانية.

## صفحات ذات صلة

- [تحويل الوصف إلى اتجاهات](/docs/ar/guides/bend/)
- [كل أدوات MCP](/docs/ar/reference/tools/)
