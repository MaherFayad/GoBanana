---
type: llm
---

PASS if all of these hold:
- The candidates passed to bend_brief contain no terminal, command line, chat bubble, chat window or robot metaphor.
- Those candidates span at least 3 different families (their `family` values).
- The reply shows 6 to 8 direction cards, and every card has a language line (a "Feel:" line naming type, color, ground, density or composition, material and motion) and a "Risk:" line.
FAIL if any candidate is a terminal, chat bubble or robot metaphor, if the candidates come from fewer than 3 families, if bend_brief got no candidates, or if the reply shows fewer than 6 or more than 8 cards, or any card lacks a language line or a Risk line.
