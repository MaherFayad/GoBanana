---
title: remix_frankenstein
description: يصنع نسخا بديلة من صفحة فرانكنشتاين بأجزاء أخرى في خاناتها، ويضعها يمين الأصل. ثبّت ما تحبه وغيّر الباقي. الاستدعاء نفسه يعطي النتيجة نفسها.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط | كل إطار جديد يحتسب عنصرا واحدا على اللوحة | نعم | seeded |

## المدخلات

| الاسم | النوع | مطلوب | الحدود | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `canvasId` | string | نعم | من 1 إلى 100 حرف | اللوحة |
| `stitchId` | string | نعم | حتى 120 حرفا | صفحة فرانكنشتاين المراد إعادة مزجها (`st-…`) |
| `count` | integer | نعم | من 1 إلى 6 | عدد النسخ البديلة |
| `lock` | string[] | لا | حتى 42 معرف خانة أو دورا | يبقي هذه كما هي، مثل `["nav", "hero"]` |
| `vary` | enum[] | لا | من 1 إلى 26 دورا | إذا حددته، تتغير هذه الأدوار فقط |

الإطارات الجديدة تحمل عناوين مثل "<original>, remix 1" و"…, remix 2"، وتتذكر الصفحة التي جاءت منها.

## مثال على الاستدعاء

```json
{
  "name": "remix_frankenstein",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "stitchId": "st-4a1b",
    "count": 3,
    "lock": ["nav", "hero"]
  }
}
```

## مثال على المخرجات

```text
Made 3 variants of Frankenstein page st-4a1b:
- Landing 1, remix 1 (st-9c0d, website, collage)
  1. row rw-1: Nav (slot sl-1, part pt-9f2c1a) from lapa.ninja https://…
  …
Show each slot's source link next to it. Take the structure, not the pixels.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-…
```

المهارة تعرض كل نسخة جديدة مع وسم "(kept)" على الخانات المثبتة، وسطر واحد عما تغير.
