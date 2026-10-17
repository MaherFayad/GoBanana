/**
 * Server instructions (MCP `initialize` result), read by agents that use GoBanana as a connector
 * without the plugin's skills (claude.ai, ChatGPT, Cursor). A short version of the plugin's
 * gobanana-explore flow, with the Mobbin check first. Mobbin screens go on the board as hotlinked
 * images linked to their Mobbin page (owner decision, 2026-10-12). Plain words, no em dashes.
 */
export const SERVER_INSTRUCTIONS = [
  "GoBanana bends one page or screen (a launch page, onboarding, a paywall) into wild but buildable directions and fills a moodboard canvas with linked references: one crazy idea over a page or two, not a product redesign.",
  "",
  "First, check whether the user also has a Mobbin connector. If so, search Mobbin for the same page and platform before bend_brief, note the baseline and must keeps, drop directions that only restyle it, and place 2 to 4 Mobbin screens per kept direction with add_to_canvas { type: 'screen', imageUrl: image_url, sourceUrl: mobbin_url, screenId, app, platform, note: 'steal: ...', directionId }. Mobbin screens are hotlinked: never download them or pass them to search_references; one can be a Frankenstein part (cut_parts with its itemId), never the whole page. With no Mobbin connector, skip this and do not mention Mobbin.",
  "",
  "Ask first, with the taste question: explore directions (recommended, no code), explore then draft the picks, or just references. Never go further than the user picked. Taste first: ask the user for 3 to 5 style words or a reference board before bend_brief; never invent them.",
  "Flow: get_canvas (reuse a matching board) or new_canvas; search_references with sweep: true, count 40, the page as query, up to 3 components and 3 adjacent jobs; pass 7 to 10 grounded candidates (4 families or more, never the audience's own tools) to bend_brief with platform, page and count 8; build each direction around its mechanic, and for a Gulf or Arabic brief pass a lens (sadu, talli, qatt-asiri); keep 6 to 8 with diversity.pairsBelow4 empty, one the subtract direction (same job, nothing added); search_references per kept direction, count 24; rate_references (bad for junk, great for 1 to 3); add_to_canvas a Space section and 12 to 18 per direction, each with a cluster and a 'steal:' note, 100 to 150 in all within the item limit; arrange_canvas by_cluster; open_canvas, give the web link, ask which to draft.",
  "Rate and note from the thumbnails, never titles. Look before building: call get_snapshot on the board and each Frankenstein page before writing any screen; if you cannot see images, say so and ask.",
  "Read boards with get_canvas summary: true first. Before export_kit, run reconcile_direction on each kept direction and tell the user about any conflicts it lists. Several kept directions export one folder each: build one at a time.",
  "Always show each reference's source link.",
].join("\n");
