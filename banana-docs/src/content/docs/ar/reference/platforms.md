---
title: المنصات
description: كيف يكتشف GoBanana المنصة من الموجز، وما الذي تغيره كل منصة في الاتجاهات وعمليات البحث والتصدير والتقييم.
---

المنصة واحدة من `mobile` أو `tablet` أو `website` أو `webapp` أو `any`. المهارات تمررها دائما إلى `bend_brief`، ولا يكتشفها الخادم إلا إذا لم تُمرر. المصدر: `banana-server/lib/platform.ts`.

## قواعد الاكتشاف

يُحوَّل الموجز إلى أحرف صغيرة ويُقارن بهذه المجموعات **بالترتيب**. أول تطابق هو الذي يُعتمد.

| الترتيب | المنصة | الكلمات (بالإنجليزية والعربية) |
| --- | --- | --- |
| 0 | `website` | "mobile web"، "responsive website"، "responsive site" |
| 1 | `tablet` | ipad، ipados، tablet؛ آيباد، ايباد، تابلت، جهاز لوحي |
| 2 | `mobile` | iphone، ios، android، smartphone، phone، mobile app، apple watch، smart watch، watchos، wear os، watch app؛ آيفون، أندرويد، جوال، موبايل، هاتف |
| 3 | `website` | landing page، website، home page، marketing site أو page، portfolio site، personal site، blog، pricing page، launch page، campaign site أو page، microsite؛ صفحة هبوط، موقع |
| 4 | `webapp` | dashboard، web app، saas، admin، admin panel، console، crm، erp، analytics tool، back office، internal tool، cms، b2b؛ لوحة تحكم، لوحة معلومات |
| 5 | `mobile` | mobile، app، apps، app screen، home screen، lock screen؛ تطبيق |
| 6 | `website` | site، web page، page؛ صفحة |
| لا شيء | `any` | |

لذلك فإن "dashboard app on iPhone" تُعد جوالا (كلمات الأجهزة تتقدم)، و"pricing page for a SaaS tool" تُعد موقعا (صفحات التسويق تتقدم على كلمات المنتج).

## ما تغيره كل منصة

| | `mobile` | `tablet` | `website` | `webapp` | `any` |
| --- | --- | --- | --- | --- | --- |
| الشبكة | 4 أعمدة، هوامش 16px، منطقة الإبهام، شريط تبويب أو ورقة سفلية | 8 أعمدة، هوامش 24px، عرض مقسوم أو شريط جانبي في الوضع الأفقي | 12 عمودا، خط مرن الحجم، قصة تمرير مع إجراء أول واضح واحد | إطار بشريط جانبي، محتوى من 12 عمودا، جداول كثيفة، دعم كامل للوحة المفاتيح | شبكة واضحة، ونقطة تركيز واحدة |
| الكثافة | فكرة واحدة لكل شاشة، أهداف لمس 44pt، إيقاع 8pt | جزءان على الأكثر، أهداف لمس 44pt | أقسام فسيحة، النص أقل من 75 حرفا في السطر | كثيفة، إيقاع 8px، جداول مضغوطة | مريحة، إيقاع 8px |
| العناوين / النص | 34px / 17px | 40px / 17px | clamp(48px, 8vw, 120px) / 18px | 28px / 14px | 40px / 16px |
| الحركة | أقل من 300ms | أقل من 300ms | ظهور هادئ مع التمرير، لا يعيق القراءة أبدا | لا تحرك البيانات أبدا أثناء قراءتها | قصيرة |
| تجنب | أهداف أصغر من 44pt، تفاصيل لا تظهر إلا بالتمرير فوقها، نص أصغر من 16px، جداول عريضة تتطلب التمرير الأفقي | أهداف أصغر من 44pt، تخطيط هاتف ممطوط | غياب إجراء أول واضح، أسطر أطول من 75 حرفا، التحكم القسري في التمرير | الزخرفة في الجداول، الحركة على الأرقام الحية، نص كثيف منخفض التباين، ثغرات في دعم لوحة المفاتيح | نص بتباين أقل من 4.5:1، عناصر تحكم بالفأرة فقط |
| صياغة البحث | "app ui" | "ipad app ui" | "website" | "dashboard ui" | "ui design" |
| معارض الواجهات | ScreensDesign، Figma Community | ScreensDesign، Figma Community | Lapa Ninja، Siteinspire، Awwwards وغيرها | Refero، SaaSFrame، Nicelydone، 21st.dev | حسب كلمات الأسلوب |
| إطار صفحة فرانكنشتاين | 390px | 834px | 1440px | 1440px | (مثل الموقع) |
| مقاسات التقييم | 390x844 | 834x1194 | 1440x900 و390x844 | 1440x900 | 1440x900 و390x844 |

بعض أفكار الثني ممنوعة حسب المنصة، فلا يحصل الهاتف أبدا على "a strict 12 column grid" أو "everything rotated 90 degrees" أو خط بحجم 300 نقطة، ولا يحصل تطبيق الويب أبدا على "one sentence per screen" أو "a single giant number per screen".
