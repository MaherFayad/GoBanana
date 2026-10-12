---
title: cut_parts
description: Frankenstein it، الخطوة 1. اقطع أجزاء (شريط التنقل، والواجهة الرئيسية، والبطاقات، والتذييل وغيرها) من صور اللوحة أو نتائج البحث إلى مكتبة أجزاء اللوحة، على شكل مستطيلات قص. مجانا.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط | لا شيء. المكتبة تتسع لـ 80 جزءا لكل لوحة | نعم | |

الجزء هو دور، ومستطيل قص فوق صورة مرتبطة من مصدرها، ووسم فاتح أو داكن، وملاحظة. لا ينزل شيء ولا يقص شيء من ملف الصورة، فالمتصفح يعرض المستطيل فوق الصورة الأصلية.

## المدخلات

| الاسم | النوع | مطلوب | الحدود | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `canvasId` | string | نعم | من 1 إلى 100 حرف | اللوحة |
| `cuts` | object[] | نعم | من 1 إلى 24 في كل استدعاء | الأجزاء المراد قطعها |
| `cuts[].itemId` | string | أحد هذين | حتى 120 حرفا | صورة موضوعة على اللوحة، ومنها شاشات Mobbin (يُخمَّن القص فيها كشاشة واحدة) |
| `cuts[].referenceId` | string | أحد هذين | حتى 100 حرف | نتيجة بحث في الدرج |
| `cuts[].role` | enum | نعم | انظر أدناه | دور الجزء في الصفحة |
| `cuts[].crop` | object | لا | `x` و`y` من 0 إلى 1، و`w` و`h` أكبر من 0 وحتى 1 | كسور من أبعاد الصورة، بدءا من الزاوية العليا اليسرى. إذا تركته يخمن الخادم شريطا حسب الدور |
| `cuts[].theme` | enum | لا | `light`، `dark`، `unknown` | كما يبدو |
| `cuts[].note` | string | لا | من 1 إلى 280 حرفا | ما الذي تأخذه، وتبدأ بـ `steal:` |

**الأدوار.** للويب والمشتركة: `nav`، `hero`، `logos`، `features`، `cards`، `gallery`، `stats`، `testimonial`، `pricing`، `cta`، `form`، `faq`، `content`، `footer`. لتطبيقات الويب: `sidebar`، `toolbar`، `table`، `chart`، `filters`. للهاتف: `status-header`، `tabbar`، `list`، `detail`، `sheet`، `empty`. وأي شيء آخر: `other`. كل دور يعمل على كل منصة.

**الأشرطة المخمنة** عند غياب `crop`: ‏nav أعلى 8% (و4% في لقطات الصفحات الكاملة الطويلة)، وhero الـ 35% التالية (و15%)، وfooter وtabbar أسفل 10%، وstatus-header أعلى 14%، وsidebar يسار 18%، وأي دور آخر الشريط الأوسط. الأجزاء المخمنة تحمل `guessedCrop: true`.

## مثال على الاستدعاء

```json
{
  "name": "cut_parts",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "cuts": [
      { "itemId": "it_42", "role": "nav", "crop": { "x": 0, "y": 0, "w": 1, "h": 0.035 }, "theme": "dark", "note": "steal: the split nav with the search pill in the middle" },
      { "itemId": "it_43", "role": "pricing", "crop": { "x": 0.05, "y": 0.42, "w": 0.9, "h": 0.2 }, "theme": "light", "note": "steal: the middle plan that breaks the grid" },
      { "referenceId": "ref_77aa", "role": "footer" }
    ]
  }
}
```

## مثال على المخرجات

```text
Cut 3 parts for Frankenstein pages (library: 11 of 80).
- pt-9f2c1a: nav from dribbble.com https://dribbble.com/shots/…, crop x 0% y 0% w 100% h 4%
- pt-1b7e44: pricing from lapa.ninja https://www.lapa.ninja/post/…, crop x 5% y 42% w 90% h 20%
- pt-c0de99: footer from landing.love https://landing.love/sites/…, crop x 0% y 90% w 100% h 10% (guessed, pass a crop to fix it)
Next: frankenstein_page with rows of part ids, or a recipe of roles.
```

## الرسائل

| الرسالة | الحل |
| --- | --- |
| "The parts library holds up to 80 parts. It has 78, so cut at most 2 more. Nothing was cut." | احذف أجزاء، أو أعد استخدامها |
| "Some images have links the canvas cannot use. Nothing was cut." | اختر مراجع من المصادر المسموح بها |
| "cuts must be a list of 1 to 24 cuts…" | كل قصة تحتاج `itemId` أو `referenceId` (واحدا منهما)، و`role` |

الدليل: [Frankenstein it](/docs/ar/guides/frankenstein/).
