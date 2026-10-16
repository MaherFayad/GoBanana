---
title: المصادر
description: كل موقع يمكن أن يبحث فيه search_references، والمنصة والمنطقة التي يغذيها كل منها، وكلمات الأسلوب التي تستدعيه، ومضيفو الصور الذين تُحمّل منهم الصور.
---

يصل GoBanana إلى كل مصدر **عبر البحث عن الصور في الويب فقط** مع مرشح `site:`. لا يكشط GoBanana المواقع، ولا يجلب الصفحات، ولا يخزن الصور. لا تُبقى نتيجة إلا إذا كان رابطها عملا واحدا في ذلك الموقع (لقطة واحدة، أو pin، أو موقع، أو شاشة)، أما صفحات القوائم والوسوم والبحث فتُستبعد. المرجع الرسمي: `banana-server/lib/sources/registry.ts`.

## المصادر الأساسية

يُبحث فيها بصياغة خاصة بالواجهات على كل منصة. Pinterest وBehance يغذيان منطقة الاتجاه الفني أيضا.

| المعرّف | الموقع | المنطقة | صفحات الأعمال |
| --- | --- | --- | --- |
| `pinterest` | Pinterest | الواجهات والاتجاه الفني | `pinterest.com/pin/…` |
| `dribbble` | Dribbble | الواجهات | `dribbble.com/shots/…` |
| `behance` | Behance | الواجهات والاتجاه الفني | `behance.net/gallery/…` |
| `awwwards` | Awwwards | الواجهات، المواقع | `awwwards.com/sites/…` |

## أساليب المواقع الاستعراضية

إذا كان الموجز لـ**موقع** وذكر واحدا من هذه الأساليب، تجي المعارض الاستعراضية (Awwwards وCraftwork) أول، ويُبحث فيها بكلمات الأسلوب نفسه بدل موضوع الموجز. موجزات الجوال والجهاز اللوحي وتطبيقات الويب ما تتأثر.

| الأسلوب | الكلمات اللي تدل عليه | يبحث في Awwwards عن | يبحث في Craftwork عن |
| --- | --- | --- | --- |
| مرح | playful، fun، too fun، whimsical، quirky، cartoon | playful illustration | playful |
| WebGL | webgl، three.js، shader، real time 3d | webgl portfolio | webgl |
| ثلاثي الأبعاد | 3d، three dimensional | 3d landing page | 3d |
| قصة بالتمرير | scroll story، scrollytelling، storytelling، immersive scroll، parallax | scroll storytelling | interactive |
| خط متحرك | kinetic type، kinetic typography، animated type | kinetic typography | (ما يُبحث فيه) |
| حركة | motion، motion first، animated، animation، micro interactions | animation | animation |
| تفاعلي | interactive، gamified، playable | interactive | interactive |
| تجريبي | experimental، avant garde، unconventional | experimental | (ما يُبحث فيه) |

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
| `craftwork` | Craftwork (إلهام المواقع) | موقع، بأسلوب استعراضي فقط | playful، 3d، webgl، motion، interactive، scroll story |
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

`i.pinimg.com` · `cdn.dribbble.com` · `mir-s3-cdn-cf.behance.net` · `mir-cdn.behance.net` · `assets.awwwards.com` · `cdn.lapa.ninja` · `r2.siteinspire.com` · `www.cssdesignawards.com` · `cssdesignawards.com` · `cdn.landing.love` · `unsection.b-cdn.net` · `pub-26e6aa63ed7942ecb7e9dbc72f09f164.r2.dev` (Supahero) · `thefwa.com` · `httpster.net` · `sidhvpjhuucqcehkevrl.supabase.co` (Dark Design) · `craftwork-products.b-cdn.net` و`marketstorage.b-cdn.net` و`curated-images.b-cdn.net` (Craftwork) · `bentogrids.com` · `cdn.21st.dev` · `images.refero.design` · `cdn.prod.website-files.com` (SaaSFrame) · `assets.nicelydone.club` · `media.screensdesign.com` · `video.gumlet.io` و`framerusercontent.com` (60fps) · `s3-alpha.figma.com` · `s3-figma-hubfile-images-production-cdn-cgi.figma.com` · `original.fontsinuse.com` · `assets.fontsinuse.com` · `images.typographicposters.com` · `assets.typographicposters.com` · `www.swissted.com` · `the-brandidentity.com` · `bpando.org` · `cdn.cosmos.so` · `d2w9rnfcy7mm78.cloudfront.net` و`images.are.na` (Are.na) · `dspncdn.com`

معارض العروض والهويات تتحمل صورها كمان من `imgproxy.services.pitch.com` و`pitch-static-assets.imgix.net` (Pitch) و`www.underconsideration.com` (Brand New).

## إضافة معرض مصدرا

تُضاف المعارض الجديدة على الخادم، بإدخال واحد في السجل، بعد فحص حي لعدد النتائج التي تكون صفحات أعمال حقيقية. لا يستطيع المستخدمون إضافة مصادر بأنفسهم حاليا. اقترح مصدرا عبر وسيلة التواصل في [صفحة الخصوصية](https://gobanana-server.maherfayad55.workers.dev/ar/privacy).
