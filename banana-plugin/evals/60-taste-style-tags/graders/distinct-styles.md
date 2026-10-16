---
type: llm
---

PASS if the reply names a style id for each kept direction, taken from the bend_brief "Styles" line (the taste asks for glassmorphism, so glass-frosted goes to the first direction and soft-3d-objects to the second), no two kept directions share a style id, and every reference it shows keeps its source link. On style tags of the references: PASS if the rate_references call carries styles read from thumbnails it could see, or the reply says plainly that it could not see the thumbnails and left the search tags as they were.
FAIL if two kept directions share a style, the reply invents style ids outside the 19-style list, or it claims to have read styles from thumbnails it never saw (tags made up from titles).
