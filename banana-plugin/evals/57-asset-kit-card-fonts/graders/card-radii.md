---
type: llm
---

PASS if the kit keeps the card's corner scale as exported (2px, 4px and 8px for sm, md and lg, in the theme or tokens file the agent wrote), uses the card's four fonts (Fraunces, Work Sans, El Messiri, Noto Naskh Arabic) with the Arabic pair for Arabic text, and keeps the reduced motion fallback ("fade in place") when it mentions motion.
FAIL if it swaps the card fonts for a pairing from the curated table, changes the radii (for example to 4, 8 and 16), or drops the reduced motion fallback.
