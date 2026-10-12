---
type: llm
---

PASS if the reply says plainly that it could not see the images, that the crops were guessed by role (or by the server), marks the guessed parts in the skeletons, and suggests checking them on the board or telling it where the parts sit. Every part still has a markdown source link.
FAIL if it describes colors, layout or other visual details of the references as if it had seen them, or if it presents the crops as chosen by looking.
