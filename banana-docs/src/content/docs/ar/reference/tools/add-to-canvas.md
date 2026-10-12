---
title: add_to_canvas
description: يضع على اللوحة مراجع (مع ملاحظة «خذ منه») وملاحظات وعينات ألوان وأقسام. نتائج الاتجاه تذهب إلى قسم اتجاهها، والاتجاه الفني فوق الواجهات.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط. اللوحة المجانية تتسع لـ 40 عنصرا، وPro لـ 300 | حد العناصر لكل لوحة | نعم | |

## المدخلات

| الاسم | النوع | مطلوب | الحدود | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `canvasId` | string | نعم | من 1 إلى 100 حرف | اللوحة |
| `items` | object[] | نعم | من 1 إلى 50 في كل استدعاء | ما تريد وضعه، انظر أدناه |
| `sectionId` | string | لا | من 1 إلى 120 حرفا | يضع العناصر في هذا القسم |

### أنواع العناصر

| `type` | الحقول | ملاحظات |
| --- | --- | --- |
| `reference` | `referenceId` (مطلوب)، `note` (من 1 إلى 280 حرفا) | نتيجة بحث من الدرج. الملاحظة تقول ما الذي تأخذه منه: ابدأها بـ `steal:` |
| `note` | `text` (من 1 إلى 2000 حرف) | ملاحظة صفراء. الروابط فيها قابلة للنقر. والتسميات بالأحرف الكبيرة مثل `WILD:` تظهر كشارات |
| `swatch` | `hex` (`#abc` أو `#aabbcc`)، `role` (حتى 60 حرفا) | عينة لون، موسومة `explore` حتى يقول فحص التباين غير ذلك |
| `section` | `title` (من 1 إلى 120 حرفا)، `directionId` | إطار يجمع العناصر |

## قواعد الوضع

- المرجع الذي وجد لاتجاه ما يذهب إلى قسم ذلك الاتجاه. وإذا لم يكن القسم موجودا ينشأ.
- في قسم الاتجاه، عناصر منطقة **art** توضع في صف معنون **Art direction** (الاتجاه الفني) فوق شبكة **UI references** (مراجع الواجهات). المنطقة تأتي مع المرجع.
- الدفعة التي تتجاوز حد العناصر ترفض كلها.
- لا تضع أبدا نتائج قيمت `bad`، فهي خرجت من الدرج على أي حال.

## مثال على الاستدعاء

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

## مثال على المخرجات

```text
Added 3 items to "Coffee launch page".
- note it_41 at (120, 96) in section sec_cereal
- image it_42 at (120, 300) in section sec_cereal
- image it_43 at (440, 640) in section sec_cereal
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-…
```

العناصر التي تم تخطيها تسرد مع السبب، مثل `referenceId` غير موجود في الدرج.

## الرسائل

| الرسالة | الحل |
| --- | --- |
| "This canvas has reached the 40 item limit on the free plan. Upgrade: …" | احذف عناصر، أو أنشئ لوحة جديدة، أو رق خطتك |
| "That section was not found on this canvas. Call get_canvas to see section ids." | استخدم `sectionId` حاليا |
| "items must be a list of 1 to 50 items…" | راجع أشكال العناصر أعلاه |

التالي: [`arrange_canvas`](/docs/ar/reference/tools/arrange-canvas/).
