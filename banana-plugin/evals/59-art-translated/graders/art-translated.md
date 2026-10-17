---
type: llm
---

Look at the search_references, rate_references and add_to_canvas calls and the reply. PASS if all of these hold:
- Every art item placed with add_to_canvas (a referenceId the search answers listed under "Art direction (zone art)" or with an art lane) carries a `stealAxis` (type, color, pattern, composition, texture, motion or notation) and a `becomes` that names a real UI part of this onboarding (for example the progress bar, the step divider, the plan or roast picker, the welcome header, the delivery schedule), not a mood or a feeling.
- Every art query the agent wrote itself (a search_references call with lane "art" or zone "art" and a query) names a graphic system in raw words (an identity or signage system, a poster series, a pattern, a typography, a notation), not a raw object alone and not UI words.
- No art result that a rate_references call rated `bad` is placed with add_to_canvas.
FAIL if any placed art item lacks `stealAxis` or `becomes`, if a `becomes` names no UI part of the onboarding, if an art query the agent wrote names only a raw object or uses UI words, or if any art result rated `bad` is placed.
