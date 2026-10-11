---
title: أدوات MCP
description: كل أدوات MCP في GoBanana، وما تفعله، وتكلفتها.
---

يتحدث خادم GoBanana بروتوكول MCP عبر HTTP على العنوان:

```text
https://gobanana-server.maherfayad55.workers.dev/api/mcp
```

كل أداة تعيد ردا نصيا قصيرا للوكيل وبيانات منظمة للعميل. وعند حدوث مشكلة يكون الرد رسالة قصيرة واضحة، لا خطأ خاما.

## الأدوات

<div class="gb-table">

| الأداة | ما تفعله | الخطة |
| --- | --- | --- |
| [`ping`](/docs/ar/reference/tools/ping/) | تتحقق من الاتصال وتعرض حسابك. | مجانية |
| [`bend_brief`](/docs/ar/reference/tools/bend-brief/) | تحول الوصف إلى اتجاهات جريئة. | مجانية، بلا حد |
| [`rate_directions`](/docs/ar/reference/tools/rate-directions/) | تبقي الاتجاهات في اللوحة أو تحذفها. | مجانية |
| [`search_references`](/docs/ar/reference/tools/search-references/) | تجد مراجع واجهات مع روابط مصادرها. | عملية بحث لكل استدعاء |
| [`rate_references`](/docs/ar/reference/tools/rate-references/) | تقيم النتائج لتتحسن عمليات البحث اللاحقة. | مجانية |
| [`new_canvas`](/docs/ar/reference/tools/new-canvas/) | تنشئ لوحة دون عرضها. | حد اللوحات |
| [`open_canvas`](/docs/ar/reference/tools/open-canvas/) | تعرض اللوحة داخل المحادثة وتعيد رابطها. | حد اللوحات عند إنشاء لوحة |
| [`add_to_canvas`](/docs/ar/reference/tools/add-to-canvas/) | تضع المراجع والملاحظات وعينات الألوان والأقسام. | حد العناصر |
| [`arrange_canvas`](/docs/ar/reference/tools/arrange-canvas/) | ترتب اللوحة أو قسما منها. | مجانية |
| [`get_canvas`](/docs/ar/reference/tools/get-canvas/) | تقرأ لوحة، أو تعرض اللوحات الأخيرة. | مجانية |
| [`extract_palette`](/docs/ar/reference/tools/extract-palette/) | تستخرج الألوان وتفحص التباين. | مجانية |
| [`export_kit`](/docs/ar/reference/tools/export-kit/) | تصدر DESIGN.md وAGENTS.md ورموز التصميم وغيرها. | المجانية: صيغتان. Pro: الكل |

</div>

الحدود مفصلة في [الخطط والحدود](/docs/ar/reference/plans/).

## أدوات عرض اللوحة

توجد أداتان أخريان للوحة داخل المحادثة فقط: `save_canvas_state` و`load_canvas_state`. وهما مخفيتان عن النموذج، ويستخدم الوكلاء `get_canvas` و`add_to_canvas` بدلا منهما.

## ترتيب معتاد

1. `new_canvas`
2. `bend_brief` مع `canvasId`
3. `rate_directions`
4. `search_references` لكل اتجاه باق
5. `rate_references`
6. `add_to_canvas`، ثم `arrange_canvas`
7. `open_canvas` لعرض اللوحة
8. `extract_palette` و`export_kit`
