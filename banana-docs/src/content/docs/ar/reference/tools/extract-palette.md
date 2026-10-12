---
title: extract_palette
description: يستخرج لوحة ألوان من عناصر الصور على اللوحة، مع أدوار الألوان وفحوص التباين حسب WCAG. ويمكنه أن يضع الألوان على اللوحة كعينات.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط | عينات الألوان تحتسب عناصر | يحفظ لوحة الألوان، والعينات مع `addSwatches` | |

تقرأ الصور المصغرة **في الذاكرة** من مضيفي صور مسموح بهم، وتحسب الألوان بمكمم median cut، ثم تهمل الصور فورا. لا يخزن شيء غير الألوان.

## المدخلات

| الاسم | النوع | مطلوب | الحدود والقيمة الافتراضية | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `canvasId` | string | نعم | من 1 إلى 100 حرف | اللوحة |
| `itemIds` | string[] | نعم | من 1 إلى 12 | معرفات عناصر الصور من `get_canvas` أو `add_to_canvas` |
| `size` | integer | لا | من 5 إلى 9، والافتراضي 6 | عدد الألوان |
| `addSwatches` | boolean | لا | الافتراضي false | يضع الألوان على اللوحة كعينات |

## المخرجات

- `palette[]`: ‏`hex`، و`oklch`، و`role` (`primary`، `secondary`، `accent`، `neutral`، `surface`، `on-surface`).
- `contrast[]`: كل لون مقابل لون السطح، ولون on-surface، والأبيض، والأسود: `fg`، و`bg`، و`ratio`، و`passesText` ‏(4.5:1، SC 1.4.3)، و`passesUi` ‏(3:1، SC 1.4.11)، و`tag`: ‏`ship` إذا نجح للنص، وإلا `explore`.
- `skipped[]`: العناصر التي تعذرت قراءتها، مع السبب.
- `swatches[]`: العينات الموضوعة. العينة توسم `ship` إذا كان لونها ضمن زوج ناجح. وتوضع في القسم الذي تشترك فيه كل صور المصدر، وإلا أسفل اللوحة.

## مثال على الاستدعاء

```json
{
  "name": "extract_palette",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "itemIds": ["it_42", "it_43", "it_44"],
    "size": 6,
    "addSwatches": true
  }
}
```

## مثال على المخرجات

شكل الإجابة، بقيم للمثال:

```text
Palette of 6 colors:
- #f4f1ea oklch(95.6% 0.011 84.6) (surface)
- #1d2a5c oklch(29.5% 0.084 270.2) (on-surface)
…
5 of 18 contrast pairs pass 4.5:1 for text (ship); the rest are explore only.
- #1d2a5c on #f4f1ea: 12.4:1
Skipped it_44: its format (for example WebP) is not supported yet.
Added 6 swatches to the canvas.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-…
```

## أسباب التخطي

not an image item on this canvas · its image host is not on the allowlist · its image link is not valid · the image could not be loaded · the link did not return an image · the image is too large · the image took too long to load · the image link redirects too many times · its format (for example WebP) is not supported yet · the image could not be read.

إذا لم تمكن قراءة أي صورة: "No image could be read, so there is no palette." مع السبب لكل عنصر.

الدليل: [لوحة الألوان والتباين](/docs/ar/guides/palette/).
