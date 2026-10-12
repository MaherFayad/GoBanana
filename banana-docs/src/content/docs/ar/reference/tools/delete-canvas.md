---
title: delete_canvas
description: يحذف لوحة نهائيا، بأقسامها وعناصرها ودرجها واتجاهاتها ورابط عرضها. يحتاج confirm بقيمة true، وموافقة صريحة من المستخدم أولا.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط. في المجانية يحرر خانة لوحة | لا شيء | نعم، **لا يمكن التراجع عنه** | destructive، idempotent |

:::danger[اسأل أولا]
وصف الأداة نفسه يطلب من الوكلاء أن يسألوك أولا، وأن يسموا اللوحة، وألا يستدعوها إلا بعد أن توافق. مهارات GoBanana لا تختار أبدا لوحة لتحذفها من تلقاء نفسها. لا تضع `delete_canvas` في أي قائمة "always allow".
:::

## المدخلات

| الاسم | النوع | مطلوب | الحدود | ماذا يفعل |
| --- | --- | --- | --- | --- |
| `canvasId` | string | نعم | من 1 إلى 100 حرف | اللوحة المراد حذفها |
| `confirm` | `true` | نعم | يجب أن يكون `true` بالضبط | لا تضبطه إلا بعد أن يوافق المستخدم على حذف هذه اللوحة |

## ما الذي يحذف

الأقسام، والعناصر، والدرج، والاتجاهات، ومكتبة الأجزاء، وصفحات فرانكنشتاين، ورابط المشاركة. والصور التي رفعتها إلى اللوحة تحذف أيضا، إلا إذا كانت لوحة أخرى من لوحاتك تعرضها.

## مثال على الاستدعاء

```json
{ "name": "delete_canvas", "arguments": { "canvasId": "7be0c1aa-…", "confirm": true } }
```

## مثال على المخرجات

```text
Deleted canvas "Frosted checkout" for good.
```

```json title="structuredContent"
{ "deleted": true, "canvasId": "7be0c1aa-…", "title": "Frosted checkout", "uploadsDeleted": 0 }
```

## الرسائل

| الرسالة | المعنى |
| --- | --- |
| "Nothing was deleted. Ask the user to confirm, then call again with confirm: true." | `confirm` مفقود أو ليس `true` |
| "That canvas was not found. It may already be deleted; get_canvas lists your canvases." | معرف خاطئ، أو اللوحة حذفت من قبل |
| "Nothing was deleted: image storage is not available right now. Try again in a minute." | تعذر حذف الملفات المرفوعة، فلم يحذف أي شيء |
