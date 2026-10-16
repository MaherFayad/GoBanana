---
title: rate_references
description: قيّم نتائج البحث بـ great أو bad لتتحسن عمليات البحث القادمة. النتائج الرديئة تخرج من الدرج ولا تعود إليك أبدا. مجانا.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط | لا شيء | نعم: قائمة الحظر الخاصة بك، والدرج، وإشارات التعلم | |

الخادم لا ينظر إلى الصور. وكيلك هو الذي ينظر، وبهذه الأداة يعلّم البحث.

- **`bad`**: يدخل العنصر قائمة الحظر الشخصية (لا يظهر لك مرة أخرى أبدا) ويخرج من درج تلك اللوحة.
- **`great`**: يحفظ كإشارة إلى الصياغات والمصممين الذين تنجح نتائجهم.
- لا يمكن تقييم إلا النتائج المحفوظة على لوحاتك، لذا ابحث دائما مع `canvasId`.
- الصياغة التي يقيمها كثيرون تقييما جيدا قد تفيد بحث الجميع، لكن فقط بعد أن يقيمها 3 مستخدمين مختلفين على الأقل. لا أحد يرى تقييماتك.

## المدخلات

| الاسم | النوع | مطلوب | الحدود | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `canvasId` | string | لا | من 1 إلى 100 حرف | اللوحة التي يحمل درجها النتائج. تزال منه النتائج الرديئة |
| `ratings` | object[] | نعم | من 1 إلى 50 | تقييم لكل نتيجة |
| `ratings[].referenceId` | string | نعم | من 1 إلى 100 حرف | المعرف الذي بين القوسين في مخرجات البحث |
| `ratings[].verdict` | enum | نعم | `great`، `bad` | |
| `ratings[].reasons` | enum[] | لا | انظر أدناه | السبب |
| `ratings[].styles` | enum[] | لا | واحد أو اثنين من [معرفات الستايلات](/docs/ar/guides/styles/)، الأساسي أول | الستايلات اللي يشوفها وكيلك في الصورة المصغرة. تنحفظ على المرجع في الدرج وعلى اللوحة، و`get_canvas` يفحص تنوع الستايلات في كل لوحة |
| `save` | boolean | لا | | احفظ المراجع `great` أيضا في [مكتبتك](/docs/ar/guides/canvases/#مكتبتك): روابط فقط، وليس الصور أبدا |

**أسباب bad:** `off_topic`، `stock_or_shop`، `cluttered`، `duplicate`، `low_craft`، `wrong_style`، `not_ui` (لمنطقة الواجهات فقط). **أسباب great:** `great_craft`، `on_style`، `on_brief`.

قيّم النتائج الرديئة فقط، ومن 1 إلى 3 نتائج بارزة في كل عملية بحث. لا يوجد حكم "ok"، فاترك النتائج الجيدة العادية بلا تقييم.

## مثال على الاستدعاء

```json
{
  "name": "rate_references",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "ratings": [
      { "referenceId": "ref_3m7k", "verdict": "bad", "reasons": ["stock_or_shop"] },
      { "referenceId": "ref_9x1a", "verdict": "bad", "reasons": ["off_topic", "not_ui"] },
      { "referenceId": "ref_8k2p", "verdict": "great", "reasons": ["on_brief"], "styles": ["hero-numeral", "dark-quiet-matte"] }
    ]
  }
}
```

## مثال على المخرجات

```text
Rated 3: 1 great, 2 bad.
Bad results will not come back in later searches. 2 removed from the tray.
Style tags saved on 1 reference; get_canvas summary checks the style mix.
Next:
- bridge lane: search_references with directionId, lane "bridge" and new query words
```

كل تقييم bad يعيد تلميحا قصيرا لإعادة البحث في مساره. المهارة تعيد المسار فقط إذا كان أكثر من 40% منه رديئا، ومرتين على الأكثر.

## الرسائل

| الرسالة | المعنى |
| --- | --- |
| "No ratings saved: those results are not on your canvases. Search with a canvasId, then rate the results." | البحث تم بدون `canvasId`، فلم يحفظ شيء يمكن تقييمه |
| "Not found on your canvases: ref_…" | بعض المعرفات غير معروفة |
