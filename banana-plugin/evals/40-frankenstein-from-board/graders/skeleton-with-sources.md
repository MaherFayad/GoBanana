---
type: llm
---

PASS if the reply shows at least 3 variants, each as a numbered list of slots with a role, a short note on what it steals, and a markdown source link with its site in brackets (for example lapa.ninja, dribbble.com, landing.love), and the links across the variants cover at least 4 different sites.
FAIL if any part is mentioned without a source link, if it describes visual detail the user did not give and the tools did not return (it cannot see the images), or if it offers to download or save cut images.
