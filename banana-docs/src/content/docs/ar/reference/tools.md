---
title: أدوات MCP
description: كل الأدوات الـ 17 التي يعطيها خادم GoBanana لوكيلك، مجمعة حسب المهمة، مع الخطة والحصة وما تغيره كل أداة. المرجع الرسمي - banana-server/lib/mcp/tools.
---

يسجل خادم GoBanana MCP على `https://gobanana-server.maherfayad55.workers.dev/api/mcp` هذه الأدوات. نقطة الاتصال تتطلب تسجيل الدخول في كل استدعاء، لذلك تعمل كل أداة باسم حسابك.

## حسب المهمة

| الأداة | ما تفعله | الخطة | تستهلك عملية بحث | تغير البيانات |
| --- | --- | --- | --- | --- |
| [`ping`](/docs/ar/reference/tools/ping/) | تفحص الاتصال وتعرض بريدك الإلكتروني | الكل | لا | لا |
| **الثني والحكم** | | | | |
| [`bend_brief`](/docs/ar/reference/tools/bend-brief/) | تحول الموجز إلى اتجاهات جامحة مع مواصفات بصرية، أو تعيد مواضع الجنون | الكل، بلا حد | لا | تحفظ الاتجاهات مع `canvasId` |
| [`rate_directions`](/docs/ar/reference/tools/rate-directions/) | تبقي الاتجاهات على اللوحة أو تستبعدها | الكل | لا | نعم |
| **البحث والحكم** | | | | |
| [`search_references`](/docs/ar/reference/tools/search-references/) | تجد مراجع الواجهات والاتجاه الفني لاتجاه ما أو لاستعلام | الكل | **نعم، 1 لكل استدعاء** | تملأ الدرج مع `canvasId` |
| [`rate_references`](/docs/ar/reference/tools/rate-references/) | تقيّم النتائج بـ great أو bad، والسيئة تخرج ولا تعود أبدا | الكل | لا | نعم |
| **اللوحات** | | | | |
| [`new_canvas`](/docs/ar/reference/tools/new-canvas/) | تنشئ لوحة دون عرضها | الكل (المجانية: 3 لوحات) | لا | نعم |
| [`open_canvas`](/docs/ar/reference/tools/open-canvas/) | تعرض لوحة داخل المحادثة، أو تنشئ واحدة وتعرضها | الكل | لا | تنشئ لوحة إذا لم يُمرر `canvasId` |
| [`get_canvas`](/docs/ar/reference/tools/get-canvas/) | تقرأ لوحة، أو تسرد آخر 10 لوحات لك | الكل | لا | لا |
| [`get_snapshot`](/docs/ar/reference/tools/get-snapshot/) | تعرض للوكيل قسما أو صفحة فرانكنشتاين كصور مصغرة، جزءا جزءا | الكل | لا | لا |
| [`add_to_canvas`](/docs/ar/reference/tools/add-to-canvas/) | تضع المراجع وشاشات Mobbin ومنشورات X والملاحظات وعينات الألوان والأقسام | الكل (المجانية: 40 عنصرا) | لا | نعم |
| [`arrange_canvas`](/docs/ar/reference/tools/arrange-canvas/) | ترتب اللوحة أو قسما واحدا منها | الكل | لا | نعم |
| [`delete_canvas`](/docs/ar/reference/tools/delete-canvas/) | تحذف اللوحة نهائيا، مع `confirm: true` | الكل | لا | نعم، حذف نهائي |
| **Frankenstein it** | | | | |
| [`attach_screenshot`](/docs/ar/reference/tools/attach-screenshot/) | ترفق لقطة شاشة صوّرها وكيلك لمنشور X واحد، عشان ينقص منها | Pro (التجريبية: الكل) | لا | نعم، تحفظ صورة مرفوعة |
| [`cut_parts`](/docs/ar/reference/tools/cut-parts/) | تقص أجزاء (مستطيلات قص) إلى مكتبة الأجزاء | الكل | لا | نعم |
| [`frankenstein_page`](/docs/ar/reference/tools/frankenstein-page/) | تكدس الأجزاء في نسخ صفحات جديدة | الكل | لا | نعم |
| [`remix_frankenstein`](/docs/ar/reference/tools/remix-frankenstein/) | تصنع نسخا من صفحة مع قفل | الكل | لا | نعم |
| [`update_frankenstein`](/docs/ar/reference/tools/update-frankenstein/) | تغير صفحة واحدة بعمليات | الكل | لا | نعم |
| **الألوان والملفات** | | | | |
| [`extract_palette`](/docs/ar/reference/tools/extract-palette/) | ألوان مع أدوارها وتباين WCAG | الكل | لا | تحفظ لوحة الألوان، وعينات الألوان مع `addSwatches` |
| [`export_kit`](/docs/ar/reference/tools/export-kit/) | تعيد ملفات: DIRECTION.md، BUILD-PROMPT.md، قواعد... | المجانية: 6 صيغ، Pro: كل الصيغ الـ 16 | لا | لا |

توجد أداتان إضافيتان لعرض اللوحة فقط: `save_canvas_state` و`load_canvas_state`. مضيفات MCP Apps تخفيهما عن النموذج، ويجب ألا يستدعيهما الوكلاء.

## قواعد مشتركة

- **المدخلات تُفحص ولا تُرمى أخطاء.** كل أداة تعلن مخطط JSON صارما، لكنها ترد على المدخلات الخاطئة بجملة واحدة بسيطة، مثل "brief must be 1 to 500 characters.". اقرأ `content[0].text`.
- **نص مع بنية.** كل إجابة فيها نص مقروء للوكيل (`content`) والبيانات نفسها في `structuredContent` للتطبيقات.
- **المعرّفات.** معرّفات اللوحات والاتجاهات والمراجع والعناصر من 1 إلى 100 حرف من الحروف والأرقام و`_` و`-`. معرّفات الاتجاهات من `bend_brief` تشبه `bd-z0y2y96z`، ومعرّفات المراجع تشبه `ref_...`، ومعرّفات الأجزاء `pt-...`، ومعرّفات صفحات فرانكنشتاين `st-...`.
- **طلبات الإزالة** تُفحص عند كل تحميل للوحة وكل عملية بحث. الروابط المحجوبة تختفي في كل مكان، بما في ذلك روابط المشاركة.
- **روابط المصادر.** نص الأدوات يذكّر الوكيل باستمرار: اعرض دائما رابط المصدر لكل مرجع.
- **رسائل شائعة:** "You are not signed in. Reconnect to sign in again."، "That canvas was not found. Call open_canvas to create one, or check the canvasId."، "The canvas changed while saving. Try again."، "Something went wrong on our side. Try again in a minute."

## الترتيب المعتاد

```text
get_canvas (list) → new_canvas → bend_brief (count 8, canvasId)
→ search_references (per kept direction) → rate_references → rate_directions
→ add_to_canvas → arrange_canvas → open_canvas
→ cut_parts → frankenstein_page → update_frankenstein / remix_frankenstein
→ extract_palette → export_kit
```
