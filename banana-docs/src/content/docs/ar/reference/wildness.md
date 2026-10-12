---
title: الجموح والحركات والعدسات
description: مستويات الجموح الخمسة، والحركات الست التي يجمع بينها bend_brief، والعدسات الثقافية الثماني.
---

## الجموح

| المستوى | التسمية | الحركات لكل اتجاه | هل تبقى كلمات التخطيط | السطر الختامي في كل موجه |
| --- | --- | --- | --- | --- |
| 1 | Fresh (منعش) | 1 | نعم | "Keep the familiar layout and controls, change only the surface." |
| 2 | Bold (جريء) | 1 | لا | "Keep it usable, but let the layout bend." |
| 3 | Weird (غريب) | 2 | لا | "Let the two ideas collide in one screen." **الافتراضي** |
| 4 | Wild (جامح) | 2 أو 3، بالتناوب | لا | "Push further than feels safe." |
| 5 | Bananas (جنوني) | 3 | لا | "Ignore usability rules for this pass and make it unforgettable." |

من المستوى 3 فما فوق يحمل كل اتجاه **لمسة** (قاعدة واحدة قصيرة، مثل «رموز تعبيرية بدل الأيقونات»). في المستوى 5 تُحذف كلمات سهولة الاستخدام (easy، clean، intuitive) من الموضوع. وحتى في Bananas تبقى قائمة «تجنب» الخاصة بالمنصة وتباين النص وفق WCAG ضمن المواصفات.

## الحركات

| الحركة | ما تستعيره | شكل الاستعلام | عنوان للمثال |
| --- | --- | --- | --- |
| `transplant` | شكل غرض ما وتفاصيل طباعته وآثار استعماله | `{object} packaging design {mood}` | "Checkout as a spa-like cereal box" |
| `material` | خامة لها ضوء وظل حقيقيان | `{material} texture ui design` | "Launch page in sandstone" |
| `era` | خطوط حقبة أو حركة فنية وألوانها وشبكتها | `{era} graphic design {subject}` | "Rewound to Fluxus 1962" |
| `constraint` | قاعدة صارمة واحدة | `{constraint} web design` | "Flat color, no gradients, no exceptions" |
| `scale` | عنصر واحد يُكبَّر إلى حد هائل والباقي صغير | | "Giant sparklines everywhere" |
| `lens` | تقليد بصري | | "Woven like a Sadu tent band" |

مرّر `moves` إلى `bend_brief` لتحديد الحركات، مثل `["material", "era"]`.

## العدسات الثقافية

| المعرّف | التقليد | الاسم العربي |
| --- | --- | --- |
| `sadu` | Sadu weaving | نسيج السدو |
| `najdi` | Najdi architecture | العمارة النجدية |
| `kufic` | Square Kufic geometry | الزخرفة الكوفية الهندسية |
| `mashrabiya` | Mashrabiya | المشربية |
| `desert-modern` | Desert modern | الحداثة الصحراوية |
| `memphis` | Memphis design | تصميم ممفيس |
| `swiss-international` | Swiss International Style | الأسلوب السويسري الدولي |
| `japanese-ma` | Japanese ma (negative space) | الفراغ الياباني |

العدسة تجعل كل الاتجاهات تستمد من ذلك التقليد. تقترح المهارات عدسة عندما تذكر السعودية أو الخليج أو العربية أو التراث المحلي، ولا تستخدم أبدا النصوص المقدسة أو الآيات الدينية.

## التعلم

نتيجة الثني ثابتة للمدخلات نفسها، لكن أمرين يغيران فرص ظهور أي مكون:

- **تقييمك للاتجاهات.** الأفكار التي تستبعدها كثيرا عبر `rate_directions` تظهر أقل. تقييمات الآخرين لا تُحتسب إلا عندما يتفق عليها 3 مستخدمين مختلفين على الأقل.
- **التنوع.** الأفكار التي ظهرت في آخر 3 لوحات لك تصبح نادرة (لا مستحيلة) على اللوحة الجديدة، حتى لا ترى نقش السوزاني نفسه في كل موجز.
