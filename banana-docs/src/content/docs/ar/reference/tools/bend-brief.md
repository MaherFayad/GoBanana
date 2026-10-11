---
title: bend_brief
description: "يحول وصف التصميم العادي إلى اتجاهات جريئة وغير متوقعة."
---

يحول وصف التصميم العادي إلى اتجاهات جريئة وغير متوقعة. لكل اتجاه عنوان قصير ولمسة واستعلام بحث ونص يبني عليه وكيلك. مرر `canvasId` لحفظ الاتجاهات في اللوحة، ثم استدع `search_references` بمعرف الاتجاه.

**الاسم في العملاء:** Bend a design brief

## المعاملات

<div class="gb-table">

| المعامل | النوع | إلزامي | الوظيفة |
| --- | --- | --- | --- |
| `brief` | نص | نعم | ما يصمم، في كلمات قليلة، من 1 إلى 500 حرف. مثال: "flight checkout screen". |
| `wildness` | عدد صحيح | نعم | 1 منعش، 2 جريء، 3 غريب، 4 جامح، 5 Bananas. كلما ارتفع الرقم اجتمعت حركات أكثر. |
| `moves` | قائمة | لا | يحدد الحركات المستخدمة: `transplant` و`material` و`era` و`constraint` و`scale` و`lens`. اتركه لاستخدام الست كلها. |
| `lens` | نص | لا | عدسة ثقافية جاهزة: `sadu` أو `najdi` أو `kufic` أو `mashrabiya` أو `desert-modern` أو `memphis` أو `swiss-international` أو `japanese-ma`. عندها يستلهم كل اتجاه من هذا التقليد. |
| `count` | عدد صحيح | لا | عدد الاتجاهات المعادة، من 1 إلى 8. القيمة الافتراضية 6. |
| `canvasId` | نص | لا | لوحة من `open_canvas` أو `new_canvas`. تحفظ فيها الاتجاهات ليقبل `search_references` المعامل `directionId`. |
| `taste` | قائمة | لا | حتى 5 كلمات قصيرة تصف الأسلوب، كل منها حتى 40 حرفا، مثل `["glassmorphism", "big typography", "dark mode"]`. تحفظ على اللوحة لعمليات البحث اللاحقة. |

</div>

## مثال

```json
{
  "brief": "flight checkout screen",
  "wildness": 4,
  "count": 6
}
```

## ما تعيده

قائمة اتجاهات. لكل اتجاه `id` (مثل `bd-3kq9x1ma`) والحركات و`title` و`twist` و`searchQuery` و`prompt`.

## الخطة

مجانية، بلا حد شهري.

## صفحات ذات صلة

- [تحويل الوصف إلى اتجاهات](/docs/ar/guides/bend/)
- [كل أدوات MCP](/docs/ar/reference/tools/)
