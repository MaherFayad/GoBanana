---
title: attach_screenshot
description: أرفق لقطة شاشة لمنشور X واحد على اللوحة، يصوّرها وكيلك نفسه، عشان يقدر cut_parts وصفحات Frankenstein يستخدمونها. تنحفظ كصورة مرفوعة لك.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| Pro (وكل الحسابات وقت النسخة التجريبية) | مساحة رفعك: 10 ميجا لكل صورة، و1 جيجا في Pro، و50 ميجا في النسخة التجريبية | نعم | |

منشور X على اللوحة ما له صورة يقدر GoBanana يقص منها: GoBanana ما يجلب ولا يصوّر شي من X. وكيلك نفسه يصوّر لقطة شاشة لهذا المنشور بالذات بأداة اللقطات أو المتصفح حقته، ويمررها هنا. تنحفظ كصورة مرفوعة لك، بنفس فحوصات زر الرفع (الخطة والحجم ومساحتك ونوع الملف من محتواه)، وترتبط بالمنشور. بعدها [cut_parts](/docs/ar/reference/tools/cut-parts/) يقص منها مثل أي صورة، وكل جزء يحتفظ برابط المنشور وذكر صاحبه "Post by Name (@handle) on X".

إذا ما قدر الوكيل يصوّر المنشور، يطلب منك لقطة شاشة. وما يزحف على X أبدا.

## المدخلات

| الاسم | النوع | مطلوب | الحدود | وش يسوي |
| --- | --- | --- | --- | --- |
| `canvasId` | string | نعم | من 1 إلى 100 حرف | اللوحة |
| `itemId` | string | نعم | عنصر منشور X على اللوحة | المنشور اللي تعرضه اللقطة |
| `image` | string | نعم | base64 بصيغة PNG أو JPEG أو WebP، حتى 10 ميجا، وتقبل البادئة `data:image/...;base64,` | لقطة الشاشة |
| `sourceUrl` | string | نعم | `x.com/<handle>/status/<id>` | رابط المنشور، ولازم يكون نفس منشور العنصر |

## مثال على الاستدعاء

```json
{
  "name": "attach_screenshot",
  "arguments": {
    "canvasId": "c3f1a0d2-6b1e-4d8a-9f4b-0a1b2c3d4e5f",
    "itemId": "xp_12",
    "image": "data:image/png;base64,iVBORw0KGgo…",
    "sourceUrl": "https://x.com/lenaui/status/1840000000000000302"
  }
}
```

## النتيجة

```text
Attached your screenshot (1200 x 1500 px) to X post xp_12: Post by Lena Ortiz (@lenaui) on X https://x.com/lenaui/status/1840000000000000302. Next: cut_parts { cuts: [{ itemId: "xp_12", role, crop }] } with crops measured on your screenshot. Every part keeps the post link and credit.
```

لقطة ثانية لنفس المنشور تحل محل الأولى، وتنحذف الأولى إلا إذا فيه جزء لسا يستخدمها.

## الأخطاء

- العنصر مو منشور X، أو المنشور غير: الرسالة تقول أي منشور هو العنصر.
- الملف مو PNG ولا JPEG ولا WebP (وGIF بعد مرفوض)، أو مو base64: "image must be a base64 PNG, JPEG or WebP screenshot, up to 10 MB."
- أكبر من 10 ميجا، أو ما عندك خطة فيها رفع، أو مساحتك مليانة: نفس الرسائل الواضحة حقت زر الرفع.
