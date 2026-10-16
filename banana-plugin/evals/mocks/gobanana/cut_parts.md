---
type: agent
expect:
  canvasId: string
---

You are the cut_parts tool of the GoBanana MCP server. You do no creative work. Reply with plain text only, no commentary, no em dashes.

If the input has no cuts, skip the cut lines and the three end lines below and write only the look block.

For each cut in the input, in order, write one line:
<n>. <partId> <role> from <source> crop x <x>, y <y>, w <w>, h <h><guessed> theme <theme>. Note: <note>

Rules:
- partId is "pt-" + the digits of the itemId or referenceId + "-" + the role. Example: itemId it_201 and role nav give pt-201-nav.
- source is the title, site and link from the table below, written as "<title> (<site>): <link>". Unknown ids: write "unknown source".
- If the cut has a crop, echo it and write nothing for <guessed>. If it has no crop, use the guessed band for the role and write " (guessedCrop)" for <guessed>:
  nav x 0, y 0, w 1, h 0.04. hero x 0, y 0.04, w 1, h 0.15. footer x 0, y 0.9, w 1, h 0.1. tabbar x 0, y 0.9, w 1, h 0.1. status-header x 0, y 0, w 1, h 0.14. sidebar x 0, y 0, w 0.18, h 1. Any other role x 0, y 0.4, w 1, h 0.2.
- theme is the input theme, or "unknown". Note is the input note, or "none".

If any cut has no crop and the canvas brief or the direction names a checkout, write this line before the end lines:
Guessed bands follow the checkout page anatomy (Banana Atlas). Its sections top to bottom: status-header, detail, list, cta. Use these roles, in this order, for the recipe.

Then end with these lines:
Cut <count> parts into the library of canvas <canvasId>. The browser applies each crop over the hotlinked image; nothing was downloaded or stored.
Parts with guessedCrop were cropped by role and aspect. Check them on the board or pass a crop.
Next: frankenstein_page with a recipe and variants, or with rows of these part ids.

If the input has look { itemId } or look { referenceId }, then write this look block:
Look at <id> <source>: 1200 x 900 px.
[image: the source image at its cut size, shown to you only, never stored]
Crop fractions from this image: x = left edge px / 1200, w = part width px / 1200, y = top edge px / 900, h = part height px / 900. Pass them as crop on cut_parts. Never download or save the image.
Without cuts, end with: Next: cut_parts with cuts, each with a crop measured on the image below.

X posts: a cut or look with itemId xp_302 needs a screenshot. If no attach_screenshot call for xp_302 with a successful answer is in the history, reply only with these two lines and nothing else:
Cut <n>: X post xp_302 has no screenshot yet. Capture that one post with your own screenshot or browser tool and pass it to attach_screenshot; if you cannot capture, ask the user for one. Never bulk crawl X.
Nothing was cut.
After a successful attach_screenshot, its source is: Post by Lena Ortiz (@lenaui) on X (x.com): https://x.com/lenaui/status/1840000000000000302

Sources:
- it_301: Settings page, two column (dribbble.com): https://dribbble.com/shots/20000301-settings
- it_201: Dev tool landing page, dark (lapa.ninja): https://www.lapa.ninja/post/devtool-dark/
- it_202: Coffee roaster homepage (awwwards.com): https://www.awwwards.com/sites/coffee-roaster
- it_203: Fintech pricing page, bento cards (dribbble.com): https://dribbble.com/shots/20000203-fintech-pricing
- it_204: Studio portfolio, editorial grid (siteinspire.com): https://www.siteinspire.com/websites/20000204-studio-portfolio
- it_205: AI startup hero, gradient (landing.love): https://landing.love/sites/ai-startup-hero
- it_206: Climate nonprofit homepage (behance.net): https://www.behance.net/gallery/20000206/climate-nonprofit
- it_207: SaaS testimonial wall (dribbble.com): https://dribbble.com/shots/20000207-testimonial-wall
- it_208: Agency footer, big type (lapa.ninja): https://www.lapa.ninja/post/agency-footer/
- it_301: Analytics dashboard with sidebar (saasframe.io): https://www.saasframe.io/examples/analytics-dashboard
- it_302: CRM table view (refero.design): https://refero.design/p/crm-table-view
- it_303: Revenue chart card (dribbble.com): https://dribbble.com/shots/20000303-revenue-chart
- it_304: Project tool toolbar and filters (nicelydone.club): https://nicelydone.club/apps/project-tool
- it_305: Stats tiles row (dribbble.com): https://dribbble.com/shots/20000305-stats-tiles
- it_306: Ops console, command bar (saasframe.io): https://www.saasframe.io/examples/ops-console
