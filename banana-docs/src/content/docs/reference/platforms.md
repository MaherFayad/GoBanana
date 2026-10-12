---
title: Platforms
description: How GoBanana detects the platform from a brief, and what each platform changes in directions, searches, exports and critique.
---

The platform is one of `mobile`, `tablet`, `website`, `webapp` or `any`. The skills always pass it to `bend_brief`; the server detects one only when it is left out. Source: `banana-server/lib/platform.ts`.

## Detection rules

The brief is lowercased and checked against these groups **in order**. The first match wins.

| Order | Platform | Words (English and Arabic) |
| --- | --- | --- |
| 0 | `website` | "mobile web", "responsive website", "responsive site" |
| 1 | `tablet` | ipad, ipados, tablet; آيباد، ايباد، تابلت، جهاز لوحي |
| 2 | `mobile` | iphone, ios, android, smartphone, phone, mobile app, apple watch, smart watch, watchos, wear os, watch app; آيفون، أندرويد، جوال، موبايل، هاتف |
| 3 | `website` | landing page, website, home page, marketing site or page, portfolio site, personal site, blog, pricing page, launch page, campaign site or page, microsite; صفحة هبوط، موقع |
| 4 | `webapp` | dashboard, web app, saas, admin, admin panel, console, crm, erp, analytics tool, back office, internal tool, cms, b2b; لوحة تحكم، لوحة معلومات |
| 5 | `mobile` | mobile, app, apps, app screen, home screen, lock screen; تطبيق |
| 6 | `website` | site, web page, page; صفحة |
| none | `any` | |

So "dashboard app on iPhone" is mobile (device words win), and "pricing page for a SaaS tool" is a website (marketing pages beat product words).

## What each platform changes

| | `mobile` | `tablet` | `website` | `webapp` | `any` |
| --- | --- | --- | --- | --- | --- |
| Grid | 4 columns, 16px margins, thumb zone, tab bar or bottom sheet | 8 columns, 24px margins, split view or sidebar in landscape | 12 columns, fluid type, a scroll story with one clear first action | Sidebar shell, 12 column content, dense tables, full keyboard | A clear grid, one focal point |
| Density | One idea per screen, 44pt targets, 8pt rhythm | Two panes at most, 44pt targets | Airy sections, body under 75 characters | Dense, 8px rhythm, compact tables | Comfortable, 8px rhythm |
| Display / body | 34px / 17px | 40px / 17px | clamp(48px, 8vw, 120px) / 18px | 28px / 14px | 40px / 16px |
| Motion | Under 300ms | Under 300ms | Subtle scroll reveals, never blocking reading | Never move data while someone reads it | Short |
| Avoid | Targets under 44pt, hover-only detail, body under 16px, wide sideways tables | Targets under 44pt, a stretched phone layout | No clear first action, lines over 75 characters, scroll jacking | Decoration in tables, motion on live numbers, low contrast dense text, keyboard gaps | Text under 4.5:1, mouse-only controls |
| Search wording | "app ui" | "ipad app ui" | "website" | "dashboard ui" | "ui design" |
| UI galleries | ScreensDesign, Figma Community | ScreensDesign, Figma Community | Lapa Ninja, Siteinspire, Awwwards and more | Refero, SaaSFrame, Nicelydone, 21st.dev | By style words |
| Frankenstein frame | 390px | 834px | 1440px | 1440px | (website) |
| Critique sizes | 390x844 | 834x1194 | 1440x900 and 390x844 | 1440x900 | 1440x900 and 390x844 |

Some bend ideas are banned per platform, so a phone never gets "a strict 12 column grid", "everything rotated 90 degrees" or type at 300 points, and a web app never gets "one sentence per screen" or "a single giant number per screen".
