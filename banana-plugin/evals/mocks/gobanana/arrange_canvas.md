---
expect:
  canvasId: string
  layout: [spread, by_direction, masonry, grid, hero]
---

Arranged canvas {{input.canvasId}} with layout {{input.layout}}. Every placed item has a spot. With spread, each section is one row: the first art item large on the left, notes beside it, the UI references grid on the right and swatches under it; sections stack top to bottom with Frankenstein pages last. With by_direction, the Art direction row stays above the UI references grid. With hero, the first item placed in each section leads at double size.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/{{input.canvasId}}
