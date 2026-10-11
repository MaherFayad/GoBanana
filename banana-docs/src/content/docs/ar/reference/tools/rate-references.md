---
title: rate_references
description: "يقيم نتائج البحث لتتحسن عمليات البحث اللاحقة."
---

يقيم نتائج البحث لتتحسن عمليات البحث اللاحقة. النتائج السيئة تغادر قائمة النتائج في اللوحة ولا تعود في عمليات بحثك. وكل تقييم سيئ يعيد تلميحا لإعادة البحث في ذلك المسار.

**الاسم في العملاء:** Rate references

## المعاملات

<div class="gb-table">

| المعامل | النوع | إلزامي | الوظيفة |
| --- | --- | --- | --- |
| `canvasId` | نص | لا | اللوحة التي تحمل قائمة نتائجها هذه النتائج. تزال منها النتائج السيئة. |
| `ratings` | قائمة | نعم | من 1 إلى 50 تقييما. كل تقييم `{ referenceId, verdict, reasons? }`. قيمة `verdict` هي `great` أو `bad`. ويمكن أن تضم `reasons` القيم `off_topic` و`low_craft` و`stock_or_shop` و`cluttered` و`duplicate` و`wrong_style` و`not_ui` و`great_craft` و`on_style` و`on_brief`. |

</div>

## مثال

```json
{
  "canvasId": "<canvasId>",
  "ratings": [
    {
      "referenceId": "<referenceId>",
      "verdict": "bad",
      "reasons": [
        "stock_or_shop"
      ]
    }
  ]
}
```

## ما تعيده

ما تم تسجيله، وتلميح لإعادة البحث مع كل تقييم سيئ.

## الخطة

مجانية.

## صفحات ذات صلة

- [البحث عن المراجع وتقييمها](/docs/ar/guides/references/)
- [كل أدوات MCP](/docs/ar/reference/tools/)
