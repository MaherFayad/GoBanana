---
title: ربط خادم MCP
description: إضافة خادم GoBanana إلى تطبيقات Claude أو Claude Code أو ChatGPT أو Cursor.
---

اربط وكيلك بعنوان الخادم التالي. وتضيف إضافة Claude المهارات فوق ذلك.

```text
https://gobanana-server.maherfayad55.workers.dev/api/mcp
```

الصقه حيث يطلب وكيلك موصلا مخصصا أو خادم MCP. تسجل الدخول عبر OAuth في المرة الأولى، ولا يوجد مفتاح API.

## تطبيقات Claude

1. افتح **الإعدادات** ثم **الموصلات**.
2. اختر **إضافة موصل مخصص**.
3. الصق عنوان الخادم واختر **إضافة**، ثم سجل الدخول عند الطلب.

## Claude Code

1. شغل هذا الأمر في الطرفية.

   ```bash
   claude mcp add --transport http gobanana https://gobanana-server.maherfayad55.workers.dev/api/mcp
   ```

2. شغل Claude Code ثم نفذ `/mcp` لتسجيل الدخول.

للحصول على المهارات أيضا، ثبت الإضافة بدلا من ذلك. راجع [تثبيت الإضافة في Claude](/docs/ar/start/install/).

## ChatGPT

1. افتح **الإعدادات** ثم **التطبيقات والموصلات**.
2. من **الإعدادات المتقدمة**، فعل **وضع المطور**.
3. اختر **إنشاء**، والصق عنوان الخادم، ثم سجل الدخول عند الطلب.

## Cursor

1. افتح الملف `~/.cursor/mcp.json` أو أنشئه.
2. أضف هذه الإعدادات واحفظ الملف.

   ```json
   {
     "mcpServers": {
       "gobanana": {
         "url": "https://gobanana-server.maherfayad55.workers.dev/api/mcp"
       }
     }
   }
   ```

3. سجل الدخول عندما يطلب Cursor ذلك.

## التحقق من عمله

اطلب من وكيلك تشغيل الأداة `ping` من GoBanana. يبدو الرد السليم هكذا:

```text
Connected to GoBanana as you@example.com.
```

إذا أخبرك أنك لم تسجل الدخول، فأعد ربط الخادم وسجل الدخول مرة أخرى. راجع [حل المشكلات](/docs/ar/guides/troubleshooting/).
