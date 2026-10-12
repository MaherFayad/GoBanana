---
title: ping
description: تأكد من أن GoBanana متصل واعرف الحساب الذي سجلت الدخول به.
---

| الخطة | الحصة | يغير البيانات | التلميحات |
| --- | --- | --- | --- |
| كل الخطط | لا شيء | لا | للقراءة فقط، idempotent |

## المدخلات

لا شيء.

## مثال على الاستدعاء

```json
{ "name": "ping", "arguments": {} }
```

## مثال على المخرجات

```text
Connected to GoBanana as you@example.com.
```

```json title="structuredContent"
{ "ok": true, "app": "GoBanana", "email": "you@example.com" }
```

## الرسائل

| الرسالة | المعنى |
| --- | --- |
| "You are not signed in. Reconnect to sign in again." | لا يوجد رمز صالح. سجل الدخول مرة أخرى في عميلك |
| "You are signed in, but GoBanana could not load your email yet. Try again in a minute." | نجح تسجيل الدخول الأول، لكن جلب بريدك الإلكتروني لم يكتمل بعد |

راجع [تأكد من أنه يعمل](/docs/ar/setup/check/).
