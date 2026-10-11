---
title: export_kit
description: "يصدر اللوحة ملفات لمشروعك."
---

يصدر اللوحة ملفات لمشروعك. يعيد كل ملف نصا، ويكتبها وكيلك حيث تريد.

**الاسم في العملاء:** Export kit

## المعاملات

<div class="gb-table">

| المعامل | النوع | إلزامي | الوظيفة |
| --- | --- | --- | --- |
| `canvasId` | نص | نعم | معرف اللوحة. |
| `formats` | قائمة | نعم | واحد أو أكثر من `design_md` (DESIGN.md) و`agents_md` (AGENTS.md) و`tokens` (tokens.json) و`tailwind` (theme.css) و`figjam_spec` (figjam-spec.json) و`html_board` (board.html) و`brief` (BRIEF.md). |

</div>

## مثال

```json
{
  "canvasId": "<canvasId>",
  "formats": [
    "design_md",
    "agents_md",
    "tokens"
  ]
}
```

## ما تعيده

ملفات، لكل منها `name` و`mime` و`content`. والصيغ التي لا تشملها خطتك تظهر في `blocked` مع ملاحظة قصيرة.

## الخطة

المجانية: `design_md` و`brief`. Pro: كل الصيغ.

## صفحات ذات صلة

- [تصدير الحزمة](/docs/ar/guides/export/)
- [كل أدوات MCP](/docs/ar/reference/tools/)
