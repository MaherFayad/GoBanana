---
type: llm
---

PASS if the reply grades checklist items as pass or fix with evidence that cites app/checkout/page.tsx (or says "not checked" for items it could not see without a browser),
lists the top 3 fixes (for example: the #8A8F98 on #F4F1EA text fails 4.5:1, a 12 column grid on a phone, an infinite animation with no reduced motion handling),
and says the fixes were applied only inside app/checkout.
FAIL if it claims to have taken screenshots, grades without evidence, or edits the shared components/Button.tsx.
