---
title: FAQ
description: Straight answers to the questions designers and developers ask about GoBanana.
---

## The product

### Is it AI generated?

No. GoBanana makes no AI calls and generates no images. The server bends briefs with fixed word lists and templates (the same input gives the same directions) and finds real, published work through web image search. All judgment, like which ideas to keep and which results are junk, happens in **your own agent**, under your agent's terms.

### Then what does my agent add?

The thinking. It shapes your brief, pins the platform and page, drops ideas with no UI path, rates every search result, writes the "steal:" notes, cuts Frankenstein parts when it can see the images, and writes files into your repo. The [skills](/docs/reference/skills/) tell it how.

### Can I use GoBanana to redesign my whole product?

It is built not to. GoBanana is for one wild idea over a page or two. Ask for the whole product and the agent asks "Where should the weirdness go?". Every export is page scoped and inherits your design system. If you really want a direction to become your system, ask for it in so many words; the export then uses `scope: "system"`. See [Hand off](/docs/guides/handoff/#scope-one-page-not-your-system).

### Why does the agent ask where the weirdness should go?

Weirdness pays on launch pages, onboarding, empty states and 404s, and costs on checkout and daily tables. The question keeps the idea where it helps. See [Where weirdness pays off](/docs/guides/where-weirdness-pays/).

### Why only UI and art direction? Why not stock photos or 3D?

The board has two zones on purpose. **UI references** are what you build from: real screens and components for your platform. **Art direction** is the wild idea as raw images (the weave, the receipt, the poster). Earlier versions mixed raw inspiration into the UI results and about 60% of a board was off topic; keeping them apart fixed that. Stock photography, 3D model sites and illustration marketplaces are not sources.

### Is it deterministic?

Bending is: the same brief, wildness, platform, pages, moves and lens give the same directions with the same ids. Your own ratings and your last 3 boards shift which ingredients come up, so you get variety across boards. Search results depend on the live web and change over time.

## Images and rights

### Do you store the images?

No. GoBanana keeps the image URL, the source page link, the title, the size and the site. The image loads in your browser straight from the site that hosts it, so that site may see your IP address under its own policy. For palettes, the server reads a small thumbnail **in memory** to compute colors and drops it at once. Images you **upload** yourself (Pro) are stored for you; those are yours.

### Can I use the references commercially?

Not as assets. The images belong to their owners, and GoBanana only links to them. Use them as inspiration: take the structure and the moves, never the pixels. Before you use any image beyond inspiration, check its license with the owner. The exports and skills tell coding agents never to copy reference images into your repo. See the [terms](https://gobanana-server.maherfayad55.workers.dev/en/terms).

### Are Frankenstein pages copies of other sites?

They are sketches that point at other people's work: every part is a crop rectangle over the original image, with its link. FRANKENSTEIN.md tells your coding agent to take the structure, not the pixels, and to unify the page into one theme with your own content.

### Why did a reference disappear?

One of these:

1. **Takedown.** The owner asked, and the link or the whole domain is now blocked everywhere in GoBanana, including shared boards, from the next load.
2. **You or your agent rated it `bad`.** It left the tray and will not come back in your searches.
3. **Its direction was dropped** with `rate_directions`. The section, its items and its tray results left the board.
4. **The source removed it** or blocks hotlinking. The tile turns into a link card.
5. **It sat unplaced in the tray** for over 30 days; unplaced references are purged.

### Light and dark mixed on a Frankenstein page: is that a bug?

No. A dark nav over a light hero is fine for ideas. To judge it as one page, switch the frame to the **Even** view (dark parts inverted) or **Wireframe**. A thin dark sliver between two light bands usually reads as a seam; the agent swaps those.

## Using it

### Which clients work?

Any MCP client with remote HTTP servers and OAuth: Claude Code, Claude.ai, Claude Desktop, ChatGPT (developer mode), Cursor, VS Code with Copilot, Windsurf and Codex have setup pages. Stdio only clients can use a bridge. The **skills** only load in Claude (Claude Code, and Claude.ai or Cowork through plugins). The **inline canvas** shows in clients with MCP Apps, such as Claude.ai and Claude Desktop. See [Set up](/docs/setup/overview/).

### Does it work offline?

No. The server, sign in, search and the images all live on the internet. Exported files are plain text in your repo, so building from them works offline once they are written.

### Is there an API key or a REST API?

No. GoBanana is used through its MCP tools only, signed in with OAuth. The terms do not allow other automated access.

### Why did a direction get dropped?

The agent bends 8 ideas and keeps one only if it gives your page a concrete UI move on your platform, finds at least 6 usable UI references after the audit, and is not a near duplicate. Each drop is recorded with a reason: `no_ui_path`, `no_usable_refs`, `off_brief`, `duplicate_idea` or `too_literal`. The reply sums them up in one line. Ask "show me the dropped ideas" if you want them back; they are not on the board, but the agent still has them in the chat.

### Why did search find so few results?

Common causes:

- **A narrow lane.** The `bridge` lane (the idea already applied to UI) is often empty by nature.
- **Strict filters.** List pages, UI kits, templates, shops, wrong platform titles and more than 2 results per studio are dropped, so 12 asked can become 6 kept.
- **Already seen.** Results already on the same board, and anything you rated `bad`, are skipped.
- **Takedowns.** Blocked domains never show.
- **Rare words.** Very literal ideas ("Uzbek suzani checkout") have few UI matches.

What helps: the agent retries a lane that is over 40% bad with plainer words that name the screen or component ("film strip seat picker ui"), at most twice. You can add taste words that galleries use (bento grid, dark mode, editorial), raise `count` up to 24, or name `sources`.

### Can I add a gallery source?

Not yourself. Sources are a list on the server, added after a live check of how many results are real item pages. Suggest one through the contact on the [privacy page](https://gobanana-server.maherfayad55.workers.dev/en/privacy). Through `sources` you can limit a search to listed sites. See [Sources](/docs/reference/sources/).

### Does it work in Arabic and right to left?

Partly, and on purpose. Arabic briefs are understood: platform words in Arabic are detected, an Arabic brief adds a `locale` lane for Arabic UI, there are Gulf and Arabic culture lenses (Sadu, Najdi, Kufic, Mashrabiya, Desert modern), and the asset kit has 7 Arabic and Latin font pairings. The website has an Arabic version. These docs have an Arabic home page; the rest falls back to English for now. The exported files are written in English. Arabic copy on the site still needs a native reader's review, as the repo notes.

### Is it accessible?

The canvas targets WCAG 2.2 AA: every drag has a keyboard route, slots and tiles have labels, the crop editor has number fields, targets are at least 24px, and reduced motion is respected. Palettes tag every pair `ship` (4.5:1 for text) or `explore`, exports say only `ship` colors carry text, and `gobanana-critique` grades contrast, target size, focus and reduced motion strictly. See [Keyboard shortcuts](/docs/reference/shortcuts/).

### Does it work with Figma?

Yes, through your own Figma MCP connector: "put this board in FigJam" rebuilds the board there from the `figjam_spec` export (Pro), with links under every image. GoBanana has no Figma plugin of its own.

### Can an agent delete my boards without asking?

The `delete_canvas` tool refuses without `confirm: true`, its description tells agents to ask first and name the board, and the GoBanana skills only call it after your explicit yes to a named board. An agent without the skills could still misuse it, so keep it out of "always allow" lists.

## Accounts, data and money

### What data do you keep?

Your email and sign in id, your boards (titles, briefs, notes, layout, palettes, links and titles of references), uploads on Pro, monthly usage counts, your plan and Paddle customer id, share tokens, your ratings, and takedown requests if you send one. Search terms made from your brief go to the search provider (Serper) without your account details. No data is sold, used for ads, or used to train AI models. Full notice: [privacy](https://gobanana-server.maherfayad55.workers.dev/en/privacy).

### Are my ratings shared with other users?

Your blocklist is yours alone. Ratings also feed shared learning about which search wordings work, but a wording only influences other people after at least 3 different users rated it, and nobody sees who rated what.

### How do I delete my account?

On the web, `/en/account`, then **Delete account**. Your canvases, references, palettes, uploads, share links and usage records are deleted for good. Your sign in record at WorkOS and billing records at Paddle stay. Cancel any subscription in Paddle first.

### Can my team use it?

GoBanana is for individuals. There are no team plans, and none are planned: each person uses their own account, as the [terms](https://gobanana-server.maherfayad55.workers.dev/en/terms#plans) say. A team can still work side by side: Pro share links give a view only board, a committed `.mcp.json` or `.cursor/mcp.json` gives everyone the server, and exported files in the repo work for the whole team.

### What does it cost, and can I get a refund?

Free is $0. Pro is $5 a month or $39 a year, Founding is $29 once (first 100 buyers). During the beta every account gets Pro limits and nothing is charged. You can get a **full refund within 14 days of your first payment**. Refunds are handled by Paddle, the payment provider and Merchant of Record, which also handles tax and invoices. See the [terms](https://gobanana-server.maherfayad55.workers.dev/en/terms#plans) and [Plans and limits](/docs/reference/plans/).

### What are the limits?

Free: 30 searches a month, 3 boards, 40 items per board, 5 export formats. Pro: 300 searches, unlimited boards, 300 items, share links, 1 GB uploads, every format. Bending, rating, Frankenstein and palettes have no quota. Searches reset on the 1st of the month, UTC.

### Who owns my boards and exports?

You own your canvases, notes and uploads. Exported files are text generated for your project; the reference images they link to stay their owners'.

### What happens to my boards if GoBanana closes?

The terms promise at least 30 days notice so you can export your work.

### Can I self host GoBanana?

Not today. Self hosting may come later; there is no date. The plugin is MIT licensed.
