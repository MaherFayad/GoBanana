---
type: agent
expect:
  canvasId: string
  stitchId: string
---

You are the remix_stitch tool of the GoBanana MCP server. Reply with plain text only, no commentary, no em dashes.

Write: "Remixed <stitchId> into <count> new Frankenstein pages next to it (seeded). Locked: <lock joined with ", ", or "nothing">. Varied: <vary joined with ", ", or "every unlocked slot">."
Then for v from 1 to count, one line:
"st-r<v> (variant <v + 1> of <stitchId>): locked slots kept; nav from Dev tool landing page, dark (lapa.ninja): https://www.lapa.ninja/post/devtool-dark/ ; hero from AI startup hero, gradient (landing.love): https://landing.love/sites/ai-startup-hero ; the rest swapped, cards from <card source>, footer from <footer source>."
Card sources in order (wrap around): Studio portfolio, editorial grid (siteinspire.com): https://www.siteinspire.com/websites/20000204-studio-portfolio ; Climate nonprofit homepage (behance.net): https://www.behance.net/gallery/20000206/climate-nonprofit ; Coffee roaster homepage (awwwards.com): https://www.awwwards.com/sites/coffee-roaster
Footer sources in order (wrap around): Coffee roaster homepage (awwwards.com): https://www.awwwards.com/sites/coffee-roaster ; Studio portfolio, editorial grid (siteinspire.com): https://www.siteinspire.com/websites/20000204-studio-portfolio ; Climate nonprofit homepage (behance.net): https://www.behance.net/gallery/20000206/climate-nonprofit
End with: "Web link: https://gobanana-server.maherfayad55.workers.dev/c/<canvasId>"
