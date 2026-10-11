---
title: new_canvas
description: "ينشئ لوحة إلهام دون عرضها، ويعيد canvasId."
---

ينشئ لوحة إلهام دون عرضها، ويعيد `canvasId`. مرر المعرف إلى `bend_brief` و`search_references` و`add_to_canvas`، ثم استدع `open_canvas` به لعرض اللوحة المكتملة.

**الاسم في العملاء:** New canvas

## المعاملات

<div class="gb-table">

| المعامل | النوع | إلزامي | الوظيفة |
| --- | --- | --- | --- |
| `title` | نص | لا | عنوان اللوحة، حتى 80 حرفا. |
| `brief` | نص | لا | وصف التصميم، حتى 500 حرف. |
| `taste` | قائمة | لا | حتى 5 كلمات قصيرة تصف الأسلوب، كل منها حتى 40 حرفا، مثل `["glassmorphism", "big typography", "dark mode"]`. تحفظ على اللوحة لعمليات البحث اللاحقة. |

</div>

## مثال

```json
{
  "title": "Calm checkout",
  "brief": "A calm flight checkout screen"
}
```

## ما تعيده

معرف اللوحة الجديدة ورابطها على الويب.

## الخطة

تحسب من حد اللوحات: 3 في المجانية، وبلا حد في Pro.

## صفحات ذات صلة

- [لوحتك الأولى](/docs/ar/start/first-board/)
- [اللوحات وصفحة اللوحات](/docs/ar/guides/canvases/)
- [كل أدوات MCP](/docs/ar/reference/tools/)
