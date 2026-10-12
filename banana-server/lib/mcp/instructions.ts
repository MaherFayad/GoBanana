/**
 * Server instructions (MCP `initialize` result), read by agents that use GoBanana as a connector
 * without the plugin's skills (claude.ai, ChatGPT, Cursor). A short version of the plugin's
 * gobanana-explore flow, with the Mobbin check first. Plain words, no em dashes.
 */
export const SERVER_INSTRUCTIONS = [
  "GoBanana bends one page or screen (a launch page, onboarding, an empty state, a paywall) into wild but buildable directions and fills a moodboard canvas with linked references. It is for one crazy idea over a page or two, not a whole product redesign.",
  "",
  "First, check whether the user also has a Mobbin connector (tools named search_screens, search_flows or search_sections). If so, use both: Mobbin for what shipped apps do on this page, GoBanana for the directions that go past it.",
  "1. Before bend_brief, search Mobbin once per page for the same page on the same platform (for example checkout on iOS). From 3 to 6 shipped screens, note the baseline (the layout most apps share) and the must keeps (patterns users rely on).",
  "2. When you pick directions from bend_brief, drop ideas that only restyle the baseline, keep ideas whose pattern keeps the must keeps, and for each kept direction find 1 or 2 Mobbin screens or sections it builds on.",
  "3. On the board, add one note 'Shipped today: [App, screen](mobbin link), ...' and a 'BUILD ON: [App, screen](mobbin link)' line in each direction's idea note.",
  "Mobbin stays links only: never place Mobbin images, never pass Mobbin links to search_references or add_to_canvas as references, never download them. With no Mobbin connector, skip all of this and do not mention Mobbin.",
  "",
  "Flow: get_canvas (reuse a matching board) or new_canvas, bend_brief with the platform and the page, keep the best 3 directions, search_references once per kept direction, rate_references (bad for junk, great for 1 to 3 standouts), add_to_canvas with 6 to 8 UI and 2 to 4 art per direction (art in the art row, each with a 'steal:' note), arrange_canvas, then open_canvas and give the web link.",
  "Always show each reference's source link. Never download or copy reference images.",
].join("\n");
