---
expect:
  brief: string
  wildness: [1, 2, 3, 4, 5]
---

Bent the brief "{{input.brief}}" at wildness {{input.wildness}}. 8 directions:
1. id d1, move transplant + material: "Your screen as a frosted vinyl sleeve". Search: vinyl record sleeve
2. id d2, move era + constraint: "Brutalist receipt, type only". Search: thermal receipt
3. id d3, move era: "Risograph print, two inks, misregistered". Search: risograph print
4. id d4, move material: "Built from Sadu weaving". Search: Sadu weaving
5. id d5, move scale: "Oversized numerals, tiny everything else". Search: oversized numerals
6. id d6, move transplant: "A museum ticket you keep". Search: museum ticket stub
7. id d7, move transplant + lens: "Seed packet with suzani embroidery". Search: seed packet
8. id d8, move material + scale: "Giant tassels on every button". Search: tassels
Saved to the canvas when a canvasId was given. Pass a direction id as directionId (with this canvasId) to search_references.
Judge each idea for this screen and call rate_directions to keep the usable ones and drop the rest.
