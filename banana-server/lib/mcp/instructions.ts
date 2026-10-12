/**
 * Server instructions (MCP `initialize` result), read by agents that use GoBanana as a connector
 * without the plugin's skills (claude.ai, ChatGPT, Cursor). A short version of the plugin's
 * gobanana-explore flow, with the Mobbin check first. Mobbin screens go on the board as hotlinked
 * images linked to their Mobbin page (owner decision, 2026-10-12). Plain words, no em dashes.
 */
export const SERVER_INSTRUCTIONS = [
  "GoBanana bends one page or screen (a launch page, onboarding, a paywall) into wild but buildable directions and fills a moodboard canvas with linked references: one crazy idea over a page or two, not a product redesign.",
  "",
  "First, check whether the user also has a Mobbin connector (search_screens, search_flows, search_sections). If so, use both: Mobbin for what shipped apps do, GoBanana for directions that go past it.",
  "1. Before bend_brief, search Mobbin for the same page on the same platform. From 3 to 6 shipped screens, note the baseline (the layout most apps share) and the must keeps.",
  "2. Drop directions that only restyle the baseline or break a must keep; for each kept one find 2 to 4 Mobbin screens it builds on (wild ones, or ones that fit).",
  "3. Place them in that direction's UI grid with add_to_canvas { type: 'screen', imageUrl: image_url, sourceUrl: mobbin_url, screenId, app, platform, note: 'steal: ...', directionId }, and add a 'BUILD ON: [App, screen](mobbin link)' line in each idea note.",
  "Mobbin screens are hotlinked and link to their Mobbin page: never download them or pass them to search_references. A wild or fitting one can be a Frankenstein part (cut_parts with its itemId), never the whole page. With no Mobbin connector, skip this and do not mention Mobbin.",
  "",
  "Taste first: ask the user for 3 to 5 style words or a reference board before bend_brief; never invent them. Build each kept direction around its mechanic, and for a Gulf or Arabic brief pass a lens (sadu, talli, qatt-asiri).",
  "Flow: get_canvas (reuse a matching board) or new_canvas, bend_brief with the platform and the page, keep the best 3 directions, search_references once per kept direction, rate_references (bad for junk, great for 1 to 3 standouts), add_to_canvas with 6 to 8 UI and 2 to 4 art per direction (each art with a 'steal:' note), arrange_canvas, then open_canvas and give the web link.",
  "Look at the thumbnails results return and rate and note from them, never from titles. Look before building: call get_snapshot on the board and each Frankenstein page before writing any screen; if you cannot see images, say so and ask.",
  "Read boards with get_canvas summary: true first. Before export_kit, run reconcile_direction on each kept direction so its spec matches the board, and tell the user about any conflicts it lists. Several kept directions export one folder each: build one at a time.",
  "Always show each reference's source link.",
].join("\n");
