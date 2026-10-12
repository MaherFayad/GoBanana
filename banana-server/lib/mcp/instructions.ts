/**
 * Server instructions (MCP `initialize` result), read by agents that use GoBanana as a connector
 * without the plugin's skills (claude.ai, ChatGPT, Cursor). A short version of the plugin's
 * gobanana-explore flow, with the Mobbin check first. Mobbin screens go on the board as hotlinked
 * images linked to their Mobbin page (owner decision, 2026-10-12). Plain words, no em dashes.
 */
export const SERVER_INSTRUCTIONS = [
  "GoBanana bends one page or screen (a launch page, onboarding, an empty state, a paywall) into wild but buildable directions and fills a moodboard canvas with linked references. It is for one crazy idea over a page or two, not a whole product redesign.",
  "",
  "First, check whether the user also has a Mobbin connector (tools named search_screens, search_flows or search_sections). If so, use both: Mobbin for what shipped apps do on this page, GoBanana for the directions that go past it.",
  "1. Before bend_brief, search Mobbin once per page for the same page on the same platform (for example checkout on iOS). From 3 to 6 shipped screens, note the baseline (the layout most apps share) and the must keeps (patterns users rely on).",
  "2. When you pick directions from bend_brief, drop ideas that only restyle the baseline, keep ideas whose pattern keeps the must keeps, and for each kept direction find 2 to 4 Mobbin screens it builds on (wild ones, or ones that fit it).",
  "3. Place them in that direction's UI grid with add_to_canvas { type: 'screen', imageUrl: image_url, sourceUrl: mobbin_url, app, platform, note: 'steal: ...', directionId }. Add one note 'Shipped today: [App, screen](mobbin link), ...' and a 'BUILD ON: [App, screen](mobbin link)' line in each idea note.",
  "Mobbin screens are hotlinked from the connector's image_url and always link to their Mobbin page: never download them, never pass them to search_references. A wild or fitting one can be a Frankenstein part (cut_parts with its itemId, for example a real pay bar under a wild hero), never the whole page. With no Mobbin connector, skip all of this and do not mention Mobbin.",
  "",
  "Taste first: ask the user for 3 to 5 style words or a reference board before bend_brief; never invent them. Build each kept direction around its mechanic, and for a Gulf or Arabic brief pass a lens (sadu, talli, qatt-asiri).",
  "Flow: get_canvas (reuse a matching board) or new_canvas, bend_brief with the platform and the page, keep the best 3 directions, search_references once per kept direction, rate_references (bad for junk, great for 1 to 3 standouts), add_to_canvas with 6 to 8 UI and 2 to 4 art per direction (art in the art row, each with a 'steal:' note), arrange_canvas, then open_canvas and give the web link.",
  "Always show each reference's source link. Never download or copy reference images.",
].join("\n");
