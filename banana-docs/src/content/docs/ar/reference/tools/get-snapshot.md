---
title: get_snapshot
description: تتيح للوكيل رؤية اللوحة أو قسم منها أو صفحة فرانكنشتاين دون متصفح، صور مصغرة مع مواضعها، أو أجزاء الصفحة بترتيب صفوفها مع مستطيلات القص. عرض للأجزاء، وليس صورة مركبة.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط | لا شيء | لا | للقراءة فقط |

## المدخلات

| الاسم | النوع | مطلوب | الحدود | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `canvasId` | string | نعم | من 1 إلى 100 حرف | اللوحة |
| `sectionId` | string | لا | معرف قسم من `get_canvas` | يعرض مراجع هذا القسم مع مواضعها |
| `stitchId` | string | لا | معرف صفحة فرانكنشتاين من `get_canvas` | يعرض أجزاء هذه الصفحة صفا صفا |
| `thumbs` | boolean | لا | القيمة الافتراضية `true` | مع `false` تعود الأسطر النصية فقط |

مرر `sectionId` أو `stitchId`، وليس الاثنين. بدونهما تحصل على أقسام اللوحة وصفحات فرانكنشتاين وأول المراجع.

## صفحة فرانكنشتاين

```json
{ "name": "get_snapshot", "arguments": { "canvasId": "c3f1a0d2-…", "stitchId": "st_…" } }
```

النتيجة أسطر نصية تتبع كل سطر منها صورة:

```text
Frankenstein page "Checkout A" (st_…, mobile, collage), 2 rows top to bottom.
This is a parts view, not a rendered composite: each part below is its full source image, and its crop rect says which band of it the page uses.
Row 1: Nav (part pt-…) from dribbble.com https://dribbble.com/shots/… Crop x 0.00, y 0.00, w 1.00, h 0.12 (fractions of the image below; the page uses only this band)
[image]
Build each row from what you see here; check your build against these images.
```

البنايات الموضوعة بجانب الصفحة عبر `add_to_canvas` (النوع `build`) تظهر في النهاية مع روابطها.

## كيف تعمل الصور المصغرة

- يجلب الخادم كل صورة بالحجم الصغير الذي يقدمه مصدرها (Pinterest `236x`، وDribbble `resize=400x300`، وBehance `disp`) ويسلم بياناتها للوكيل داخل النتيجة. لا تحفظ ولا تخزن مؤقتا ولا تسجل ولا تتاح على أي عنوان.
- لا تجلب إلا الصور من المضيفات الموجودة في قائمة السماح للبحث. شاشات Mobbin وملفاتك المرفوعة ولقطات البنايات تذكر مع روابطها ولا تجلب.
- حتى 12 صورة في كل استدعاء، ونحو 3 ثوان لكل صورة، ونحو 1.5 ميغابايت إجمالا. الصورة الأكبر من 300 كيلوبايت التي ليس لها حجم صغير تتخطى، ويذكر السطر ذلك.

## الرسائل

| الرسالة | الحل |
| --- | --- |
| "That Frankenstein page was not found…" | اقرأ معرفات الصفحات عبر `get_canvas` |
| "That section was not found…" | اقرأ معرفات الأقسام عبر `get_canvas` |
| "Pass a sectionId or a stitchId, not both." | اختر واحدا |
