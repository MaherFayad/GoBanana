---
title: search_references
description: "يبحث عن مراجع واجهات (شاشات تطبيقات، صفحات ويب، لوحات معلومات، مكونات) في Dribbble وPinterest وBehance وAwwwards."
---

يبحث عن مراجع واجهات (شاشات تطبيقات، صفحات ويب، لوحات معلومات، مكونات) في Dribbble وPinterest وBehance وAwwwards. كل نتيجة مرتبطة بمصدرها. النتائج واجهات دائما، مهما كانت الكلمات. مرر `directionId` من `bend_brief` أو `query`. ومرر `canvasId` لإضافة النتائج إلى قائمة النتائج في تلك اللوحة.

**الاسم في العملاء:** Search references

## المعاملات

<div class="gb-table">

| المعامل | النوع | إلزامي | الوظيفة |
| --- | --- | --- | --- |
| `directionId` | نص | لا | معرف اتجاه من `bend_brief`. يعطي أفضل النتائج. مرر هذا أو `query`. |
| `query` | نص | لا | كلمات البحث، من 1 إلى 300 حرف. مرر هذا أو `directionId`. |
| `sources` | قائمة | لا | من 1 إلى 4 من `pinterest` و`dribbble` و`behance` و`awwwards`. الافتراضي: `pinterest` و`dribbble`. |
| `count` | عدد صحيح | لا | عدد النتائج، من 4 إلى 24. القيمة الافتراضية 12. |
| `canvasId` | نص | لا | يضيف النتائج إلى قائمة النتائج في هذه اللوحة. |
| `taste` | قائمة | لا | حتى 5 كلمات قصيرة تصف الأسلوب، كل منها حتى 40 حرفا، مثل `["glassmorphism", "big typography", "dark mode"]`. تحفظ على اللوحة لعمليات البحث اللاحقة. |
| `lane` | نص | لا | مع `directionId` و`query`: يبحث في هذا المسار فقط من الاتجاه، بكلمات الاستعلام. واحد من `fidelity` و`taste` و`component` و`hero` و`bridge` و`locale`. |
| `mix` | نص | لا | يتم تجاهله. النتائج واجهات دائما. بقي حتى تعمل الاستدعاءات القديمة. |

</div>

## مثال

```json
{
  "directionId": "bd-3kq9x1ma",
  "canvasId": "<canvasId>",
  "count": 12
}
```

## ما تعيده

مراجع، لكل منها `id` و`thumbUrl` و`imageUrl` و`sourceUrl` و`sourceSite` و`title` و`width` و`height`. روابط فقط، ولا تنسخ أي صورة.

## الخطة

كل استدعاء يحسب عملية بحث واحدة من حدك الشهري: 30 في المجانية، و300 في Pro، و200 في خطة المؤسسين.

## صفحات ذات صلة

- [البحث عن المراجع وتقييمها](/docs/ar/guides/references/)
- [كل أدوات MCP](/docs/ar/reference/tools/)
