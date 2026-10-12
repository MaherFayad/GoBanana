---
title: search_references
description: يجد مراجع تصميم لاتجاه من الثني أو لنص بحث، في منطقتين هما مراجع الواجهات والاتجاه الفني، ومع كل مرجع رابط مصدره. كل استدعاء عملية بحث واحدة.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط | **عملية بحث واحدة لكل استدعاء** (المجانية 30 في الشهر، Pro ‏300) | مع `canvasId`: يملأ الدرج ويحفظ كلمات الذوق | open world |

النتائج روابط وعناوين فقط. GoBanana لا ينزل الصور ولا يخزنها أبدا. البحث الفاشل لا يحتسب.

## المدخلات

| الاسم | النوع | مطلوب | الحدود والقيمة الافتراضية | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `directionId` | string | أحد هذين | من 1 إلى 100 حرف | اتجاه من `bend_brief` محفوظ على لوحة. يبحث في كل مساراته |
| `query` | string | أحد هذين | من 1 إلى 300 حرف | كلمات عادية. مع `directionId` و`lane`: الكلمات الجديدة لذلك المسار |
| `canvasId` | string | لا | من 1 إلى 100 حرف | يضيف النتائج إلى درج تلك اللوحة، ويتخطى النتائج الموجودة عليها |
| `count` | integer | لا | من 4 إلى 24، والافتراضي 12 | عدد النتائج |
| `zone` | enum | لا | `ui`، `art`، `both` | الافتراضي `both` للاتجاه (قرابة الثلث للاتجاه الفني، و3 على الأقل)، و`ui` لنص البحث |
| `lane` | enum | لا | `fidelity`، `taste`، `component`، `hero`، `bridge`، `locale`، `gallery`، `art` | مع `directionId` و`query`: يعيد مسارا واحدا |
| `taste` | string[] | لا | من 1 إلى 5 كلمات | كلمات الذوق، تحفظ على اللوحة |
| `sources` | enum[] | لا | من 1 إلى 4 معرفات مصادر | يفرض مصادر بعينها. إذا تركته يختار الخادم المعارض حسب المنصة والأسلوب. [معرفات المصادر](/docs/ar/reference/sources/) |
| `mix` | enum | لا | `ui`، `balanced`، `wild` | يتجاهله الخادم. باق حتى تعمل الاستدعاءات القديمة |
| `thumbs` | boolean | لا | القيمة الافتراضية `true` | صورة مصغرة لكل نتيجة (حتى 12) بعد النص، كل صورة بعد السطر الذي يسميها، حتى يقيم الوكيل ويكتب ملاحظاته من الصورة لا من العنوان. تجلب في كل استدعاء بالحجم الصغير للمصدر ولا تحفظ أبدا. انظر [get_snapshot](/docs/ar/reference/tools/get-snapshot/) |

## المسارات

بحث الاتجاه يشغل عدة مسارات في الوقت نفسه، ولكل مسار صياغته:

| المسار | المنطقة | يبحث عن |
| --- | --- | --- |
| `fidelity` | الواجهات | شاشات حقيقية للصفحة على المنصة |
| `taste` | الواجهات | كلمات الأسلوب للصفحة (كلماتك، أو كلمات الاتجاه) |
| `hero` | الواجهات | أقسام الواجهة الرئيسية (hero) في المواقع |
| `component` | الواجهات | المكونات التي يذكرها الموجز والمواصفات (bottom sheet، جدول أسعار...) |
| `bridge` | الواجهات | الفكرة الجامحة مطبقة على واجهة من قبل. غالبا يكون فارغا |
| `locale` | الواجهات | واجهات عربية، إذا كان الموجز بالعربية |
| `gallery` | الواجهات | معارض واجهات منتقاة حسب المنصة والأسلوب |
| `art` | الاتجاه الفني | كلمات `artQueries` الخاصة بالاتجاه كصور خام على Pinterest وBehance ومعارض الفن |

## ما يرشحه الخادم

- يقبل صفحات العناصر فقط من المواقع المختارة (لقطة واحدة، أو pin، أو موقع، أو شاشة)، ويستبعد صفحات القوائم والوسوم والبحث.
- يستبعد حزم الواجهات (UI kits) والقوالب والعناوين التي فيها "for Adobe XD" أو "Figma kit".
- نتيجتان على الأكثر لكل استوديو أو مصمم، والأعمال الأحدث أولا على Dribbble وBehance.
- العناوين التي لا تناسب المنصة (لوحات تحكم ويب لموجز هاتف، أو شاشات هاتف لموجز تطبيق ويب).
- النتائج الرديئة في منطقة الاتجاه الفني: المتاجر، وقوائم المنتجات، والأسعار، والأزياء، وEtsy أو Amazon، وصفحات الشعارات، والصور الجاهزة (stock).
- كل ما قيمته `bad` من قبل، وكل ما هو موجود على اللوحة نفسها.
- الروابط والنطاقات التي أزيلت.

يبقى على وكيلك أن يحكم على كل نتيجة ويقيم ما تبقى باستخدام [`rate_references`](/docs/ar/reference/tools/rate-references/).

## مثال على الاستدعاء

```json
{
  "name": "search_references",
  "arguments": {
    "directionId": "bd-mob5pq35",
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "count": 12
  }
}
```

أعد مسارا واحدا بكلمات أفضل:

```json
{
  "name": "search_references",
  "arguments": {
    "directionId": "bd-mob5pq35",
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "lane": "bridge",
    "query": "cereal box hero section website"
  }
}
```

## مثال على المخرجات

الشكل العام، بعناوين ومعرفات للمثال:

```text
Found 8 UI references and 4 art direction references for "cereal box". Show each source link with its image.
UI references:
1. [ref_8k2..., fidelity] Coffee brand landing page (lapa.ninja, ui): https://www.lapa.ninja/post/...
2. [ref_9x1..., hero] Bold packaging hero (dribbble.com, ui): https://dribbble.com/shots/...
...
Art direction (place these in the art row, not with the UI references):
9. [ref_3m7..., art] Vintage cereal box back panel (pinterest.com, art): https://www.pinterest.com/pin/...
...
Added to the tray of canvas c3f1a0d2-....
Rate standouts and misses with rate_references (ids in brackets).
```

يحمل `structuredContent` الحقول `references[]` (ولكل مرجع `id`، و`title`، و`sourceUrl`، و`sourceSite`، و`imageUrl`، و`thumbUrl`، و`zone`، و`lane`)، و`zones` (الأعداد)، و`queries`، و`lanes`، و`sources`، و`dropped`، و`addedToTray`.

## الرسائل

| الرسالة | الحل |
| --- | --- |
| "You have used your 30 free searches this month. Upgrade: …" | راجع [الخطط](/docs/ar/reference/plans/) |
| "Pass a directionId from bend_brief or a query." | مرر أحدهما |
| "That direction was not found. Directions are saved only when bend_brief gets a canvasId…" | اثن الموجز مع `canvasId`، أو ابحث باستخدام `query` |
| "To redo one lane, pass directionId, lane and query (the new words for that lane)." | أضف الحقل الناقص |
| "That direction has no hero lane. Its lanes: fidelity, taste, …" | اختر مسارا من القائمة |
| "Search failed. Try again in a minute." | أعد المحاولة مرة واحدة. لا يحتسب |

ذو صلة: [المصادر](/docs/ar/reference/sources/)، [الأسئلة الشائعة: نتائج قليلة](/docs/ar/faq/#لماذا-وجد-البحث-نتائج-قليلة).
