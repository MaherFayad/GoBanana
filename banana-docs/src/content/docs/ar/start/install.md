---
title: تثبيت الإضافة في Claude
description: إضافة GoBanana إلى Claude Code أو claude.ai أو Cowork.
---

تربط إضافة GoBanana تطبيق Claude بخادم MCP الخاص بـ GoBanana، وتضيف ست مهارات. تخبر المهارات Claude بالأدوات التي يستدعيها، وبترتيبها، وبطريقة عرض النتائج.

:::note[تجريبي]
الإضافة في الإصدار 0.1.0، ويحدد المتجر الذي يدرجها عند الإطلاق. إلى ذلك الحين يمكنك ربط الخادم مباشرة: راجع [ربط خادم MCP](/docs/ar/start/connect/).
:::

## Claude Code

ثبت الإضافة من المتجر الذي يدرج GoBanana:

```text
/plugin install gobanana --marketplace <owner>/<repo>
```

أو حمل مجلد الإضافة مباشرة أثناء التطوير:

```bash
claude --plugin-dir ./banana-plugin
```

ثم سجل الدخول:

1. نفذ `/mcp`.
2. اختر خادم GoBanana.
3. سجل الدخول في المتصفح.

يستخدم GoBanana بروتوكول OAuth، فلا يوجد مفتاح API للصقه.

:::caution[تغيير اسم الخادم]
تغير مفتاح الخادم في الإضافة من `banana` إلى `gobanana`. إذا ثبت نسخة قديمة، فأعد تثبيت الإضافة.
:::

## claude.ai وCowork

أضف الإضافة من إعدادات الإضافات في مؤسستك، أو من دليل Anthropic بعد إدراجها فيه. يظهر خادم GoBanana كموصل، فاربطه وسجل الدخول.

## المهارات

<div class="gb-table">

| المهارة | قل مثلا | ما يحدث |
| --- | --- | --- |
| `gobanana-explore` | "go wild on our checkout"، "push this design" | يصوغ الوصف، ويفتح لوحة، ويحوله إلى أفكار، ويحذف ما لا يمكن تحويله إلى واجهة، ويبحث عن مراجع للباقي، ثم يعرض الأفكار المختارة. |
| `gobanana-moodboard` | "make a moodboard"، "arrange this"، "put it in FigJam" | قسم لكل اتجاه، وملاحظات قصيرة، وترتيب نظيف. ويمكنه بناء لوحة FigJam عبر Figma MCP، أو لوحة HTML. |
| `gobanana-palette` | "palette"، "colors from these" | يستخرج الألوان مع أدوارها، ويسم كل زوج `ship` أو `explore` حسب تباين WCAG 2.2. |
| `gobanana-design-md` | "DESIGN.md"، "design system file" | يصدر DESIGN.md ويكتبه، ويشغل الفحص، ويصلح ما يظهره. |
| `gobanana-agents-md` | "AGENTS.md"، "rules for coding agents" | يكتب ملف AGENTS.md يوجه وكلاء البرمجة إلى DESIGN.md. |
| `gobanana-asset-kit` | "asset kit"، "starter kit" | رموز التصميم، وسمة Tailwind، وتدرجات CSS آمنة، وزوج خطوط مفتوح الترخيص، واختيار مجموعة أيقونات Lucide أو Phosphor، في ملفات مرقمة. |

</div>

إذا لم يستطع عميلك عرض اللوحة داخل المحادثة، فكل مهارة تعطيك رابط الويب لفتحها بملء الشاشة.

## التحقق من الاتصال

اطلب من Claude التحقق من اتصال GoBanana. يستدعي الأداة [`ping`](/docs/ar/reference/tools/ping/)، ويرد بالحساب الذي سجلت الدخول به.

## التالي

[لوحتك الأولى](/docs/ar/start/first-board/)
