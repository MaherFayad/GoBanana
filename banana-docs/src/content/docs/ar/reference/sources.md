---
title: المصادر
description: كل موقع يمكن أن يبحث فيه search_references، والمنصة والمنطقة التي يغذيها كل منها، وكلمات الأسلوب التي تستدعيه، ومضيفو الصور الذين تُحمّل منهم الصور.
---

يصل GoBanana إلى كل مصدر **عبر البحث عن الصور في الويب فقط** مع مرشح `site:`. لا يكشط GoBanana المواقع، ولا يجلب الصفحات، ولا يخزن الصور. لا تُبقى نتيجة إلا إذا كان رابطها عملا واحدا في ذلك الموقع (لقطة واحدة، أو pin، أو موقع، أو شاشة)، أما صفحات القوائم والوسوم والبحث فتُستبعد. المرجع الرسمي: `banana-server/lib/sources/registry.ts`. منشورات X مو مصدر بحث: تدخل اللوحة برابطها وتظهر بتضمين X نفسه (شوف [منشورات X](#منشورات-x)).

## المصادر الأساسية

يُبحث فيها بصياغة خاصة بالواجهات على كل منصة. Pinterest وBehance يغذيان منطقة الاتجاه الفني أيضا.

| المعرّف | الموقع | المنطقة | صفحات الأعمال |
| --- | --- | --- | --- |
| `pinterest` | Pinterest | الواجهات والاتجاه الفني | `pinterest.com/pin/…` |
| `dribbble` | Dribbble | الواجهات | `dribbble.com/shots/…` |
| `behance` | Behance | الواجهات والاتجاه الفني | `behance.net/gallery/…` |
| `awwwards` | Awwwards | الواجهات، المواقع | `awwwards.com/sites/…` |

## أساليب المواقع الاستعراضية

إذا كان الموجز لـ**موقع** وذكر واحدا من هذه الأساليب، تجي المعارض الاستعراضية (Awwwards) أول، ويُبحث فيها بكلمات الأسلوب نفسه بدل موضوع الموجز. موجزات الجوال والجهاز اللوحي وتطبيقات الويب ما تتأثر.

| الأسلوب | الكلمات اللي تدل عليه | يبحث في Awwwards عن |
| --- | --- | --- |
| مرح | playful، fun، too fun، whimsical، quirky، cartoon | playful illustration |
| WebGL | webgl، three.js، shader، real time 3d | webgl portfolio |
| ثلاثي الأبعاد | 3d، three dimensional | 3d landing page |
| قصة بالتمرير | scroll story، scrollytelling، storytelling، immersive scroll، parallax | scroll storytelling |
| خط متحرك | kinetic type، kinetic typography، animated type | kinetic typography |
| حركة | motion، motion first، animated، animation، micro interactions | animation |
| تفاعلي | interactive، gamified، playable | interactive |
| تجريبي | experimental، avant garde، unconventional | experimental |

## معارض الواجهات حسب المنصة

| المعرّف | الموقع | المنصة | كلمات الأسلوب التي تستدعيه |
| --- | --- | --- | --- |
| `lapa` | Lapa Ninja | موقع | landing page |
| `siteinspire` | Siteinspire | موقع | minimal، editorial، swiss style |
| `cssda` | CSS Design Awards | موقع | award، immersive |
| `landinglove` | landing.love | موقع | motion، animation، landing page |
| `unsection` | Unsection | موقع | hero، section، pricing، features |
| `supahero` | Supahero | موقع | hero، hero section |
| `thefwa` | The FWA | موقع | immersive، 3d، motion، award |
| `httpster` | Httpster | موقع | brutalist، typography، big typography، editorial |
| `darkdesign` | Dark Design | موقع | dark mode، dark |
| `21st` | 21st.dev (مكونات React وTailwind) | موقع، تطبيق ويب | component، react، shadcn، hero section، animated |
| `refero` | Refero | تطبيق ويب | |
| `saasframe` | SaaSFrame | تطبيق ويب | |
| `nicelydone` | Nicelydone | تطبيق ويب | |
| `screensdesign` | ScreensDesign | جوال، جهاز لوحي | |
| `figma` | Figma Community | جوال، جهاز لوحي | (يجب أن تدل العناوين على واجهات، وتُستبعد حزم الواجهات ومجموعات الأيقونات) |
| `bentogrids` | Bento Grids | أي منصة، حسب الأسلوب | bento grid، bento |
| `60fps` | 60fps | أي منصة، حسب الأسلوب | motion، animation، micro-interaction |

## معارض الفن (منطقة الاتجاه الفني)

تُختار عندما تذكر استعلامات الاتجاه الفني أو اسم الفكرة وسومها.

| المعرّف | الموقع | الوسوم |
| --- | --- | --- |
| `fontsinuse` | Fonts In Use | typography، editorial، type، lettering، poster، serif، retro |
| `typoposters` | typo/graphic posters | poster، typography، swiss style، experimental |
| `swissted` | Swissted | swiss style، international style، punk |
| `brandidentity` | The Brand Identity | branding، identity، brand، luxury |
| `bpando` | BP&O | packaging، branding، label |
| `cosmos` | Cosmos | collage، moodboard، texture، grainy، y2k |
| `arena` | Are.na | collage، moodboard، experimental، archive |
| `designspiration` | Designspiration | poster، print، graphic design، illustration |

## موجزات العروض والهويات

إذا الموجز ما ذكر جوال ولا جهاز لوحي ولا موقع ولا تطبيق ويب، لكنه ذكر عرض تقديمي أو هوية، ياخذ مسار خاص فيه بدل مسارات الواجهات:

- **العروض التقديمية** (مسار `deck`): pitch deck، keynote، slide layout، data slide، editorial deck، dark deck، big number slide. يدور في Dribbble وBehance وPinterest ومعرض قوالب Pitch، والأسلوب الافتراضي داكن إلا إذا ذوقك أو الموجز ذكر أسلوب ثاني.
- **الهوية والتصميم الجرافيكي** (مسار `brand`): brand identity، logo system، brand guidelines، visual identity، poster، packaging، typographic. يدور أول شي في The Brand Identity وBP&O وBrand New وFonts In Use وtypo/graphic posters، وبعدها Behance وDribbble وPinterest.

لازم عنوان النتيجة يذكر نوع العمل (نتائج الشاشات والتطبيقات تنشال)، وأعمال المعارض تمشي مثل ما هي. مثلا "pitch deck for a fintech startup" و"packaging for an olive oil brand" تستخدم هالمسارات، أما "pitch deck builder web app" فيظل موجز تطبيق ويب.

| المعرّف | الموقع | النوع | صفحات الأعمال |
| --- | --- | --- | --- |
| `pitch` | قوالب Pitch | العروض التقديمية | `pitch.com/templates/…` |
| `brandnew` | Brand New (UnderConsideration) | الهوية | `underconsideration.com/brandnew/archives/….php` |

## كيف يختار البحث مصادره

في عملية بحث واحدة لاتجاه واحد يختار الخادم:

1. **معرضين للواجهات على الأكثر**: أولا المعارض التي تطابق وسوم أسلوبها كلمات أسلوب الاتجاه أو الموجز (وتناسب المنصة)، ثم معارض المنصة، مع تدويرها لكل اتجاه حتى يبحث اتجاهان على اللوحة نفسها في معارض مختلفة.
2. **معرضا فنيا واحدا على الأكثر** تذكر استعلامات الاتجاه الفني وسومه، إضافة إلى Pinterest وBehance لمسار الاتجاه الفني.
3. **المصادر الأساسية** لمسارات الواجهات.

مرّر `sources` (من 1 إلى 4 معرّفات) إلى `search_references` فقط عندما تريد مواقع محددة.

## مضيفو الصور

تُحمّل الصور في متصفحك مباشرة من هؤلاء المضيفين (وهم أيضا ضمن سياسة أمان المحتوى في اللوحة). إذا حجبت شبكتك أحدهم، تظهر مربعاته على شكل بطاقات روابط.

`i.pinimg.com` · `cdn.dribbble.com` · `mir-s3-cdn-cf.behance.net` · `mir-cdn.behance.net` · `assets.awwwards.com` · `cdn.lapa.ninja` · `r2.siteinspire.com` · `www.cssdesignawards.com` · `cssdesignawards.com` · `cdn.landing.love` · `unsection.b-cdn.net` · `pub-26e6aa63ed7942ecb7e9dbc72f09f164.r2.dev` (Supahero) · `thefwa.com` · `httpster.net` · `sidhvpjhuucqcehkevrl.supabase.co` (Dark Design) · `bentogrids.com` · `cdn.21st.dev` · `images.refero.design` · `cdn.prod.website-files.com` (SaaSFrame) · `assets.nicelydone.club` · `media.screensdesign.com` · `video.gumlet.io` و`framerusercontent.com` (60fps) · `s3-alpha.figma.com` · `s3-figma-hubfile-images-production-cdn-cgi.figma.com` · `original.fontsinuse.com` · `assets.fontsinuse.com` · `images.typographicposters.com` · `assets.typographicposters.com` · `www.swissted.com` · `the-brandidentity.com` · `bpando.org` · `cdn.cosmos.so` · `d2w9rnfcy7mm78.cloudfront.net` و`images.are.na` (Are.na) · `dspncdn.com`

معارض العروض والهويات تتحمل صورها كمان من `imgproxy.services.pitch.com` و`pitch-static-assets.imgix.net` (Pitch) و`www.underconsideration.com` (Brand New).

## منشورات X

منشورات X تدخل اللوحة **برابطها**، وما تجي أبدا من البحث عن الصور: رابط منشور تعطيه أنت أو وكيلك لـ `add_to_canvas` (`{ "type": "xpost", "url": "https://x.com/<handle>/status/<id>" }`)، أو رابط منشور X رجع بالصدفة في بحث ويب، ويعرضه `search_references` كرابط بس بدون صورة.

- **وش ينحفظ:** رابط المنشور ورقمه واسم صاحبه ومعرّفه ونص المنشور، وملاحظتك وعلامة Ship أو Explore حقتك. تجي من نقطة oEmbed العامة حقت X (`publish.x.com/oembed`، اللي يوثقها X للتضمين)، وتنحفظ مؤقتا برقم المنشور ليوم واحد. ما ينحفظ ولا ينسخ أي صورة أو فيديو من X.
- **اللوحة على الويب:** يظهر المنشور بتضمين X الرسمي (`platform.twitter.com/widgets.js`)، ويتحمل بس لما يكون المربع قدامك على الشاشة، فالفيديو يشتغل داخل المنشور. إذا ما قدر X يتحمل، يصير المربع بطاقة فيها صاحب المنشور والنص و**Open on X**.
- **اللوحة داخل المحادثة:** بطاقة رابط فيها صاحب المنشور و**Open on X**. إطار المحادثة ما يسمح بتضمين X، وشروط المطورين حقت X ما تسمح بعرض محتوى X داخل إطار.
- **التصدير:** رابط مع ذكر صاحبه، مثل "Post by Name (@handle) on X".
- **ما يدخل أي نموذج أبدا:** المنشور ما له صورة مصغرة، فـ GoBanana ما يعرضه على أي نموذج، ونص المنشور ما يطلع في اللي ترجعه الأدوات.
- **أجزاء Frankenstein:** وكيلك نفسه يصوّر لقطة شاشة لهذا المنشور بالذات ويرفقها بـ [attach_screenshot](/docs/ar/reference/tools/attach-screenshot/)، وبعدها ينقص منها مثل أي صورة مرفوعة، وكل جزء يحتفظ برابط المنشور وذكر صاحبه. GoBanana نفسه ما يجلب ولا يصوّر شي من X.

## إضافة معرض مصدرا

تُضاف المعارض الجديدة على الخادم، بإدخال واحد في السجل، بعد فحص حي لعدد النتائج التي تكون صفحات أعمال حقيقية. لا يستطيع المستخدمون إضافة مصادر بأنفسهم حاليا. اقترح مصدرا عبر وسيلة التواصل في [صفحة الخصوصية](https://gobanana-server.maherfayad55.workers.dev/ar/privacy).
