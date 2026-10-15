---
title: arrange_canvas
description: يرتب لوحة كاملة أو قسما واحدا بأحد أربعة تخطيطات. النتيجة نفسها التي يعطيها شريط أدوات اللوحة.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط | لا شيء | نعم، المواضع فقط | idempotent |

## المدخلات

| الاسم | النوع | مطلوب | الحدود | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `canvasId` | string | نعم | من 1 إلى 100 حرف | اللوحة |
| `layout` | enum | نعم | `spread`، `by_direction`، `masonry`، `grid`، `hero` | التخطيط |
| `sectionId` | string | لا | من 1 إلى 120 حرفا | يرتب هذا القسم فقط |

| التخطيط | ماذا يفعل |
| --- | --- |
| `spread` | صف لكل اتجاه: الصورة الفنية الرئيسية كبيرة، وملاحظة الفكرة بجانبها، وشبكة واجهات 3 في 2 بعدهما، والألوان ونموذج الخط تحتها. الصفوف تتتابع من الأعلى إلى الأسفل، وصفحات فرانكنشتاين في الآخر. الافتراضي للوحات المزاج |
| `by_direction` | عمود لكل قسم. صف الاتجاه الفني يبقى فوق شبكة الواجهات |
| `masonry` | 4 أعمدة تحافظ على أشكال الصور |
| `grid` | خلايا متساوية |
| `hero` | العنصر الأول كبير، والباقي تحته |

## مثال على الاستدعاء

```json
{ "name": "arrange_canvas", "arguments": { "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f", "layout": "spread" } }
```

## مثال على المخرجات

```text
Arranged 31 items in "Coffee launch page" with the spread layout.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-…
```

المهارات تستدعيها مرة واحدة، بعد آخر `add_to_canvas`، ولا تقرأ اللوحة بينهما.

## الرسائل

| الرسالة | الحل |
| --- | --- |
| "layout must be one of: spread, by_direction, masonry, grid, hero." | اختر تخطيطا من القائمة |
| "That section was not found on this canvas…" | استخدم `sectionId` حاليا |
