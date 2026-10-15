---
title: update_frankenstein
description: يعدل صفحة فرانكنشتاين واحدة بقائمة عمليات، وهي swap وmove وmoveRow وremove وinsert وcrop وwidths وmode وnote وtitle، تطبق بالترتيب، إما كلها وإما لا شيء.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط | لا شيء | نعم | الكل أو لا شيء |

## المدخلات

| الاسم | النوع | مطلوب | الحدود | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `canvasId` | string | نعم | من 1 إلى 100 حرف | اللوحة |
| `stitchId` | string | نعم | حتى 120 حرفا | صفحة فرانكنشتاين (`st-…`) |
| `ops` | object[] | نعم | من 1 إلى 30 | تطبق بالترتيب. إذا فشلت واحدة لا يطبق شيء |

## العمليات

| `op` | الحقول | ماذا تفعل |
| --- | --- | --- |
| `swap` | `slotId`، `partId` | تضع جزءا آخر في خانة |
| `move` | `slotId`، `index`، `rowId?` | تنقل خانة داخل صفها، أو إلى صف آخر |
| `moveRow` | `rowId`، `index` | تنقل صفا كاملا (0 هو الأعلى) |
| `remove` | `slotId` أو `rowId` | تحذف خانة أو صفا |
| `insert` | `slots` (من 1 إلى 3: `partId`، `role?`، `crop?`، `note?`)، `index?` أو `afterRowId?`، `widths?` | تضيف صفا جديدا. الافتراضي في النهاية |
| `crop` | `slotId`، `crop` `{x, y, w, h}` | تعيد قص خانة دون جزء جديد |
| `widths` | `rowId`، `widths` (من 1 إلى 3 أرقام، وكل رقم حتى 12) | عروض الخانات النسبية |
| `mode` | `mode`: `collage`، `wireframe`، `harmonize` (ما زال `even` يعمل لإصدار واحد) | تبدل طريقة العرض |
| `note` | `note` (حتى 280)، `slotId?` | مع `slotId`: ملاحظة «خذ منه» للخانة. وبدونه: فكرة الصفحة في سطر واحد. القيمة الفارغة تمسحها |
| `title` | `title` (من 1 إلى 120) | تعيد تسمية الصفحة |

معرفات الخانات والصفوف (`sl-…`، `rw-…`) تأتي من `frankenstein_page` أو `get_canvas`.

## مثال على الاستدعاء

```json
{
  "name": "update_frankenstein",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "stitchId": "st-4a1b",
    "ops": [
      { "op": "swap", "slotId": "sl-3", "partId": "pt-1b7e44" },
      { "op": "widths", "rowId": "rw-5", "widths": [1, 2] },
      { "op": "note", "note": "Editorial nav over a dashboard hero" },
      { "op": "mode", "mode": "wireframe" }
    ]
  }
}
```

## مثال على المخرجات

```text
Applied 4 changes to Frankenstein page st-4a1b:
- Landing 1 (st-4a1b, website, wireframe): Editorial nav over a dashboard hero
  1. row rw-1: Nav (slot sl-1, part pt-9f2c1a) from lapa.ninja https://…
  …
Show each slot's source link next to it. Take the structure, not the pixels.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-…
```
