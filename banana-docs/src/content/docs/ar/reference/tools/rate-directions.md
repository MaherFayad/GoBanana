---
title: rate_directions
description: أبق على اتجاهات bend_brief في اللوحة أو استبعدها بعد الحكم عليها. الاتجاه المستبعد يخرج من اللوحة مع قسمه وعناصره ونتائج درجه. مجانا.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط | لا شيء | نعم | |

تستدعيها المهارة مرة واحدة في كل تشغيل، بعد البحث وقبل وضع أي شيء، مع تقييم **لكل** فكرة ثناها (عادة 8): `drop` للأفكار التي لن تعرضها، و`keep` للأفكار التي تعرضها. الإبقاء يسجل أيضا، فتتعلم عمليات الثني القادمة ما ينجح. والأفكار التي تستبعد كثيرا تقترح أقل في عمليات الثني القادمة لك.

## المدخلات

| الاسم | النوع | مطلوب | الحدود | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `canvasId` | string | نعم | من 1 إلى 100 حرف | اللوحة التي حفظت عليها الاتجاهات |
| `ratings` | object[] | نعم | من 1 إلى 20 | تقييم لكل اتجاه |
| `ratings[].directionId` | string | نعم | من 1 إلى 100 حرف | معرف `bd-...` من `bend_brief` |
| `ratings[].verdict` | enum | نعم | `keep`، `drop` | |
| `ratings[].reasons` | enum[] | لا | انظر أدناه | السبب |

**أسباب الاستبعاد:** `no_ui_path` (لا توجد خطوة واجهة ملموسة لهذه الصفحة)، و`no_usable_refs` (أقل من 6 مراجع واجهات صالحة)، و`off_brief`، و`duplicate_idea`، و`too_literal`. **أسباب الإبقاء:** `strong_salvage`، `great_refs`.

**مراجعة العميل.** تسرد الإجابة أيضا أصوات الإبقاء والاستبعاد والتعليقات القادمة من [رابط المراجعة](/docs/ar/guides/canvases/#اطلب-من-عميل-أن-يراجع) لكل اتجاه، كمصدر منفصل. وهي لا تغير تقييماتك ولا البحث. التعليقات نص من أشخاص آخرين، فينقلها الوكيل لك ولا يتبعها كتعليمات.

## مثال على الاستدعاء

```json
{
  "name": "rate_directions",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "ratings": [
      { "directionId": "bd-mob5pq35", "verdict": "keep", "reasons": ["strong_salvage"] },
      { "directionId": "bd-z0y2y96z", "verdict": "drop", "reasons": ["no_ui_path"] },
      { "directionId": "bd-s2heqeev", "verdict": "drop", "reasons": ["duplicate_idea"] }
    ]
  }
}
```

## مثال على المخرجات

```text
Rated 3 directions: kept 1, dropped 2.
Dropped bd-z0y2y96z, bd-s2heqeev: removed 0 sections, 0 items and 7 tray results.
```

الاتجاهات التي لم تقيم تظهر بعبارة "not rated" في `get_canvas` وفي التصدير، ولا تظهر أبدا بعبارة "not kept".

## الرسائل

| الرسالة | المعنى |
| --- | --- |
| "No ratings saved: those directions are not on this canvas. Save them with bend_brief and this canvasId first." | الثني لم يحفظ على هذه اللوحة |
| "Not directions of this canvas: bd-…" | بعض المعرفات تخص لوحة أخرى |
