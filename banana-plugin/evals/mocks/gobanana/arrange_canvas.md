---
expect:
  canvasId: string
  layout: [by_direction, by_cluster, masonry, grid, hero]
---

Arranged canvas {{input.canvasId}} with layout {{input.layout}}. Every placed item has a spot. With by_direction, the Art direction row stays above the UI references grid in each section. With by_cluster, each section shows one labeled row per cluster, best first, in this order: layout, components, type, color, motion, art, then other cluster labels (such as category, adjacent, outliers), then Other for items without a cluster. With hero, the first item placed in each section leads at double size.
Web link: https://gobanana-server.maherfayad55.workers.dev/c/{{input.canvasId}}
