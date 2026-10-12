---
title: new_canvas
description: ينشئ لوحة إلهام دون أن يعرضها، ويعطيك canvasId الخاص بها. املأها، ثم اعرضها مرة واحدة وهي جاهزة باستخدام open_canvas.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط. المجانية تملك 3 لوحات على الأكثر | تحتسب ضمن حد اللوحات | نعم | ليست idempotent |

تستخدمها المهارات بدلا من `open_canvas` حتى لا تشاهد لوحة فارغة تمتلئ أمامك. ولا تستدعيها إلا إذا لم تناسب الطلب أي لوحة من لوحاتك الأخيرة.

## المدخلات

| الاسم | النوع | مطلوب | الحدود | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `title` | string | لا | من 1 إلى 80 حرفا | عنوان اللوحة. الافتراضي: عنوان مأخوذ من الموجز، وإلا "Untitled moodboard" |
| `brief` | string | لا | من 1 إلى 500 حرف | موجز التصميم، يحفظ على اللوحة |
| `taste` | string[] | لا | من 1 إلى 5 كلمات، وكل كلمة حتى 40 حرفا | كلمات الذوق. تستخدمها عمليات البحث على هذه اللوحة |

## مثال على الاستدعاء

```json
{
  "name": "new_canvas",
  "arguments": {
    "title": "Coffee launch page",
    "brief": "launch page for a specialty coffee roaster",
    "taste": ["grainy", "big typography"]
  }
}
```

## مثال على المخرجات

```text
Created canvas "Coffee launch page" (id c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f). It is not shown yet.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f
Taste for searches: grainy, big typography.
Next: pass this canvasId to bend_brief and search_references, place results with add_to_canvas, then call open_canvas with this canvasId to show the finished board.
```

## الرسائل

| الرسالة | الحل |
| --- | --- |
| "You have used your 3 free canvases. Upgrade for unlimited canvases: …" | أعد استخدام لوحة، أو احذف واحدة، أو رق خطتك |
| "title must be 1 to 80 characters." | اختصر العنوان |
| "taste must be 1 to 5 short style words, for example minimal or dark mode." | كلمات أقل وأقصر |
