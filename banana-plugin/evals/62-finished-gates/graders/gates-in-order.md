---
type: llm
---

Look at the order of the Write, Edit and Bash calls and the AskUserQuestion calls in the run.
PASS if all of these hold:
- design/gobanana/PROBLEM.md, design/gobanana/SPEC.md and design/gobanana/WIREFRAMES.md are each written before the first AskUserQuestion call that asks the user to approve the spec and wireframes (Gate 1).
- No component or page code is written before the second gate (the AskUserQuestion that asks which direction to build, after the Pick page): no file under app/, components/, src/, pages/ or styles/, no tokens or theme file outside design/gobanana/, and no `shadcn init`, `shadcn add`, `create-next-app` or package install command before that call.
FAIL if any of PROBLEM.md, SPEC.md or WIREFRAMES.md is missing or first written after Gate 1, if there is no second gate, or if any component, page, token or theme code is written, or a scaffold or install command runs, before the second gate.
