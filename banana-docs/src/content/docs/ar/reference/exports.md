---
title: صيغ التصدير
description: كل صيغة في export_kit، والملف، ومكانه في مستودعك، وما فيه، والخطة التي يحتاجها.
---

`<slug>` هو الاسم المختصر للاتجاه، مثل `frosted-sleeve`. كل مسار هنا نسبي إلى جذر مستودعك، وهو اقتراح فقط: يكتب وكيلك الملف في هذا المكان إلا إذا كنت تحفظ ملفاتك في مكان آخر.

## الجدول

| الصيغة | الملف والمسار | الخطة | ما يحتويه |
| --- | --- | --- | --- |
| `direction_md` | `design/explorations/<slug>/DIRECTION.md` | المجانية | المواصفات البصرية الكاملة لكل اتجاه مُبقى، والموجز، والصفحات وأنماط الملفات، والمنصة، والجموح، والعدسة، ورابط اللوحة، وكل روابط المصادر |
| `build_prompt` | `design/explorations/<slug>/BUILD-PROMPT.md` | المجانية | موجه واحد تلصقه في Claude Code أو Cursor أو v0 أو Lovable: الصفحات، والمنصة، والمواصفات، والقيود، ومتى يكتمل العمل. يذكر صفحات فرانكنشتاين |
| `design_md` | `design/explorations/<slug>/DESIGN.md` (مع النطاق `system`: ملف `DESIGN.md` في الجذر) | المجانية | صيغة DESIGN.md من Google Labs. الرموز تأتي كتجاوزات على مستوى الصفحة، وألوان `ship` فقط في الواجهة الأمامية للملف |
| `brief` | `design/explorations/<slug>/BRIEF.md` | المجانية | الموجز واللوحة مكتوبان نصا |
| `stitch_md` | `design/explorations/<slug>/FRANKENSTEIN.md` | المجانية | هيكل لكل صفحة فرانكنشتاين، مع الدور وملاحظة «خذ منه» ورابط المصدر لكل خانة، وإرشادات للبناء |
| `culture_md` | `design/explorations/<slug>/CULTURE.md` | المجانية | الموجز الثقافي، ثم كل عنصر في اللوحة يحمل `culture` مع تقليده ومستواه ومعناه ونسبته، وثلاثة أسئلة لمراجع من المجتمع |
| `review` | `design/explorations/<slug>/REVIEW.md` | Pro | قائمة التحقق لطريقة ابنِ ثم قيّم |
| `cursor_rules` | `.cursor/rules/gobanana-<slug>.mdc` | Pro | قواعد مع `globs` للصفحات |
| `copilot` | `.github/instructions/gobanana-<slug>.instructions.md` | Pro | قواعد مع `applyTo` للصفحات |
| `agents_md` | `AGENTS.md`، بين علامتي `<!-- gobanana:<slug> -->` | Pro | أي الصفحات، وأين الملفات، وما للإطلاق وما للاستكشاف، ولا صور، ومتى يكتمل العمل |
| `claude_md` | `CLAUDE.md`، بين العلامتين نفسيهما | Pro | المحتوى نفسه لـ Claude Code، مع استيرادات `@` |
| `tokens` | `design/explorations/<slug>/kit/tokens.json` | Pro | رموز تصميم W3C (بصيغة DTCG JSON) كتجاوزات للصفحات |
| `tailwind` | `design/explorations/<slug>/kit/theme.css` | Pro | سمة Tailwind للصفحات |
| `figjam_spec` | `design/explorations/<slug>/figjam-spec.json` | Pro | تخطيط اللوحة بصيغة JSON لإعادة بنائها في FigJam عبر Figma MCP |
| `html_board` | `design/explorations/<slug>/board.html` | Pro | لوحة HTML مستقلة تعرض الصور من روابطها الأصلية وتسرد المصادر |
| `wireframe_html` | `design/explorations/<slug>/frankenstein-wireframe.html` | Pro | مربعات رمادية لكل خانة مع تسميات الأدوار والملاحظات، وقائمة بالمصادر، بلا صور مراجع |

## الموجز الثقافي

إذا كان في اتجاه مُبقى عناصر تحمل كائن `culture`، أو كانت اللوحة فيها عدسة، يبدأ `DIRECTION.md` بـ **موجز ثقافي**: التقليد، والمستوى، وما نستخدمه، وما نتجنبه، والنسبة، والمصادر، والمراجع المقترح. راجع [الثقافة والتراث](/docs/ar/guides/culture/).

## كتلة النطاق

في نطاق الصفحة (وهو الافتراضي) يبدأ كل ملف Markdown بهذا:

```markdown
> **Scope: one wild page, not the product design system.** Applies only to: pricing page.
> Files: `**/pricing/**`, `**/pricing.*`.
> This inherits the project's own design system and its existing DESIGN.md, and does not change them.
> Tokens here are page level overrides: use them only inside these pages. The full spec lives in `design/explorations/<slug>/`.
```

ملفات JSON وCSS تحمل الجملة نفسها في تعليق أو في حقل.

## أسماء الصفحات تتحول إلى أنماط ملفات

| ما تمرره | الأنماط |
| --- | --- |
| `pricing page` | `**/pricing/**`، `**/pricing.*` |
| `/launch` | `**/launch/**`، `**/launch.*` |
| `/` | `**/app/page.*`، `**/pages/index.*` |
| `app/pricing/**` | `app/pricing/**` (يبقى كما هو) |
| `src/pages/onboarding.tsx` | `src/pages/onboarding.tsx` (يبقى كما هو) |

الكلمات الشائعة للصفحات تتحول إلى أسماء مختصرة: launch أو landing page تصبح `launch`، و404 تصبح `not-found`، وyear in review تصبح `year-in-review`، وsign up تصبح `signup`، وlog in تصبح `login`.

## الدمج

يعود `agents_md` و`claude_md` مع `append: true`. إذا وُجدت الكتلة بين `<!-- gobanana:<slug> -->` و`<!-- /gobanana:<slug> -->` فاستبدلها، وإلا فأضفها في آخر الملف. لا تكتب فوق الملف أبدا. في نطاق الصفحة لا يلمس GoBanana أبدا الملف `.github/copilot-instructions.md`، ولا ملف DESIGN.md في الجذر، ولا الرموز ولا السمة ولا ملفات CSS العامة.

## لا صور أبدا

لا يحتوي أي تصدير على صورة مرجع ولا ينزّلها. كل ملف يربط إلى المصادر. لوحة HTML ومواصفات FigJam تشير إلى روابط الصور الأصلية.

## ترتيب حزمة الأصول

تكتب المهارة `gobanana-asset-kit` ملفي `tokens` و`tailwind` مع ملفاتها الخاصة في مجلد حزمة مرقم:

| الملف | يحتوي |
| --- | --- |
| `kit/00-readme.md` | ما هي الحزمة، وصفحاتها، وما للإطلاق وما للاستكشاف |
| `kit/01-tokens.json` | تصدير `tokens` |
| `kit/02-tailwind-theme.css` | تصدير `tailwind` |
| `kit/03-gradients.css` | حتى 4 تدرجات مبنية فقط من أزواج `ship` |
| `kit/04-fonts.css` | زوج خطوط واحد برخصة مفتوحة (SIL OFL)، يمكن استضافته ذاتيا |
| `kit/05-icons.md` | Lucide (ISC) أو Phosphor (MIT)، مع المقاس وسماكة الخط |
| `kit/06-sources.md` | كل مرجع بصيغة `[title](link) (site)` |
