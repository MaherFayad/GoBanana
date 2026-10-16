---
title: مهارات الإضافة
description: المهارات الاثنتا عشرة في إضافة GoBanana لـ Claude، وما تقوله لتشغيل كل واحدة، والأدوات التي تستدعيها، وما تحصل عليه.
---

تضيف الإضافة (`gobanana`، الإصدار 0.1.4) هذه المهارات فوق خادم MCP. يختار Claude المهارة المناسبة مما تقوله، ويمكنك أيضا أن تسميها بنفسك (`/gobanana-explore` في Claude Code). كل المهارات تتبع القواعد نفسها: رابط المصدر لكل مرجع، لا تنزيل للصور ولا نسخ لها، كلمات بسيطة، سؤال واحد على الأكثر في كل دور، وعرض رسالة الخطة أو الحصة مرة واحدة ثم التوقف.

| المهارة | قل شيئا مثل | الأدوات | ما تحصل عليه |
| --- | --- | --- | --- |
| `gobanana-explore` | «اجعل صفحة الإطلاق جامحة»، «أفكار مجنونة للتهيئة الأولى»، «اجعلها غريبة»، «أين يمكن أن يكون تطبيقنا غريبا» | `get_canvas`، `new_canvas`، `bend_brief`، `search_references`، `rate_references`، `rate_directions`، `add_to_canvas`، `arrange_canvas`، `open_canvas`، إضافة إلى موصل Mobbin لديك | 3 أو 4 اتجاهات مُبقاة على شكل بطاقات مواصفات مختصرة، ولوحة جاهزة في منطقتين مع ملاحظات «خذ منه»، وسطر واحد عما استُبعد |
| `gobanana-moodboard` | «اصنع لوحة إلهام»، «رتّب هذا»، «اجمعها حسب الاتجاه»، «ضعها في FigJam»، «اصنع لوحة HTML» | `get_canvas`، `add_to_canvas`، `arrange_canvas`، `export_kit` (`figjam_spec`، `html_board`) | أقسام لكل اتجاه، وصف للاتجاه الفني فوق شبكة الواجهات، وملاحظات «خذ منه»، وتخطيط مرتب، ويمكن إخراجها إلى FigJam أو HTML |
| `gobanana-frankenstein` | «frankenstein it»، «القائمة من هذا والقسم الرئيسي من ذاك»، «أعد مزج هذه»، «مخطط هيكلي من مراجعي» | `get_canvas`، `cut_parts`، `frankenstein_page`، `update_frankenstein`، `remix_frankenstein`، `open_canvas`، `export_kit` (`stitch_md`، `wireframe_html`) | 3 أو 4 صفحات فرانكنشتاين، كل منها هيكل مرقم مع روابط المصادر |
| `gobanana-build` | «ابن صفحة فرانكنشتاين هذه»، «ابن الشاشة من اللوحة»، «حول هذه الصفحة إلى كود من الأجزاء» | `reconcile_direction`، `get_snapshot`، `get_canvas`، `add_to_canvas` (`build`) | الشاشة مبنية صفا صفا مقابل الأجزاء، مع ملاحظة اتجاه RTL العربي لكل جزء، وفحص انحراف لكل صف، ولقطة من البناء توضع بجانب صفحة فرانكنشتاين الخاصة بها |
| `gobanana-palette` | «لوحة ألوان»، «ألوان من الاتجاه الفني»، «هل تنجح هذه الألوان في اختبار التباين» | `get_canvas`، `extract_palette` | ألوان مع أدوارها، وجدول تباين، و`ship` أو `explore` لكل زوج، وعينات ألوان على اللوحة |
| `gobanana-handoff` | «سلّم هذا»، «قواعد Cursor لهذا»، «موجه لـ v0»، «جهّز وكلائي لهذه الصفحة» | `get_canvas`، `export_kit` | حزمة التسليم بنطاقها، مكتوبة في مستودعك ومدمجة في AGENTS.md وCLAUDE.md |
| `gobanana-design-md` | «ملف DESIGN.md لهذه الصفحة»، «افحص ملف DESIGN.md» | `get_canvas`، `export_kit` (`design_md`، `direction_md`)، `npx @google/design.md@0.4.0 lint` | ملف DESIGN.md بنطاق محدد يمر من الفحص بلا أخطاء (حتى 3 جولات إصلاح) |
| `gobanana-agents-md` | «AGENTS.md»، «قواعد لوكلاء البرمجة»، «اجعل وكلائي يتبعون هذا الاتجاه» | `get_canvas`، `export_kit` (`agents_md`، `claude_md`) | قسم معلَّم في AGENTS.md (وCLAUDE.md) |
| `gobanana-asset-kit` | «حزمة الأصول»، «رموز تصميم لهذه الصفحة»، «تدرجات من لوحة الألوان»، «أي الخطوط والأيقونات» | `get_canvas`، `extract_palette`، `export_kit` (`tokens`، `tailwind`) | من `kit/00-readme.md` إلى `kit/06-sources.md` |
| `gobanana-culture` | «خله يحس سعودي»، «استخدم السدو»، «أبواب نجدية»، «حملة رمضان»، أو أي طلب يذكر ثقافة أو منطقة أو خطا أو مناسبة | `get_canvas`، `get_snapshot`، `bend_brief`، `search_references`، `rate_references`، `add_to_canvas`، `export_kit` | كل عنصر ثقافي بتسميته الدقيقة، مصنف حسب حساسيته، ومحول إلى جزء من الواجهة، مع ملاحظات المعنى والمأخوذ والنسب والحذر، وملخص ثقافي في التسليم |
| `gobanana-weekly-drop` | «إسقاط أسبوعي»، «فكرة جديدة لصفحة الأسعار كل اثنين»، «جدول لي أفكارا جامحة كل أسبوع» | `get_canvas`، `new_canvas`، `bend_brief`، `search_references`، `rate_references`، `add_to_canvas`، `arrange_canvas`، `open_canvas`، وتعمل على جدولتك أنت | بعد موافقتك، مهمة مجدولة في وكيلك تضيف جولة أفكار واحدة كل أسبوع إلى لوحة وتنشر الرابط |
| `gobanana-taste` | «وش ستايل هذا»، «صنف الستايلات»، «كلها شبه بعض»، «كلها داكنة»، «هذا رخيص؟» | `search_references`، `rate_references` (`styles`)، `add_to_canvas`، `get_canvas` (`summary`)، `bend_brief` | كل مرجع عليه [ستايله](/docs/ar/guides/styles/) من صورته المصغرة، وكل لوحة متنوعة، وكل اتجاه بستايل خاص فيه، وحكم واضح: ممتاز أو رخيص حسب معيار المالك |
| `gobanana-critique` | «قيّم البناء»، «هل يطابق هذا الاتجاه»، «قيّم صفحتي» | `get_canvas`، `export_kit` (`review`)، أداة متصفح | جدول نجاح أو إصلاح مع الأدلة، وأهم 3 إصلاحات، تُطبق ضمن نطاق الصفحة إذا وافقت |

## أزواج الخطوط في حزمة الأصول

كلها برخصة SIL Open Font License 1.1، ومتاحة على Google Fonts. الزوج الافتراضي هو `space-grotesk-inter`، والمنتجات ثنائية اللغة بالعربية والإنجليزية تحصل على زوج يدعم العربية.

| الزوج | خط العناوين | خط النص | الكتابة | الطابع |
| --- | --- | --- | --- | --- |
| `space-grotesk-inter` | Space Grotesk | Inter | لاتينية | تقني، نظيف، واثق |
| `fraunces-work-sans` | Fraunces | Work Sans | لاتينية | دافئ، تحريري، مرح |
| `playfair-source-sans` | Playfair Display | Source Sans 3 | لاتينية | فاخر، تحريري، كلاسيكي |
| `syne-dm-sans` | Syne | DM Sans | لاتينية | فني، تجريبي، معرض |
| `bricolage-instrument-sans` | Bricolage Grotesque | Instrument Sans | لاتينية | طريف، ودود، شركة ناشئة |
| `dm-serif-dm-sans` | DM Serif Display | DM Sans | لاتينية | أنيق، ضيافة، هادئ |
| `archivo-black-archivo` | Archivo Black | Archivo | لاتينية | ملصق، خشن، رياضي |
| `unbounded-manrope` | Unbounded | Manrope | لاتينية | مستقبلي، عملات رقمية، عريض |
| `instrument-serif-inter-tight` | Instrument Serif | Inter Tight | لاتينية | أزياء، تحريري، بسيط |
| `anton-work-sans` | Anton | Work Sans | لاتينية | ملصق، صاخب، مضغوط |
| `space-mono-space-grotesk` | Space Mono | Space Grotesk | لاتينية | قديم الطراز، طرفية، مطورون |
| `ibm-plex-arabic-plex-sans` | IBM Plex Sans Arabic | IBM Plex Sans | عربية، لاتينية | مؤسسي، تقنية مالية، ثنائي اللغة |
| `noto-kufi-noto-sans-arabic` | Noto Kufi Arabic | Noto Sans Arabic | عربية، لاتينية | هندسي، حكومي، تراثي |
| `readex-pro-plex-arabic` | Readex Pro | IBM Plex Sans Arabic | عربية، لاتينية | ودود، تطبيقات، ثنائي اللغة |
| `cairo-tajawal` | Cairo | Tajawal | عربية، لاتينية | تجزئة، سفر، حديث |
| `alexandria-almarai` | Alexandria | Almarai | عربية، لاتينية | جريء، أسلوب حياة، شبابي |
| `el-messiri-noto-naskh` | El Messiri | Noto Naskh Arabic | عربية، لاتينية | تراثي، تحريري، ضيافة |
| `reem-kufi-tajawal` | Reem Kufi | Tajawal | عربية، لاتينية | هندسي، ثقافي، لافتات |

## تعديل مهارة

المهارات ملفات `SKILL.md` عادية داخل `banana-plugin/skills/<name>/`. عدّل واحدة وحمّل المجلد باستخدام `claude --plugin-dir` لتجربتها. الواجهة الأمامية للملف (frontmatter) فيها `name` و`description` فقط، لذلك تعمل المهارة نفسها في Claude Code وClaude.ai وCowork. راجع [إعداد Claude Code](/docs/ar/setup/claude-code/#الخيار-الثالث-التطوير-المحلي-مع-plugin-dir).
