---
title: bend_brief
description: يحول موجز التصميم إلى اتجاهات جامحة لصفحة واحدة أو صفحتين، ولكل اتجاه مواصفات بصرية تناسب المنصة وكلمات بحث للاتجاه الفني ونص أمر. وإذا لم تحدد صفحات يعيد wildSpots.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط، بلا حد | لا شيء | فقط مع `canvasId`: يحفظ الاتجاهات | idempotent |

الثني حتمي: الموجز نفسه بمستوى الجموح والمنصة والصفحات والحركات والعدسة نفسها يعطي الاتجاهات نفسها بالمعرفات نفسها. سجل تقييماتك في `rate_directions` والأفكار التي على آخر 3 لوحات لك تغير الاحتمالات، فلا ترى الفكرة نفسها مع كل موجز جديد.

## المدخلات

| الاسم | النوع | مطلوب | الحدود والقيمة الافتراضية | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `brief` | string | نعم | من 1 إلى 500 حرف | ما الذي تصممه، في كلمات قليلة: "flight checkout screen" |
| `wildness` | integer | نعم | من 1 إلى 5 | ‏1 Fresh، و2 Bold، و3 Weird، و4 Wild، و5 Bananas. كلما ارتفع المستوى جمع حركات أكثر |
| `count` | integer | لا | من 1 إلى 8، والافتراضي 6 | عدد الاتجاهات. المهارة تطلب 8 |
| `platform` | enum | لا | `mobile`، `tablet`، `website`، `webapp`، `any` | اتركه فارغا ليستنتجه من الموجز. [القواعد](/docs/ar/reference/platforms/) |
| `pages` | string[] | لا | من 1 إلى 3، وكل واحدة حتى 60 حرفا | الصفحات التي تخصها الفكرة. اتركه فارغا لتحصل على `wildSpots` |
| `moves` | enum[] | لا | `transplant`، `material`، `era`، `constraint`، `scale`، `lens` | يحصر الحركات المستخدمة. الافتراضي الست كلها |
| `lens` | enum | لا | `sadu`، `najdi`، `kufic`، `mashrabiya`، `talli`، `qatt-asiri`، `desert-modern`، `memphis`، `swiss-international`، `japanese-ma` | كل اتجاه يستلهم من هذا التقليد |
| `mustKeep` | string[] | لا | من 1 إلى 6، وكل واحد حتى 60 حرفا | أنماط يعتمد عليها المستخدمون ("clear total"، "one primary action"، "step indicator"). يسقط أي اتجاه قد يكسر واحدا منها. موجزات الدفع والسلة والحجز تحافظ افتراضيا على إجمالي واضح وإجراء رئيسي واحد |
| `brand` | object | لا | `designMd` حتى 20,000 حرف، و`tokens` كائن JSON حتى 20,000 حرف، و`stretch` مطلوب | هوية منتجك، وكم تقدر الاتجاهات تبعد عنها. شوف [مرونة الهوية](#مرونة-الهوية) |
| `taste` | string[] | لا | من 1 إلى 5 كلمات، وكل كلمة حتى 40 حرفا | كلمات الذوق، تحفظ على اللوحة مع `canvasId` |
| `fromUpload` | object | لا | `uploadId` (من رفوعاتك أنت)، و`roles` اختيارية (من 1 إلى 12 دورا من [أدوار الأجزاء](/docs/ar/reference/tools/cut-parts/)) | حوّل صفحتك أنت. بدون `roles` تعرض الإجابة لقطة الشاشة (حتى 1.5 ميغابايت) وتطلب من الوكيل سرد أجزائها من الأعلى إلى الأسفل. ومع `roles` تكتب سطر الأساس منها. تعمل رفوعاتك أنت فقط |
| `canvasId` | string | لا | من 1 إلى 100 حرف | يحفظ الاتجاهات على تلك اللوحة، فيقبل `search_references` معرف `directionId` |

## المخرجات

لكل اتجاه: `id`، و`title` (الفكرة في 4 كلمات على الأكثر، ولا يذكر الموجز)، و`twist` (دائما ابتداء من مستوى الجموح 3)، و`move`، و`searchQuery`، و`platform`، و`pages`، و`mechanic`، و`artQueries` (من 1 إلى 3 عبارات بحث صور لمنطقة الاتجاه الفني، بصيغة الموضوع والخامة والتكوين)، و`prompt`، و`spec`.

`mechanic` هو `{ element, how }`: الجزء العامل في الصفحة الذي تصبحه الفكرة الجامحة، وهو واحد من `progress` أو `total` أو `cta` أو `divider` أو `section-nav` أو `header` أو `empty-state` أو `plan` (بطاقات الباقات في صفحة اختيار الباقة أو الأسعار؛ ضفيرة كشريط التقدم، وتبويبات كأقسام، وشريط منسوج كفاصل بين الأقسام). لا يقع أبدا على إجمالي أو زر رئيسي محمي. ابن الاتجاه حوله، وابحث عن واجهات فيها هذا العنصر.

حقول `spec`:

| حقل المواصفات | مثال |
| --- | --- |
| `typeVoice`، `typography` | mono: a monospace for display at clamp(48px, 8vw, 120px), the same mono for body at 18px |
| `color` | Chalky terracotta, sage and bone, no gloss; text at 4.5 to 1 or more |
| `layout` | 12 column grid, fluid type, a scroll story that opens on a hero with one clear action |
| `imagery`، `texture`، `iconography` | Close-up sandstone renders; layered sandstone bands; emoji stand in for every icon |
| `motion` | Slow 300ms fades, nothing loops, none with reduced motion on |
| `density` | Airy sections, one message per screen height |
| `signature`، `pattern` | The hero section rendered in sandstone; layered panels as the section divider |
| `steal[]`، `avoid[]` | How light sits on sandstone; text over sandstone without a solid backing |
| `styleWords[]`، `whyItFits` | minimal; "A dusty matte mood suits hungry people deciding fast" |

ويضاف إليها `platform`، و`pages`، و`wildness`، و`wildnessLabel`، و`lens` (مع `arabicFont`، خط عرض عربي من Google Fonts، ومع `culture`: `tier` و`meaning` و`uiMappings` كصفوف من العنصر والقواعد وآلية الواجهة، وأسطر `care` و`sources` الموثقة، وتنطبق على كل اتجاه)، و`suggestedLenses` (حتى 3 معرفات عدسات عندما يذكر الموجز سوقا خليجية أو عربية أو العربية ولم تحدد عدسة)، و`wildSpots` (خمسة مواضع، وتكون فارغة إذا مررت `pages`). ومع `canvasId`: يضاف `canvasId` و`saved`.

## مرونة الهوية

الشغل الجامح ما ينشر إلا إذا وافق عليه فريق الهوية. مرر ملف DESIGN.md حق المنتج (`designMd`)، أو رموز التصميم (`tokens`)، أو الاثنين، مع `stretch`:

| `stretch` | وش يحافظ عليه كل اتجاه |
| --- | --- |
| `keep-logo-and-primary` | اللون الأساسي للهوية يبقى لون الإجراء الرئيسي واللون المميز، والشعار يبقى مثل ما تنشره الهوية. قواعد الشعار من DESIGN.md تنضاف لقائمة `avoid` ولنص الأمر في كل اتجاه. والاتجاه اللي آليته الترويسة يخلي الشعار فيها بدون أي تغيير |
| `keep-primary` | اللون الأساسي للهوية يبقى لون الإجراء الرئيسي واللون المميز. الشعار وكل شي ثاني يقدر يتغير |
| `free` | ولا شي. اللون الأساسي ينذكر في نص الأمر كمرجع، مو كقاعدة |

اللون الأساسي ينقرأ من رمز اسمه `primary` (مثل `color.brand.primary` مع `$value`)، وإذا ما لقاه ياخذه من أول سطر في DESIGN.md يذكر "primary" ومعه لون hex. الخادم ما يخمن لون أبدا: إذا ما لقى شي يقول لك في النتيجة، وتقدر تمرر الرموز أو سطر مثل `Primary: #1A56DB`. بعدها يصير سطر اللون: "Brand primary #1A56DB stays the main action and accent color, with #FFFFFF text on it (6.18 to 1); the idea's palette supports it: ...". الهوية ما تغير معرفات الاتجاهات ولا الأفكار اللي تطلع لك.

```json
{
  "name": "bend_brief",
  "arguments": {
    "brief": "checkout for a payments app",
    "wildness": 3,
    "platform": "mobile",
    "brand": {
      "designMd": "## Colors\n- Primary: #1A56DB\n\n## Logo\n- Keep clear space of 16px around the logo.",
      "stretch": "keep-logo-and-primary"
    }
  }
}
```

```text
Brand stretch keep-logo-and-primary: every direction keeps the brand primary and the logo as shipped. Read: primary #1A56DB, 1 logo rule.
```

## مثال على الاستدعاء

```json
{
  "name": "bend_brief",
  "arguments": {
    "brief": "launch page for a specialty coffee roaster",
    "wildness": 3,
    "count": 2,
    "platform": "website",
    "pages": ["launch page"],
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f"
  }
}
```

## مثال على المخرجات

مخرجات حقيقية من محرك الثني، بعد اختصارها:

```text
2 directions for "launch page for a specialty coffee roaster" (wildness 3, Weird):
Platform: website (website). Each direction is for one wild page or two, not the product's main design.
Pages: launch page.

1. Fluxus 1962 sandstone (Twist: only circles and half circles, no exceptions) [material + era] query: sandstone
   id: bd-z0y2y96z. Prompt: Redesign the specialty coffee launch page. Render every surface as sandstone...
   Mechanic: build this direction around cta = Sandstone skins the main button; still one button with a plain label. Search for UI that has this element.
   Spec: type mono: A monospace for display at clamp(48px, 8vw, 120px)... | color: Chalky terracotta, sage and bone...
   Signature: The hero section rendered in sandstone, with real light and shadow. Pattern: Layered sandstone panels...
   Art queries: sandstone texture; Fluxus graphic design
2. Cereal box (Twist: sparklines blown up huge) [scale + transplant] query: cereal box
   id: bd-mob5pq35. ...
   Mechanic: build this direction around section-nav = Cereal box as the tabs that switch between sections. Search for UI that has this element.
   Art queries: cereal box; oversized sparklines poster

Saved to canvas c3f1a0d2-.... Pass a direction id as directionId (with this canvasId) to search_references.
```

## مواضع الجنون

استدعه بدون `pages` (وبدون `canvasId` إذا كنت لا تريد حفظ شيء):

```json
{ "name": "bend_brief", "arguments": { "brief": "personal finance app", "wildness": 3, "count": 1, "platform": "mobile" } }
```

```text
Pages: none given. Where weirdness pays off (wildSpots):
- onboarding: Seen once, sets the tone, and nobody has learned the layout yet.
- empty state: Nothing to read yet, so the screen has room for a strong idea.
- achievement or streak moment: A reward should feel special, not like every other screen.
- paywall: A memorable paywall sells the feeling, not just the feature list.
- splash screen: A second of brand with no task to get in the way.
```

## الرسائل

| الرسالة | الحل |
| --- | --- |
| "brief must be 1 to 500 characters, for example "flight checkout screen"." | اختصر الموجز |
| "wildness must be a whole number from 1 (Fresh) to 5 (Bananas)." | مرر قيمة من 1 إلى 5 |
| "pages must be 1 to 3 page names, each up to 60 characters." | صفحات أقل وأسماء أقصر |
| "brand needs a stretch (keep-logo-and-primary, keep-primary, free), with designMd up to 20000 characters and tokens as a JSON object up to 20000 characters." | أضف `stretch`، أو قص DESIGN.md أو الرموز على أجزاء الألوان والشعار بس |
| "canvasId must be an id from open_canvas." | استخدم معرف لوحة حقيقيا |
| "The directions were not saved: that canvas was not found or could not be reached..." | الاتجاهات تعود رغم ذلك. ابحث بنص بحثها، أو أعد الثني بمعرف صالح |

ذو صلة: [اجعل شاشتك جامحة](/docs/ar/guides/go-wild/)، [الجموح والحركات والعدسات](/docs/ar/reference/wildness/).
