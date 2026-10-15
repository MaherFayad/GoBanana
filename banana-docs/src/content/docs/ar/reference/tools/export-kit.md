---
title: export_kit
description: يصدّر اللوحة كملفات لمستودعك، مثل DIRECTION.md وBUILD-PROMPT.md وREVIEW.md وDESIGN.md وقواعد Cursor وتعليمات Copilot وأقسام AGENTS.md وCLAUDE.md والرموز وغيرها. النطاق صفحة واحدة افتراضيا.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| المجانية: 7 صيغ. Pro: الصيغ الـ 19 كلها | لا شيء | لا. يعيد نصا، ووكيلك يكتب الملفات | |

## المدخلات

| الاسم | النوع | مطلوب | الحدود والقيمة الافتراضية | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `canvasId` | string | نعم | من 1 إلى 100 حرف | اللوحة |
| `formats` | enum[] | نعم | من 1 إلى 17، انظر أدناه | الملفات المطلوبة |
| `directionId` | string | لا | من 1 إلى 100 حرف | اتجاه واحد مبقى عليه. الافتراضي: كل الاتجاهات المبقى عليها |
| `pages` | string[] | لا | من 1 إلى 5، وكل واحدة حتى 80 حرفا | أسماء مسارات أو أنماط glob: ‏`"pricing page"`، `"/launch"`، `"app/pricing/**"` |
| `scope` | enum | لا | `page` (الافتراضي)، `system` | `page`: ينطبق على الصفحات فقط ويرث نظام التصميم الخاص بك. `system`: يصبح الاتجاه نظامك |

**الصيغ:** `design_md`، `brief`، `direction_md`، `build_prompt`، `stitch_md`، `culture_md`، `claude_settings` (المجانية) · `review`، `cursor_rules`، `copilot`، `agents_md`، `claude_md`، `tokens`، `tailwind`، `figjam_spec`، `html_board`، `wireframe_html`، `pitch_md`، `experiment_md` ‏(Pro). المسارات والمحتويات: [صيغ التصدير](/docs/ar/reference/exports/).

## مثال على الاستدعاء

```json
{
  "name": "export_kit",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "directionId": "bd-mob5pq35",
    "pages": ["/launch"],
    "scope": "page",
    "formats": ["direction_md", "build_prompt", "review", "cursor_rules", "agents_md"]
  }
}
```

## مثال على المخرجات

كتلة النص الأولى ملخص، ثم كتلة نص لكل ملف باسمه ونوعه ومساره:

```text
Exported 5 files from "Coffee launch page": DIRECTION.md, BUILD-PROMPT.md, REVIEW.md, gobanana-spa-like-cereal-box.mdc, AGENTS.md.
Scope: one wild page. These files sit on top of the project's own design system and do not replace it or its DESIGN.md.
Write each file below to its path in the user's project. AGENTS.md and CLAUDE.md are sections between gobanana:<slug> markers: replace the marked block if it exists, else append it. Keep the source links.
```

```text
File: DIRECTION.md (text/markdown)
path: design/explorations/spa-like-cereal-box/DIRECTION.md

# Wild direction: Coffee launch page
> **Scope: one wild page, not the product design system.** Applies only to: /launch.
…
```

في الخطة المجانية تصدر الصيغ المجانية، وتسرد البقية مع رسالة الترقية في الإجابة نفسها: "These formats need Pro: review, cursor_rules, agents_md. Upgrade: …". وإذا كانت كل الصيغ المطلوبة من Pro، تكون الإجابة هي الرسالة وحدها.

`structuredContent`: ‏`{ canvasId, scope, files: [{ name, mime, path, content, append? }], blocked, note? }`. القيمة `append: true` تميز AGENTS.md وCLAUDE.md: ادمجهما حسب العلامات، ولا تكتب فوقهما أبدا.

## الرسائل

| الرسالة | الحل |
| --- | --- |
| "These formats need Pro: …" | رق خطتك، أو استخدم الصيغ المجانية |
| "This canvas has no direction with that id. Call get_canvas to see the direction ids." | استخدم معرف اتجاه مبقى عليه |
| "pages takes 1 to 5 route names or globs, each up to 80 characters…" | صفحات أقل وأسماء أقصر |
| "scope must be "page" (one wild page, the default) or "system" (the whole design system)." | اختر واحدا |

الدليل: [سلّم الاتجاه إلى وكيل البرمجة](/docs/ar/guides/handoff/).
