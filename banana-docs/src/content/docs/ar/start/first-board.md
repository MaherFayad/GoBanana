---
title: لوحتك الأولى
description: من طلب واحد إلى لوحة مليئة بالاتجاهات والمراجع.
---

يستخدم هذا الشرح إضافة Claude. ومن دون الإضافة، يستطيع وكيلك استدعاء [الأدوات](/docs/ar/reference/tools/) نفسها مباشرة.

## 1. اطلب فكرة جامحة

اكتب طلبا مثل هذا:

```text
Go wild on a calm flight checkout screen.
```

تلتقط المهارة `gobanana-explore` هذا الطلب. ويمكنك الكتابة بالعربية أيضا.

## 2. ما يفعله الوكيل

1. يصوغ طلبك في وصف قصير.
2. ينشئ لوحة باستخدام [`new_canvas`](/docs/ar/reference/tools/new-canvas/).
3. يحول الوصف إلى أفكار باستخدام [`bend_brief`](/docs/ar/reference/tools/bend-brief/)، وتحفظ الاتجاهات في اللوحة.
4. يحذف الأفكار التي لا يمكن تحويلها إلى واجهة لشاشتك باستخدام [`rate_directions`](/docs/ar/reference/tools/rate-directions/).
5. يبحث عن مراجع واجهات للأفكار المختارة باستخدام [`search_references`](/docs/ar/reference/tools/search-references/). تصل النتائج إلى قائمة النتائج في اللوحة. أما الفكرة الجامحة فتذهب إلى الملاحظات، لا إلى الصور.
6. يراجع النتائج باستخدام [`rate_references`](/docs/ar/reference/tools/rate-references/)، ويعيد البحث في المسار الضعيف بكلمات أفضل.
7. يضع المراجع المختارة باستخدام [`add_to_canvas`](/docs/ar/reference/tools/add-to-canvas/)، ويعرض اللوحة باستخدام [`open_canvas`](/docs/ar/reference/tools/open-canvas/).

## 3. استعرض اللوحة

كل اتجاه قسم، والمراجع داخله مع روابط مصادرها، والملاحظات وعينات الألوان بجوارها.

- في Claude يمكن أن تظهر اللوحة داخل المحادثة.
- كل رد فيه أيضا رابط ويب يفتح اللوحة نفسها بملء الشاشة على `/c/<id>`.
- كل لوحاتك مدرجة في [صفحة اللوحات](https://gobanana-server.maherfayad55.workers.dev/ar/canvases).

تحفظ التغييرات تلقائيا بعد ثانية تقريبا من توقفك، ويعرض شريط الأدوات حينها "All changes saved".

## 4. تابع العمل

- "Make a palette from the references" يشغل `extract_palette`. راجع [لوحة الألوان وفحص التباين](/docs/ar/guides/palette/).
- "Arrange this as a masonry board" يشغل [`arrange_canvas`](/docs/ar/reference/tools/arrange-canvas/).
- "Write a DESIGN.md" يشغل `export_kit`. راجع [تصدير الحزمة](/docs/ar/guides/export/).

:::tip
لتضيف إلى لوحة موجودة، اذكر ذلك صراحة. يستطيع الوكيل عرض لوحاتك الأخيرة باستخدام [`get_canvas`](/docs/ar/reference/tools/get-canvas/) واستخدام إحداها بدل إنشاء لوحة جديدة.
:::
