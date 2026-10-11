---
type: llm
---

Look at the add_to_canvas calls. PASS if, within each section, the UI references (ids starting with u: fidelity, taste, bridge, hero) are placed before any inspiration reference (ids starting with i),
and no section gets more than 2 inspiration references.
FAIL if an inspiration reference is placed before the UI references of its section, or if 3 or more inspiration references (i1 to i4) go into one section.
