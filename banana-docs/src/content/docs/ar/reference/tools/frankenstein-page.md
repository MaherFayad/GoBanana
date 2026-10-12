---
title: frankenstein_page
description: Frankenstein it، الخطوة 2. ركّب أجزاء المكتبة فوق بعضها في صفحات جديدة، من الأعلى إلى الأسفل، داخل إطار بمقاس المنصة. من صفوف تحددها بنفسك، أو من وصفة مع ما يصل إلى 6 نسخ بديلة.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط | كل إطار يحتسب عنصرا واحدا على اللوحة | نعم | |

توضع الإطارات جنبا إلى جنب في قسم **Frankenstein pages** (صفحات فرانكنشتاين) على اللوحة، وينشأ القسم إذا لم يكن موجودا. في مخرجات الأداة تسمى صفحة فرانكنشتاين stitch (`stitchId`، `st-…`).

## المدخلات

| الاسم | النوع | مطلوب | الحدود والقيمة الافتراضية | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `canvasId` | string | نعم | من 1 إلى 100 حرف | اللوحة |
| `recipe` | enum[] | أحد هذين | من 1 إلى 14 دورا | الأدوار من الأعلى إلى الأسفل، وتملأ من المكتبة |
| `rows` | object[] | أحد هذين | من 1 إلى 14 صفا | صفوف أجزاء تحددها بنفسك |
| `rows[].slots` | object[] | نعم | من 1 إلى 3 | `{ partId, crop?, note? }`. ‏`note` حتى 280 حرفا |
| `rows[].widths` | number[] | لا | قيمة لكل خانة، من 2 إلى 3 قيم، وكل قيمة أكبر من 0 وحتى 12 | عروض نسبية، مثل `[1, 3]` لشريط جانبي. الافتراضي عروض متساوية |
| `variants` | integer | لا | من 1 إلى 6 | مع الوصفة: عدد الصفحات. كل صفحة تمزج 3 مصادر على الأقل إذا سمحت المكتبة |
| `platform` | enum | لا | `mobile` ‏(390px)، `tablet` ‏(834px)، `website`، `webapp` ‏(1440px) | عرض الإطار. الافتراضي: منصة الاتجاه، وإلا website |
| `mode` | enum | لا | `collage` (الافتراضي)، `wireframe`، `even` | طريقة العرض |
| `title` | string | لا | حتى 120 حرفا | عنوان الصفحة |
| `note` | string | لا | حتى 280 حرفا | الفكرة في سطر واحد |
| `directionId` | string | لا | من 1 إلى 100 حرف | الاتجاه المبقى عليه الذي تخدمه هذه الصفحة |

## مثال على الاستدعاء: وصفة

```json
{
  "name": "frankenstein_page",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "platform": "website",
    "title": "Landing",
    "mode": "collage",
    "recipe": ["nav", "hero", "logos", "features", "cards", "testimonial", "cta", "footer"],
    "variants": 3
  }
}
```

## مثال على الاستدعاء: صفوف محددة

```json
{
  "name": "frankenstein_page",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "platform": "webapp",
    "title": "Dashboard home",
    "rows": [
      { "slots": [{ "partId": "pt-a1" }, { "partId": "pt-b2" }], "widths": [1, 4] },
      { "slots": [{ "partId": "pt-c3", "note": "steal: KPI cards with sparklines" }] }
    ]
  }
}
```

## مثال على المخرجات

```text
Made 3 Frankenstein pages in the "Frankenstein pages" section (sec_fk):
- Landing 1 (st-4a1b, website, collage)
  1. row rw-1: Nav (slot sl-1, part pt-9f2c1a) from "Dev tool landing page" on lapa.ninja https://… note: steal: the split nav…
  2. row rw-2: Hero (slot sl-2, part pt-77ab) from landing.love https://…
  …
Show each slot's source link next to it. Take the structure, not the pixels.
Change one with update_frankenstein, or make variants with remix_frankenstein.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-…
```

## الرسائل

| الرسالة | الحل |
| --- | --- |
| "The parts library is empty. Cut parts from board images or search results with cut_parts first." | شغل [`cut_parts`](/docs/ar/reference/tools/cut-parts/) |
| "recipe is a list of 1 to 14 roles from: …" | استخدم الأدوار المذكورة |
| "This canvas has reached the 40 item limit on the free plan…" | أفرغ مساحة من العناصر |

التالي: [`update_frankenstein`](/docs/ar/reference/tools/update-frankenstein/)، [`remix_frankenstein`](/docs/ar/reference/tools/remix-frankenstein/).
